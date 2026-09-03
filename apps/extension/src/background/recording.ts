import type { RecordedAction, RecordingState } from '@liha/shared';

const STORAGE_KEY = 'liha:recording-session';
const MAX_ACTIONS = 200;

interface RecordingSnapshot {
  session: RecordingState | null;
  lastTake: RecordingState | null;
}

interface SessionStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export type ResumePageOutcome = 'inactive' | 'resumed' | 'origin-mismatch';

const EMPTY: RecordingSnapshot = { session: null, lastTake: null };

function pathOf(href: string): string {
  const url = new URL(href);
  return `${url.pathname}${url.search}${url.hash}` || '/';
}

/**
 * Recorder state that survives a Manifest V3 service-worker restart.
 *
 * Demonstrations can contain values typed into ordinary form fields, so the
 * state deliberately uses `storage.session`: it is kept in memory by the
 * browser, is not exposed to content scripts, and disappears when the browser
 * session ends. It must never be moved to `storage.local`.
 *
 * The storage dependency is injected so the state machine can be tested
 * without extension globals. Older engines without `storage.session` get a
 * volatile fallback rather than persisting potentially sensitive values.
 */
export function createRecordingStore(storage?: SessionStorageArea): {
  start(tabId: number, origin: string, href: string): Promise<RecordingState>;
  addAction(tabId: number, action: RecordedAction): Promise<void>;
  resumePage(tabId: number, href: string): Promise<ResumePageOutcome>;
  getRecording(): Promise<RecordingState | null>;
  getLastTake(): Promise<RecordingState | null>;
  stop(): Promise<RecordingState | null>;
} {
  let volatile: RecordingSnapshot = { ...EMPTY };
  let writeQueue: Promise<void> = Promise.resolve();

  const read = async (): Promise<RecordingSnapshot> => {
    if (!storage) return volatile;
    const stored = await storage.get(STORAGE_KEY);
    const value = stored[STORAGE_KEY] as RecordingSnapshot | undefined;
    return value ?? { ...EMPTY };
  };

  const mutate = async <T>(change: (snapshot: RecordingSnapshot) => T): Promise<T> => {
    let result!: T;
    const operation = writeQueue.then(async () => {
      const snapshot = await read();
      result = change(snapshot);
      if (storage) await storage.set({ [STORAGE_KEY]: snapshot });
      else volatile = snapshot;
    });
    writeQueue = operation.catch(() => undefined);
    await operation;
    return result;
  };

  return {
    start(tabId, origin, href) {
      return mutate((snapshot) => {
        const session: RecordingState = {
          tabId,
          origin,
          startedAt: Date.now(),
          lastUrl: href,
          actions: [],
        };
        snapshot.session = session;
        snapshot.lastTake = null;
        return session;
      });
    },

    async addAction(tabId, action) {
      await mutate((snapshot) => {
        if (!snapshot.session || snapshot.session.tabId !== tabId) return;
        if (snapshot.session.actions.length >= MAX_ACTIONS) return;
        snapshot.session.actions.push(action);
      });
    },

    resumePage(tabId, href) {
      return mutate((snapshot) => {
        const session = snapshot.session;
        if (!session || session.tabId !== tabId) return 'inactive';
        let next: URL;
        try {
          next = new URL(href);
        } catch {
          return 'origin-mismatch';
        }
        if (next.origin !== session.origin) return 'origin-mismatch';

        if (session.lastUrl !== href) {
          const path = pathOf(href);
          const previous = session.actions.at(-1);
          if (
            session.actions.length < MAX_ACTIONS &&
            (previous?.kind !== 'navigate' || previous.path !== path)
          ) {
            session.actions.push({
              at: Date.now(),
              kind: 'navigate',
              selector: '',
              candidates: [],
              path,
              label: path,
            });
          }
          session.lastUrl = href;
        }
        return 'resumed';
      });
    },

    async getRecording() {
      return (await read()).session;
    },

    async getLastTake() {
      return (await read()).lastTake;
    },

    stop() {
      return mutate((snapshot) => {
        const finished = snapshot.session;
        snapshot.session = null;
        snapshot.lastTake = finished;
        return finished;
      });
    },
  };
}
