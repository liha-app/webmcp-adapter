import { DEMO_SITE_IDS, SITES, siteUrl, type SiteId } from '@liha/config';
import { findEntry } from './catalog';
import type { Capability } from '@liha/adapter-schema';
import type { MessageKey } from '../i18n/en';

export interface DemoApp {
  id: Exclude<SiteId, 'registry'>;
  name: string;
  /** A message key: the blurb is ours to write, so it exists in both languages. */
  blurbKey: MessageKey;
  /** Resolved for wherever this page is being served from. */
  url: string;
  adapterId: string;
  tools: Array<{ name: string; capability: Capability }>;
  noteKey?: MessageKey;
}

const BLURB_KEYS: Record<string, MessageKey> = {
  'demo-crm': 'demos.blurbCrm',
  'demo-shop': 'demos.blurbShop',
  'demo-project': 'demos.blurbProject',
};

const NOTE_KEYS: Record<string, MessageKey> = {
  'demo-project': 'demos.noteProject',
};

/**
 * The demo apps, resolved against wherever this page is served from: open the
 * portal on localhost and it points at your local demos; open the deployed
 * portal and it points at the deployed ones. The adapters are scoped to both,
 * as separate exact origins.
 */
export function demoApps(currentOrigin?: string): DemoApp[] {
  return DEMO_SITE_IDS.map((id) => {
    const entry = findEntry(id);
    return {
      id,
      name: SITES[id].label,
      blurbKey: BLURB_KEYS[id] ?? 'demos.blurbCrm',
      url: siteUrl(id, currentOrigin),
      adapterId: id,
      tools: (entry?.adapter.tools ?? []).map((tool) => ({ name: tool.name, capability: tool.capability })),
      ...(NOTE_KEYS[id] ? { noteKey: NOTE_KEYS[id] } : {}),
    };
  });
}

/** The one flag that has to be switched on, plus the five steps around it. */
export const SETUP_STEPS: Array<{ key: MessageKey; code?: string }> = [
  { key: 'setup.step1' },
  { key: 'setup.step2', code: 'chrome://flags/#enable-webmcp-testing' },
  { key: 'setup.step3' },
  { key: 'setup.step4' },
  { key: 'setup.step5' },
  { key: 'setup.step6' },
];
