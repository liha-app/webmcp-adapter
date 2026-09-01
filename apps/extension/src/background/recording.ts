import type { RecordedAction, RecordingState } from '@liha/shared';

/**
 * Recorder session state.
 *
 * Held in memory only. Recorded actions carry the values a person typed while
 * demonstrating the workflow, and those never reach storage: the Studio reads
 * them from the live session, and stopping the recording drops them.
 */
let session: RecordingState | null = null;

const MAX_ACTIONS = 200;

export function startRecording(tabId: number, origin: string): RecordingState {
  session = { tabId, origin, startedAt: Date.now(), actions: [] };
  return session;
}

export function addAction(tabId: number, action: RecordedAction): void {
  if (!session || session.tabId !== tabId) return;
  if (session.actions.length >= MAX_ACTIONS) return;
  session.actions.push(action);
}

export function getRecording(): RecordingState | null {
  return session;
}

export function stopRecording(): RecordingState | null {
  const finished = session;
  session = null;
  return finished;
}

/** Kept separately so the Studio can still read the last take after Stop. */
let lastTake: RecordingState | null = null;

export function keepTake(state: RecordingState | null): void {
  lastTake = state;
}

export function getLastTake(): RecordingState | null {
  return lastTake;
}
