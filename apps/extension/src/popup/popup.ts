import type { PopupState, RecordingCommandOutcome } from '@liha/shared';
import { diagnostics, ext } from '../platform';
import { applyDocumentLanguage, loadLocale, t } from '../i18n';
import { el, renderAdapterCard, send } from '../ui/adapters';

const app = document.getElementById('app');

/** Not a link: Chrome refuses navigation to chrome:// from an extension page. */
const FLAG_URL = 'chrome://flags/#enable-webmcp-testing';

function render(state: PopupState): void {
  if (!app) return;
  app.replaceChildren();

  const platform = diagnostics();
  /*
   * Two different questions, and conflating them is what made this popup
   * unhelpful in the one situation it most needed to help.
   *
   * `state.runtime` is reported by the injected runtime, which the background
   * only reads where an installed adapter matches the current origin. So on
   * every other page — including this project's own portal, which is where the
   * README sends people first — there was no runtime to ask, the popup said
   * "unknown (runtime not loaded on this page)", and the notice below never
   * appeared. Someone whose browser simply had the flag off was told nothing
   * about the flag.
   *
   * Whether the browser has WebMCP does not depend on the open tab, and this
   * page can answer it about itself.
   */
  const browserHasWebMcp = platform.webmcpApi;
  const onPage = state.runtime?.webmcp;
  const statusText = !browserHasWebMcp
    ? t('popup.statusUnavailable')
    : onPage === 'available'
      ? t('popup.statusAvailable')
      : onPage === 'unsupported'
        ? t('popup.statusNotOnPage')
        : t('popup.statusNoAdapter');
  const statusClass = !browserHasWebMcp
    ? 'status--err'
    : onPage === 'available'
      ? 'status--ok'
      : 'status--warn';

  const kv = el('dl', { class: 'kv' });
  kv.append(el('dt', {}, t('popup.page')), el('dd', {}, state.origin ?? t('popup.noPage')));
  // The runtime version rides along with the status rather than taking a row of
  // its own; it matters when reporting a problem and never otherwise.
  const status = el('dd', { class: `status ${statusClass}` }, statusText);
  if (state.runtime) status.append(el('span', { class: 'muted' }, t('popup.runtimeVersion', [state.runtime.runtimeVersion])));
  kv.append(el('dt', {}, t('popup.webmcp')), status);
  app.append(kv);

  if (!browserHasWebMcp || !platform.mainWorldInjection) {
    const note = el('p', { class: 'notice' });
    note.append(
      !platform.mainWorldInjection ? t('popup.noMainWorld', [platform.engine]) : t('popup.noWebmcp'),
    );
    if (browserHasWebMcp === false && platform.mainWorldInjection) {
      // chrome:// cannot be linked to from an extension page, and typing a flag
      // URL off a screenshot is exactly where people give up. Hand it over.
      const flag = el('code', { class: 'notice__flag' }, FLAG_URL);
      const copy = el('button', { class: 'btn btn--small', type: 'button' }, t('popup.copy'));
      copy.addEventListener('click', () => {
        void navigator.clipboard.writeText(FLAG_URL).then(
          () => (copy.textContent = t('popup.copied')),
          () => (copy.textContent = t('popup.copyFailed')),
        );
      });
      note.append(el('span', { class: 'notice__row' }, flag, copy));
    }
    app.append(note);
  }

  /*
   * One action, and three ways out.
   *
   * Recording is what a person came here to start, so it is a prominent button
   * across the width of the popup. The other three only open a page, and a page
   * you open is a row in a list, not a button: as three tinted words in a line
   * they read as one sentence broken into pieces, and none of them looked like
   * it led anywhere. They are a group now, each with the chevron that says so
   * and its count on the right.
   */
  const actions = el('div', { class: 'actions' });
  const recording = state.recording !== null;
  const record = el(
    'button',
    {
      class: `btn btn--block ${recording ? 'btn--danger' : 'btn--primary'}`,
      type: 'button',
      'data-action': 'toggle-recording',
    },
    recording ? t('popup.stopRecording', [state.recording?.actions.length ?? 0]) : t('popup.record'),
  );
  record.addEventListener('click', () => {
    if (recording) {
      void send<RecordingCommandOutcome>({ type: 'liha/stop-recording' }).then(() => window.close());
      return;
    }

    void send<RecordingCommandOutcome>({ type: 'liha/start-recording' })
      .then((outcome) => {
        if (outcome.ok) {
          load();
          return;
        }
        actions.append(el('p', { class: 'notice' }, t('popup.recordUnavailable')));
      })
      .catch(() => actions.append(el('p', { class: 'notice' }, t('popup.recordUnavailable'))));
  });
  actions.append(record);
  app.append(actions);

  const elsewhere = el('div', { class: 'group elsewhere' });
  for (const [label, page, value] of [
    [t('popup.adapters'), 'manage/manage.html', String(state.catalog.length)],
    [t('popup.studio'), 'studio/studio.html', ''],
    [t('popup.compatibility'), 'diagnostics/diagnostics.html', ''],
  ] as Array<[string, string, string]>) {
    const link = el('button', { class: 'linkrow', type: 'button' }, el('span', { class: 'linkrow__label' }, label));
    if (value) link.append(el('span', { class: 'linkrow__value' }, value));
    link.addEventListener('click', () => void ext.tabs.create({ url: ext.runtime.getURL(page) }));
    elsewhere.append(link);
  }
  app.append(elsewhere);

  /*
   * Only what applies to the page in front of the reader.
   *
   * This used to list the whole catalogue, so opening the popup anywhere showed
   * three adapters, a dozen tools and "Not scoped to the current page" three
   * times — the answer to "does this site work" buried in answers to questions
   * nobody had asked. Everything else moved to the Adapters page, which is
   * where a list belongs.
   */
  // chrome-extension:// and chrome:// are origins, but they are not sites an
  // adapter could ever apply to, so the empty state should not name one back at
  // the reader as though it were the page they are looking at.
  const onWebsite = /^https?:/.test(state.url ?? '');
  const here = state.catalog.filter((entry) => entry.matchesCurrentOrigin);
  for (const entry of here) {
    app.append(
      renderAdapterCard(entry, {
        live: state.runtime?.adapters.find((installed) => installed.id === entry.adapter.id),
        onChanged: load,
        showOrigins: false,
      }),
    );
  }
  if (here.length === 0) {
    const empty = el('div', { class: 'card' });
    empty.append(
      el('h3', {}, t('popup.emptyTitle')),
      el(
        'p',
        { class: 'muted' },
        onWebsite && state.origin ? t('popup.emptyScoped', [state.origin]) : t('popup.emptyNoSite'),
      ),
    );
    app.append(empty);
  }

  if (state.runtimeError) app.append(el('p', { class: 'muted' }, t('popup.runtimeProbe', [state.runtimeError])));

  const log = state.runtime?.log ?? [];
  app.append(el('h4', {}, t('popup.executionLog')));
  const logBox = el('div', { class: 'log' });
  if (log.length === 0) {
    logBox.append(el('div', { class: 'muted' }, t('popup.noActivity')));
  } else {
    for (const entry of log) {
      const time = new Date(entry.at).toLocaleTimeString();
      logBox.append(
        el('div', entry.level === 'error' ? { class: 'err' } : {}, `${time}  ${entry.tool}  ${entry.message}`),
      );
    }
  }
  app.append(logBox);
  app.append(el('p', { class: 'muted' }, t('popup.logNote')));
}

function load(): void {
  void send<PopupState>({ type: 'liha/get-state' }).then(render);
}

// The language is read before the first paint, so nothing renders in English
// and then swaps under the reader.
void loadLocale().then(() => {
  applyDocumentLanguage();
  load();
});

/*
 * A popup that is open while the demonstration happens.
 *
 * It closes the instant you click into the page, so for most of a take it is
 * not there — but an inspected popup, or one on a second screen, stays. It used
 * to keep the count it was first rendered with and showed "Stop recording (0)"
 * over a take that had three actions in it, which reads as a recorder that is
 * not working.
 */
ext.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message?.type === 'liha/recording-changed') load();
});


/* The badge used to read "Phase 0 PoC", which stopped being true a long time
 * before anyone noticed. A version number cannot go stale in the same way. */
const versionTag = document.getElementById('version');
if (versionTag) versionTag.textContent = `v${ext.runtime.getManifest().version}`;
