import { OFFICIAL_ADAPTERS } from '@liha/adapters';
import {
  highestCapability,
  type AdapterCategory,
  type AdapterDefinition,
  type Capability,
} from '@liha/adapter-schema';
import { ADAPTER_REGISTRY_URL } from './links';

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

export const CATALOG: CatalogEntry[] = OFFICIAL_ADAPTERS.map((adapter) => {
  const capabilities = [...new Set(adapter.tools.map((tool) => tool.capability))];
  return {
    adapter,
    capabilities,
    maxCapability: highestCapability(capabilities),
    toolCount: adapter.tools.length,
    status: 'official',
    verified: Boolean(adapter.verifiedAt),
    sourcePath: `adapters/${adapter.id}.json`,
    sourceUrl: `${ADAPTER_REGISTRY_URL}/blob/main/adapters/${adapter.id}.json`,
  };
});

export const CATEGORIES: AdapterCategory[] = [...new Set(CATALOG.map((entry) => entry.adapter.category ?? 'other'))];

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
