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
 * A sibling to the C, S and R of the other Liha products. The letter is made
 * by the A's own counter — the rounded triangle under the face — which lets
 * the silhouette stay a jellyfish bell and keep the scalloped hem the family
 * is built on.
 *
 * These paths are copied verbatim from tools/brand/source.svg, the master
 * drawing. Regenerate with `node tools/brand/build.mjs` — never hand-edit
 * them, and never redraw them here.
 *
 * This is the app icon rather than the mark: below about 24px the sparkle is a
 * smudge rather than a sparkle, so the icon drops it and reverses the mark out
 * of a filled squircle. Inlined so the nav costs no extra request.
 */
export const BRAND_TEAL = '#1caca7';

const MARK_TRANSFORM = 'translate(5.883 4.170) scale(0.080409)';
const MARK_BODY = 'M596.27,559.42l-53.33-168.11-65.92-205.5c-16.24-50.63-53.68-88.67-104.86-104.07-79.77-24-170.68,17.1-196.49,97.21l-93.92,291.59-29.04,93.14c-5.73,18.38,5.46,38.03,20.92,46.54,16.23,8.94,37.76,6.29,50.34-7.77l14-21.83c13.58-15.93,37.92-17.34,53.44-2.91,11.36,10.56,15.63,37.6,44.8,39.5,14.04.91,27-5.08,35.37-16.82,6.24-8.75,9.98-18.72,13.94-28.75,5.74-14.55,18.1-24.14,32-26.76,16.17-3.04,31.32,3.59,41.07,16.09,10.1,12.94,11.53,38.43,31.4,50.77,11.75,7.3,27.32,7.42,39.48.89,9.59-5.15,15.97-13.95,20.67-23.32,6.85-13.66,19.59-21.82,34.48-21.56,13.54.23,26.88,8.43,33.06,21.49,6.59,13.92,17.62,23.36,31.93,25.56,15.27,2.35,29.59-3.28,39.42-15.42,8.95-11.06,11.77-25.77,7.26-39.99ZM378.46,467.75c-3.09,4.57-9.82,9.49-17.52,9.46l-73.82-.28c-7.19-.03-14.13-6.13-16.77-10.8-3.94-6.96-3.15-14.35-.1-21.27l27.3-62.02c5.17-11.75,18.13-17.15,29.97-16.21,12.56,1,22.02,8.73,27.26,20.84l25.84,59.67c2.93,6.76,2.11,14.29-2.15,20.6ZM423.08,280.68c-11.83,16.01-31.51,26.58-52.22,26.62l-91.4.18c-12.78.03-24.31-4.26-35.23-10.62-20.38-11.88-31.34-34.41-30.39-58.03,1.51-37.27,30.59-65.72,66.45-75.42,29.56-8,60.59-8.11,90.04.1,18.09,5.04,33.17,14.36,45.62,27.86,22.78,24.72,27.52,61.73,7.13,89.32Z';
const MARK_EYE_R = 'M392.2,250.22c-.04,12.66-11.68,19.43-22.75,19.01-11.31-.43-20.78-9.62-20.76-21.63l.05-23.26c.02-11.76,10.14-19.6,20.79-20.05,11.56-.49,22.79,7.12,22.75,19.57l-.09,26.36Z';
const MARK_EYE_L = 'M300.79,248.6c.09,12.57-10.75,20.78-22,20.55s-21.82-8.9-21.74-20.75l.17-24.56c.08-11.96,10.46-19.47,21.62-19.61,10.28-.13,20.45,7.8,21.78,19.14l.17,25.23Z';

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
        <path fill="#fff" d={MARK_BODY} />
        <path fill={BRAND_TEAL} d={MARK_EYE_R} />
        <path fill={BRAND_TEAL} d={MARK_EYE_L} />
      </g>
    </svg>
  );
}
