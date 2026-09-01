import { validateAdapter, type AdapterDefinition } from '@liha/adapter-schema';
import demoCrm from './demo-crm.json';
import demoProject from './demo-project.json';
import demoShop from './demo-shop.json';

const RAW: unknown[] = [demoCrm, demoShop, demoProject];

/**
 * The official adapter catalogue.
 *
 * Even first-party definitions go through schema validation before anything
 * consumes them: an adapter is data, and data from any source is validated the
 * same way. A definition that fails validation is dropped loudly rather than
 * shipped.
 */
export const OFFICIAL_ADAPTERS: AdapterDefinition[] = RAW.map((candidate) => {
  const result = validateAdapter(candidate);
  if (!result.ok || !result.adapter) {
    throw new Error(`bundled adapter failed validation: ${result.errors.join('; ')}`);
  }
  return result.adapter;
});

export function findOfficialAdapter(id: string): AdapterDefinition | undefined {
  return OFFICIAL_ADAPTERS.find((adapter) => adapter.id === id);
}
