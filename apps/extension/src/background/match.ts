import { originOf } from '@liha/adapter-schema';
import type { AdapterRecord } from '@liha/shared';

/**
 * Selects the adapters that should run on a page.
 *
 * Kept free of extension APIs so it can be tested directly — this is the
 * decision that determines what code reaches a site, and it is worth being able
 * to test in isolation.
 *
 * More than one adapter may target the same origin: the whole point of a
 * registry is that someone else may have published one for a site you already
 * have an adapter for. Every enabled match is returned, and a disabled adapter
 * withholds only itself.
 */
export function findAllForUrl(catalogue: readonly AdapterRecord[], url: string): AdapterRecord[] {
  const origin = originOf(url);
  if (!origin) return [];
  return catalogue.filter((entry) => entry.adapter.origins.includes(origin));
}

export function findEnabledForUrl(catalogue: readonly AdapterRecord[], url: string): AdapterRecord[] {
  return findAllForUrl(catalogue, url).filter((entry) => entry.enabled);
}
