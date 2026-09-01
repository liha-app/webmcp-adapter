import { describe, expect, it } from 'vitest';
import { summarizeEffects, validateAdapter } from '@liha/adapter-schema';
import { OFFICIAL_ADAPTERS } from './index';

/**
 * The published adapters are the part of this project a stranger is asked to
 * trust, so they are held to the same standard as the code.
 */
describe('official adapters', () => {
  it('ships the three demo adapters', () => {
    expect(OFFICIAL_ADAPTERS.map((adapter) => adapter.id).sort()).toEqual([
      'demo-crm',
      'demo-project',
      'demo-shop',
    ]);
  });

  it.each(OFFICIAL_ADAPTERS)('$id validates', (adapter) => {
    expect(validateAdapter(adapter).errors).toEqual([]);
  });

  it.each(OFFICIAL_ADAPTERS)('$id is scoped to first-party demo origins only', (adapter) => {
    for (const origin of adapter.origins) {
      expect(origin).toMatch(/^http:\/\/(localhost|127\.0\.0\.1):52\d\d$/);
    }
  });

  it.each(OFFICIAL_ADAPTERS)('$id documents every tool for an agent to choose from', (adapter) => {
    for (const tool of adapter.tools) {
      expect(tool.description.length).toBeGreaterThan(20);
      for (const property of Object.values(tool.inputSchema.properties)) {
        expect(property.description ?? '').not.toBe('');
      }
    }
  });

  it.each(OFFICIAL_ADAPTERS)('$id declares READ only for tools that change nothing', (adapter) => {
    for (const tool of adapter.tools) {
      if (tool.capability !== 'READ') continue;
      const effects = summarizeEffects(tool);
      // A search box still has to be typed into, but a READ tool must not click,
      // submit or navigate.
      expect({ name: tool.name, clicks: effects.clicks, submits: effects.submits, navigations: effects.navigations })
        .toEqual({ name: tool.name, clicks: 0, submits: 0, navigations: 0 });
    }
  });

  it('classifies deletion as DESTRUCTIVE so it always asks first', () => {
    const project = OFFICIAL_ADAPTERS.find((adapter) => adapter.id === 'demo-project');
    const remove = project?.tools.find((tool) => tool.name === 'delete_task');
    expect(remove?.capability).toBe('DESTRUCTIVE');
  });

  // Checked against what the adapters *do* — tool names and the elements they
  // touch — rather than their prose, which legitimately mentions that no
  // checkout exists.
  it('contains no payment, checkout or credential tooling', () => {
    const surface = OFFICIAL_ADAPTERS.flatMap((adapter) =>
      adapter.tools.flatMap((tool) => [
        tool.name,
        ...tool.steps.map((step) => ('selector' in step ? step.selector : '')),
        ...Object.keys(tool.inputSchema.properties),
      ]),
    )
      .join(' ')
      .toLowerCase();
    for (const forbidden of ['checkout', 'payment', 'pay_', 'credit', 'card', 'password', 'cvv', 'purchase']) {
      expect(surface).not.toContain(forbidden);
    }
  });
});
