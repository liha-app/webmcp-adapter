import {
  STORE_INSTALL_EVENT,
  STORE_STATE_EVENT,
  STORE_STATE_RESPONSE_EVENT,
  type StoreStateResponse,
} from '@liha/shared';
import type { AdapterDefinition } from '@liha/adapter-schema';
import type { MessageKey } from '../i18n/en';

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
    const onState = () => done(true);
    document.addEventListener(READY_EVENT, onReady);
    document.addEventListener(STORE_STATE_RESPONSE_EVENT, onState, { once: true });
    // The content script announces itself on load; asking for state is a second
    // chance to detect it if this page rendered after that announcement.
    document.dispatchEvent(new CustomEvent(STORE_STATE_EVENT));
    setTimeout(() => {
      document.removeEventListener(STORE_STATE_RESPONSE_EVENT, onState);
      done(false);
    }, 600);
  });
}

export interface InstalledState extends StoreStateResponse {
  /**
   * Whether the extension actually answered.
   *
   * A silent extension and an extension with nothing installed both used to
   * arrive as an empty list, and a caller that has to tell them apart — the
   * guided build, taking its baseline of what was already here — would have
   * taken silence for "nothing was installed" and then counted the visitor's
   * existing adapters as things it had just watched being built.
   */
  answered: boolean;
}

export function fetchInstalled(): Promise<InstalledState> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      document.removeEventListener(STORE_STATE_RESPONSE_EVENT, onState);
      resolve({ installed: [], answered: false });
    }, 1200);
    const onState = (event: Event) => {
      clearTimeout(timer);
      const detail = (event as CustomEvent<StoreStateResponse>).detail;
      resolve({ installed: detail?.installed ?? [], answered: true });
    };
    document.addEventListener(STORE_STATE_RESPONSE_EVENT, onState, { once: true });
    document.dispatchEvent(new CustomEvent(STORE_STATE_EVENT));
  });
}

/**
 * A failure this page worked out for itself, rather than one the extension
 * explained.
 *
 * These two used to be English sentences built here and rendered straight onto
 * a Japanese page. A library that talks to the extension has no business
 * choosing the reader's language, so it names the condition and the view says
 * it — `INSTALL_PROBLEM_MESSAGE` is the one place that mapping lives, so the
 * two screens that show it cannot drift apart.
 */
export type InstallProblem = 'no-response' | 'no-result';

export const INSTALL_PROBLEM_MESSAGE: Record<InstallProblem, MessageKey> = {
  'no-response': 'install.noResponse',
  'no-result': 'install.noResult',
};

export interface InstallOutcome {
  ok: boolean;
  /** Set only where this page is the one that noticed; the extension sets none. */
  problem?: InstallProblem;
  /**
   * What the extension said, verbatim.
   *
   * These are validation errors naming the field that failed, and they are the
   * whole value of the answer — they are passed through untouched rather than
   * flattened into a translated "installation failed".
   */
  errors: string[];
}

/** What to put in front of a reader when an install did not happen. */
export function installProblemText(outcome: InstallOutcome, t: (key: MessageKey) => string): string {
  return outcome.problem ? t(INSTALL_PROBLEM_MESSAGE[outcome.problem]) : outcome.errors.join(' ');
}

/**
 * Asks the extension to count what each selector matches on a page at `origin`.
 *
 * The extension answers with numbers and nothing else. That is the whole design
 * of this: an agent choosing selectors for an adapter needs to know whether the
 * one it picked hits exactly one element — the runtime is fail-closed on
 * ambiguity — and it does not need, and must not get, the page's contents to
 * find that out.
 */
/*
 * There is no requestProbe here any more.
 *
 * It asked the extension to run a CSS selector against another origin and
 * return a count, over a DOM event any script on this page could fire. Counts
 * leak: repeated prefix queries read an attribute a character at a time, and a
 * single one answers "is this person signed in". It needed an XSS here to
 * reach, and that is exactly the case where it would have mattered.
 *
 * Probing lives in the Studio, which is a page the extension owns.
 */
export function requestInstall(adapter: AdapterDefinition): Promise<InstallOutcome> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      document.removeEventListener(INSTALL_RESULT_EVENT, onResult);
      resolve({ ok: false, problem: 'no-response', errors: [] });
    }, 180_000);
    const onResult = (event: Event) => {
      clearTimeout(timer);
      const detail = (event as CustomEvent<InstallOutcome>).detail;
      resolve(detail ?? { ok: false, problem: 'no-result', errors: [] });
    };
    document.addEventListener(INSTALL_RESULT_EVENT, onResult, { once: true });
    document.dispatchEvent(new CustomEvent(STORE_INSTALL_EVENT, { detail: { adapter } }));
  });
}
