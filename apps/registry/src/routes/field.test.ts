import { describe, expect, it } from 'vitest';
import {
  bandBoost,
  bandHead,
  clamp01,
  colourAt,
  colourPhase,
  ease,
  FORMATION,
  FORMATION_PERIOD,
  formationAt,
  mix,
  PALETTE,
  PALETTE_SIZE,
  particleCount,
  pointerFalloff,
} from './field';

describe('the hero palette', () => {
  it('is five colours, in both appearances', () => {
    expect(PALETTE_SIZE).toBe(5);
    expect(PALETTE.light.cycle).toHaveLength(5);
    expect(PALETTE.dark.cycle).toHaveLength(5);
  });

  it('starts and ends the cycle on the brand, so the pocket closes seamlessly', () => {
    // The field is brand-coloured at rest; the pocket travels away from that
    // colour and has to arrive back at it rather than at a fifth stranger.
    expect(PALETTE.light.cycle[0]).toEqual(PALETTE.light.brand);
    expect(PALETTE.dark.cycle[0]).toEqual(PALETTE.dark.brand);
  });

  it('keeps every channel in range', () => {
    for (const set of [PALETTE.light.cycle, PALETTE.dark.cycle]) {
      for (const colour of set) {
        for (const channel of [colour.r, colour.g, colour.b]) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it('lifts the dark set above the light one, because it lands on black', () => {
    // A dot that reads on white is too dark to read on black, and the other way
    // round. The two sets exist for that reason, so they cannot be equal.
    const sum = (c: { r: number; g: number; b: number }) => c.r + c.g + c.b;
    for (let i = 0; i < PALETTE_SIZE; i += 1) {
      expect(sum(PALETTE.dark.cycle[i]!)).toBeGreaterThan(sum(PALETTE.light.cycle[i]!));
    }
  });
});

describe('mix', () => {
  it('returns the ends unchanged', () => {
    const a = { r: 10, g: 20, b: 30 };
    const b = { r: 200, g: 100, b: 0 };
    expect(mix(a, b, 0)).toEqual(a);
    expect(mix(a, b, 1)).toEqual(b);
  });

  it('meets in the middle and clamps beyond the ends', () => {
    expect(mix({ r: 0, g: 0, b: 0 }, { r: 100, g: 200, b: 50 }, 0.5)).toEqual({ r: 50, g: 100, b: 25 });
    expect(mix({ r: 0, g: 0, b: 0 }, { r: 100, g: 100, b: 100 }, 5)).toEqual({ r: 100, g: 100, b: 100 });
    expect(mix({ r: 0, g: 0, b: 0 }, { r: 100, g: 100, b: 100 }, -3)).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('pointerFalloff', () => {
  it('is full underneath the pointer and nothing at the radius', () => {
    expect(pointerFalloff(0, 100)).toBe(1);
    expect(pointerFalloff(100, 100)).toBe(0);
    expect(pointerFalloff(140, 100)).toBe(0);
  });

  it('softens toward the edge rather than cutting off', () => {
    // Squared, so half way out is a quarter of the effect — that is what keeps
    // the pocket from looking like a disc stamped on the field.
    expect(pointerFalloff(50, 100)).toBeCloseTo(0.25, 5);
    expect(pointerFalloff(25, 100)).toBeCloseTo(0.5625, 5);
  });

  it('cannot be driven by a zero radius', () => {
    expect(pointerFalloff(0, 0)).toBe(0);
  });
});

describe('the sweeping band', () => {
  it('travels, and comes back round', () => {
    const span = 1000;
    const first = bandHead(0, span, 0.05);
    const later = bandHead(4000, span, 0.05);
    expect(later).toBeGreaterThan(first);
    // One full period returns it to where it began.
    const period = span + 700;
    expect(bandHead(period / 0.05, span, 0.05)).toBeCloseTo(first, 5);
  });

  it('starts off-screen either side, so it enters and leaves', () => {
    const span = 1000;
    let min = Infinity;
    let max = -Infinity;
    for (let t = 0; t < 200000; t += 250) {
      const head = bandHead(t, span, 0.05);
      min = Math.min(min, head);
      max = Math.max(max, head);
    }
    expect(min).toBeLessThan(0);
    expect(max).toBeGreaterThan(span);
  });

  it('brightens what it passes over and nothing else', () => {
    expect(bandBoost(400, 400, 150)).toBe(1);
    expect(bandBoost(400, 600, 150)).toBe(0);
    expect(bandBoost(400, 475, 150)).toBeCloseTo(0.25, 5);
  });
});

describe('particleCount', () => {
  it('scales with the area it has to fill', () => {
    expect(particleCount(1400, 500)).toBeGreaterThan(particleCount(700, 500));
  });

  it('stays inside a budget a frame can afford', () => {
    expect(particleCount(4000, 2000)).toBeLessThanOrEqual(4200);
  });

  it('is dense enough to read as ground rather than as confetti', () => {
    // A hero at 1440x820 wants thousands, not hundreds. Drawn sparse once, and
    // it looked like someone had shaken glitter over the page.
    expect(particleCount(1440, 820)).toBeGreaterThan(3000);
  });

  it('still reads as a field on a phone', () => {
    expect(particleCount(320, 200)).toBeGreaterThanOrEqual(600);
  });
});

describe('clamp01', () => {
  it('holds the ends', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });
});

describe('colourPhase', () => {
  it('gives neighbours the same colour, which is what stops it looking like confetti', () => {
    // Circular, because the cycle wraps: phase 4.99 and phase 0.01 are the same
    // colour, and two dots either side of that seam are still neighbours.
    const apart = (a: number, b: number) => {
      const d = Math.abs(a - b) % PALETTE_SIZE;
      return Math.min(d, PALETTE_SIZE - d);
    };
    for (const [x, y] of [
      [400, 300],
      [625, 0], // sits on the seam
      [12, 640],
    ]) {
      expect(apart(colourPhase(x!, y!, 0), colourPhase(x! + 4, y! + 3, 0))).toBeLessThan(0.1);
    }
  });

  it('drifts with time, so the bands travel', () => {
    expect(colourPhase(400, 300, 0)).not.toBeCloseTo(colourPhase(400, 300, 9000), 3);
  });

  it('spans every colour across a hero, so a pocket anywhere finds one', () => {
    const seen = new Set<number>();
    for (let x = 0; x < 1280; x += 8) seen.add(Math.floor(colourPhase(x, 300, 0)));
    expect(seen.size).toBe(PALETTE_SIZE);
  });

  it('stays inside the palette wherever it is asked', () => {
    for (const [x, y, t] of [
      [0, 0, 0],
      [-900, -400, -50000],
      [4000, 2000, 900000],
    ]) {
      const phase = colourPhase(x!, y!, t!);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(PALETTE_SIZE);
    }
  });
});

describe('colourAt', () => {
  it('lands on a palette entry at whole numbers', () => {
    expect(colourAt(PALETTE.light.cycle, 2)).toEqual(PALETTE.light.cycle[2]);
    expect(colourAt(PALETTE.light.cycle, 0)).toEqual(PALETTE.light.brand);
  });

  it('blends between neighbours, and wraps from the last to the first', () => {
    expect(colourAt(PALETTE.light.cycle, 0.5)).toEqual(mix(PALETTE.light.cycle[0]!, PALETTE.light.cycle[1]!, 0.5));
    expect(colourAt(PALETTE.light.cycle, 4.5)).toEqual(mix(PALETTE.light.cycle[4]!, PALETTE.light.brand, 0.5));
  });
});

describe('the gather and scatter loop', () => {
  it('starts scattered, settles, holds, and comes apart again', () => {
    expect(formationAt(0)).toBe(0);
    expect(formationAt(FORMATION.gather)).toBe(1);
    expect(formationAt(FORMATION.gather + FORMATION.hold / 2)).toBe(1);
    expect(formationAt(FORMATION.gather + FORMATION.hold + FORMATION.scatter)).toBe(0);
  });

  it('holds the mark together for long enough to be seen', () => {
    // A visitor who lands mid-cycle has to meet the mark, not a smear of it.
    let formed = 0;
    for (let t = 0; t < FORMATION_PERIOD; t += 50) if (formationAt(t) > 0.9) formed += 50;
    expect(formed).toBeGreaterThan(5000);
  });

  it('repeats, and never leaves the rails', () => {
    for (let t = -FORMATION_PERIOD * 2; t < FORMATION_PERIOD * 3; t += 37) {
      const value = formationAt(t);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(formationAt(1234)).toBeCloseTo(formationAt(1234 + FORMATION_PERIOD), 10);
  });

  it('eases in and out rather than snapping', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5, 5);
    // Slower at the ends than in the middle: that is the whole point of easing.
    expect(ease(0.1)).toBeLessThan(0.1);
    expect(ease(0.9)).toBeGreaterThan(0.9);
  });
});
