/*
 * The mark, built the way the reference actually is: a circular dome, straight
 * flanks tangent to it, and a scalloped hem. Measured off the reference rather
 * than eyeballed — below 15% of its height the silhouette's edge is linear to
 * within a pixel, and above that it fits a circle of radius 0.31 × the body
 * width to within a pixel too.
 */
const n = (v) => Math.round(v * 100) / 100;

export const DEFAULTS = {
  W: 1254, H: 1254,
  bodyX: 342, bodyY: 336, bodyW: 570, bodyH: 566,
  // The hem, traced off the reference: the flanks arrive at hemEdgeY, then
  // four feet alternate with three humps, and the middle hump lifts higher
  // than its neighbours.
  domeR: 0.310,        // × body width
  hemEdgeY: 0.910,     // × body height, where the flank meets the hem
  footY: 0.996,        // depth of a foot
  humpY: 0.910,        // top of an outer hump
  humpMidY: 0.867,     // top of the middle hump
  footFirst: 0.090,    // x of the first foot, × body width
  footLast: 0.910,
  flankBow: 0.0,       // outward bow on the flank, × body width (0 = straight)
  sparkX: 305, sparkY: 276, sparkR: 62, sparkWaist: 0.30,
  faceX: 0.305, faceY: 0.168, faceW: 0.389, faceH: 0.265, faceR: 0.29,
  eyeW: 0.077, eyeH: 0.117, eyeGap: 0.084, eyeY: 0.249,
  ctrX: 0.398, ctrY: 0.535, ctrW: 0.204, ctrH: 0.198, ctrRTop: 0.30, ctrRBot: 0.22,
};

function sparkle(cx, cy, r, waist) {
  const k = r * waist;
  return `M${n(cx)} ${n(cy - r)}C${n(cx + k)} ${n(cy - k)} ${n(cx + k)} ${n(cy - k)} ${n(cx + r)} ${n(cy)}`
    + `C${n(cx + k)} ${n(cy + k)} ${n(cx + k)} ${n(cy + k)} ${n(cx)} ${n(cy + r)}`
    + `C${n(cx - k)} ${n(cy + k)} ${n(cx - k)} ${n(cy + k)} ${n(cx - r)} ${n(cy)}`
    + `C${n(cx - k)} ${n(cy - k)} ${n(cx - k)} ${n(cy - k)} ${n(cx)} ${n(cy - r)}Z`;
}

/** Where a line from P touches a circle (C, r); `side` picks which tangent. */
function tangentPoint(px, py, cx, cy, r, side) {
  const dx = px - cx, dy = py - cy;
  const d = Math.hypot(dx, dy);
  const a = Math.acos(Math.min(1, r / d));
  const base = Math.atan2(dy, dx);
  const th = base + side * a;
  return [cx + r * Math.cos(th), cy + r * Math.sin(th)];
}

export function body(p) {
  const { bodyX: X, bodyY: Y, bodyW: BW, bodyH: BH } = p;
  const cx = X + BW / 2;
  const r = p.domeR * BW;
  const cy = Y + r;                        // the dome's crown sits on Y
  const hemY = Y + p.hemEdgeY * BH;
  const [rtx, rty] = tangentPoint(X + BW, hemY, cx, cy, r, -1);
  const [ltx, lty] = tangentPoint(X, hemY, cx, cy, r, +1);

  // Alternating feet and humps, right to left, with a horizontal tangent at
  // every extremum so the fringe reads as scallops rather than zig-zags.
  const fx = (i) => X + (p.footFirst + (p.footLast - p.footFirst) * (i / 3)) * BW;
  const pts = [[X + BW, hemY]];
  for (let i = 3; i >= 0; i -= 1) {
    pts.push([fx(i), Y + p.footY * BH]);
    if (i > 0) {
      const mx = (fx(i) + fx(i - 1)) / 2;
      const top = i === 2 ? p.humpMidY : p.humpY;
      pts.push([mx, Y + top * BH]);
    }
  }
  pts.push([X, hemY]);
  let hem = '';
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const k = (x1 - x0) * 0.5;
    hem += `C${n(x0 + k)} ${n(y0)} ${n(x1 - k)} ${n(y1)} ${n(x1)} ${n(y1)}`;
  }

  // The flank is a straight line to within a pixel over most of its run, but
  // `flankBow` lets the fit put back any slight swell near the hem.
  const bow = p.flankBow * BW;
  const flank = (fromX, fromY, toX, toY, sign) =>
    `C${n(fromX + sign * bow * 0.4)} ${n(fromY + (toY - fromY) * 0.35)} ` +
    `${n(toX + sign * bow)} ${n(fromY + (toY - fromY) * 0.72)} ${n(toX)} ${n(toY)}`;
  return `M${n(ltx)} ${n(lty)}A${n(r)} ${n(r)} 0 0 1 ${n(rtx)} ${n(rty)}`
    + flank(rtx, rty, X + BW, hemY, 1)
    + hem
    + flank(X, hemY, ltx, lty, -1).replace(/^C/, 'C')
    + 'Z';
}

function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${n(x + rr)} ${n(y)}h${n(w - rr * 2)}a${n(rr)} ${n(rr)} 0 0 1 ${n(rr)} ${n(rr)}`
    + `v${n(h - rr * 2)}a${n(rr)} ${n(rr)} 0 0 1 ${n(-rr)} ${n(rr)}`
    + `h${n(-(w - rr * 2))}a${n(rr)} ${n(rr)} 0 0 1 ${n(-rr)} ${n(-rr)}`
    + `v${n(-(h - rr * 2))}a${n(rr)} ${n(rr)} 0 0 1 ${n(rr)} ${n(-rr)}Z`;
}

export function face(p) {
  const { bodyX: X, bodyY: Y, bodyW: BW, bodyH: BH } = p;
  const w = p.faceW * BW, h = p.faceH * BH;
  return roundRect(X + p.faceX * BW, Y + p.faceY * BH, w, h, p.faceR * BW);
}

export function counter(p) {
  const { bodyX: X, bodyY: Y, bodyW: BW, bodyH: BH } = p;
  const w = p.ctrW * BW, h = p.ctrH * BH;
  const x = X + p.ctrX * BW, y = Y + p.ctrY * BH;
  const cx = x + w / 2, bot = y + h, half = w / 2;
  const rT = p.ctrRTop * w, rB = p.ctrRBot * w;
  return `M${n(cx)} ${n(y)}`
    + `C${n(cx + rT * 0.62)} ${n(y)} ${n(cx + half * 0.52)} ${n(y + h * 0.30)} ${n(cx + half - rB * 0.18)} ${n(bot - rB)}`
    + `C${n(cx + half + rB * 0.42)} ${n(bot)} ${n(cx + half - rB)} ${n(bot)} ${n(cx + half - rB * 1.3)} ${n(bot)}`
    + `L${n(cx - half + rB * 1.3)} ${n(bot)}`
    + `C${n(cx - half + rB)} ${n(bot)} ${n(cx - half - rB * 0.42)} ${n(bot)} ${n(cx - half + rB * 0.18)} ${n(bot - rB)}`
    + `C${n(cx - half * 0.52)} ${n(y + h * 0.30)} ${n(cx - rT * 0.62)} ${n(y)} ${n(cx)} ${n(y)}Z`;
}

export function eyes(p) {
  const { bodyX: X, bodyY: Y, bodyW: BW, bodyH: BH } = p;
  const w = p.eyeW * BW, h = p.eyeH * BH, r = w / 2;
  const cx = X + (p.faceX + p.faceW / 2) * BW;
  const y = Y + p.eyeY * BH;
  const pill = (x) => `M${n(x)} ${n(y + r)}a${n(r)} ${n(r)} 0 0 1 ${n(w)} 0v${n(h - w)}a${n(r)} ${n(r)} 0 0 1 ${n(-w)} 0Z`;
  return pill(cx - (p.eyeGap * BW) / 2 - w) + pill(cx + (p.eyeGap * BW) / 2);
}

export function svg(p, ink = '#0FAEA8', withSparkle = true) {
  const spark = withSparkle ? sparkle(p.sparkX + p.sparkR, p.sparkY + p.sparkR, p.sparkR, p.sparkWaist) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.W} ${p.H}" width="${p.W}" height="${p.H}">`
    + `<path fill="${ink}" fill-rule="evenodd" d="${spark}${body(p)}${face(p)}${counter(p)}"/>`
    + `<path fill="${ink}" d="${eyes(p)}"/></svg>`;
}
