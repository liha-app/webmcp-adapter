/*
 * Rasterise the toolbar glyph for the extension.
 *
 *   node tools/brand/icons.mjs apps/extension/icons
 *
 * Everywhere else in this project the mark ships as SVG. The extension cannot:
 * Chrome takes only bitmaps for `icons` and `action.default_icon`, and an
 * extension with neither gets the grey placeholder letter in the toolbar.
 * Firefox would accept the SVG, but a second icon set for the second build is
 * a second thing to keep in step, so both take these.
 *
 * The PNGs are committed. `pnpm build` must not need a browser — Playwright is
 * here for the tests, not for packaging — so this runs when the mark changes,
 * not on every build. `icons.test.ts` is what notices if it did not.
 *
 * The glyph rather than the app icon: what the extension wears in the toolbar
 * is the mark in the ink, not the mark reversed out of a teal square. See
 * build.mjs for why the toolbar gets its own form at all.
 *
 * Chromium rasterises the vector at each target size rather than downsampling
 * one large render; both were compared side by side. At 32px the direct raster
 * keeps the hem's scallops crisp and the two eyes separable, where the
 * box-filtered 4x render smears them. At 16px the eyes merge either way — they
 * are 44x65 units inside a 598 unit drawing, so they land under a pixel — and
 * the icon reads as its silhouette, which is all a 16px icon is asked to do.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** What Chrome asks for: menu, 2x toolbar and Windows, the extensions page, the install dialog. */
export const SIZES = [16, 32, 48, 128];

const out = process.argv[2] ?? '.';
const svg = readFileSync(
  process.argv[3] ?? join(here, '../../apps/registry/public/brand/liha-adapter-glyph.svg'),
  'utf8',
);

const browser = await chromium.launch();
for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  // The svg keeps its own width/height attributes; CSS overrides them, so the
  // file is rendered exactly as it ships rather than as an edited copy.
  await page.setContent(
    `<body style="margin:0"><style>svg{display:block;width:100%;height:100%}</style>${svg}</body>`,
  );
  // omitBackground, because the squircle has corners: an opaque icon would sit
  // in a white box on Chrome's toolbar.
  writeFileSync(join(out, `icon-${size}.png`), await page.screenshot({ omitBackground: true }));
  await page.close();
}
await browser.close();
console.log(`wrote ${SIZES.length} icons to ${out}  (${SIZES.join(', ')}px)`);
