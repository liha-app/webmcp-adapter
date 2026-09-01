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

const recorder = createRecorder((action: RecordedAction) => {
  void ext.runtime.sendMessage({ type: 'liha/recorded-action', action }).catch(() => {
    /* recording session already ended */
  });
});

ext.runtime.onMessage.addListener((message: { type?: string; active?: boolean }) => {
  if (message?.type !== 'liha/recorder-mode') return;
  if (message.active) recorder.start();
  else recorder.stop();
});
