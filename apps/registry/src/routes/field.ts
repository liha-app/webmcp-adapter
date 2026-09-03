/**
 * The maths behind the hero's particle field, kept out of the canvas glue so
 * it can be tested without a renderer.
 *
 * The field is after the one on Gemini's about page: a dense drift of coloured
 * dots, a bright band that sweeps across on a timer, and a pocket around the
 * pointer where the dots brighten, spread and shift hue. Theirs is WebGL2 over
 * a full-bleed black page; this is a 2D canvas over one section of a page that
 * is white half the time, so the numbers are ours even where the idea is not.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Five colours, as asked for: purple, blue, orange, green, and the brand.
 *
 * Two sets, because the field sits on white as often as on black. The light
 * ones are deepened so a 2px dot still reads against #ffffff; the dark ones are
 * lifted so it still reads against #000000.
 */
export const PALETTE: Record<'light' | 'dark', Rgb[]> = {
  light: [
    { r: 124, g: 58, b: 237 }, // purple
    { r: 0, g: 113, b: 227 }, //  blue — the portal's own
    { r: 234, g: 110, b: 20 }, // orange
    { r: 22, g: 143, b: 87 }, //  green
    { r: 21, g: 150, b: 146 }, // brand teal, a shade down for white
  ],
  dark: [
    { r: 167, g: 129, b: 255 },
    { r: 41, g: 151, b: 255 },
    { r: 255, g: 149, b: 66 },
    { r: 74, g: 210, b: 140 },
    { r: 45, g: 205, b: 199 },
  ],
};

export const PALETTE_SIZE = PALETTE.light.length;

/** Linear blend, used to shift a dot's hue toward its neighbour under the pointer. */
export function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  const t = clamp01(amount);
  return {
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t),
  };
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * How strongly the pointer affects a dot: 1 underneath it, 0 at the radius and
 * beyond, squared so the edge of the pocket is soft rather than a disc.
 */
export function pointerFalloff(distance: number, radius: number): number {
  if (radius <= 0 || distance >= radius) return 0;
  const t = 1 - distance / radius;
  return t * t;
}

/**
 * The sweeping band. `along` is the dot projected onto the band's diagonal;
 * `head` is where the band is now. Same shape as the pointer's falloff, which
 * is why the two read as one effect rather than two.
 */
export function bandBoost(along: number, head: number, width: number): number {
  return pointerFalloff(Math.abs(along - head), width);
}

/** Where the band's head is at time `t`, wrapping with a gap either side. */
export function bandHead(t: number, span: number, speed: number): number {
  const period = span + 700;
  return (((t * speed) % period) + period) % period - 350;
}

/**
 * Enough dots to read as a field, never enough to cost a frame.
 *
 * Density is the whole effect. The first pass drew a dot per 1300px² and the
 * result read as a sprinkle of confetti rather than as ground — the reference
 * is thousands of dots, most of them under a pixel across. The cap is what a
 * frame can afford: past roughly four thousand arcs the paint starts to show.
 */
export function particleCount(width: number, height: number): number {
  return Math.max(600, Math.min(4200, Math.round((width * height) / 190)));
}
