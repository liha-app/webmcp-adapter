import { writeFileSync } from 'node:fs';
import { mark } from './gen.mjs';

export const TEAL = '#0FA98C';

/**
 * The mark, in the family's units: height 500, sparkle anchored top-left.
 * Proportions were derived from the reference by ratio rather than by eye —
 * face 40% of the body width at 17–44% of its height, counter 20% wide at
 * 54–76%, eyes 8% wide with an 8.8% gap.
 */
export const A = {
  L: 32, R: 492, T: 40, B: 500,
  apexHalf: 126, apexDrop: 126, shoulder: 0.03, hemHumps: 4, hemRise: 46,
  face: { cx: 262, cy: 180, w: 186, h: 125, r: 52 },
  eye: { w: 36, h: 56, gap: 40, cy: 181 },
  counter: { cx: 262, topY: 288, botY: 392, half: 54, rTop: 26, rBot: 22 },
};

function parts(svg) {
  const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
  return { body: ds[0], eyes: ds[1] };
}

if (process.argv[2]) {
  const dir = process.argv[2];
  writeFileSync(`${dir}/adapter-mark.svg`, mark(TEAL, A));
  writeFileSync(`${dir}/adapter-mark-mono.svg`, mark('currentColor', A));

  // The app icon. Below roughly 24px the sparkle is a smudge rather than a
  // sparkle, so the icon drops it and reverses the mark out of a squircle —
  // which is also the form the store layout wants at 64 and 128px.
  const solo = parts(mark(TEAL, { ...A, withSparkle: false }));
  const S = 0.0905;
  const OX = 32 - (492 * S) / 2 + 0.6;
  const OY = 32 - (500 * S) / 2 + 1.6;
  writeFileSync(`${dir}/adapter-icon.svg`,
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Liha WebMCP Adapter">
  <rect width="64" height="64" rx="16" fill="${TEAL}"/>
  <g transform="translate(${OX.toFixed(2)} ${OY.toFixed(2)}) scale(${S})">
    <path fill="#fff" fill-rule="evenodd" d="${solo.body}"/>
    <path fill="${TEAL}" d="${solo.eyes}"/>
  </g>
</svg>`);
  console.log('wrote adapter-mark.svg, adapter-mark-mono.svg, adapter-icon.svg');
}
