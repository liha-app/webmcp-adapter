import { describe, expect, it } from 'vitest';
import type { RecordedAction } from '@liha/shared';
import { createRecordingStore } from './recording';

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
