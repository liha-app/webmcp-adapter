/*
 * The Liha "A": jellyfish + letterform.
 *
 * The letter is made by the A's own counter — the small rounded triangle — so
 * the silhouette stays a jellyfish bell and keeps the continuous scalloped hem
 * every sibling has. The face is a separate rounded patch above it, exactly as
 * on the Run mark.
 *
 * Built to the family's measurements: height 500, 38 × 62 pill eyes, a
 * four-pointed sparkle anchored at the top-left.
 */
export const P = {
  W: 492, H: 500,
  withSparkle: true,
  spark: { cx: 55, cy: 54, r: 55, waist: 0.26 },
  L: 32, R: 492, T: 40, B: 500,
  apexHalf: 96,      // half-width of the rounded apex
  apexDrop: 150,     // where the sides take over from the cap
  shoulder: 0.24,    // outward bow of the flanks
  hemHumps: 4,
  hemRise: 58,
  // the face patch: a rounded rectangle, like the Run mark's
  face: { cx: 262, cy: 236, w: 216, h: 152, r: 62 },
  eye: { w: 38, h: 62, gap: 44, cy: 236 },
  // the A's counter: what makes the mark a letter rather than a bell
  counter: { cx: 262, topY: 322, botY: 428, half: 62, rTop: 30, rBot: 26 },
};

const n = (v) => Math.round(v * 10) / 10;

function sparkle({ cx, cy, r, waist }) {
  const k = r * waist;
  return `M${n(cx)} ${n(cy - r)}C${n(cx + k)} ${n(cy - k)} ${n(cx + k)} ${n(cy - k)} ${n(cx + r)} ${n(cy)}`
    + `C${n(cx + k)} ${n(cy + k)} ${n(cx + k)} ${n(cy + k)} ${n(cx)} ${n(cy + r)}`
    + `C${n(cx - k)} ${n(cy + k)} ${n(cx - k)} ${n(cy + k)} ${n(cx - r)} ${n(cy)}`
    + `C${n(cx - k)} ${n(cy - k)} ${n(cx - k)} ${n(cy - k)} ${n(cx)} ${n(cy - r)}Z`;
}

/** The bell fringe, drawn right to left along the baseline. */
function hem(xRight, xLeft, y, count, rise) {
  const span = (xRight - xLeft) / count;
  let d = '';
  for (let i = 0; i < count; i += 1) {
    const x0 = xRight - i * span;
    const x1 = x0 - span;
    const mid = (x0 + x1) / 2;
    d += `C${n(x0 - span * 0.14)} ${n(y)} ${n(mid + span * 0.32)} ${n(y - rise)} ${n(mid)} ${n(y - rise)}`;
    d += `C${n(mid - span * 0.32)} ${n(y - rise)} ${n(x1 + span * 0.14)} ${n(y)} ${n(x1)} ${n(y)}`;
  }
  return d;
}

/** The bell: a rounded apex, flanks splaying out, a scalloped hem. */
function bell(p) {
  const { L, R, T, B, apexHalf, apexDrop, shoulder, hemHumps, hemRise } = p;
  const cx = (L + R) / 2;
  const apexL = cx - apexHalf;
  const apexR = cx + apexHalf;
  const sideT = T + apexDrop;
  const bow = (R - L) * shoulder * 0.5;
  const run = B - sideT;
  return [
    `M${n(apexL)} ${n(sideT)}`,
    `C${n(apexL)} ${n(T)} ${n(apexR)} ${n(T)} ${n(apexR)} ${n(sideT)}`,
    `C${n(apexR + bow)} ${n(sideT + run * 0.40)} ${n(R)} ${n(B - run * 0.34)} ${n(R)} ${n(B)}`,
    hem(R, L, B, hemHumps, hemRise),
    `C${n(L)} ${n(B - run * 0.34)} ${n(apexL - bow)} ${n(sideT + run * 0.40)} ${n(apexL)} ${n(sideT)}`,
    'Z',
  ].join('');
}

function roundedRect({ cx, cy, w, h, r }) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  return `M${n(x + rr)} ${n(y)}h${n(w - rr * 2)}a${n(rr)} ${n(rr)} 0 0 1 ${n(rr)} ${n(rr)}`
    + `v${n(h - rr * 2)}a${n(rr)} ${n(rr)} 0 0 1 ${n(-rr)} ${n(rr)}`
    + `h${n(-(w - rr * 2))}a${n(rr)} ${n(rr)} 0 0 1 ${n(-rr)} ${n(-rr)}`
    + `v${n(-(h - rr * 2))}a${n(rr)} ${n(rr)} 0 0 1 ${n(rr)} ${n(-rr)}Z`;
}

/** The A's counter: a rounded triangle, apex up. */
function counter({ cx, topY, botY, half, rTop, rBot }) {
  return `M${n(cx)} ${n(topY)}`
    + `C${n(cx + rTop * 0.7)} ${n(topY)} ${n(cx + half * 0.55)} ${n(topY + (botY - topY) * 0.30)} ${n(cx + half - rBot * 0.2)} ${n(botY - rBot)}`
    + `C${n(cx + half + rBot * 0.5)} ${n(botY)} ${n(cx + half - rBot)} ${n(botY)} ${n(cx + half - rBot * 1.35)} ${n(botY)}`
    + `L${n(cx - half + rBot * 1.35)} ${n(botY)}`
    + `C${n(cx - half + rBot)} ${n(botY)} ${n(cx - half - rBot * 0.5)} ${n(botY)} ${n(cx - half + rBot * 0.2)} ${n(botY - rBot)}`
    + `C${n(cx - half * 0.55)} ${n(topY + (botY - topY) * 0.30)} ${n(cx - rTop * 0.7)} ${n(topY)} ${n(cx)} ${n(topY)}Z`;
}

function eyes({ w, h, gap, cy }, cx) {
  const r = w / 2;
  const pill = (x) => `M${n(x)} ${n(cy - h / 2 + r)}a${n(r)} ${n(r)} 0 0 1 ${n(w)} 0v${n(h - w)}a${n(r)} ${n(r)} 0 0 1 ${n(-w)} 0Z`;
  return pill(cx - gap / 2 - w) + pill(cx + gap / 2);
}

export function mark(color = '#0FA98C', over = {}) {
  const p = { ...P, ...over,
    spark: { ...P.spark, ...(over.spark ?? {}) },
    face: { ...P.face, ...(over.face ?? {}) },
    counter: { ...P.counter, ...(over.counter ?? {}) },
    eye: { ...P.eye, ...(over.eye ?? {}) } };
  const spark = p.withSparkle === false ? '' : sparkle(p.spark);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.W} ${p.H}" role="img" aria-label="Liha WebMCP Adapter">
  <path fill="${color}" fill-rule="evenodd" d="${spark}${bell(p)}${roundedRect(p.face)}${counter(p.counter)}"/>
  <path fill="${color}" d="${eyes(p.eye, p.face.cx)}"/>
</svg>`;
}
