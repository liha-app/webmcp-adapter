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

describe('a tool that says where it belongs', () => {
  const page = (html: string) => {
    const root = document.implementation.createHTMLDocument();
    root.body.innerHTML = html;
    return root;
  };

  const adapter = {
    id: 'shop',
    name: 'Shop',
    version: '1.0.0',
    origins: ['https://shop.example.com'],
    tools: [
      {
        name: 'search',
        description: 'Search the catalogue.',
        capability: 'READ' as const,
        inputSchema: { type: 'object' as const, properties: {} },
        steps: [{ type: 'readText' as const, selector: '#results', as: 'results' }],
      },
      {
        name: 'read_versions',
        description: 'Read the versions of the package on this page.',
        capability: 'READ' as const,
        inputSchema: { type: 'object' as const, properties: {} },
        appliesWhen: ['[data-page="package"]'],
        steps: [{ type: 'readList' as const, selector: '.version', as: 'versions' }],
      },
    ],
  };

  it('is not applicable on a page it is not for, and does not drag the adapter down', () => {
    // The front page: search works, the package tool has nothing to read. That
    // used to be "broken", and the adapter reported itself as degraded on the
    // busiest page of the site it was written for.
    const health = checkAdapterHealth(adapter, page('<div id="results"></div>'), () => 1);
    expect(health.tools.map((tool) => tool.status)).toEqual(['healthy', 'not-applicable']);
    expect(health.status).toBe('healthy');
  });

  it('is checked normally once the page is the one it named', () => {
    const html = '<div id="results"></div><div data-page="package"><span class="version"></span></div>';
    const health = checkAdapterHealth(adapter, page(html), () => 1);
    expect(health.tools.map((tool) => tool.status)).toEqual(['healthy', 'healthy']);
    expect(health.status).toBe('healthy');
  });

  it('is broken, not excused, when it is on its own page and cannot find anything', () => {
    const health = checkAdapterHealth(adapter, page('<div id="results"></div><div data-page="package"></div>'), () => 1);
    expect(health.tools.map((tool) => tool.status)).toEqual(['healthy', 'broken']);
    expect(health.status).toBe('degraded');
  });

  it('reports the page the answer is about', () => {
    const health = checkAdapterHealth(adapter, page(''), () => 1, 'https://shop.example.com/p/thing');
    expect(health.url).toBe('https://shop.example.com/p/thing');
  });

  it('says so when nothing in the adapter applies here', () => {
    const only = { ...adapter, tools: [adapter.tools[1]!] };
    expect(checkAdapterHealth(only, page(''), () => 1).status).toBe('not-applicable');
  });
});
