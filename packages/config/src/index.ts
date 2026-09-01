import origins from '../origins.json';

/**
 * Deployment origins for every surface in the project.
 *
 * Exact origins, never wildcards. An adapter's security rests on being scoped
 * to origins it declares one by one, so "the production site" is a specific
 * host here and stays a specific host everywhere it is used.
 *
 * Both the development and production origins are listed for each site: an
 * adapter that works on `localhost` during development and on the deployed
 * demo is one adapter with three declared origins, not a wildcard.
 */
export type SiteId = 'registry' | 'demo-crm' | 'demo-shop' | 'demo-project';

export interface SiteConfig {
  label: string;
  port: number;
  production: string;
  development: string[];
}

export const SITES: Record<SiteId, SiteConfig> = origins.sites as Record<SiteId, SiteConfig>;

export const SITE_IDS = Object.keys(SITES) as SiteId[];
export const DEMO_SITE_IDS = SITE_IDS.filter((id): id is Exclude<SiteId, 'registry'> => id !== 'registry');

/** Every origin a site is reachable on, development first. */
export function originsFor(site: SiteId): string[] {
  const config = SITES[site];
  return [...config.development, config.production];
}

/** Extension match patterns for a site, e.g. `https://crm.example.com/*`. */
export function matchPatternsFor(site: SiteId): string[] {
  return originsFor(site).map((origin) => `${origin}/*`);
}

export const ALL_ORIGINS: string[] = SITE_IDS.flatMap(originsFor);
export const ALL_MATCH_PATTERNS: string[] = SITE_IDS.flatMap(matchPatternsFor);
export const DEMO_MATCH_PATTERNS: string[] = DEMO_SITE_IDS.flatMap(matchPatternsFor);
export const REGISTRY_MATCH_PATTERNS: string[] = matchPatternsFor('registry');

/**
 * The origin to link to at runtime.
 *
 * The portal, the demos and the extension are deployed together, so a page
 * served from production links to production demos and a page served from
 * localhost links to the local ones. Falls back to production when there is no
 * document to ask, which is the right default for anything rendered ahead of time.
 */
export function siteUrl(site: SiteId, currentOrigin?: string): string {
  const config = SITES[site];
  if (!currentOrigin) return config.production;
  if (config.development.includes(currentOrigin)) return currentOrigin;
  const local = config.development.find((origin) => {
    try {
      return new URL(origin).hostname === new URL(currentOrigin).hostname;
    } catch {
      return false;
    }
  });
  return local ?? (SITES.registry.development.includes(currentOrigin) ? config.development[0]! : config.production);
}
