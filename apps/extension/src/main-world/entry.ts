/**
 * MAIN-world entry point.
 *
 * This file runs in the page's own JavaScript world and therefore MUST NOT
 * touch any `chrome.*` extension API. It is injected by the service worker via
 * `scripting.executeScript({ world: 'MAIN', files: [...] })`; the adapter
 * definition arrives separately as plain JSON data.
 *
 * Being in the MAIN world also means the host page can see and tamper with this
 * global. That trade-off is inherent to registering WebMCP tools from an
 * extension and is documented in SECURITY.md.
 */
import { createRuntime, detectModelContext, macrotask, type ConfirmationRequest } from '@liha/adapter-runtime';
import { BRIDGE_REQUEST_EVENT, BRIDGE_RESPONSE_EVENT, RUNTIME_GLOBAL } from '@liha/shared';

const CONFIRM_TIMEOUT_MS = 130_000;

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Asks the extension — through the isolated content script — to confirm a
 * guarded call. The dialog is drawn by the extension, not by the page.
 *
 * Anything other than an explicit approval denies, including a missing bridge
 * or a timeout, so a broken confirmation path can never let a DESTRUCTIVE call
 * through.
 */
function requestConfirmation(request: ConfirmationRequest): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const id = randomId();
    let settled = false;
    const finish = (approved: boolean) => {
      if (settled) return;
      settled = true;
      document.removeEventListener(BRIDGE_RESPONSE_EVENT, onResponse);
      clearTimeout(timer);
      resolve(approved);
    };
    const onResponse = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; approved?: boolean }>).detail;
      if (detail?.id !== id) return;
      finish(detail.approved === true);
    };
    const timer = setTimeout(() => finish(false), CONFIRM_TIMEOUT_MS);
    document.addEventListener(BRIDGE_RESPONSE_EVENT, onResponse);
    document.dispatchEvent(
      new CustomEvent(BRIDGE_REQUEST_EVENT, { detail: { id, kind: 'confirm', request } }),
    );
  });
}

const scope = globalThis as typeof globalThis & Record<string, unknown>;
if (!scope[RUNTIME_GLOBAL]) {
  scope[RUNTIME_GLOBAL] = createRuntime({
    doc: document,
    location: { origin: location.origin, href: location.href },
    getModelContext: () => detectModelContext(document),
    // Client-side navigation only: a full page load would destroy the calling
    // context mid-tool-call. Apps that need a real navigation are out of scope
    // for this step, and the following waitFor fails closed if nothing happens.
    navigate: (href) => {
      history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    settle: macrotask,
    now: () => Date.now(),
    requestConfirmation,
  });
}

export {};
