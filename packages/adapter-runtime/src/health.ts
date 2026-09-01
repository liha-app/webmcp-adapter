import {
  rollUpHealth,
  stepSelector,
  type AdapterDefinition,
  type AdapterHealth,
  type ToolHealth,
} from '@liha/adapter-schema';
import { countMatches } from './dom';

/**
 * Probes the selectors a tool needs while the page is at rest.
 *
 * Only entry-point selectors can be checked without side effects — the fields
 * inside a dialog do not exist until something opens it — so a tool declares
 * `probeSelectors`, and otherwise its first selector-bearing step is used.
 * Health is a signal, not a guarantee: it says "this adapter still recognises
 * the page", not "every step will succeed".
 */
export function probeSelectorsFor(tool: AdapterDefinition['tools'][number]): string[] {
  if (tool.probeSelectors && tool.probeSelectors.length > 0) return tool.probeSelectors;
  for (const step of tool.steps) {
    const selector = stepSelector(step);
    if (selector) return [selector];
  }
  return [];
}

export function checkAdapterHealth(
  adapter: AdapterDefinition,
  root: ParentNode,
  now: () => number,
): AdapterHealth {
  const tools: ToolHealth[] = adapter.tools.map((tool) => {
    const selectors = probeSelectorsFor(tool);
    const probes = selectors.map((selector) => ({ selector, matches: countMatches(selector, root) }));
    let status: ToolHealth['status'];
    if (probes.length === 0) status = 'unknown';
    else if (probes.every((probe) => probe.matches === 1)) status = 'healthy';
    else if (probes.every((probe) => probe.matches === 0 || probe.matches < 0)) status = 'broken';
    else status = 'degraded';
    return { name: tool.name, capability: tool.capability, status, probes };
  });

  return { adapterId: adapter.id, status: rollUpHealth(tools), checkedAt: now(), tools };
}
