import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORE_STATE_EVENT, STORE_STATE_RESPONSE_EVENT } from '@liha/shared';
import type { AdapterDefinition } from '@liha/adapter-schema';
import { en } from '../i18n/en';
import { fetchInstalled, installProblemText, requestInstall } from './extension';

/**
 * What this page says when the extension does not answer it.
 *
 * These two failures used to be English sentences assembled in the library and
 * printed onto whatever page asked, Japanese included. They are conditions now,
 * and the only thing that turns a condition into a sentence is the message
 * catalogue — so `t` here is the real catalogue, and a code with no message
 * fails this rather than shipping.
 */
const t = (key: keyof typeof en) => en[key];

const ADAPTER = {
  id: 'nimbus-search',
  name: 'Nimbus Supply search',
  version: '1.0.0',
  origins: ['http://localhost:5274'],
  tools: [],
} as unknown as AdapterDefinition;

const INSTALL_RESULT = 'liha:install-result';

afterEach(() => {
  vi.useRealTimers();
});

describe('asking the extension to install an adapter', () => {
  it('reports silence as a condition, not as a sentence', async () => {
    vi.useFakeTimers();
    const outcome = requestInstall(ADAPTER);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(await outcome).toEqual({ ok: false, problem: 'no-response', errors: [] });
  });

  it('reports an answer with nothing in it as its own condition', async () => {
    const outcome = requestInstall(ADAPTER);
    document.dispatchEvent(new CustomEvent(INSTALL_RESULT));
    expect(await outcome).toEqual({ ok: false, problem: 'no-result', errors: [] });
  });

  it('says both of them in the reader’s language', async () => {
    vi.useFakeTimers();
    const silent = requestInstall(ADAPTER);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(installProblemText(await silent, t)).toBe(en['install.noResponse']);
    vi.useRealTimers();

    const empty = requestInstall(ADAPTER);
    document.dispatchEvent(new CustomEvent(INSTALL_RESULT));
    expect(installProblemText(await empty, t)).toBe(en['install.noResult']);
  });

  it('hands a validation error back with its content intact', async () => {
    const outcome = requestInstall(ADAPTER);
    document.dispatchEvent(
      new CustomEvent(INSTALL_RESULT, {
        detail: { ok: false, errors: ['tools.0.name: tool names must be snake_case'] },
      }),
    );
    const result = await outcome;
    // The path and the rule are the whole value of the answer. Nothing here
    // flattens them into a translated "installation failed".
    expect(result.problem).toBeUndefined();
    expect(installProblemText(result, t)).toBe('tools.0.name: tool names must be snake_case');
  });

  it('passes a success through untouched', async () => {
    const outcome = requestInstall(ADAPTER);
    document.dispatchEvent(new CustomEvent(INSTALL_RESULT, { detail: { ok: true, errors: [] } }));
    expect((await outcome).ok).toBe(true);
  });
});

describe('asking the extension what is installed', () => {
  it('tells a silent extension apart from one with nothing installed', async () => {
    vi.useFakeTimers();
    const silent = fetchInstalled();
    await vi.advanceTimersByTimeAsync(1200);
    // Both arrive as an empty list. The guided build takes its baseline from
    // this, and a baseline built out of silence would make everything already
    // on the machine look like it had just been recorded.
    expect(await silent).toEqual({ installed: [], answered: false });
    vi.useRealTimers();

    const onRequest = () => {
      document.dispatchEvent(new CustomEvent(STORE_STATE_RESPONSE_EVENT, { detail: { installed: [] } }));
    };
    document.addEventListener(STORE_STATE_EVENT, onRequest, { once: true });
    expect(await fetchInstalled()).toEqual({ installed: [], answered: true });
  });
});
