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

/**
 * How long after a click the browser's own form submission still counts as the
 * same human action. The two are raised in the same task; this is slack for a
 * site that prevents the default and submits the form itself a moment later.
 */
const SAME_GESTURE_MS = 2000;

/**
 * One human action, one step.
 *
 * Pressing a form's submit button raises a click and then a submit, and
 * recording both produced a tool that clicked Create — which closed the dialog
 * — and then went looking for the same form to submit, by which time it was
 * gone: `matched 0 elements`, on a workflow the person had just performed
 * successfully. Only the submit is kept, because it is the step that does the
 * work and the one that still resolves after the click has had its effect.
 *
 * Matched on the form rather than on timing alone: a click on something else
 * that happens to precede a submit is a real step and stays.
 */
export function mergeAction(actions: RecordedAction[], action: RecordedAction): RecordedAction[] {
  const previous = actions[actions.length - 1];
  const sameGesture =
    action.kind === 'submit' &&
    previous?.kind === 'click' &&
    previous.submitsForm !== undefined &&
    previous.submitsForm === action.selector &&
    action.at - previous.at <= SAME_GESTURE_MS;
  return sameGesture ? [...actions.slice(0, -1), action] : [...actions, action];
}

export function startRecording(tabId: number, origin: string): RecordingState {
  session = { tabId, origin, startedAt: Date.now(), actions: [] };
  return session;
}

export function addAction(tabId: number, action: RecordedAction): void {
  if (!session || session.tabId !== tabId) return;
  if (session.actions.length >= MAX_ACTIONS) return;
  session.actions = mergeAction(session.actions, action);
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
