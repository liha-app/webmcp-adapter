# Brand assets

The product mark: the Liha jellyfish, drawn as an **A** for Adapter.

It belongs to a family — Liha Code Review is a C, Sitebase an S, Run an R.
The letter is made by the A's own counter, the rounded triangle under the
face, which is what lets the silhouette stay a jellyfish bell and keep the
scalloped hem every sibling has.

`source.svg` is the **master drawing**. Everything else is derived from it and
nothing regenerates it; to change the mark, redraw it and replace that file.

Colour is **`#1caca7`**, taken from the master.  The four already in use are two
blues (`#2787f5` parent, `#006eb8` Sitebase), a purple (`#6450a1` Code Review)
and an orange (`#f68c50` Run) — teal was the gap. Coral and indigo were drawn
and rejected for reading as those last two at a glance.

## Regenerating

```bash
node tools/brand/build.mjs apps/registry/public/brand
cp apps/registry/public/brand/liha-adapter-icon.svg apps/registry/public/favicon.svg
```

| File | Use |
|---|---|
| `liha-adapter-mark.svg` | the full mark, sparkle and all — wordmark lockups |
| `liha-adapter-icon.svg` | squircle app icon — favicon, nav, the store |
| `liha-adapter-mark-mono.svg` | `currentColor`, for a single-colour context |

`build.mjs` copies the paths verbatim. What it actually does is the mechanical
work around them:

- **Strips the C2PA blob.** The Illustrator export is 72KB, of which 70KB is
  content-credentials metadata rather than artwork.
- **Replaces the `.cls-1` stylesheet with `fill` attributes.** Every mark in the
  family exports with that same class name, so inlining two of them in one
  document makes the second silently repaint the first — which is exactly what
  happened the first time these were compared side by side. Attributes are
  immune, and `BrandMark` inlines this geometry into the page.
- **Builds the app icon**, which is not the mark shrunk down. Below about 24px
  the sparkle is a smudge rather than a sparkle, so the icon drops it and
  reverses the mark out of a filled squircle — also the shape the store's
  product slots want at 64 and 128px. It is centred on the jellyfish's own
  bounding box, not the mark's, which the sparkle would skew.

`BrandMark` in `apps/registry/src/routes/components.tsx` inlines exactly what
`build.mjs` emits, so the nav costs no extra request. Regenerate both together
— never hand-edit those path strings.

## Why the mark is teal and the buttons are blue

The site follows Apple's App Store design system, where the interface chrome is
Apple blue and each product brings its own colour. A teal mark beside a blue
call to action is that system working as intended, not an accident.
