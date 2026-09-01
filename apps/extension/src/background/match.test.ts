import { describe, expect, it } from 'vitest';
import { validateAdapter } from '@liha/adapter-schema';
import type { AdapterRecord } from '@liha/shared';
import { findAllForUrl, findEnabledForUrl } from './match';

function record(id: string, origins: string[], enabled = true): AdapterRecord {
  const validation = validateAdapter({
    id,
    name: id,
    version: '1.0.0',
    origins,
    tools: [
      {
        name: 'do_thing',
        description: 'Does the thing on this site.',
        capability: 'INTERACT',
        inputSchema: { type: 'object', properties: {} },
        steps: [{ type: 'click', selector: '#go' }],
      },
    ],
  });
  if (!validation.adapter) throw new Error(validation.errors.join('; '));
  return {
    adapter: validation.adapter,
    source: 'installed',
    enabled,
    installedAt: 0,
    policy: { confirmWrite: false },
  };
}

const official = record('official-crm', ['https://crm.example.com']);
const community = record('community-crm', ['https://crm.example.com']);
const elsewhere = record('other-site', ['https://shop.example.com']);

describe('choosing which adapters run on a page', () => {
  it('returns every adapter that targets the origin', () => {
    const found = findAllForUrl([official, community, elsewhere], 'https://crm.example.com/customers');
    expect(found.map((entry) => entry.adapter.id)).toEqual(['official-crm', 'community-crm']);
  });

  // The registry exists so someone else can publish an adapter for a site you
  // already have one for. Stopping at the first match would silently drop it.
  it('does not stop at the first match', () => {
    expect(findEnabledForUrl([official, community], 'https://crm.example.com/')).toHaveLength(2);
  });

  // And a disabled adapter must withhold only itself.
  it('lets a disabled adapter be skipped without hiding the others', () => {
    const disabledFirst = [record('official-crm', ['https://crm.example.com'], false), community];
    expect(findEnabledForUrl(disabledFirst, 'https://crm.example.com/').map((e) => e.adapter.id)).toEqual([
      'community-crm',
    ]);
  });

  it('returns nothing for an origin no adapter targets', () => {
    expect(findAllForUrl([official, community], 'https://evil.example.com/')).toEqual([]);
    expect(findAllForUrl([official], 'https://crm.example.com.evil.test/')).toEqual([]);
    expect(findAllForUrl([official], 'about:blank')).toEqual([]);
    expect(findAllForUrl([official], 'not a url')).toEqual([]);
  });

  it('matches any of an adapter’s declared origins', () => {
    const both = record('dual', ['http://localhost:5273', 'http://127.0.0.1:5273']);
    expect(findAllForUrl([both], 'http://127.0.0.1:5273/x')).toHaveLength(1);
    expect(findAllForUrl([both], 'http://localhost:5273/x')).toHaveLength(1);
    expect(findAllForUrl([both], 'http://localhost:5274/x')).toEqual([]);
  });
});
