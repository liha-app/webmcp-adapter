/*
 * Derive the brand assets from the master drawing.
 *
 *   node tools/brand/build.mjs apps/registry/public/brand
 *
 * `source.svg` is the master, drawn by hand. Nothing here reshapes it — the
 * paths are copied verbatim. What this does is the mechanical part:
 *
 * - strips the C2PA blob, which is 97% of the exported file and not artwork
 * - replaces the `.cls-1` stylesheet with plain `fill` attributes. Every mark
 *   in the Liha family exports with that same class name, so inlining two of
 *   them in one document makes the second repaint the first. Attributes are
 *   immune, and BrandMark inlines this geometry into the page.
 * - builds the app icon, which is not the mark shrunk down: below about 24px
 *   the sparkle is a smudge rather than a sparkle, so the icon drops it and
 *   reverses the mark out of a filled squircle. That is also the shape the
 *   store's product slots want at 64 and 128px.
 * - builds the toolbar glyph, which is the third form and the smallest.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'source.svg'), 'utf8');

/** Sampled from the master drawing, not chosen. */
export const TEAL = '#1caca7';

const viewBox = source.match(/viewBox="([^"]+)"/)[1];
const paths = [...source.matchAll(/<path[^>]*\bd="([^"]+)"/g)].map((m) => m[1]);
if (paths.length !== 4) throw new Error(`expected 4 paths in source.svg, found ${paths.length}`);
const [SPARKLE, BODY, EYE_R, EYE_L] = paths;

/* Measured off the master with getBBox, so the icon can be centred on the
 * jellyfish rather than on the mark's box, which the sparkle skews. */
const BODY_BOX = { x: 51.2, y: 74.9, w: 547.2, h: 542.4 };

const mark = (fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="Liha WebMCP Adapter">
  <path fill="${fill}" d="${SPARKLE}"/>
  <path fill="${fill}" d="${BODY}"/>
  <path fill="${fill}" d="${EYE_R}"/>
  <path fill="${fill}" d="${EYE_L}"/>
</svg>
`;

/** The squircle app icon: the jellyfish reversed out, sparkle dropped. */
function icon() {
  const box = 64;
  const inset = 44;                                   // the mark's optical size
  const scale = inset / Math.max(BODY_BOX.w, BODY_BOX.h);
  const ox = box / 2 - (BODY_BOX.x + BODY_BOX.w / 2) * scale;
  const oy = box / 2 - (BODY_BOX.y + BODY_BOX.h / 2) * scale;
  /*
   * The eyes are white here, not teal.
   *
   * In the mark the body is teal and the face is a hole, so the face shows the
   * page behind it and the eyes are teal dots on that. Reversed, the body is
   * white and the same hole shows the teal squircle — so teal eyes on a teal
   * face vanish. Inverting the figure has to invert the eyes with it.
   */
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}" width="${box}" height="${box}" role="img" aria-label="Liha WebMCP Adapter">
  <rect width="${box}" height="${box}" rx="16" fill="${TEAL}"/>
  <g transform="translate(${ox.toFixed(3)} ${oy.toFixed(3)}) scale(${scale.toFixed(6)})">
    <path fill="#fff" d="${BODY}"/>
    <path fill="#fff" d="${EYE_R}"/>
    <path fill="#fff" d="${EYE_L}"/>
  </g>
</svg>
`;
}

/**
 * The toolbar glyph: the jellyfish in the ink, framed on itself.
 *
 * A browser toolbar gives an icon 16 to 32 transparent pixels, and neither of
 * the other two forms spends them well. The mark carries the sparkle, which
 * pushes the jellyfish off-centre and down to about two thirds of the tile —
 * and at 16px the sparkle is one dim pixel doing nothing for it. The app icon
 * does fill the tile, but by reversing the figure out of a solid teal square,
 * which at that size reads as a coloured tile someone pasted in rather than as
 * a mark. Reversing it out is also the thing this project has been asked twice
 * not to do.
 *
 * So: the jellyfish alone, in the ink, on nothing, framed on its own box. The
 * face stays a hole, which is what lets it sit on a light or a dark toolbar
 * without a second file.
 */
function glyph() {
  const side = Math.max(BODY_BOX.w, BODY_BOX.h) * 1.10;   // a little air at the edges
  const x = BODY_BOX.x + BODY_BOX.w / 2 - side / 2;
  const y = BODY_BOX.y + BODY_BOX.h / 2 - side / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x.toFixed(2)} ${y.toFixed(2)} ${side.toFixed(2)} ${side.toFixed(2)}" width="64" height="64" role="img" aria-label="Liha WebMCP Adapter">
  <path fill="${TEAL}" d="${BODY}"/>
  <path fill="${TEAL}" d="${EYE_R}"/>
  <path fill="${TEAL}" d="${EYE_L}"/>
</svg>
`;
}

const dir = process.argv[2] ?? '.';
writeFileSync(join(dir, 'liha-adapter-mark.svg'), mark(TEAL));
writeFileSync(join(dir, 'liha-adapter-mark-mono.svg'), mark('currentColor'));
writeFileSync(join(dir, 'liha-adapter-icon.svg'), icon());
writeFileSync(join(dir, 'liha-adapter-glyph.svg'), glyph());
/*
 * The tab icon is the mark, not the app icon.
 *
 * A browser tab sits the icon on the browser's own chrome, where a filled teal
 * square reads as a tile someone pasted in; the mark reads as a mark. The
 * squircle is still what a home-screen tile and the extension's toolbar slot
 * want, and both still get it.
 */
const favicon = process.argv[3] ?? join(dir, '../favicon.svg');
writeFileSync(favicon, mark(TEAL));
console.log(`wrote four assets to ${dir} and the favicon to ${favicon}  (viewBox ${viewBox}, ink ${TEAL})`);

export { BODY, EYE_R, EYE_L, SPARKLE, icon, glyph };
