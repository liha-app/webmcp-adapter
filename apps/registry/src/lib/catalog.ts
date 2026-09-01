import { OFFICIAL_ADAPTERS } from '@liha/adapters';
import {
  highestCapability,
  summarizeEffects,
  type AdapterCategory,
  type AdapterDefinition,
  type Capability,
} from '@liha/adapter-schema';

export interface CatalogEntry {
  adapter: AdapterDefinition;
  /** The strongest capability any of its tools declares. */
  maxCapability: Capability;
  capabilities: Capability[];
  toolCount: number;
  /** Where a reader can audit the definition themselves. */
  sourcePath: string;
}

export const CATALOG: CatalogEntry[] = OFFICIAL_ADAPTERS.map((adapter) => {
  const capabilities = [...new Set(adapter.tools.map((tool) => tool.capability))];
  return {
    adapter,
    capabilities,
    maxCapability: highestCapability(capabilities),
    toolCount: adapter.tools.length,
    sourcePath: `adapters/${adapter.id}.json`,
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
 * WebMCP tool both call this, so an agent and a person get the same answers
 * from the same code rather than two implementations that drift apart.
 */
export function searchCatalog(filters: SearchFilters): CatalogEntry[] {
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
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function findEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.adapter.id === id);
}

export function toolEffectSummary(adapter: AdapterDefinition, toolName: string): string {
  const tool = adapter.tools.find((candidate) => candidate.name === toolName);
  if (!tool) return '';
  const effects = summarizeEffects(tool);
  const parts = [
    effects.clicks && `${effects.clicks} click`,
    effects.inputs && `${effects.inputs} input`,
    effects.submits && `${effects.submits} submit`,
    effects.navigations && `${effects.navigations} navigation`,
    effects.reads && `${effects.reads} read`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'no page interaction';
}
