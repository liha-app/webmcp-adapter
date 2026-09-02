import { describe, expect, it } from 'vitest';
import { builtHere, callSnippet, reportsDetail, type Installed } from './installed';

/**
 * The payload from an extension that predates the fields this page reads. It
 * really shipped, so it really arrives, and the page has to survive it — this
 * shape took the whole route down in production once.
 */
const OLD = [
  { id: 'demo-crm', version: '1.3.0', enabled: true, health: null },
  { id: 'demo-shop', version: '1.1.0', enabled: true, health: null },
] as unknown as Installed[];

const NEW: Installed[] = [
  {
    id: 'demo-crm',
    name: 'Acme CRM',
    version: '1.3.0',
    enabled: true,
    source: 'builtin',
    origins: ['https://demo-crm.liha.review'],
    tools: [{ name: 'search_customers', capability: 'READ', required: ['query'] }],
    health: null,
  },
  {
    id: 'nimbus-search',
    name: 'Nimbus Supply search',
    version: '1.0.0',
    enabled: true,
    source: 'studio',
    origins: ['http://localhost:5274'],
    tools: [{ name: 'find_products', capability: 'READ', required: ['keyword'] }],
    health: null,
  },
];

describe('reading what the extension reports', () => {
  it('survives an extension older than this page', () => {
    expect(() => builtHere(OLD)).not.toThrow();
    expect(builtHere(OLD)).toEqual([]);
  });

  it('does not mistake a missing source for “not built in”', () => {
    // The bug: `source !== 'builtin'` is true when source is undefined, which
    // reported all three bundled adapters as the visitor's own work.
    expect(builtHere(OLD)).toHaveLength(0);
    expect(reportsDetail(OLD)).toBe(false);
  });

  it('knows a current extension can answer', () => {
    expect(reportsDetail(NEW)).toBe(true);
    expect(reportsDetail([])).toBe(true);
  });

  it('picks out only what the visitor put there', () => {
    expect(builtHere(NEW).map((entry) => entry.id)).toEqual(['nimbus-search']);
    expect(builtHere(NEW)[0]?.tools[0]?.name).toBe('find_products');
  });

  it('writes a snippet that calls the tool the way the API wants', () => {
    const snippet = callSnippet(builtHere(NEW)[0]?.tools[0]);
    expect(snippet).toContain("t.name === \"find_products\"");
    // The input is a JSON string; passing the object fails with a parse error.
    expect(snippet).toContain('JSON.stringify({');
    expect(snippet).toContain("keyword: 'cable',");
  });

  it('says so rather than inventing arguments for a tool that takes none', () => {
    const snippet = callSnippet({ name: 'ping', capability: 'READ', required: [] });
    expect(snippet).toContain('takes no arguments');
  });
});
