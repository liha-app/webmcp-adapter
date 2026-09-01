import type { Capability } from './adapter';

/**
 * Adapters break. Sites redeploy, class names change, a button moves. The
 * format assumes breakage rather than treating it as exceptional, so health is
 * a first-class part of an adapter's presentation in the Store and popup.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'broken' | 'unknown';

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
  tools: ToolHealth[];
}

export function rollUpHealth(tools: readonly ToolHealth[]): HealthStatus {
  if (tools.length === 0) return 'unknown';
  const known = tools.filter((tool) => tool.status !== 'unknown');
  if (known.length === 0) return 'unknown';
  if (known.every((tool) => tool.status === 'healthy')) return 'healthy';
  if (known.every((tool) => tool.status === 'broken')) return 'broken';
  return 'degraded';
}
