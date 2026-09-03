import { originOf, summarizeEffects, validateAdapter } from '@liha/adapter-schema';
import type { AdapterHealth } from '@liha/adapter-schema';
import { DEFAULT_POLICY } from '@liha/adapter-runtime';
import type {
  AdapterRecord,
  CatalogEntry,
  ExtensionMessage,
  PopupState,
  RecordingCommandOutcome,
  StoreStateResponse,
} from '@liha/shared';
import { ext } from '../platform';
import {
  findEnabledForUrl,
  installAdapter,
  readCatalogue,
  removeAdapter,
  setEnabled,
  setPolicy,
  type InstallOutcome,
} from './adapters';
import { decide, getPendingRequest, handleWindowClosed, requestConfirmation } from './confirmations';
import { injectAdapter, readHealth, readRuntimeStatus, uninstallFromTab } from './injection';
import { createRecordingStore } from './recording';

/**
 * Origins actually covered by this build's static content scripts. Reading the
 * built manifest matters: release builds intentionally omit development
 * origins that remain in the shared source config. Everything else needs an
 * explicitly granted optional host permission plus a dynamically registered
 * content script, so installing an adapter never silently widens reach.
 */
const STATIC_ORIGINS = (ext.runtime.getManifest().host_permissions ?? []).flatMap((pattern: string) => {
  try {
    return [new URL(pattern.replace(/\/\*$/, '')).origin];
  } catch {
    return [];
  }
});

const DYNAMIC_SCRIPT_ID = 'liha-dynamic-bridge';
const recordingStore = createRecordingStore(ext.storage.session);

/* -------------------------------------------------------------------------- */
/* Host permissions and dynamic content scripts                                */
/* -------------------------------------------------------------------------- */

async function grantedOrigins(catalogue: readonly AdapterRecord[]): Promise<string[]> {
  const extra = new Set<string>();
  for (const record of catalogue) {
    for (const origin of record.adapter.origins) {
      if (!STATIC_ORIGINS.includes(origin)) extra.add(`${origin}/*`);
    }
  }
  const patterns = [...extra];
  if (patterns.length === 0) return [];
  const allowed: string[] = [];
  for (const pattern of patterns) {
    try {
      if (await ext.permissions.contains({ origins: [pattern] })) allowed.push(pattern);
    } catch {
      /* pattern not requestable */
    }
  }
  return allowed;
}

/**
 * Keeps the dynamic content script registration in step with the adapters the
 * user has installed *and* granted host access to. Registering only granted
 * origins means a revoked permission stops the adapter reaching that site.
 */
async function syncDynamicContentScripts(): Promise<void> {
  if (typeof ext.scripting.registerContentScripts !== 'function') return;
  const catalogue = await readCatalogue();
  const matches = await grantedOrigins(catalogue);
  try {
    const existing = await ext.scripting.getRegisteredContentScripts({ ids: [DYNAMIC_SCRIPT_ID] });
    if (existing.length > 0) await ext.scripting.unregisterContentScripts({ ids: [DYNAMIC_SCRIPT_ID] });
  } catch {
    /* nothing registered yet */
  }
  if (matches.length === 0) return;
  try {
    await ext.scripting.registerContentScripts([
      {
        id: DYNAMIC_SCRIPT_ID,
        matches,
        js: ['content/bridge.js'],
        runAt: 'document_start',
        world: 'ISOLATED',
        allFrames: false,
        persistAcrossSessions: true,
      },
    ]);
  } catch (error) {
    console.warn('[liha] could not register dynamic content scripts', error);
  }

  await injectBridgeIntoOpenTabs(matches);
}

/*
 * A registration only reaches documents that load after it.
 *
 * Granting a new origin therefore left every tab already open on it without the
 * bridge: READ tools still worked, because the MAIN-world runtime is injected
 * on demand, but the confirmation channel lives in the content script — so a
 * DESTRUCTIVE call sat there and timed out, and reloading the page fixed it.
 * That is not a state anyone should have to discover.
 */
async function injectBridgeIntoOpenTabs(matches: string[]): Promise<void> {
  if (matches.length === 0 || typeof ext.tabs?.query !== 'function') return;
  let tabs: Array<{ id?: number }> = [];
  try {
    tabs = await ext.tabs.query({ url: matches });
  } catch (error) {
    console.warn('[liha] could not list tabs for bridge injection', error);
    return;
  }
  await Promise.all(
    tabs
      .filter((tab): tab is { id: number } => typeof tab.id === 'number')
      .map(async (tab) => {
        try {
          await ext.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/bridge.js'],
            world: 'ISOLATED',
          });
        } catch {
          /* The tab may have navigated away, or be one we cannot touch. Either
           * way the next load gets the registered script. */
        }
      }),
  );
}

/**
 * Makes the recorder available on a site that has no adapter yet.
 *
 * Opening the toolbar popup grants `activeTab`, which is deliberately used
 * instead of persistent host access: recording can reach only the tab the
 * person just chose, and a cross-origin navigation revokes the grant. Sites
 * with an installed adapter already have the bridge and take the fast path.
 */
async function enableRecorderOnTab(tabId: number): Promise<boolean> {
  try {
    await ext.tabs.sendMessage(tabId, { type: 'liha/recorder-mode', active: true });
    return true;
  } catch {
    /* This is the expected path for a site with no adapter yet. */
  }

  if (typeof ext.scripting.executeScript !== 'function') return false;

  try {
    await ext.scripting.executeScript({
      target: { tabId },
      files: ['content/bridge.js'],
      world: 'ISOLATED',
    });
    await ext.tabs.sendMessage(tabId, { type: 'liha/recorder-mode', active: true });
    return true;
  } catch (error) {
    console.warn('[liha] could not start the recorder on this page', error);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Injection lifecycle                                                          */
/* -------------------------------------------------------------------------- */

async function handlePageReady(href: string, tabId: number, frameId: number): Promise<void> {
  if (frameId === 0) {
    const recording = await recordingStore.resumePage(tabId, href);
    if (recording === 'resumed') {
      // The new document has registered its message listener before announcing
      // readiness, so this also resumes after a normal reload/navigation.
      await ext.tabs.sendMessage(tabId, { type: 'liha/recorder-mode', active: true }).catch(() => undefined);
    } else if (recording === 'origin-mismatch') {
      // A recording may never silently expand to an origin the person did not
      // approve. Keep the partial take for Studio and stop listening.
      await recordingStore.stop();
    }
  }

  const catalogue = await readCatalogue();
  // Every enabled adapter for this origin, not just the first: a site can have
  // an official adapter and a community one, and disabling either must not
  // silently withhold the other.
  for (const record of findEnabledForUrl(catalogue, href)) {
    try {
      const result = await injectAdapter(tabId, frameId, record.adapter, record.policy, record.source);
      if (!result.ok) console.warn(`[liha] ${record.adapter.id} not installed:`, result.reason);
    } catch (error) {
      console.error(`[liha] injecting ${record.adapter.id} failed`, error);
    }
  }
}

async function tabsForAdapter(record: AdapterRecord): Promise<chrome.tabs.Tab[]> {
  // Querying without a url filter keeps the extension free of the broad "tabs"
  // permission: tab.url is only populated for origins we already hold host
  // permissions for, which is exactly the set we may act on.
  const tabs = await ext.tabs.query({});
  return tabs.filter((tab) => tab.url && record.adapter.origins.includes(originOf(tab.url) ?? ''));
}

async function applyToOpenTabs(adapterId: string, enabled: boolean): Promise<void> {
  const catalogue = await readCatalogue();
  const record = catalogue.find((entry) => entry.adapter.id === adapterId);
  if (!record) return;
  for (const tab of await tabsForAdapter(record)) {
    if (tab.id === undefined) continue;
    if (enabled) {
      try {
        await injectAdapter(tab.id, 0, record.adapter, record.policy, record.source);
      } catch (error) {
        console.warn('[liha] enable injection failed', error);
      }
    } else {
      await uninstallFromTab(tab.id, adapterId);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* State for the extension UI                                                   */
/* -------------------------------------------------------------------------- */

async function buildPopupState(): Promise<PopupState> {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  const origin = originOf(url);
  const catalogue = await readCatalogue();

  const catalog: CatalogEntry[] = catalogue.map((record) => ({
    adapter: record.adapter,
    source: record.source,
    enabled: record.enabled,
    policy: record.policy,
    matchesCurrentOrigin: origin !== null && record.adapter.origins.includes(origin),
  }));

  let runtime = null;
  let runtimeError: string | undefined;
  if (tab?.id !== undefined && catalog.some((entry) => entry.matchesCurrentOrigin)) {
    try {
      runtime = await readRuntimeStatus(tab.id);
    } catch (error) {
      runtimeError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    url,
    origin,
    recording: await recordingStore.getRecording(),
    catalog,
    runtime,
    ...(runtimeError ? { runtimeError } : {}),
  };
}

/**
 * Tell whoever is listening how many actions are in the take.
 *
 * Nothing is listening most of the time — the popup is closed — and a message
 * with no receiver rejects, which is not an error worth having.
 */
function announceRecording(count: number | null): void {
  void ext.runtime.sendMessage({ type: 'liha/recording-changed', count }).catch(() => undefined);
}

async function buildStoreState(): Promise<StoreStateResponse> {
  const catalogue = await readCatalogue();
  /*
   * Health is a fact about a page, so it is read from one page.
   *
   * This used to walk every tab and let each overwrite the last, so with two
   * tabs of the same site open the popup showed whichever the enumeration
   * happened to reach last — a report that changed under the reader for no
   * reason they could see. The page in front of them is the one they are asking
   * about; only if that tab is not one an adapter covers does this fall back to
   * another, and the answer carries its own URL either way.
   */
  const healthByAdapter = new Map<string, AdapterHealth>();
  const covered = (tab: chrome.tabs.Tab) => {
    if (tab.id === undefined || !tab.url) return false;
    const origin = originOf(tab.url);
    return Boolean(origin && catalogue.some((entry) => entry.adapter.origins.includes(origin)));
  };
  const [active] = await ext.tabs.query({ active: true, currentWindow: true });
  const candidates = (await ext.tabs.query({})).filter(covered);
  const chosen = active && covered(active) ? active : candidates[0];
  if (chosen?.id !== undefined) {
    for (const health of await readHealth(chosen.id)) healthByAdapter.set(health.adapterId, health);
  }
  /*
   * What the Store page is allowed to know about the adapters on this machine.
   *
   * It used to get every installed adapter's origins and full tool list. That
   * is an inventory of which private services someone has adapters for, handed
   * to an ordinary web page — and the Store only needs it for two things: to
   * mark its own catalogue entries as installed, and to write the call snippet
   * for the adapter you just built in the Studio.
   *
   * So: names and state for everything, details only where the page already
   * knows them (the adapters this extension ships, which are public) or just
   * made them (the newest Studio build, which is what the guided build shows).
   */
  const newestStudio = catalogue
    .filter((record) => record.source === 'studio')
    .sort((a, b) => a.installedAt - b.installedAt)
    .at(-1);
  const mayDetail = (record: (typeof catalogue)[number]) =>
    record.source === 'builtin' || record.adapter.id === newestStudio?.adapter.id;

  return {
    installed: catalogue.map((record) => ({
      id: record.adapter.id,
      name: record.adapter.name,
      version: record.adapter.version,
      enabled: record.enabled,
      source: record.source,
      ...(mayDetail(record)
        ? {
            origins: record.adapter.origins,
            tools: record.adapter.tools.map((tool) => ({
              name: tool.name,
              capability: tool.capability,
              required: tool.inputSchema.required ?? [],
            })),
          }
        : {}),
      health: healthByAdapter.get(record.adapter.id) ?? null,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Recorder                                                                     */
/* -------------------------------------------------------------------------- */

async function setRecording(active: boolean): Promise<RecordingCommandOutcome> {
  if (active) {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined || !tab.url) return { ok: false, error: 'no-active-page' };
    const origin = originOf(tab.url);
    if (!origin || !/^https?:$/.test(new URL(origin).protocol)) return { ok: false, error: 'no-active-page' };

    await recordingStore.start(tab.id, origin, tab.url);
    if (!(await enableRecorderOnTab(tab.id))) {
      await recordingStore.stop();
      return { ok: false, error: 'bridge-unavailable' };
    }
    return { ok: true };
  }

  /*
   * Stop the tab that is recording, not the tab you happen to be looking at.
   *
   * Both branches used to read the active tab, so starting on one tab and
   * pressing Stop from another ended the session in the worker while leaving
   * the first tab's recorder running — still listening to everything the person
   * did there, with nothing in the UI to say so.
   */
  const recording = await recordingStore.stop();
  if (recording?.tabId !== undefined) {
    try {
      await ext.tabs.sendMessage(recording.tabId, { type: 'liha/recorder-mode', active: false });
    } catch {
      // The tab is gone, which stops it just as well.
    }
  }
  if (!active) {
    await ext.tabs.create({ url: ext.runtime.getURL('studio/studio.html') });
  }
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Installing                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Installing an adapter always shows the user what they are agreeing to: the
 * exact origins it will run on and every tool with its capability. A request
 * arriving from a web page is still only a request — it goes through the same
 * validation and the same confirmation as one started from extension UI.
 */
async function handleInstall(
  candidate: unknown,
  source: AdapterRecord['source'],
  fromOrigin?: string,
): Promise<InstallOutcome> {
  const validation = validateAdapter(candidate);
  if (!validation.ok || !validation.adapter) return { ok: false, errors: validation.errors };
  const adapter = validation.adapter;

  const missingHostAccess = adapter.origins.filter((origin) => !STATIC_ORIGINS.includes(origin));
  const approved = await requestConfirmation({
    kind: 'install',
    request: {
      adapterId: adapter.id,
      adapterName: adapter.name,
      version: adapter.version,
      ...(adapter.description ? { description: adapter.description } : {}),
      origins: adapter.origins,
      source,
      ...(fromOrigin ? { fromOrigin } : {}),
      tools: adapter.tools.map((tool) => ({
        effects: (() => {
          const { clicks, inputs, submits, navigations, reads, readOnly } = summarizeEffects(tool);
          return { clicks, inputs, submits, navigations, reads, readOnly };
        })(),
        name: tool.name,
        capability: tool.capability,
        description: tool.description,
      })),
      needsHostPermission: missingHostAccess.length > 0,
    },
  });
  if (!approved) return { ok: false, errors: ['the user declined the install'] };

  const outcome = await installAdapter(adapter, source, { ...DEFAULT_POLICY });
  if (outcome.ok) {
    await syncDynamicContentScripts();
    if (outcome.adapterId) await applyToOpenTabs(outcome.adapterId, true);
  }
  return outcome;
}

/* -------------------------------------------------------------------------- */
/* Selector probing for the Studio                                              */
/* -------------------------------------------------------------------------- */

/** Counts matches for each selector, evaluated in the isolated world: the
 *  Studio only needs to know whether a selector is unique, which never requires
 *  reaching into the page's own JavaScript. */
function countSelectorsInPage(selectors: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const selector of selectors) {
    try {
      counts[selector] = document.querySelectorAll(selector).length;
    } catch {
      counts[selector] = -1;
    }
  }
  return counts;
}

async function probeSelectors(
  origin: string,
  selectors: string[],
): Promise<{ probe?: Record<string, number>; error?: string }> {
  const tabs = await ext.tabs.query({});
  const tab = tabs.find((candidate) => candidate.url && originOf(candidate.url) === origin);
  if (tab?.id === undefined) return { error: `No open tab on ${origin}. Open the page and try again.` };
  try {
    const [result] = await ext.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      world: 'ISOLATED',
      func: countSelectorsInPage,
      args: [selectors],
    });
    return { probe: (result?.result as Record<string, number> | undefined) ?? {} };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/* -------------------------------------------------------------------------- */
/* Message routing                                                              */
/* -------------------------------------------------------------------------- */

ext.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  switch (message.type) {
    case 'liha/page-ready': {
      const tabId = sender.tab?.id;
      if (tabId === undefined) return false;
      void handlePageReady(message.href, tabId, sender.frameId ?? 0);
      return false;
    }

    case 'liha/get-state':
      void buildPopupState().then(sendResponse);
      return true;

    case 'liha/set-enabled':
      void setEnabled(message.adapterId, message.enabled)
        .then(() => applyToOpenTabs(message.adapterId, message.enabled))
        .then(() => sendResponse({ ok: true }));
      return true;

    case 'liha/set-policy':
      void setPolicy(message.adapterId, message.policy)
        .then(() => applyToOpenTabs(message.adapterId, true))
        .then(() => sendResponse({ ok: true }));
      return true;

    case 'liha/confirm-request':
      // Asked for by the MAIN-world runtime through the isolated bridge, and
      // answered by the user in an extension window the page cannot touch.
      void requestConfirmation({ kind: 'tool', request: message.request }).then((approved) =>
        sendResponse({ approved }),
      );
      return true;

    case 'liha/get-confirmation':
      sendResponse({ payload: getPendingRequest(message.requestId) });
      return false;

    case 'liha/confirm-decision':
      sendResponse({ ok: decide(message.requestId, message.approved) });
      return false;

    case 'liha/start-recording':
      void setRecording(true).then((outcome) => {
        // Zero is a real answer here, and only after the take exists: a popup
        // that hears "0" for a start that failed would show a take that is not
        // running.
        if (outcome.ok) announceRecording(0);
        sendResponse(outcome);
      });
      return true;

    case 'liha/stop-recording':
      void setRecording(false).then((outcome) => {
        announceRecording(null);
        sendResponse(outcome);
      });
      return true;

    case 'liha/recorded-action': {
      const tabId = sender.tab?.id;
      if (tabId === undefined) return false;
      /*
       * The count goes back to the page that sent the action, and out to
       * anything else listening.
       *
       * A popup left open while the demonstration happens used to keep showing
       * the count it was rendered with — "Stop recording (0)" while three
       * actions had been captured, which reads as a recorder that is not
       * working. It is the same number in both places now, and it is read back
       * out of the session after the write: a click and the submit it caused
       * are merged into the one action they are, so counting locally would say
       * one more than the Studio does.
       */
      void recordingStore
        .addAction(tabId, message.action)
        .then(() => recordingStore.getRecording())
        .then((session) => {
          const count = session?.actions.length ?? 0;
          announceRecording(count);
          sendResponse({ ok: true, count });
        });
      return true;
    }

    case 'liha/get-recording':
      void Promise.all([recordingStore.getRecording(), recordingStore.getLastTake()]).then(
        ([recording, lastTake]) => sendResponse({ recording: recording ?? lastTake }),
      );
      return true;

    case 'liha/install-adapter':
      void handleInstall(message.adapter, message.source, message.fromOrigin).then(sendResponse);
      return true;

    case 'liha/remove-adapter':
      void (async () => {
        await applyToOpenTabs(message.adapterId, false);
        await removeAdapter(message.adapterId);
        await syncDynamicContentScripts();
        sendResponse({ ok: true });
      })();
      return true;

    case 'liha/list-adapters':
      void buildStoreState().then(sendResponse);
      return true;

    case 'liha/probe-selectors':
      /*
       * Extension pages only, and the check is here rather than only at the
       * relay because this is the boundary that matters.
       *
       * A probe runs an arbitrary selector against an origin the extension has
       * permission for and returns a count — enough to read an attribute a
       * character at a time from a page the asker cannot see.
       *
       * The test is the sender's URL, not whether it has a tab: the Studio
       * opens in a tab like any page, so `sender.tab` says nothing. A content
       * script's sender.url is the website's; an extension page's starts with
       * this extension's own origin, which nothing on the web can forge.
       */
      if (!sender.url?.startsWith(ext.runtime.getURL(''))) {
        sendResponse({ error: 'selector probing is only available from the extension’s own pages' });
        return false;
      }
      void probeSelectors(message.origin, message.selectors).then(sendResponse);
      return true;

    case 'liha/check-health':
      void (async () => {
        const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
        sendResponse({ health: tab?.id === undefined ? [] : await readHealth(tab.id) });
      })();
      return true;

    default:
      return false;
  }
});

ext.windows.onRemoved.addListener(handleWindowClosed);

ext.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    const recording = await recordingStore.getRecording();
    if (recording?.tabId !== tabId) return;
    await recordingStore.stop();
  })();
});

/*
 * A cross-origin navigation revokes `activeTab`, so the next document cannot
 * announce itself through `liha/page-ready`. At load completion, a failed ping
 * is the reliable signal to stop rather than claiming to record while nothing
 * is captured. For a same-origin document the grant survives, so the bridge is
 * injected again and resumes the session.
 */
ext.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  void (async () => {
    const recording = await recordingStore.getRecording();
    if (recording?.tabId !== tabId) return;
    const tab = await ext.tabs.get(tabId).catch(() => null);
    const href = tab?.url;
    if (!href || originOf(href) !== recording.origin || !(await enableRecorderOnTab(tabId))) {
      await recordingStore.stop();
    }
  })();
});

/*
 * Host access can be taken away from the extension's own settings page, and
 * nothing here was listening. The dynamic registration has to follow it down —
 * otherwise a revoked origin keeps its content script until the next restart —
 * and any runtime already sitting in a page on that origin has to be told to
 * unregister its tools rather than carrying on.
 */
if (ext.permissions?.onRemoved?.addListener) {
  ext.permissions.onRemoved.addListener((removed) => {
    void (async () => {
      await syncDynamicContentScripts();
      const origins = removed.origins ?? [];
      if (origins.length === 0 || typeof ext.tabs?.query !== 'function') return;
      const catalogue = await readCatalogue();
      const affected = catalogue.filter((entry) =>
        entry.adapter.origins.some((origin) => origins.includes(`${origin}/*`)),
      );
      let tabs: Array<{ id?: number }> = [];
      try {
        tabs = await ext.tabs.query({ url: origins });
      } catch {
        return;
      }
      for (const tab of tabs) {
        if (typeof tab.id !== 'number') continue;
        for (const entry of affected) {
          await uninstallFromTab(tab.id, entry.adapter.id).catch(() => undefined);
        }
      }
    })();
  });
}

if (ext.permissions?.onAdded?.addListener) {
  ext.permissions.onAdded.addListener(() => void syncDynamicContentScripts());
}
ext.runtime.onInstalled.addListener(() => void syncDynamicContentScripts());
ext.runtime.onStartup.addListener(() => void syncDynamicContentScripts());
