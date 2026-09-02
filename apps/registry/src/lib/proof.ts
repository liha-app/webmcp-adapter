import type { MessageKey } from '../i18n/en';

/**
 * What has actually been verified, kept in one place so the claims on the
 * landing page cannot quietly drift from the suite that backs them.
 *
 * The numbers live here; the prose around them lives in the message
 * catalogue, because it has to exist in both languages.
 *
 * Update alongside the test suite — CONTRIBUTING points here.
 */
export const PROOF = {
  unitAndIntegrationTests: 204,
  e2eTests: 44,
  acceptance: [
    { nameKey: 'verified.runPhase0', whatKey: 'verified.runPhase0What', result: '10/10' },
    { nameKey: 'verified.runFull', whatKey: 'verified.runFullWhat', result: '43/43' },
    { nameKey: 'verified.runRecorder', whatKey: 'verified.runRecorderWhat', result: '25/25' },
  ],
  factKeys: [
    'verified.fact1',
    'verified.fact2',
    'verified.fact3',
    'verified.fact4',
    'verified.fact5',
  ],
  ciNoteKey: 'verified.ciNote',
} as const satisfies {
  unitAndIntegrationTests: number;
  e2eTests: number;
  acceptance: ReadonlyArray<{ nameKey: MessageKey; whatKey: MessageKey; result: string }>;
  factKeys: readonly MessageKey[];
  ciNoteKey: MessageKey;
};
