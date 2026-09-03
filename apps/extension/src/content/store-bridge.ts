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
  STORE_STATE_EVENT,
  STORE_STATE_RESPONSE_EVENT,
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
 * There is deliberately no selector probe here any more.
 *
 * This relay ran in the Store's page, so any JavaScript on that page could ask
 * the extension to run an arbitrary CSS selector against a *different* origin
 * it had permission for and hand back a count. Counts are enough: repeat
 * `[data-token^="a"]`, `[data-token^="b"]` and you read an attribute a
 * character at a time, or you learn whether someone is signed in, or how many
 * records they have. It needed an XSS on the Store to reach, and if that ever
 * happened the extension's host permissions became the attacker's.
 *
 * Probing still exists — in the Studio, which is an extension page the user
 * opened, not a website the extension trusts. The service worker refuses the
 * message from anywhere else.
 */

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
