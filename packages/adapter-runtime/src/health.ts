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

/** Whether this page is one the tool is for. Undeclared means "no opinion". */
export function appliesHere(tool: AdapterDefinition['tools'][number], root: ParentNode): boolean | null {
  const conditions = tool.appliesWhen;
  if (!conditions || conditions.length === 0) return null;
  return conditions.every((selector) => countMatches(selector, root) > 0);
}

export function checkAdapterHealth(
  adapter: AdapterDefinition,
  root: ParentNode,
  now: () => number,
  url?: string,
): AdapterHealth {
  /*
   * A tool that finds nothing is broken unless it said where it belongs.
   *
   * The temptation is to excuse it when another tool of the same adapter still
   * resolves — "the adapter knows this page, so this one must be for a
   * different one". That reading is unprovable from here, and paying for it
   * means losing the case health exists for: one selector going stale while the
   * rest of the site is unchanged is exactly a tool quietly coming apart, and
   * it would be reported as fine. Only the author knows which of the two it is,
   * and `appliesWhen` is how they say so.
   */
  const tools: ToolHealth[] = adapter.tools.map((tool) => {
    const selectors = probeSelectorsFor(tool);
    const probes = selectors.map((selector) => ({ selector, matches: countMatches(selector, root) }));
    let status: ToolHealth['status'];
    if (appliesHere(tool, root) === false) status = 'not-applicable';
    else if (probes.length === 0) status = 'unknown';
    else if (probes.every((probe) => probe.matches === 1)) status = 'healthy';
    else if (probes.every((probe) => probe.matches === 0 || probe.matches < 0)) status = 'broken';
    else status = 'degraded';
    return { name: tool.name, capability: tool.capability, status, probes };
  });

  return {
    adapterId: adapter.id,
    status: rollUpHealth(tools),
    checkedAt: now(),
    ...(url === undefined ? {} : { url }),
    tools,
  };
}
