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
 * It belongs to a family — Liha Code Review is a C, Sitebase an S, Run an R —
 * so it is built to the same measurements: height 500, the bell fringe along
 * the hem, pill eyes in a rounded face patch, and the four-pointed sparkle at
 * the top left. Teal is this product's colour; the four already in use are two
 * blues, a purple and an orange.
 *
 * The letter is made by the A's own counter — the rounded triangle below the
 * face — which is what lets the silhouette stay a jellyfish bell with the
 * continuous scalloped hem every sibling has.
 *
 * Below about 24px the sparkle is a smudge rather than a sparkle, so the app
 * icon drops it and reverses the mark out of a filled squircle instead. That
 * is the form used in the nav and in the store, and it is what favicon.svg is.
 *
 * tools/brand/ regenerates all of it.
 */
export const BRAND_TEAL = '#0FA98C';

const MARK_TRANSFORM = 'translate(10.34 10.97) scale(0.0905)';
const MARK_BODY = 'M136 166C136 40 388 40 388 166C394.9 299.6 492 386.4 492 500C475.9 500 471.3 454 434.5 454C397.7 454 393.1 500 377 500C360.9 500 356.3 454 319.5 454C282.7 454 278.1 500 262 500C245.9 500 241.3 454 204.5 454C167.7 454 163.1 500 147 500C130.9 500 126.3 454 89.5 454C52.7 454 48.1 500 32 500C32 386.4 129.1 299.6 136 166ZM221 117.5h82a52 52 0 0 1 52 52v21a52 52 0 0 1 -52 52h-82a52 52 0 0 1 -52 -52v-21a52 52 0 0 1 52 -52ZM262 288C280.2 288 291.7 319.2 311.6 370C327 392 294 392 286.3 392L237.7 392C230 392 197 392 212.4 370C232.3 319.2 243.8 288 262 288Z';
const MARK_EYES = 'M206 171a18 18 0 0 1 36 0v20a18 18 0 0 1 -36 0ZM282 171a18 18 0 0 1 36 0v20a18 18 0 0 1 -36 0Z';

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
