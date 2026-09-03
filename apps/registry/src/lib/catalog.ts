import { OFFICIAL_ADAPTERS } from '@liha/adapters';
import {
  highestCapability,
  validateAdapter,
  type AdapterCategory,
  type AdapterDefinition,
  type Capability,
} from '@liha/adapter-schema';
import { ADAPTER_CATALOG_URL, ADAPTER_REGISTRY_URL } from './links';

export type AdapterStatus = 'official' | 'community';

export interface CatalogEntry {
  adapter: AdapterDefinition;
  /** The strongest capability any of its tools declares. */
  maxCapability: Capability;
  capabilities: Capability[];
  toolCount: number;
  status: AdapterStatus;
  verified: boolean;
  /** Where a reader can audit the definition themselves. */
  sourcePath: string;
  sourceUrl: string;
}

function entryFromAdapter(
  adapter: AdapterDefinition,
  status: AdapterStatus,
  verified: boolean,
  sourcePath = `adapters/${adapter.id}.json`,
): CatalogEntry {
  const capabilities = [...new Set(adapter.tools.map((tool) => tool.capability))];
  return {
    adapter,
    capabilities,
    maxCapability: highestCapability(capabilities),
    toolCount: adapter.tools.length,
    status,
    verified,
    sourcePath,
    sourceUrl: `${ADAPTER_REGISTRY_URL}/blob/main/${sourcePath}`,
  };
}

export const CATALOG: CatalogEntry[] = OFFICIAL_ADAPTERS.map((adapter) =>
  entryFromAdapter(adapter, 'official', Boolean(adapter.verifiedAt)),
);

export const CATEGORIES: AdapterCategory[] = [...new Set(CATALOG.map((entry) => entry.adapter.category ?? 'other'))];

interface PublishedCatalogItem {
  status: AdapterStatus;
  verified: boolean;
  source: string;
  adapter: unknown;
}

interface PublishedCatalog {
  schemaVersion: number;
  adapters: PublishedCatalogItem[];
}

/**
 * Treat the public registry as untrusted input even though its main branch is
 * protected. The Store only accepts the same declarative adapter schema as the
 * extension, plus a small closed set of catalogue metadata.
 */
export function parsePublishedCatalog(value: unknown): CatalogEntry[] | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PublishedCatalog>;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.adapters)) return null;

  const entries: CatalogEntry[] = [];
  const ids = new Set<string>();
  for (const item of candidate.adapters) {
    if (!item || typeof item !== 'object') return null;
    if (item.status !== 'official' && item.status !== 'community') return null;
    if (typeof item.verified !== 'boolean') return null;
    if (typeof item.source !== 'string' || !/^adapters\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(item.source)) {
      return null;
    }
    const validation = validateAdapter(item.adapter);
    if (!validation.ok || !validation.adapter || ids.has(validation.adapter.id)) return null;
    if (item.source !== `adapters/${validation.adapter.id}.json`) return null;
    ids.add(validation.adapter.id);
    entries.push(entryFromAdapter(validation.adapter, item.status, item.verified, item.source));
  }
  return entries;
}

/**
 * Refresh the Store from the community registry. A network or validation
 * failure deliberately leaves the bundled official collection in place.
 */
export async function loadPublishedCatalog(fetcher: typeof fetch = fetch): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetcher(ADAPTER_CATALOG_URL, { cache: 'no-cache', signal: controller.signal });
    if (!response.ok) return false;
    const entries = parsePublishedCatalog(await response.json());
    if (!entries || entries.length === 0) return false;
    CATALOG.splice(0, CATALOG.length, ...entries);
    CATEGORIES.splice(
      0,
      CATEGORIES.length,
      ...new Set(entries.map((entry) => entry.adapter.category ?? 'other')),
    );
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export interface SearchFilters {
  query?: string;
  category?: string;
  capability?: string;
}

/**
 * The one search implementation. The page's filter UI and the `search_adapters`
 * WebMCP tool both call this, so structural filters cannot drift apart. The UI
 * may also provide translated display copy, letting a Japanese query find the
 * same canonical adapter without changing the agent-facing definition.
 */
export function searchCatalog(
  filters: SearchFilters,
  localizedText?: (entry: CatalogEntry) => string,
): CatalogEntry[] {
  const needle = filters.query?.trim().toLowerCase() ?? '';
  return CATALOG.filter((entry) => {
    if (filters.category && filters.category !== 'all' && (entry.adapter.category ?? 'other') !== filters.category) {
      return false;
    }
    if (filters.capability && filters.capability !== 'all') {
      if (!entry.capabilities.includes(filters.capability as Capability)) return false;
    }
    if (!needle) return true;
    const haystack = [
      entry.adapter.id,
      entry.adapter.name,
      entry.adapter.description ?? '',
      entry.adapter.category ?? '',
      ...entry.adapter.origins,
      ...entry.adapter.tools.map((tool) => `${tool.name} ${tool.description}`),
      localizedText?.(entry) ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function findEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.adapter.id === id);
}
