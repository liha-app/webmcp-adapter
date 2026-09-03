import { useEffect, useRef } from 'react';
import { MARK_GEOMETRY } from '@liha/brand';
import {
  bandBoost,
  bandHead,
  colourAt,
  colourPhase,
  formationAt,
  mix,
  PALETTE,
  particleCount,
  pointerFalloff,
  type Palette,
  type Rgb,
} from './field';

/**
 * The hero's particle field.
 *
 * After the one on Gemini's about page — a drift of dots that the cursor pushes
 * around and a band of light that sweeps through on a timer. Theirs is WebGL2
 * across a black full-bleed page; this is a 2D canvas over one section of a
 * page that is white half the time, and two things here are not theirs at all:
 *
 * - the dots gather into the Liha mark and come apart again on a loop, so the
 *   field is the product's own shape rather than a texture. The mark's geometry
 *   comes from @liha/brand and is rasterised once per resize to find out where
 *   the dots should settle — there is no second drawing of the jellyfish here.
 * - the field is the brand colour and nothing else, until the pointer opens a
 *   pocket in it that travels through the other four.
 *
 * It is decoration, and it behaves like decoration: aria-hidden, never taking a
 * pointer event, one static frame when the visitor asks for reduced motion, and
 * no frames at all while the hero is off-screen or the tab is in the background.
 */
interface Particle {
  /** Where it lives when the field is scattered. */
  fx: number;
  fy: number;
  /** Where it lives when the field has gathered into the mark. */
  mx: number;
  my: number;
  drift: number;
  wobble: number;
  r: number;
  phase: number;
  speed: number;
}

const POINTER_RADIUS = 220;
const BAND_WIDTH = 150;
const BAND_SPEED = 0.045;

/**
 * Points inside the mark, found by drawing it and reading back the pixels.
 *
 * Rejection sampling rather than walking the path: the jellyfish has a hole for
 * its face and a sparkle floating off one corner, and "is this pixel painted"
 * gets both right for free where a path walk would need to know about winding.
 */
function markPoints(width: number, height: number, wanted: number): Array<[number, number]> {
  /*
   * Big enough that the headline sits inside the mark rather than on top of
   * it: the bell clears the type above and the hem clears the buttons below,
   * which is what leaves a jellyfish rather than a cloud. Drawn small it
   * disappeared behind the words entirely.
   */
  const size = Math.max(120, Math.min(width * 0.4, height * 0.98));
  const scratch = document.createElement('canvas');
  const step = Math.max(1, Math.round(size / 190));
  scratch.width = Math.round(size / step);
  scratch.height = Math.round(size / step);
  const pen = scratch.getContext('2d', { willReadFrequently: true });
  if (!pen) return [];

  const [, , vbW, vbH] = MARK_GEOMETRY.viewBox.split(/\s+/).map(Number) as [number, number, number, number];
  const fit = Math.min(scratch.width / vbW, scratch.height / vbH);
  pen.translate((scratch.width - vbW * fit) / 2, (scratch.height - vbH * fit) / 2);
  pen.scale(fit, fit);
  pen.fillStyle = '#000';
  for (const d of MARK_GEOMETRY.paths) pen.fill(new Path2D(d));

  const { data } = pen.getImageData(0, 0, scratch.width, scratch.height);
  const inside: Array<[number, number]> = [];
  const left = (width - size) / 2;
  // A shade above centre: the hero's text block sits low, and this lifts the
  // bell clear of it.
  const top = (height - size) / 2 - height * 0.05;
  for (let y = 0; y < scratch.height; y += 1) {
    for (let x = 0; x < scratch.width; x += 1) {
      if (data[(y * scratch.width + x) * 4 + 3]! > 128) inside.push([x, y]);
    }
  }
  if (inside.length === 0) return [];

  // One dot per painted pixel would give a solid silhouette; sampling with a
  // little jitter keeps it reading as dots that happen to agree.
  const points: Array<[number, number]> = [];
  for (let i = 0; i < wanted; i += 1) {
    const [px, py] = inside[Math.floor(Math.random() * inside.length)]!;
    points.push([
      left + (px + Math.random()) * step,
      top + (py + Math.random()) * step,
    ]);
  }
  return points;
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const context = element.getContext('2d');
    if (!context) return;
    /* Re-bound with the type the guards above have already proved, so the
     * closures below do not each have to assert it again. */
    const canvas: HTMLCanvasElement = element;
    const ctx: CanvasRenderingContext2D = context;

    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const dark = matchMedia('(prefers-color-scheme: dark)');
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;
    let started = 0;
    let last = 0;
    const pointer = { x: 0, y: 0, strength: 0, wanted: 0 };

    /** The explicit choice wins; otherwise follow the system, same as the CSS. */
    function palette(): Palette {
      const attribute = document.documentElement.getAttribute('data-theme');
      const isDark = attribute === 'dark' || (attribute !== 'light' && dark.matches);
      return isDark ? PALETTE.dark : PALETTE.light;
    }

    function seed() {
      const count = particleCount(width, height);
      const home = markPoints(width, height, count);
      particles = Array.from({ length: count }, (_, i) => {
        const settled = home[i] ?? [width / 2, height / 2];
        return {
          fx: Math.random() * width,
          fy: Math.random() * height,
          mx: settled[0],
          my: settled[1],
          drift: Math.random() * Math.PI * 2,
          wobble: 0.6 + Math.random() * 1.8,
          r: 0.35 + Math.random() * Math.random() * 2.1,
          phase: Math.random() * Math.PI * 2,
          speed: 0.0004 + Math.random() * 0.0011,
        };
      });
    }

    function resize() {
      const box = canvas.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      const ratio = Math.min(2, devicePixelRatio || 1);
      width = box.width;
      height = box.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      seed();
      if (motion.matches) draw(0);
    }

    function draw(t: number) {
      const colours = palette();
      const still = motion.matches;
      // Held together when the visitor has asked for less motion: the mark is
      // the point, and it is the loop rather than the shape that is the motion.
      const formed = still ? 1 : formationAt(t);
      const head = bandHead(t, width, BAND_SPEED);
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        // The scattered position drifts; the gathered one breathes in place.
        const wander = still ? 0 : Math.sin(t * 0.00012 + p.drift) * 14;
        const breath = still ? 0 : Math.sin(t * 0.0007 + p.phase) * p.wobble * formed;
        const x = p.fx + wander + (p.mx - p.fx) * formed + breath;
        const y = p.fy + wander * 0.6 + (p.my - p.fy) * formed + breath;

        // Its own slow twinkle, so no two dots pulse together.
        const twinkle = still ? 0.72 : 0.55 + 0.45 * Math.sin(t * p.speed + p.phase);
        // The band, projected along a diagonal so it sweeps rather than wipes.
        const boost = still ? 0 : bandBoost(x * 0.82 + y * 0.58, head, BAND_WIDTH);

        let radius = p.r * (1 + boost * 0.7 + formed * 0.15);
        let alpha = (0.26 + 0.34 * twinkle + boost * 0.5 + formed * 0.16) * (0.5 + p.r * 0.24);
        let colour = colours.brand;

        if (pointer.strength > 0.001) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const distance = Math.hypot(dx, dy);
          const force = pointerFalloff(distance, POINTER_RADIUS) * pointer.strength;
          if (force > 0) {
            /*
             * The pocket: dots part around the cursor, brighten, grow, and
             * leave the brand colour for the cycle underneath. That cycle is a
             * drifting gradient, so the pocket opens into a band of colour
             * that keeps moving while the pointer sits still — and because the
             * cycle starts and ends on the brand, its edge has no seam.
             */
            const shove = force * 38;
            const away = distance || 1;
            const opened = colourAt(colours.cycle, colourPhase(x, y, t));
            radius *= 1 + force * 1.7;
            alpha += force * 0.9;
            colour = mix(colour, opened, Math.min(1, force * 1.8));
            paint(x + (dx / away) * shove, y + (dy / away) * shove, radius, colour, alpha);
            continue;
          }
        }
        paint(x, y, radius, colour, alpha);
      }
    }

    function paint(x: number, y: number, radius: number, colour: Rgb, alpha: number) {
      ctx.fillStyle = `rgba(${colour.r},${colour.g},${colour.b},${Math.min(1, alpha).toFixed(3)})`;
      // Most of the field is under a pixel across, where a square and a circle
      // are the same two pixels — and fillRect costs a fraction of an arc. At
      // four thousand dots a frame that difference is the whole budget.
      if (radius < 0.9) {
        const size = radius * 2;
        ctx.fillRect(x - radius, y - radius, size, size);
        return;
      }
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    function tick(now: number) {
      if (!started) started = now;
      /*
       * Eased against the clock rather than against the frame count. Per-frame
       * easing means the pocket opens twice as slowly on a 30fps machine as on
       * a 60fps one — and vanishes entirely on one that is struggling, which is
       * exactly when a visitor is most likely to be moving the pointer about
       * wondering whether the page is alive.
       */
      const step = Math.min(120, now - (last || now));
      last = now;
      pointer.strength += (pointer.wanted - pointer.strength) * (1 - Math.exp(-step / 90));
      draw(now - started);
      frame = requestAnimationFrame(tick);
    }

    function start() {
      if (frame || motion.matches || !visible || document.hidden) return;
      frame = requestAnimationFrame(tick);
    }
    function stop() {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
      // The clock stops with it, so a background tab does not come back and
      // apply a ten-second easing step in one frame.
      last = 0;
    }

    function onPointerMove(event: PointerEvent) {
      const box = canvas.getBoundingClientRect();
      pointer.x = event.clientX - box.left;
      pointer.y = event.clientY - box.top;
      pointer.wanted = 1;
    }
    function onPointerLeave() {
      pointer.wanted = 0;
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const onScreen = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (visible) start();
        else stop();
      },
      { threshold: 0 },
    );
    onScreen.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());
    const onAppearance = () => {
      if (motion.matches) draw(0);
    };
    const themeWatch = new MutationObserver(onAppearance);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    resize();
    start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    dark.addEventListener('change', onAppearance);
    motion.addEventListener('change', () => {
      stop();
      if (motion.matches) draw(0);
      else start();
    });

    return () => {
      stop();
      observer.disconnect();
      onScreen.disconnect();
      themeWatch.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      dark.removeEventListener('change', onAppearance);
    };
  }, []);

  return <canvas ref={canvasRef} className="field" aria-hidden="true" data-testid="hero-field" />;
}
