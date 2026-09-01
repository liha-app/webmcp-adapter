import { beforeEach, describe, expect, it } from 'vitest';
import { validateAdapter, type AdapterDefinition } from '@liha/adapter-schema';
import { checkAdapterHealth, probeSelectorsFor } from './health';

const adapter = validateAdapter({
  id: 'demo',
  name: 'Demo',
  version: '1.0.0',
  origins: ['https://app.test'],
  tools: [
    {
      name: 'open_thing',
      description: 'Opens the thing',
      capability: 'INTERACT',
      inputSchema: { type: 'object', properties: {} },
      steps: [{ type: 'click', selector: '[data-action="open"]' }],
    },
    {
      name: 'edit_thing',
      description: 'Edits the thing',
      capability: 'WRITE',
      inputSchema: { type: 'object', properties: {} },
      probeSelectors: ['[data-testid="list"]', '[data-action="edit"]'],
      steps: [{ type: 'click', selector: '[data-action="edit"]' }],
    },
  ],
}).adapter as AdapterDefinition;

const now = () => 1_700_000_000_000;

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('probeSelectorsFor', () => {
  it('uses declared probe selectors when present', () => {
    expect(probeSelectorsFor(adapter.tools[1]!)).toEqual(['[data-testid="list"]', '[data-action="edit"]']);
  });

  it('falls back to the first selector-bearing step', () => {
    expect(probeSelectorsFor(adapter.tools[0]!)).toEqual(['[data-action="open"]']);
  });
});

describe('checkAdapterHealth', () => {
  it('is healthy when every probe resolves to exactly one element', () => {
    document.body.innerHTML =
      '<button data-action="open"></button><div data-testid="list"></div><button data-action="edit"></button>';
    const health = checkAdapterHealth(adapter, document, now);
    expect(health.status).toBe('healthy');
    expect(health.checkedAt).toBe(now());
  });

  it('is broken when nothing on the page matches', () => {
    document.body.innerHTML = '<p>a completely different page</p>';
    expect(checkAdapterHealth(adapter, document, now).status).toBe('broken');
  });

  it('is degraded when only some tools still recognise the page', () => {
    document.body.innerHTML = '<button data-action="open"></button>';
    const health = checkAdapterHealth(adapter, document, now);
    expect(health.status).toBe('degraded');
    expect(health.tools.map((tool) => tool.status)).toEqual(['healthy', 'broken']);
  });

  // An ambiguous anchor is not healthy: the step that uses it would fail closed.
  it('is degraded when a probe is ambiguous', () => {
    document.body.innerHTML =
      '<button data-action="open"></button><button data-action="open"></button><div data-testid="list"></div><button data-action="edit"></button>';
    const health = checkAdapterHealth(adapter, document, now);
    expect(health.tools[0]?.status).toBe('degraded');
    expect(health.tools[0]?.probes[0]?.matches).toBe(2);
  });
});
