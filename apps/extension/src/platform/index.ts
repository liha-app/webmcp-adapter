/**
 * The one place that talks to a browser extension API directly.
 *
 * Chrome is the primary target. Firefox exposes the same MV3 surface under
 * `browser` (and mostly aliases `chrome`), so isolating the differences here
 * keeps the port from leaking `if (firefox)` checks through the codebase — and,
 * more importantly, keeps Firefox from constraining what the Chrome build does.
 *
 * Nothing in this module is imported by the MAIN-world runtime, which must stay
 * free of extension APIs entirely.
 */
declare const browser: typeof chrome | undefined;

const api: typeof chrome =
  typeof browser !== 'undefined' && browser?.runtime ? (browser as typeof chrome) : chrome;

export const ext = api;

export type Engine = 'chrome' | 'firefox' | 'unknown';

export function engine(): Engine {
  if (typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent)) return 'firefox';
  if (typeof chrome !== 'undefined' && chrome.runtime) return 'chrome';
  return 'unknown';
}

/**
 * MAIN-world script injection is what makes an adapter possible at all: WebMCP
 * tools have to be registered on the page's own `document.modelContext`.
 * Firefox does not currently support `world: 'MAIN'` for `executeScript`, so
 * this is the capability the Firefox build reports as missing rather than
 * working around.
 */
export function supportsMainWorldInjection(): boolean {
  const scripting = api.scripting as (typeof chrome.scripting & { ExecutionWorld?: unknown }) | undefined;
  if (!scripting?.executeScript) return false;
  const worlds = scripting.ExecutionWorld as Record<string, string> | undefined;
  if (worlds) return Object.values(worlds).includes('MAIN');
  // Chrome exposes the enum; if it is missing, assume support only on Chrome.
  return engine() === 'chrome';
}

export interface PlatformDiagnostics {
  engine: Engine;
  extensionApi: boolean;
  scriptingApi: boolean;
  mainWorldInjection: boolean;
  dynamicContentScripts: boolean;
  optionalHostPermissions: boolean;
}

export function diagnostics(): PlatformDiagnostics {
  return {
    engine: engine(),
    extensionApi: Boolean(api?.runtime),
    scriptingApi: Boolean(api?.scripting?.executeScript),
    mainWorldInjection: supportsMainWorldInjection(),
    dynamicContentScripts: typeof api?.scripting?.registerContentScripts === 'function',
    optionalHostPermissions: typeof api?.permissions?.request === 'function',
  };
}
