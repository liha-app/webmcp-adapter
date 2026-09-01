import type { Capability, HealthStatus } from '@liha/adapter-schema';

export function CapabilityBadge({ capability }: { capability: Capability }) {
  return <span className={`cap cap--${capability}`}>{capability}</span>;
}

const HEALTH_TEXT: Record<HealthStatus, string> = {
  healthy: 'healthy',
  degraded: 'degraded',
  broken: 'broken',
  unknown: 'not checked',
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  return (
    <span className={`health health--${status}`} title="Reported by your browser extension against the live site">
      {HEALTH_TEXT[status]}
    </span>
  );
}
