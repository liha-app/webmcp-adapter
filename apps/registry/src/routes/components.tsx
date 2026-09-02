import type { ReactElement } from 'react';
import type { Capability, HealthStatus } from '@liha/adapter-schema';
import { useI18n, type MessageKey } from '../i18n';

export function CapabilityBadge({ capability }: { capability: Capability }) {
  return <span className={`cap cap--${capability}`}>{capability}</span>;
}

const HEALTH_KEY: Record<HealthStatus, MessageKey> = {
  healthy: 'health.healthy',
  degraded: 'health.degraded',
  broken: 'health.broken',
  unknown: 'health.unknown',
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  const { t } = useI18n();
  return (
    <span className={`health health--${status}`} title={t('health.title')}>
      {t(HEALTH_KEY[status])}
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

/*
 * The product mark: the Liha jellyfish, drawn as an "A" for Adapter.
 *
 * A sibling to the C, S and R of the other Liha products, and normalised to
 * the same height 500 canvas. The letter is made by the A's own counter — the
 * rounded triangle under the face — which is what lets the silhouette stay a
 * jellyfish bell and keep the scalloped hem every sibling has.
 *
 * The geometry is not eyeballed. It is fitted to the approved reference by
 * minimising disagreeing pixels, and matches it to within two pixels
 * everywhere except one short segment of the right flank where the reference
 * is slightly asymmetric — a mark should be symmetric there.
 *
 * This inlines exactly what tools/brand/build.mjs emits, so the nav costs no
 * extra request. Regenerate both together; never edit these strings by hand.
 */
export const BRAND_TEAL = '#0FAEA8';

const MARK_TRANSFORM = 'translate(9.96 10.00) scale(0.08800)';
const MARK_BODY = 'M95.92 118.42A160.24 160.24 0 0 1 405.29 118.42C407.8 242.63 507.47 373.93 501.21 473.29C479.46 473.29 479.46 500 457.71 500C423.19 500 423.19 458.16 388.66 458.16C354.14 458.16 354.14 500 319.62 500C285.09 500 285.09 433.27 250.57 433.27C216.05 433.27 216.05 500 181.52 500C147 500 147 458.16 112.48 458.16C77.96 458.16 77.96 500 43.43 500C21.72 500 21.72 473.29 0 473.29C-2.5 349.09 89.66 217.79 95.92 118.42ZM217.7 88.39h65.63a64.52 64.52 0 0 1 64.52 64.52v0a64.52 64.52 0 0 1 -64.52 64.52h-65.63a64.52 64.52 0 0 1 -64.52 -64.52v0a64.52 64.52 0 0 1 64.52 -64.52ZM250.42 265.72C274.78 265.72 277.71 295.02 297.74 334.77C314.93 363.4 274.26 363.4 265.67 363.4L235.16 363.4C226.57 363.4 185.91 363.4 203.09 334.77C223.12 295.02 226.05 265.72 250.42 265.72Z';
const MARK_EYES = 'M190.51 143.08a19.15 19.15 0 0 1 38.3 0v20.92a19.15 19.15 0 0 1 -38.3 0ZM272.22 143.08a19.15 19.15 0 0 1 38.3 0v20.92a19.15 19.15 0 0 1 -38.3 0Z';

export function BrandMark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Liha WebMCP Adapter"
    >
      <rect width="64" height="64" rx="16" fill={BRAND_TEAL} />
      <g transform={MARK_TRANSFORM}>
        <path fill="#fff" fillRule="evenodd" d={MARK_BODY} />
        <path fill={BRAND_TEAL} d={MARK_EYES} />
      </g>
    </svg>
  );
}
