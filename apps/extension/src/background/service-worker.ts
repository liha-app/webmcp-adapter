import { originOf, validateAdapter } from '@liha/adapter-schema';
import { ALL_ORIGINS } from '@liha/config';
import type { AdapterHealth } from '@liha/adapter-schema';
import { DEFAULT_POLICY } from '@liha/adapter-runtime';
import type {
  AdapterRecord,
  CatalogEntry,
  ExtensionMessage,
  PopupState,
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
import { addAction, getLastTake, getRecording, keepTake, startRecording, stopRecording } from './recording';

/**
 * Origins covered by the static content scripts in the manifest, derived from
 * the same config the manifest is generated from. Everything else needs an
 * explicitly granted optional host permission plus a dynamically registered
 * content script, so installing an adapter never silently widens the
 * extension's reach.
 */
const STATIC_ORIGINS = ALL_ORIGINS;

const DYNAMIC_SCRIPT_ID = 'liha-dynamic-bridge';

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
}

/* -------------------------------------------------------------------------- */
/* Injection lifecycle                                                          */
/* -------------------------------------------------------------------------- */

async function handlePageReady(href: string, tabId: number, frameId: number): Promise<void> {
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
    recording: getRecording(),
    catalog,
    runtime,
    ...(runtimeError ? { runtimeError } : {}),
  };
}

async function buildStoreState(): Promise<StoreStateResponse> {
  const catalogue = await readCatalogue();
  const healthByAdapter = new Map<string, AdapterHealth>();
  const tabs = await ext.tabs.query({});
  for (const tab of tabs) {
    if (tab.id === undefined || !tab.url) continue;
    const origin = originOf(tab.url);
    if (!origin || !catalogue.some((entry) => entry.adapter.origins.includes(origin))) continue;
    for (const health of await readHealth(tab.id)) healthByAdapter.set(health.adapterId, health);
  }
  return {
    installed: catalogue.map((record) => ({
      id: record.adapter.id,
      name: record.adapter.name,
      version: record.adapter.version,
      enabled: record.enabled,
      source: record.source,
      origins: record.adapter.origins,
      tools: record.adapter.tools.map((tool) => ({
        name: tool.name,
        capability: tool.capability,
        required: tool.inputSchema.required ?? [],
      })),
      health: healthByAdapter.get(record.adapter.id) ?? null,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Recorder                                                                     */
/* -------------------------------------------------------------------------- */

async function setRecording(active: boolean): Promise<void> {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || !tab.url) return;
  const origin = originOf(tab.url);
  if (!origin) return;

  if (active) {
    startRecording(tab.id, origin);
    keepTake(null);
  } else {
    keepTake(stopRecording());
  }
  try {
    await ext.tabs.sendMessage(tab.id, { type: 'liha/recorder-mode', active });
  } catch {
    // The content script is not present on this page; recording simply stays empty.
  }
  if (!active) {
    await ext.tabs.create({ url: ext.runtime.getURL('studio/studio.html') });
  }
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
      void setRecording(true).then(() => sendResponse({ ok: true }));
      return true;

    case 'liha/stop-recording':
      void setRecording(false).then(() => sendResponse({ ok: true }));
      return true;

    case 'liha/recorded-action': {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) addAction(tabId, message.action);
      return false;
    }

    case 'liha/get-recording':
      sendResponse({ recording: getRecording() ?? getLastTake() });
      return false;

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
ext.runtime.onInstalled.addListener(() => void syncDynamicContentScripts());
ext.runtime.onStartup.addListener(() => void syncDynamicContentScripts());
