import { describe, expect, it } from 'vitest';
import type { RecordedAction } from '@liha/shared';
import { createRecordingStore, mergeAction } from './recording';

function action(label: string): RecordedAction {
  return {
    at: Date.now(),
    kind: 'click',
    selector: `[data-action='${label}']`,
    candidates: [],
    label,
  };
}

function sessionStorage() {
  const values: Record<string, unknown> = {};
  return {
    values,
    async get(key: string) {
      return { [key]: values[key] };
    },
    async set(items: Record<string, unknown>) {
      Object.assign(values, structuredClone(items));
    },
  };
}

describe('recording session store', () => {
  it('survives a service-worker restart without writing persistent storage', async () => {
    const storage = sessionStorage();
    const firstWorker = createRecordingStore(storage);
    await firstWorker.start(7, 'https://example.com', 'https://example.com/start');
    await firstWorker.addAction(7, action('before-restart'));

    const restartedWorker = createRecordingStore(storage);
    await restartedWorker.addAction(7, action('after-restart'));
    const take = await restartedWorker.stop();

    expect(take?.actions.map((item) => item.label)).toEqual(['before-restart', 'after-restart']);
    expect(await restartedWorker.getRecording()).toBeNull();
    expect((await restartedWorker.getLastTake())?.actions).toHaveLength(2);
  });

  it('records same-origin document navigation once and resumes the session', async () => {
    const store = createRecordingStore(sessionStorage());
    await store.start(4, 'https://example.com', 'https://example.com/customers');

    expect(await store.resumePage(4, 'https://example.com/customers?page=2#row')).toBe('resumed');
    expect(await store.resumePage(4, 'https://example.com/customers?page=2#row')).toBe('resumed');

    expect((await store.getRecording())?.actions).toEqual([
      expect.objectContaining({ kind: 'navigate', path: '/customers?page=2#row' }),
    ]);
  });

  it('refuses to resume a recording on another origin', async () => {
    const store = createRecordingStore(sessionStorage());
    await store.start(4, 'https://example.com', 'https://example.com/start');

    expect(await store.resumePage(4, 'https://accounts.example.net/login')).toBe('origin-mismatch');
    expect((await store.getRecording())?.lastUrl).toBe('https://example.com/start');
  });

  it('serializes concurrent actions so none overwrite another', async () => {
    const store = createRecordingStore(sessionStorage());
    await store.start(2, 'https://example.com', 'https://example.com/');

    await Promise.all(Array.from({ length: 20 }, (_, index) => store.addAction(2, action(String(index)))));

    expect((await store.getRecording())?.actions.map((item) => item.label)).toEqual(
      Array.from({ length: 20 }, (_, index) => String(index)),
    );
  });
});

const gesture = (
  kind: RecordedAction['kind'],
  selector: string,
  at: number,
  extra: Partial<RecordedAction> = {},
) => ({ at, kind, selector, candidates: [], ...extra }) as RecordedAction;

const kinds = (actions: RecordedAction[]) => actions.map((entry) => entry.kind).join(',');

describe('a click and the submit it causes', () => {
  const FORM = "[data-testid='customer-form']";

  it('are recorded as the one action they are', () => {
    let actions: RecordedAction[] = [];
    for (const next of [
      gesture('click', "[data-action='add-customer']", 1000),
      gesture('fill', "input[name='name']", 1200, { value: 'Dana Lopez' }),
      gesture('fill', "input[name='email']", 1400, { value: 'dana@example.com' }),
      gesture('click', "[data-action='create-customer']", 1600, { submitsForm: FORM }),
      gesture('submit', FORM, 1601),
    ]) {
      actions = mergeAction(actions, next);
    }
    // Not click,fill,fill,click,submit — the tool that produced would have
    // clicked Create, closing the dialog, and then looked for the form again.
    expect(kinds(actions)).toBe('click,fill,fill,submit');
    expect(actions.at(-1)?.selector).toBe(FORM);
  });

  it('keeps a click that opened something, which is a step of its own', () => {
    const actions = mergeAction([gesture('click', "[data-action='add-customer']", 1000)], gesture('submit', FORM, 1100));
    expect(kinds(actions)).toBe('click,submit');
  });

  it('keeps a click on a different form’s button', () => {
    const actions = mergeAction(
      [gesture('click', '#save', 1000, { submitsForm: '#other-form' })],
      gesture('submit', FORM, 1010),
    );
    expect(kinds(actions)).toBe('click,submit');
  });

  it('keeps a click that a later, unrelated submit follows', () => {
    const actions = mergeAction(
      [gesture('click', '#save', 1000, { submitsForm: FORM })],
      gesture('submit', FORM, 1000 + 9000),
    );
    expect(kinds(actions)).toBe('click,submit');
  });

  it('leaves everything else alone', () => {
    let actions: RecordedAction[] = [];
    for (const next of [
      gesture('click', '#a', 1),
      gesture('fill', '#b', 2),
      gesture('select', '#c', 3),
      gesture('check', '#d', 4),
    ]) {
      actions = mergeAction(actions, next);
    }
    expect(kinds(actions)).toBe('click,fill,select,check');
  });
});
