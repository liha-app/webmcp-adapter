import { describe, expect, it } from 'vitest';
import { validateAdapter } from '@liha/adapter-schema';
import type { RecordedAction } from '@liha/shared';
import { draftFromRecording, draftToAdapter, parametersOf } from './draft';

const recording: RecordedAction[] = [
  { at: 1, kind: 'click', selector: "[data-action='add-customer']", candidates: [], label: 'Add customer' },
  { at: 2, kind: 'fill', selector: "input[name='name']", candidates: [], value: 'Alice Smith' },
  { at: 3, kind: 'fill', selector: "input[name='email']", candidates: [], value: 'alice@example.com' },
  { at: 4, kind: 'submit', selector: "[data-testid='customer-form']", candidates: [] },
];

describe('draftFromRecording', () => {
  it('turns recorded actions into steps in order', () => {
    const draft = draftFromRecording(recording, 'https://crm.example.com');
    expect(draft.steps.map((step) => step.kind)).toEqual(['click', 'fill', 'fill', 'submit']);
    expect(draft.origin).toBe('https://crm.example.com');
  });

  // A demonstration is an example of the workflow, not the exact call an agent
  // should make, so typed values start out as parameters.
  it('proposes recorded values as tool input, named after the field', () => {
    const draft = draftFromRecording(recording, 'https://crm.example.com');
    expect(draft.steps[1]).toMatchObject({ parameterized: true, parameter: 'name', value: 'Alice Smith' });
    expect(draft.steps[2]).toMatchObject({ parameterized: true, parameter: 'email' });
    expect(parametersOf(draft).map((parameter) => parameter.name)).toEqual(['name', 'email']);
  });

  it('leaves clicks alone', () => {
    const draft = draftFromRecording(recording, 'https://crm.example.com');
    expect(draft.steps[0]?.parameterized).toBe(false);
  });

  it('records an action whose value was withheld without inventing one', () => {
    const withheld: RecordedAction[] = [{ at: 1, kind: 'fill', selector: "input[name='password']", candidates: [] }];
    const draft = draftFromRecording(withheld, 'https://crm.example.com');
    expect(draft.steps[0]?.value).toBe('');
    expect(draft.steps[0]?.parameterized).toBe(false);
  });
});

describe('draftToAdapter', () => {
  function complete() {
    const draft = draftFromRecording(recording, 'https://crm.example.com');
    return {
      ...draft,
      adapterId: 'crm-adapter',
      adapterName: 'CRM adapter',
      toolName: 'create_customer',
      toolDescription: 'Create a customer by filling in the Add Customer form.',
      capability: 'WRITE' as const,
    };
  }

  it('produces an adapter that passes the same validation as a published one', () => {
    const adapter = draftToAdapter(complete(), { name: 'Full name', email: 'Email address' });
    const result = validateAdapter(adapter);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('turns parameterised steps into placeholders and a matching input schema', () => {
    const adapter = draftToAdapter(complete()) as {
      tools: Array<{ steps: Array<Record<string, unknown>>; inputSchema: { required: string[] } }>;
    };
    expect(adapter.tools[0]?.steps[1]).toMatchObject({ type: 'fill', value: '{{name}}' });
    expect(adapter.tools[0]?.inputSchema.required).toEqual(['name', 'email']);
  });

  it('is invalid until the author names the tool', () => {
    const draft = { ...complete(), toolName: '' };
    expect(validateAdapter(draftToAdapter(draft)).ok).toBe(false);
  });

  it('never emits a step type outside the declarative vocabulary', () => {
    const adapter = draftToAdapter(complete()) as { tools: Array<{ steps: Array<{ type: string }> }> };
    const allowed = new Set(['click', 'fill', 'select', 'check', 'uncheck', 'submit', 'waitFor', 'assertVisible', 'assertText', 'readText', 'readAttribute', 'readList', 'navigate']);
    for (const step of adapter.tools[0]?.steps ?? []) expect(allowed.has(step.type)).toBe(true);
  });
});
