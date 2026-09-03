/**
 * The maths behind the hero's particle field, kept out of the canvas glue so
 * it can be tested without a renderer.
 *
 * The field is after the one on Gemini's about page: a dense drift of coloured
 * dots, a bright band that sweeps across on a timer, and a pocket around the
 * pointer where the dots brighten, spread and shift hue. Theirs is WebGL2 over
 * a full-bleed black page; this is a 2D canvas over one section of a page that
 * is white half the time, so the numbers are ours even where the idea is not.
 *
 * Two things here are not theirs at all. The dots gather into the Liha mark and
 * fall apart again on a loop, so the field is the product's own shape rather
 * than a texture. And the field is one colour — the brand's — until the pointer
 * touches it, where it opens into the other four. Five hues scattered at random
 * read as mess; five hues that only appear where the visitor is pointing read
 * as a response.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * The brand first, then the four it opens into: purple, blue, orange, green.
 *
 * The field is the brand colour and nothing else until something touches it.
 * The other four live in this cycle so the pointer's pocket can travel through
 * them and come back to the brand without a seam — which is why the brand is
 * both the first entry and the one the cycle wraps to.
 *
 * Two sets, because the field sits on white as often as on black. The light
 * ones are deepened so a 2px dot still reads against #ffffff; the dark ones are
 * lifted so it still reads against #000000.
 */
export interface Palette {
  /** What the field is at rest. */
  brand: Rgb;
  /** What the pointer opens it into, brand included so the cycle closes. */
  cycle: Rgb[];
}

const LIGHT_BRAND: Rgb = { r: 21, g: 150, b: 146 };
const DARK_BRAND: Rgb = { r: 45, g: 205, b: 199 };

export const PALETTE: Record<'light' | 'dark', Palette> = {
  light: {
    brand: LIGHT_BRAND,
    cycle: [
      LIGHT_BRAND,
      { r: 124, g: 58, b: 237 }, // purple
      { r: 0, g: 113, b: 227 }, //  blue — the portal's own
      { r: 234, g: 110, b: 20 }, // orange
      { r: 22, g: 143, b: 87 }, //  green
    ],
  },
  dark: {
    brand: DARK_BRAND,
    cycle: [
      DARK_BRAND,
      { r: 167, g: 129, b: 255 },
      { r: 41, g: 151, b: 255 },
      { r: 255, g: 149, b: 66 },
      { r: 74, g: 210, b: 140 },
    ],
  },
};

export const PALETTE_SIZE = PALETTE.light.cycle.length;

/**
 * Where a dot sits in the colour cycle: a diagonal gradient that drifts.
 *
 * Only the pointer's pocket reads this — the rest of the field is the brand
 * colour. Deriving it from position rather than randomising per dot means the
 * dots around any one dot are the same colour as it, so the pocket opens as a
 * band of colour rather than a spray of it, and moving the phase with time is
 * what makes that band travel while the pointer sits still.
 */
export function colourPhase(x: number, y: number, t: number): number {
  const cycles = x * 0.0016 + y * 0.0022 + t * 0.000045;
  return (((cycles % 1) + 1) % 1) * PALETTE_SIZE;
}

/** The two palette entries a phase falls between, and how far along it is. */
export function colourAt(palette: Rgb[], phase: number): Rgb {
  const size = palette.length;
  const scaled = ((phase % size) + size) % size;
  const index = Math.floor(scaled);
  return mix(palette[index]!, palette[(index + 1) % size]!, scaled - index);
}

/** Eased both ends, so the gather and the scatter start and stop softly. */
export function ease(x: number): number {
  const t = clamp01(x);
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/**
 * The gather/scatter loop, in milliseconds.
 *
 * Long enough held together that a visitor who arrives mid-cycle sees the mark
 * rather than a smear, long enough apart that the field still reads as a field.
 */
export const FORMATION = { gather: 3600, hold: 5200, scatter: 2600, rest: 3200 } as const;
export const FORMATION_PERIOD =
  FORMATION.gather + FORMATION.hold + FORMATION.scatter + FORMATION.rest;

/** 0 is scattered across the section, 1 is settled into the mark. */
export function formationAt(t: number): number {
  const p = ((t % FORMATION_PERIOD) + FORMATION_PERIOD) % FORMATION_PERIOD;
  if (p < FORMATION.gather) return ease(p / FORMATION.gather);
  const held = p - FORMATION.gather;
  if (held < FORMATION.hold) return 1;
  const falling = held - FORMATION.hold;
  if (falling < FORMATION.scatter) return 1 - ease(falling / FORMATION.scatter);
  return 0;
}

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
