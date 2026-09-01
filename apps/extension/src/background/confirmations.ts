import type { ConfirmationPayload } from '@liha/shared';
import { ext } from '../platform';

interface Pending {
  payload: ConfirmationPayload;
  resolve: (approved: boolean) => void;
  windowId?: number;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, Pending>();
const CONFIRM_TIMEOUT_MS = 120_000;

function newRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Shows a confirmation window and resolves with the user's decision.
 *
 * Everything that is not an explicit approval denies: a timeout, a closed
 * window, a window that could not be opened. A confirmation gate that fails
 * open is not a gate.
 */
export function requestConfirmation(payload: ConfirmationPayload): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const requestId = newRequestId();
    let settled = false;
    const settle = (approved: boolean) => {
      if (settled) return;
      settled = true;
      const entry = pending.get(requestId);
      if (entry) {
        clearTimeout(entry.timer);
        pending.delete(requestId);
        if (entry.windowId !== undefined) {
          ext.windows.remove(entry.windowId).catch(() => {
            /* already closed */
          });
        }
      }
      resolve(approved);
    };

    const timer = setTimeout(() => settle(false), CONFIRM_TIMEOUT_MS);
    pending.set(requestId, { payload, resolve: settle, timer });

    ext.windows
      .create({
        url: ext.runtime.getURL(`confirm/confirm.html?id=${requestId}`),
        type: 'popup',
        width: 460,
        height: 560,
      })
      .then((window) => {
        const entry = pending.get(requestId);
        if (entry && window?.id !== undefined) entry.windowId = window.id;
      })
      .catch((error) => {
        console.error('[liha] could not open the confirmation window', error);
        settle(false);
      });
  });
}

export function getPendingRequest(requestId: string): ConfirmationPayload | null {
  return pending.get(requestId)?.payload ?? null;
}

export function decide(requestId: string, approved: boolean): boolean {
  const entry = pending.get(requestId);
  if (!entry) return false;
  entry.resolve(approved);
  return true;
}

/** Closing the window without deciding is a denial. */
export function handleWindowClosed(windowId: number): void {
  for (const [, entry] of pending) {
    if (entry.windowId === windowId) entry.resolve(false);
  }
}
