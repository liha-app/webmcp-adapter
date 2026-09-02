/*
 * Emit the brand assets from the fitted parameters.
 *
 * The geometry in params.json was not drawn by hand or by eye: it was fitted to
 * the approved reference by minimising the pixels where the two disagree, at
 * 512², then verified at 1024². Everything matches to within two pixels except
 * one short segment of the right flank, where the reference is slightly
 * asymmetric — a mark should be symmetric there, so that is left as it is.
 *
 *   node tools/brand/build.mjs apps/registry/public/brand
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { svg, body, face, counter, eyes } from './shape.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fitted = JSON.parse(readFileSync(join(here, 'params.json'), 'utf8'));

/** Measured off the reference, not chosen: the most common ink pixel. */
export const TEAL = '#0FAEA8';

/**
 * The family normalises marks to height 500 with the sparkle at the top-left,
 * so rescale the fit — which lives in the reference's 1254² frame — into that.
 */
function normalise(p, height = 500) {
  const minX = Math.min(p.sparkX, p.bodyX);
  const minY = Math.min(p.sparkY, p.bodyY);
  const maxX = Math.max(p.sparkX + p.sparkR * 2, p.bodyX + p.bodyW);
  const maxY = p.bodyY + p.footY * p.bodyH;
  const s = height / (maxY - minY);
  return {
    ...p,
    W: Math.round((maxX - minX) * s), H: height,
    bodyX: (p.bodyX - minX) * s, bodyY: (p.bodyY - minY) * s,
    bodyW: p.bodyW * s, bodyH: p.bodyH * s,
    sparkX: (p.sparkX - minX) * s, sparkY: (p.sparkY - minY) * s, sparkR: p.sparkR * s,
  };
}

const P = normalise(fitted);
const dir = process.argv[2] ?? '.';

writeFileSync(join(dir, 'liha-adapter-mark.svg'), svg(P, TEAL, true) + '\n');
writeFileSync(join(dir, 'liha-adapter-mark-mono.svg'), svg(P, 'currentColor', true) + '\n');

/*
 * The app icon is not the mark shrunk. Below about 24px the sparkle is a smudge
 * rather than a sparkle, so the icon drops it and reverses the mark out of a
 * filled squircle — which is also the shape the store's product slots want at
 * 64 and 128px.
 */
const solo = normalise({ ...fitted, sparkX: fitted.bodyX, sparkY: fitted.bodyY, sparkR: 0 }, 500);
const scale = 44 / 500;                       // the mark occupies 44 of 64
const ox = 32 - (solo.W * scale) / 2;
const oy = 32 - (500 * scale) / 2;
writeFileSync(join(dir, 'liha-adapter-icon.svg'),
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Liha WebMCP Adapter">
  <rect width="64" height="64" rx="16" fill="${TEAL}"/>
  <g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${scale.toFixed(5)})">
    <path fill="#fff" fill-rule="evenodd" d="${body(solo)}${face(solo)}${counter(solo)}"/>
    <path fill="${TEAL}" d="${eyes(solo)}"/>
  </g>
</svg>
`);

console.log(`wrote three assets to ${dir}  (mark ${P.W} × ${P.H}, ink ${TEAL})`);
