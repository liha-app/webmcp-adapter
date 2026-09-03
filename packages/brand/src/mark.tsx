/*
 * The product mark: the Liha jellyfish, drawn as an "A" for Adapter.
 *
 * A sibling to the C, S and R of the other Liha products. The letter is made
 * by the A's own counter — the rounded triangle under the face — which lets
 * the silhouette stay a jellyfish bell and keep the scalloped hem the family
 * is built on.
 *
 * Two forms, and they are not interchangeable:
 *
 * - `BrandMark` is the drawing itself, teal on nothing, sparkle and all. It is
 *   what goes beside the wordmark, because a lockup pairs a mark with type —
 *   never an app icon with type.
 * - `BrandIcon` is the app icon: the same jellyfish reversed out of a filled
 *   squircle, with the sparkle dropped because below about 24px it reads as a
 *   smudge rather than a sparkle. That is the favicon, the extension icon, and
 *   the product tile in the store — slots that want a filled square.
 *
 * These paths are copied verbatim from the generated assets, which come from
 * tools/brand/source.svg. Regenerate with `node tools/brand/build.mjs` — never
 * hand-edit them, and never redraw them here. brand.test.ts fails if they
 * drift.
 *
 * Lives in its own package because the three demo sites need the mark too, to
 * point back at the portal, and copying the geometry into each of them is
 * exactly how a drawing ends up with four versions.
 */
export const BRAND_TEAL = '#1caca7';

const MARK_VIEWBOX = '0 0 598.38 617.41';
const MARK_SPARKLE = 'M88.17,97.41c-14.05,16.56-12.01,38.54-23.8,39.23-13.11.76-10.36-23.55-27.13-41.68C23.83,80.45,1.44,79.49.12,69.96c-.65-4.69,1.33-8.5,5.91-10.64,34.25-15.99,35.37-16.7,48.7-52.74C56.25,2.48,59.83.2,63.39.01c4.25-.22,7.67,2.54,9.28,7,12.91,35.59,16.24,37.38,48.32,51.82,4.74,2.13,7.18,5.32,7.1,10.07-.19,11.12-24.77,10.65-39.92,28.5Z';
const ICON_TRANSFORM = 'translate(5.883 4.170) scale(0.080409)';
const MARK_BODY = 'M596.27,559.42l-53.33-168.11-65.92-205.5c-16.24-50.63-53.68-88.67-104.86-104.07-79.77-24-170.68,17.1-196.49,97.21l-93.92,291.59-29.04,93.14c-5.73,18.38,5.46,38.03,20.92,46.54,16.23,8.94,37.76,6.29,50.34-7.77l14-21.83c13.58-15.93,37.92-17.34,53.44-2.91,11.36,10.56,15.63,37.6,44.8,39.5,14.04.91,27-5.08,35.37-16.82,6.24-8.75,9.98-18.72,13.94-28.75,5.74-14.55,18.1-24.14,32-26.76,16.17-3.04,31.32,3.59,41.07,16.09,10.1,12.94,11.53,38.43,31.4,50.77,11.75,7.3,27.32,7.42,39.48.89,9.59-5.15,15.97-13.95,20.67-23.32,6.85-13.66,19.59-21.82,34.48-21.56,13.54.23,26.88,8.43,33.06,21.49,6.59,13.92,17.62,23.36,31.93,25.56,15.27,2.35,29.59-3.28,39.42-15.42,8.95-11.06,11.77-25.77,7.26-39.99ZM378.46,467.75c-3.09,4.57-9.82,9.49-17.52,9.46l-73.82-.28c-7.19-.03-14.13-6.13-16.77-10.8-3.94-6.96-3.15-14.35-.1-21.27l27.3-62.02c5.17-11.75,18.13-17.15,29.97-16.21,12.56,1,22.02,8.73,27.26,20.84l25.84,59.67c2.93,6.76,2.11,14.29-2.15,20.6ZM423.08,280.68c-11.83,16.01-31.51,26.58-52.22,26.62l-91.4.18c-12.78.03-24.31-4.26-35.23-10.62-20.38-11.88-31.34-34.41-30.39-58.03,1.51-37.27,30.59-65.72,66.45-75.42,29.56-8,60.59-8.11,90.04.1,18.09,5.04,33.17,14.36,45.62,27.86,22.78,24.72,27.52,61.73,7.13,89.32Z';
const MARK_EYE_R = 'M392.2,250.22c-.04,12.66-11.68,19.43-22.75,19.01-11.31-.43-20.78-9.62-20.76-21.63l.05-23.26c.02-11.76,10.14-19.6,20.79-20.05,11.56-.49,22.79,7.12,22.75,19.57l-.09,26.36Z';
const MARK_EYE_L = 'M300.79,248.6c.09,12.57-10.75,20.78-22,20.55s-21.82-8.9-21.74-20.75l.17-24.56c.08-11.96,10.46-19.47,21.62-19.61,10.28-.13,20.45,7.8,21.78,19.14l.17,25.23Z';

export interface MarkProps {
  size?: number;
  className?: string;
  /** Paints the whole drawing in the current text colour instead of teal. */
  mono?: boolean;
}

/** The mark: what belongs next to the wordmark. */
export function BrandMark({ size = 20, className, mono = false }: MarkProps) {
  const fill = mono ? 'currentColor' : BRAND_TEAL;
  return (
    <svg
      className={className}
      viewBox={MARK_VIEWBOX}
      width={size}
      height={size}
      role="img"
      aria-label="Liha WebMCP Adapter"
    >
      <path fill={fill} d={MARK_SPARKLE} />
      <path fill={fill} d={MARK_BODY} />
      <path fill={fill} d={MARK_EYE_R} />
      <path fill={fill} d={MARK_EYE_L} />
    </svg>
  );
}

/** The app icon: a filled squircle, for slots that want one. */
export function BrandIcon({ size = 64, className }: { size?: number; className?: string }) {
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
      <g transform={ICON_TRANSFORM}>
        <path fill="#fff" d={MARK_BODY} />
        {/* White, not teal: the face is a hole, so it already shows the squircle. */}
        <path fill="#fff" d={MARK_EYE_R} />
        <path fill="#fff" d={MARK_EYE_L} />
      </g>
    </svg>
  );
}
