import {
  STORE_INSTALL_EVENT,
  STORE_STATE_EVENT,
  STORE_STATE_RESPONSE_EVENT,
  type StoreStateResponse,
} from '@liha/shared';
import type { AdapterDefinition } from '@liha/adapter-schema';

const READY_EVENT = 'liha:extension-ready';
const INSTALL_RESULT_EVENT = 'liha:install-result';

/**
 * The Store is an ordinary web page and has no privileged access to the
 * extension. It asks, via DOM events the extension's content script listens
 * for, and the extension decides — including showing the user the origins and
 * capabilities before anything is installed. If the extension is not present,
 * everything here degrades to "not installed" and the page still works.
 */
export function extensionPresent(): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: boolean) => {
      if (settled) return;
      settled = true;
      document.removeEventListener(READY_EVENT, onReady);
      resolve(value);
    };
    const onReady = () => done(true);
    document.addEventListener(READY_EVENT, onReady);
    // The content script announces itself on load; asking for state is a second
    // chance to detect it if this page rendered after that announcement.
    document.dispatchEvent(new CustomEvent(STORE_STATE_EVENT));
    const onState = () => done(true);
    document.addEventListener(STORE_STATE_RESPONSE_EVENT, onState, { once: true });
    setTimeout(() => {
      document.removeEventListener(STORE_STATE_RESPONSE_EVENT, onState);
      done(false);
    }, 600);
  });
}

export function fetchInstalled(): Promise<StoreStateResponse> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      document.removeEventListener(STORE_STATE_RESPONSE_EVENT, onState);
      resolve({ installed: [] });
    }, 1200);
    const onState = (event: Event) => {
      clearTimeout(timer);
      resolve((event as CustomEvent<StoreStateResponse>).detail ?? { installed: [] });
    };
    document.addEventListener(STORE_STATE_RESPONSE_EVENT, onState, { once: true });
    document.dispatchEvent(new CustomEvent(STORE_STATE_EVENT));
  });
}

export interface InstallOutcome {
  ok: boolean;
  errors: string[];
}

export function requestInstall(adapter: AdapterDefinition): Promise<InstallOutcome> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      document.removeEventListener(INSTALL_RESULT_EVENT, onResult);
      resolve({ ok: false, errors: ['The extension did not respond. Is it installed and enabled?'] });
    }, 180_000);
    const onResult = (event: Event) => {
      clearTimeout(timer);
      const detail = (event as CustomEvent<InstallOutcome>).detail;
      resolve(detail ?? { ok: false, errors: ['No result from the extension.'] });
    };
    document.addEventListener(INSTALL_RESULT_EVENT, onResult, { once: true });
    document.dispatchEvent(new CustomEvent(STORE_INSTALL_EVENT, { detail: { adapter } }));
  });
}
