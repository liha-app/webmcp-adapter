import { describe, expect, it } from 'vitest';
import { baselineOf, builtHere, callSnippet, flowState, reportsDetail, type Installed } from './installed';

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

/*
 * Which adapter this run of the guided build actually made.
 *
 * Step 6 used to be ticked by the last non-bundled adapter in the list, so
 * anyone who had ever installed a community adapter arrived with the step
 * already complete and step 7 offering them a snippet for somebody else's
 * tool. The question the page is asking is narrower than "is anything
 * installed": it is "did the thing I was watching for turn up".
 */
const BUILTIN: Installed = {
  id: 'demo-crm',
  name: 'Acme CRM',
  version: '1.3.0',
  enabled: true,
  source: 'builtin',
  origins: ['https://demo-crm.liha.review'],
  tools: [{ name: 'search_customers', capability: 'READ', required: ['query'] }],
  health: null,
};

const NPM_FINDER: Installed = {
  id: 'npm-package-finder',
  name: 'npm Package Finder',
  version: '1.0.0',
  enabled: true,
  source: 'installed',
  health: null,
};

const HN: Installed = { ...NPM_FINDER, id: 'hn-reader', name: 'HN Reader', version: '2.0.0' };

const NIMBUS: Installed = {
  id: 'nimbus-search',
  name: 'Nimbus Supply search',
  version: '1.0.0',
  enabled: true,
  source: 'studio',
  origins: ['http://localhost:5274'],
  tools: [{ name: 'find_products', capability: 'READ', required: ['keyword'] }],
  health: null,
};

describe('what this run of the guided build made', () => {
  it('is not satisfied by a community adapter that was already installed', () => {
    const before = [BUILTIN, NPM_FINDER];
    const state = flowState(before, baselineOf(before));
    // The reported bug: npm Package Finder ticked step 6 and step 7 handed out
    // its call snippet, for a recording that had never been made.
    expect(state.made).toBeUndefined();
    expect(state.existing.map((entry) => entry.id)).toEqual(['npm-package-finder']);
  });

  it('is satisfied when the adapter recorded here turns up, and shows that one', () => {
    const before = [BUILTIN, NPM_FINDER];
    const state = flowState([...before, NIMBUS], baselineOf(before));
    expect(state.made?.id).toBe('nimbus-search');
    expect(state.made?.tools[0]?.name).toBe('find_products');
    expect(state.existing.map((entry) => entry.id)).toEqual(['npm-package-finder']);
  });

  it('is unmoved by a shelf of community adapters', () => {
    const before = [BUILTIN, NPM_FINDER, HN];
    const state = flowState(before, baselineOf(before));
    expect(state.made).toBeUndefined();
    expect(state.existing.map((entry) => entry.id)).toEqual(['npm-package-finder', 'hn-reader']);
  });

  it('claims nothing from an extension too old to say where an adapter came from', () => {
    expect(() => flowState(OLD, baselineOf(OLD))).not.toThrow();
    const state = flowState(OLD, baselineOf(OLD));
    expect(state.made).toBeUndefined();
    // Not "you have installed nothing" — this extension cannot answer, and
    // `reportsDetail` is what the page says that with.
    expect(state.existing).toEqual([]);
    expect(reportsDetail(OLD)).toBe(false);
  });

  it('claims nothing without a baseline, and lists what is there instead', () => {
    // A first visit that arrives after the building is done, or a browser that
    // will not keep session storage. Both are "cannot tell", not "did not
    // happen", so the adapter is shown without the step being ticked.
    const state = flowState([BUILTIN, NIMBUS], null);
    expect(state.made).toBeUndefined();
    expect(state.existing.map((entry) => entry.id)).toEqual(['nimbus-search']);
  });

  it('does not count a Studio adapter that was already on the machine', () => {
    const before = [BUILTIN, NIMBUS];
    expect(flowState(before, baselineOf(before)).made).toBeUndefined();
  });

  it('does count a rebuild reinstalled over the same id', () => {
    // Record, install, notice a mistake, record again. Same id, new version —
    // still work done here.
    const before = [BUILTIN, NIMBUS];
    const state = flowState([BUILTIN, { ...NIMBUS, version: '1.1.0' }], baselineOf(before));
    expect(state.made?.version).toBe('1.1.0');
  });

  it('shows the Studio build the extension described, not one it withheld', () => {
    // Only the newest Studio build arrives with its tools; an earlier one is a
    // name and a state. Step 7 has nothing to write from the latter.
    const partial: Installed = { ...NIMBUS, id: 'older-build', name: 'Older build' };
    delete (partial as { tools?: unknown }).tools;
    const state = flowState([BUILTIN, partial, NIMBUS], baselineOf([BUILTIN]));
    expect(state.made?.id).toBe('nimbus-search');
    expect(state.existing.map((entry) => entry.id)).toEqual(['older-build']);
  });

  it('reports every adapter the visitor installed as theirs', () => {
    expect(builtHere([BUILTIN, NPM_FINDER, NIMBUS]).map((entry) => entry.source)).toEqual(['installed', 'studio']);
  });
});
