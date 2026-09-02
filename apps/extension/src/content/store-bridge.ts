/**
 * ISOLATED-world content script for the Adapter Store.
 *
 * The Store is an ordinary web page and cannot talk to the extension directly,
 * so it dispatches DOM events that this script relays. Nothing here is
 * privileged: an install request from the page is a *request*, and the service
 * worker still validates the definition and asks the user to approve the
 * origins and capabilities before anything is installed.
 */
import {
  STORE_INSTALL_EVENT,
  STORE_PROBE_EVENT,
  STORE_PROBE_RESPONSE_EVENT,
  STORE_STATE_EVENT,
  STORE_STATE_RESPONSE_EVENT,
  type ProbeOutcome,
  type ProbeRequest,
  type StoreStateResponse,
} from '@liha/shared';
import { ext } from '../platform';

const READY_EVENT = 'liha:extension-ready';
const INSTALL_RESULT_EVENT = 'liha:install-result';

function announceExtension(): void {
  document.dispatchEvent(new CustomEvent(READY_EVENT, { detail: { version: ext.runtime.getManifest().version } }));
}

announceExtension();
document.addEventListener('DOMContentLoaded', announceExtension);

document.addEventListener(STORE_INSTALL_EVENT, (event) => {
  const detail = (event as CustomEvent<{ adapter: unknown }>).detail;
  if (!detail?.adapter) return;
  ext.runtime
    .sendMessage({
      type: 'liha/install-adapter',
      adapter: detail.adapter,
      source: 'installed',
      fromOrigin: location.origin,
    })
    .then((outcome) => {
      document.dispatchEvent(new CustomEvent(INSTALL_RESULT_EVENT, { detail: outcome }));
    })
    .catch((error: unknown) => {
      document.dispatchEvent(
        new CustomEvent(INSTALL_RESULT_EVENT, {
          detail: { ok: false, errors: [error instanceof Error ? error.message : String(error)] },
        }),
      );
    });
});

/*
 * Counting selectors on another origin's page. The service worker does the
 * looking, in the ISOLATED world, and returns numbers — this relay never sees
 * page content because none is ever produced.
 */
document.addEventListener(STORE_PROBE_EVENT, (event) => {
  const detail = (event as CustomEvent<ProbeRequest>).detail;
  if (!detail?.requestId || !detail.origin || !Array.isArray(detail.selectors)) return;
  const answer = (outcome: Omit<ProbeOutcome, 'requestId'>) => {
    document.dispatchEvent(
      new CustomEvent(STORE_PROBE_RESPONSE_EVENT, { detail: { requestId: detail.requestId, ...outcome } }),
    );
  };
  ext.runtime
    .sendMessage({ type: 'liha/probe-selectors', origin: detail.origin, selectors: detail.selectors })
    .then((outcome: Omit<ProbeOutcome, 'requestId'>) => answer(outcome ?? { error: 'No answer from the extension.' }))
    .catch((error: unknown) => answer({ error: error instanceof Error ? error.message : String(error) }));
});

document.addEventListener(STORE_STATE_EVENT, () => {
  ext.runtime
    .sendMessage({ type: 'liha/list-adapters' })
    .then((state: StoreStateResponse) => {
      document.dispatchEvent(new CustomEvent(STORE_STATE_RESPONSE_EVENT, { detail: state }));
    })
    .catch(() => {
      document.dispatchEvent(
        new CustomEvent(STORE_STATE_RESPONSE_EVENT, { detail: { installed: [] } satisfies StoreStateResponse }),
      );
    });
});
