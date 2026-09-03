import { describe, expect, it } from 'vitest';
import { validateAdapter } from '@liha/adapter-schema';
import type { RecordedAction } from '@liha/shared';
import {
  draftFromRecording,
  draftToAdapter,
  duplicateSubmits,
  emptyStep,
  parametersOf,
  reachableNow,
  type Draft,
  type DraftStep,
  type StepKind,
} from './draft';

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

describe('what a check can expect to find', () => {
  const step = (kind: StepKind, selector: string): DraftStep => ({
    ...emptyStep(kind),
    selector,
  });

  it('stops at the step that opens something', () => {
    // The dialog's fields do not exist until Add Customer is pressed, so
    // counting them against the list page reported a working flow as broken.
    const steps = [
      step('click', "[data-action='add-customer']"),
      step('fill', "input[name='name']"),
      step('fill', "input[name='email']"),
      step('submit', "[data-testid='customer-form']"),
    ];
    expect(reachableNow(steps)).toBe(1);
  });

  it('covers a whole workflow that never changes the page', () => {
    const steps = [step('readText', 'h1'), step('readAttribute', 'a'), step('assertVisible', '#x')];
    expect(reachableNow(steps)).toBe(steps.length);
  });

  it('includes the step that does the changing, because it is there to be found', () => {
    const steps = [step('waitFor', '#ready'), step('click', '#go'), step('fill', '#after')];
    expect(reachableNow(steps)).toBe(2);
  });

  it('says nothing is reachable in an empty draft', () => {
    expect(reachableNow([])).toBe(0);
  });
});

describe('a click and a submit of the same form', () => {
  const FORM = "[data-testid='customer-form']";
  const draft = (steps: DraftStep[]): Draft => ({
    adapterId: 'x',
    adapterName: 'x',
    version: '0.1.0',
    description: '',
    origin: 'https://example.com',
    toolName: 't',
    toolTitle: '',
    toolDescription: 'd',
    capability: 'WRITE',
    steps,
  });

  it('is reported when both survive into the draft', () => {
    const click = { ...emptyStep('click'), selector: '#create', submitsForm: FORM };
    const submit = { ...emptyStep('submit'), selector: FORM };
    expect(duplicateSubmits(draft([click, submit]))).toEqual([click]);
  });

  it('is not reported for a click that opens the form', () => {
    const open = { ...emptyStep('click'), selector: '#add' };
    const submit = { ...emptyStep('submit'), selector: FORM };
    expect(duplicateSubmits(draft([open, submit]))).toEqual([]);
  });

  it('is not reported when the submit is of a different form', () => {
    const click = { ...emptyStep('click'), selector: '#create', submitsForm: '#other' };
    const submit = { ...emptyStep('submit'), selector: FORM };
    expect(duplicateSubmits(draft([click, submit]))).toEqual([]);
  });
});

describe('a draft made from a recording', () => {
  it('opens with a name and a description, not with examples of them', () => {
    // These were placeholders, which look exactly like filled-in fields and are
    // not: the Studio showed `create_customer` in grey and, under it, "tool
    // name is empty".
    const made = draftFromRecording(recording, 'https://crm.example.com');
    expect(made.toolName).toBe('add_customer');
    expect(made.toolDescription).toContain('Add customer');
    expect(made.toolDescription).toContain('crm.example.com');
  });

  it('is valid the moment it is taken', () => {
    const made = draftFromRecording(recording, 'https://crm.example.com');
    const result = validateAdapter(draftToAdapter(made, {}));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('falls back to something usable when nothing was labelled', () => {
    const unlabelled: RecordedAction[] = [
      { at: 1, kind: 'fill', selector: "input[name='q']", candidates: [], value: 'x' },
      { at: 2, kind: 'submit', selector: 'form', candidates: [] },
    ];
    const made = draftFromRecording(unlabelled, 'https://example.com');
    expect(made.toolName).toBe('submit_form');
    expect(validateAdapter(draftToAdapter(made, {})).ok).toBe(true);
  });
});
