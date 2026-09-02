import type { ReactElement } from 'react';
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

/*
 * Adapter icons.
 *
 * The store layout is built around a 64px squircle, so adapters need one. These
 * are drawn here rather than shipped as files: the hue comes from a hash of the
 * adapter id, so a contributed adapter gets a stable icon without anyone having
 * to supply artwork, and the glyph comes from the declared category.
 */
function hueOf(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) % 360;
  return hash;
}

const GLYPHS: Record<string, ReactElement> = {
  crm: (
    <g fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="32" cy="25" r="8" />
      <path d="M17 47c2.6-7.4 8.4-11.2 15-11.2S44.4 39.6 47 47" />
    </g>
  ),
  commerce: (
    <g fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 24h26l-2.4 24H21.4L19 24Z" />
      <path d="M26 24v-4a6 6 0 0 1 12 0v4" />
    </g>
  ),
  productivity: (
    <g fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 23.5l4 4 6.5-7" />
      <path d="M18 41.5l4 4 6.5-7" />
      <path d="M35 25h12M35 43h12" />
    </g>
  ),
  'developer-tools': (
    <g fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M25 24l-9 8 9 8" />
      <path d="M39 24l9 8-9 8" />
    </g>
  ),
  registry: (
    <g fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M32 15l15 8-15 8-15-8 15-8Z" />
      <path d="M17 32l15 8 15-8" />
      <path d="M17 41l15 8 15-8" />
    </g>
  ),
  other: (
    <g fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M25 17v11M39 17v11" />
      <path d="M19 28h26v5a13 13 0 0 1-13 13 13 13 0 0 1-13-13v-5Z" />
      <path d="M32 46v6" />
    </g>
  ),
};

export function AdapterIcon({ id, category, size = 64 }: { id: string; category?: string; size?: number }) {
  const hue = hueOf(id);
  const glyph = GLYPHS[category ?? 'other'] ?? GLYPHS.other;
  const gradientId = `icon-${id}`;
  return (
    <span className="appicon" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" role="presentation">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor={`hsl(${hue} 84% 62%)`} />
            <stop offset="100%" stopColor={`hsl(${(hue + 26) % 360} 76% 42%)`} />
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill={`url(#${gradientId})`} />
        <rect width="64" height="22" fill="#fff" opacity="0.09" />
        {glyph}
      </svg>
    </span>
  );
}
