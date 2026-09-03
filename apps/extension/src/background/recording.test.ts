import { describe, expect, it } from 'vitest';
import type { RecordedAction } from '@liha/shared';
import { mergeAction } from './recording';

const action = (kind: RecordedAction['kind'], selector: string, at: number, extra: Partial<RecordedAction> = {}) =>
  ({ at, kind, selector, candidates: [], ...extra }) as RecordedAction;

const kinds = (actions: RecordedAction[]) => actions.map((entry) => entry.kind).join(',');

describe('a click and the submit it causes', () => {
  const FORM = "[data-testid='customer-form']";

  it('are recorded as the one action they are', () => {
    let actions: RecordedAction[] = [];
    for (const next of [
      action('click', "[data-action='add-customer']", 1000),
      action('fill', "input[name='name']", 1200, { value: 'Dana Lopez' }),
      action('fill', "input[name='email']", 1400, { value: 'dana@example.com' }),
      action('click', "[data-action='create-customer']", 1600, { submitsForm: FORM }),
      action('submit', FORM, 1601),
    ]) {
      actions = mergeAction(actions, next);
    }
    // Not click,fill,fill,click,submit — the tool that produced would have
    // clicked Create, closing the dialog, and then looked for the form again.
    expect(kinds(actions)).toBe('click,fill,fill,submit');
    expect(actions.at(-1)?.selector).toBe(FORM);
  });

  it('keeps a click that opened something, which is a step of its own', () => {
    const actions = mergeAction([action('click', "[data-action='add-customer']", 1000)], action('submit', FORM, 1100));
    expect(kinds(actions)).toBe('click,submit');
  });

  it('keeps a click on a different form’s button', () => {
    const actions = mergeAction(
      [action('click', '#save', 1000, { submitsForm: '#other-form' })],
      action('submit', FORM, 1010),
    );
    expect(kinds(actions)).toBe('click,submit');
  });

  it('keeps a click that a later, unrelated submit follows', () => {
    const actions = mergeAction(
      [action('click', '#save', 1000, { submitsForm: FORM })],
      action('submit', FORM, 1000 + 9000),
    );
    expect(kinds(actions)).toBe('click,submit');
  });

  it('leaves everything else alone', () => {
    let actions: RecordedAction[] = [];
    for (const next of [
      action('click', '#a', 1),
      action('fill', '#b', 2),
      action('select', '#c', 3),
      action('check', '#d', 4),
    ]) {
      actions = mergeAction(actions, next);
    }
    expect(kinds(actions)).toBe('click,fill,select,check');
  });
});
