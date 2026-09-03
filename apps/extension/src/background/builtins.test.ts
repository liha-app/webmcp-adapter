import { describe, expect, it } from 'vitest';
import { OFFICIAL_ADAPTERS } from '@liha/adapters';
import { validateAdapter, type AdapterDefinition } from '@liha/adapter-schema';
import { scopeToManifest } from './builtins';

function adapter(origins: string[]): AdapterDefinition {
  const validation = validateAdapter({
    id: 'demo',
    name: 'Demo',
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
  if (!validation.ok || !validation.adapter) throw new Error(validation.errors.join('; '));
  return validation.adapter;
}

const PRODUCTION = ['https://demo-shop.liha.review/*'];
const DEVELOPMENT = [...PRODUCTION, 'http://localhost:5274/*'];

describe('scoping a builtin to what the build asks for', () => {
  it('keeps an origin the manifest declares', () => {
    const scoped = scopeToManifest(adapter(['https://demo-shop.liha.review']), PRODUCTION);
    expect(scoped?.origins).toEqual(['https://demo-shop.liha.review']);
  });

  it('drops the development origins a release build does not ask for', () => {
    const both = adapter(['http://localhost:5274', 'https://demo-shop.liha.review']);
    expect(scopeToManifest(both, PRODUCTION)?.origins).toEqual(['https://demo-shop.liha.review']);
    expect(scopeToManifest(both, DEVELOPMENT)?.origins).toEqual(both.origins);
  });

  it('drops an adapter left with nowhere to run rather than one that runs anywhere', () => {
    expect(scopeToManifest(adapter(['http://localhost:5274']), PRODUCTION)).toBeUndefined();
  });

  it('does not treat a prefix as a match', () => {
    const scoped = scopeToManifest(adapter(['https://demo-shop.liha.review.evil.test']), PRODUCTION);
    expect(scoped).toBeUndefined();
  });

  /*
   * The reason the filter exists: every shipped adapter names a development
   * origin, so a release build that skipped this step would ship builtins —
   * which run at `official` trust, unconfirmed — scoped to the user's own
   * localhost.
   */
  it('has something to do on every adapter we ship', () => {
    const development = OFFICIAL_ADAPTERS.flatMap((entry) =>
      entry.origins.filter((origin) => origin.startsWith('http://')),
    );
    expect(development.length).toBeGreaterThan(0);
  });
});
