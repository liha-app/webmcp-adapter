/**
 * ISOLATED-world content script.
 *
 * Three jobs, all of which have to happen outside the page's reach:
 *  - tell the service worker that a page in scope has loaded;
 *  - relay confirmation requests from the MAIN-world runtime to the extension,
 *    so the dialog the user sees is drawn by the extension and not the page;
 *  - capture recorder actions.
 *
 * The adapter definition is never routed through the page — the service worker
 * injects it straight into the MAIN world — so there is no page-visible channel
 * a hostile page could spoof to install an adapter of its choosing.
 */
import { BRIDGE_REQUEST_EVENT, BRIDGE_RESPONSE_EVENT, type PageReadyMessage, type RecordedAction } from '@liha/shared';
import { ext } from '../platform';
import { createIndicator } from './indicator';
import { t, loadLocale } from '../i18n';
import { createRecorder } from './recorder';

function announce(): void {
  const message: PageReadyMessage = { type: 'liha/page-ready', href: location.href };
  void ext.runtime.sendMessage(message).catch(() => {
    // The service worker may be restarting; the next navigation re-announces.
  });
}

announce();

// Restoring from the back/forward cache re-uses the document without re-running
// the initial load path, so re-announce to re-register the tools.
window.addEventListener('pageshow', (event) => {
  if ((event as PageTransitionEvent).persisted) announce();
});

/* -------------------------------------------------------------------------- */
/* Confirmation relay                                                           */
/* -------------------------------------------------------------------------- */

interface BridgeRequestDetail {
  id: string;
  kind: 'confirm';
  request: unknown;
}

document.addEventListener(BRIDGE_REQUEST_EVENT, (event) => {
  const detail = (event as CustomEvent<BridgeRequestDetail>).detail;
  if (!detail || detail.kind !== 'confirm' || typeof detail.id !== 'string') return;

  const respond = (approved: boolean) => {
    document.dispatchEvent(
      new CustomEvent(BRIDGE_RESPONSE_EVENT, { detail: { id: detail.id, approved } }),
    );
  };

  ext.runtime
    .sendMessage({ type: 'liha/confirm-request', request: detail.request })
    .then((response: { approved?: boolean } | undefined) => respond(response?.approved === true))
    .catch(() => respond(false));
});

/* -------------------------------------------------------------------------- */
/* Recorder                                                                     */
/* -------------------------------------------------------------------------- */

const indicator = createIndicator();

/*
 * The count is the service worker's, not a tally kept here.
 *
 * Pressing a form's submit button raises a click and a submit, which the
 * session merges into the one action they are. A badge counting locally would
 * say 5 where the Studio said 4, and a recorder whose own numbers disagree is
 * not one anybody trusts.
 */
const recorder = createRecorder((action: RecordedAction) => {
  void ext.runtime
    .sendMessage({ type: 'liha/recorded-action', action })
    .then((response: { count?: number } | undefined) => {
      if (typeof response?.count === 'number') indicator.count(response.count);
    })
    .catch(() => {
      /* recording session already ended */
    });
});

function startIndicator(): void {
  void loadLocale().then(() =>
    indicator.show(t('recorder.indicator'), t('recorder.stop'), () => {
      void ext.runtime.sendMessage({ type: 'liha/stop-recording' }).catch(() => undefined);
    }),
  );
}

ext.runtime.onMessage.addListener((message: { type?: string; active?: boolean }) => {
  if (message?.type !== 'liha/recorder-mode') return;
  if (message.active) {
    recorder.start();
    startIndicator();
  } else {
    recorder.stop();
    indicator.hide();
  }
});

// A take that ends by the page going away still ends. Nothing here outlives it.
window.addEventListener('pagehide', () => indicator.hide());
