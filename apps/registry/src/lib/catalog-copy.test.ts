import { describe, expect, it } from 'vitest';
import { CATALOG, findEntry, searchCatalog } from './catalog';
import {
  JA_CATALOG_COPY,
  adapterDescription,
  catalogSearchText,
  categoryLabel,
  localizedInputSchema,
  toolDescription,
  toolEffectSummary,
  verifiedDate,
} from './catalog-copy';

describe('official catalogue translations', () => {
  it('covers every official adapter, tool and documented input', () => {
    expect(Object.keys(JA_CATALOG_COPY).sort()).toEqual(
      CATALOG.map((entry) => entry.adapter.id).sort(),
    );

    for (const { adapter } of CATALOG) {
      const copy = JA_CATALOG_COPY[adapter.id];
      expect(copy, adapter.id).toBeDefined();
      expect(copy!.description, adapter.id).not.toBe(adapter.description);
      expect(Object.keys(copy!.tools).sort(), adapter.id).toEqual(
        adapter.tools.map((tool) => tool.name).sort(),
      );

      for (const tool of adapter.tools) {
        const translatedTool = copy!.tools[tool.name];
        expect(translatedTool!.description, `${adapter.id}.${tool.name}`).not.toBe(tool.description);

        const canonicalProperties = tool.inputSchema.properties ?? {};
        const translatedSchema = localizedInputSchema(
          adapter.id,
          tool.name,
          tool.inputSchema,
          'ja',
        );
        const translatedProperties = translatedSchema.properties as
          | Record<string, { description?: string }>
          | undefined;

        for (const [name, property] of Object.entries(canonicalProperties)) {
          if (!property.description) continue;
          expect(
            translatedProperties?.[name]?.description,
            `${adapter.id}.${tool.name}.${name}`,
          ).not.toBe(property.description);
        }
      }
    }
  });

  it('keeps English display copy canonical', () => {
    const adapter = findEntry('demo-crm')!.adapter;
    const tool = adapter.tools[0]!;
    expect(adapterDescription(adapter, 'en')).toBe(adapter.description);
    expect(toolDescription(adapter.id, tool.name, tool.description, 'en')).toBe(tool.description);
    expect(localizedInputSchema(adapter.id, tool.name, tool.inputSchema, 'en')).toBe(tool.inputSchema);
  });

  it('localizes category labels without changing category identifiers', () => {
    expect(categoryLabel('crm', 'en')).toBe('CRM');
    expect(categoryLabel('crm', 'ja')).toBe('顧客管理');
    expect(categoryLabel('commerce', 'ja')).toBe('EC・コマース');
    expect(categoryLabel('productivity', 'ja')).toBe('仕事効率化');
  });

  it.each([
    ['顧客', 'demo-crm'],
    ['タスク', 'demo-project'],
    ['クーポン', 'demo-shop'],
  ])('finds %s in Japanese display copy', (query, expectedId) => {
    const results = searchCatalog({ query }, (entry) => catalogSearchText(entry, 'ja'));
    expect(results.map((entry) => entry.adapter.id)).toEqual([expectedId]);
  });

  it('still searches canonical English copy', () => {
    expect(searchCatalog({ query: 'coupon' }).map((entry) => entry.adapter.id)).toEqual(['demo-shop']);
  });

  it('uses readable effect counts in both languages', () => {
    const adapter = findEntry('demo-crm')!.adapter;
    expect(toolEffectSummary(adapter, 'search_customers', 'en')).toBe('1 input · 1 read');
    expect(toolEffectSummary(adapter, 'search_customers', 'ja')).toBe('入力1回 · 読み取り1回');
  });

  it('translates schema descriptions but preserves agent input values', () => {
    const adapter = findEntry('demo-shop')!.adapter;
    const tool = adapter.tools.find((candidate) => candidate.name === 'choose_top')!;
    const schema = localizedInputSchema(adapter.id, tool.name, tool.inputSchema, 'ja');
    const translatedTop = (schema.properties as Record<string, { description: string; enum: string[] }>).top!;
    const canonicalTop = (tool.inputSchema.properties as Record<string, { enum: string[] }>).top!;
    expect(translatedTop.description).toBe('取り付ける天板素材');
    expect(translatedTop.enum).toEqual(canonicalTop.enum);
  });

  it('formats verified dates for the selected locale', () => {
    expect(verifiedDate('2026-09-01', 'en', 'fallback')).toBe('Sep 1, 2026');
    expect(verifiedDate('2026-09-01', 'ja', 'fallback')).toBe('2026年9月1日');
    expect(verifiedDate(undefined, 'ja', '未確認')).toBe('未確認');
  });
});
