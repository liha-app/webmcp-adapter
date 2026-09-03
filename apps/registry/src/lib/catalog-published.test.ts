import { describe, expect, it } from 'vitest';
import { CATALOG, loadPublishedCatalog, parsePublishedCatalog } from './catalog';

const communityAdapter = {
  id: 'community-notes',
  name: 'Community Notes',
  version: '1.0.0',
  description: 'Read notes from a community demo.',
  origins: ['https://notes.example.com'],
  tools: [
    {
      name: 'read_notes',
      description: 'Read the visible notes.',
      capability: 'READ',
      inputSchema: { type: 'object', properties: {} },
      steps: [{ type: 'readText', selector: '[data-testid="notes"]', as: 'notes' }],
    },
  ],
};

const published = {
  schemaVersion: 1,
  adapters: [
    {
      status: 'community',
      verified: false,
      source: 'adapters/community-notes.json',
      adapter: communityAdapter,
    },
  ],
};

describe('published adapter catalogue', () => {
  it('turns validated community entries into Store entries', () => {
    const result = parsePublishedCatalog(published);
    expect(result).toHaveLength(1);
    expect(result?.[0]).toMatchObject({
      status: 'community',
      verified: false,
      sourcePath: 'adapters/community-notes.json',
    });
  });

  it('rejects metadata paths that do not match the adapter id', () => {
    expect(
      parsePublishedCatalog({
        ...published,
        adapters: [{ ...published.adapters[0], source: 'adapters/someone-else.json' }],
      }),
    ).toBeNull();
  });

  it('keeps the bundled catalogue when fetching fails', async () => {
    const before = CATALOG.map((entry) => entry.adapter.id);
    const loaded = await loadPublishedCatalog(async () => new Response(null, { status: 503 }));
    expect(loaded).toBe(false);
    expect(CATALOG.map((entry) => entry.adapter.id)).toEqual(before);
  });
});
