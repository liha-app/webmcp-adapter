import type { Capability } from './adapter';

/**
 * Adapters break. Sites redeploy, class names change, a button moves. The
 * format assumes breakage rather than treating it as exceptional, so health is
 * a first-class part of an adapter's presentation in the Store and popup.
 */
/**
 * `not-applicable` is the fourth answer, and the one that was missing.
 *
 * A tool written for a package's detail page finds nothing on the registry's
 * front page, and calling that "broken" made a working adapter report itself as
 * degraded on half the site it was written for. Not being on the right page is
 * not a fault.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'broken' | 'unknown' | 'not-applicable';

export interface ToolHealth {
  name: string;
  capability: Capability;
  status: HealthStatus;
  /** Selectors probed, with how many elements each resolved to. */
  probes: Array<{ selector: string; matches: number }>;
}

export interface AdapterHealth {
  adapterId: string;
  status: HealthStatus;
  checkedAt: number;
  /** The page this answer is about. A verdict with no page is not a verdict. */
  url?: string;
  tools: ToolHealth[];
}

/**
 * A tool that does not apply here says nothing about the adapter.
 *
 * It is left out of the roll-up rather than counted as a failure: an adapter
 * whose search works on the front page and whose detail tools are simply
 * elsewhere is healthy, not degraded. An adapter with nothing applicable on
 * this page reports that, which is also not a fault.
 */
export function rollUpHealth(tools: readonly ToolHealth[]): HealthStatus {
  if (tools.length === 0) return 'unknown';
  const relevant = tools.filter((tool) => tool.status !== 'not-applicable');
  if (relevant.length === 0) return 'not-applicable';
  const known = relevant.filter((tool) => tool.status !== 'unknown');
  if (known.length === 0) return 'unknown';
  if (known.every((tool) => tool.status === 'healthy')) return 'healthy';
  if (known.every((tool) => tool.status === 'broken')) return 'broken';
  return 'degraded';
}
