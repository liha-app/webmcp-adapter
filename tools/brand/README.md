# Brand assets

The product mark: the Liha jellyfish, drawn as an **A** for Adapter.

It belongs to a family — Liha Code Review is a C, Sitebase an S, Run an R —
so it is built to the same measurements as its siblings rather than to taste.
Those were taken off the published marks, not estimated:

| | |
|---|---|
| Canvas | height 500, width 421–492 |
| Sparkle | four-pointed, anchored at the top-left, ~20% of the height |
| Letterform | starts at 7–13% across and 7–9% down, fills the rest |
| Eyes | vertical pills, ~38 × 60, ~40 apart |
| Hem | a continuous scalloped bell fringe across the full width |

The letter is made by the A's own counter — the rounded triangle below the
face — which is what lets the silhouette stay a jellyfish bell and keep the
hem every sibling has. Cutting a notch between two legs also spells A, but it
breaks the hem, and the hem is the part that makes the family a family.

Colour is **`#0FAEA8`**, sampled from the reference rather than chosen — it is
the most common ink pixel in it. The four already in use are two blues
(`#2787f5` parent, `#006eb8` Sitebase), a purple (`#6450a1` Code Review) and an
orange (`#f68c50` Run); teal is the gap. Coral and indigo were drawn and
rejected for reading as those last two at a glance.

## How the geometry was arrived at

`reference.png` is the approved design. `params.json` was **fitted** to it, not
eyeballed: the parametric mark is rasterised and compared to the reference
pixel by pixel, and a coordinate descent minimises the number that disagree.

Three things the fit found that guessing had got wrong:

- The dome is a **circular arc**, radius `0.32 × body width`, and the flanks are
  **straight lines tangent to it**. Below 15% of the height the reference's edge
  is linear to within a pixel. An earlier version drew a cap and two flanks as
  separate curves, which leaves a tangent break at the shoulder and reads as a
  flat-topped bucket no matter how the bounding box is tuned.
- The dome finishes rounding within **18%** of the body height. A first pass
  used 27%, which made the whole mark tall and narrow.
- The hem's four feet sit at 9 / 35 / 65 / 91% across, and the **middle hump
  lifts higher** than the outer two.

Verified at 1024²: everything matches to within two pixels except one short
segment of the right flank, where the reference is slightly asymmetric. A mark
should be symmetric there, so that difference is deliberate.

## Regenerating

```bash
node tools/brand/build.mjs apps/registry/public/brand
cp apps/registry/public/brand/liha-adapter-icon.svg apps/registry/public/favicon.svg
```

`shape.mjs` holds the geometry, `params.json` the fitted numbers, `build.mjs`
the three outputs. The paths are generated rather than traced, so the curves
stay clean and every proportion can be adjusted in one place.

`BrandMark` in `apps/registry/src/routes/components.tsx` inlines exactly what
`build.mjs` emits, so the nav costs no extra request. Regenerate both together
— never hand-edit those path strings.

| File | Use |
|---|---|
| `liha-adapter-mark.svg` | the full mark, sparkle and all — wordmark lockups |
| `liha-adapter-icon.svg` | squircle app icon — favicon, nav, the store |
| `liha-adapter-mark-mono.svg` | `currentColor`, for a single-colour context |

The app icon is not the mark shrunk down. Below about 24px the sparkle is a
smudge rather than a sparkle, so the icon drops it and reverses the mark out of
a filled squircle — which is also the form the store's product pages want at 64
and 128px. `BrandMark` in `apps/registry/src/routes/components.tsx` inlines the
same geometry so the nav costs no extra request.

## Why the mark is teal and the buttons are blue

The site follows Apple's App Store design system, where the interface chrome is
Apple blue and each product brings its own colour. A teal mark beside a blue
call to action is that system working as intended, not an accident.
