import { DEMO_SITE_IDS, SITES, siteUrl, type SiteId } from '@liha/config';
import { findEntry } from './catalog';
import type { Capability } from '@liha/adapter-schema';

export interface DemoApp {
  id: Exclude<SiteId, 'registry'>;
  name: string;
  blurb: string;
  /** Resolved for wherever this page is being served from. */
  url: string;
  adapterId: string;
  tools: Array<{ name: string; capability: Capability }>;
  note?: string;
}

const BLURBS: Record<string, string> = {
  'demo-crm': 'A customer list with an add-and-edit dialog. Ordinary CRUD, ordinary React.',
  'demo-shop': 'A storefront with search, a cart and coupon codes. No checkout, by design.',
  'demo-project': 'Tasks with assignees and statuses — including a delete, so you can watch a destructive tool ask first.',
};

const NOTES: Record<string, string> = {
  'demo-project': 'Use this one to see the DESTRUCTIVE confirmation.',
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
      blurb: BLURBS[id] ?? '',
      url: siteUrl(id, currentOrigin),
      adapterId: id,
      tools: (entry?.adapter.tools ?? []).map((tool) => ({ name: tool.name, capability: tool.capability })),
      ...(NOTES[id] ? { note: NOTES[id] } : {}),
    };
  });
}

export const SETUP_STEPS = [
  { text: 'Use Google Chrome 151 or newer.' },
  { text: 'Enable the WebMCP flag and relaunch.', code: 'chrome://flags/#enable-webmcp-testing' },
  { text: 'Load the extension: download it, unzip, then Load unpacked at chrome://extensions with Developer mode on.' },
  { text: 'Open one of the demos below.' },
  { text: 'Check the Liha popup — the adapter should be enabled and its tools registered.' },
  { text: 'Ask your WebMCP agent to do something, for example “create a customer named Alice Smith”.' },
];
