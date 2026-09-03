import { useEffect, useRef } from 'react';
import {
  bandBoost,
  bandHead,
  mix,
  PALETTE,
  PALETTE_SIZE,
  particleCount,
  pointerFalloff,
  type Rgb,
} from './field';

/**
 * The hero's particle field.
 *
 * After the one on Gemini's about page — a drift of coloured dots that the
 * cursor pushes around and a band of light that sweeps through on a timer.
 * Theirs is WebGL2 across a black full-bleed page; this is a 2D canvas over one
 * section of a page that is white half the time, so everything except the idea
 * is ours: five colours rather than a blue nebula, two palettes so it reads on
 * white as well as on black, and a mask that fades the field out at the edges
 * so it belongs to the section instead of sitting on it as a rectangle.
 *
 * It is decoration, and it behaves like decoration: aria-hidden, never taking a
 * pointer event, one static frame when the visitor asks for reduced motion, and
 * no frames at all while the hero is off-screen or the tab is in the background.
 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  phase: number;
  speed: number;
}

const POINTER_RADIUS = 220;
const BAND_WIDTH = 150;
const BAND_SPEED = 0.045;

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
    const pointer = { x: 0, y: 0, strength: 0, wanted: 0 };

    /** The explicit choice wins; otherwise follow the system, same as the CSS. */
    function palette(): Rgb[] {
      const attribute = document.documentElement.getAttribute('data-theme');
      const isDark = attribute === 'dark' || (attribute !== 'light' && dark.matches);
      return isDark ? PALETTE.dark : PALETTE.light;
    }

    function seed() {
      const count = particleCount(width, height);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.05,
        vy: (Math.random() - 0.5) * 0.05,
        r: 0.35 + Math.random() * Math.random() * 2.1,
        hue: Math.floor(Math.random() * PALETTE_SIZE),
        phase: Math.random() * Math.PI * 2,
        speed: 0.0004 + Math.random() * 0.0011,
      }));
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
      const head = bandHead(t, width, BAND_SPEED);
      const still = motion.matches;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (!still) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -4) p.x = width + 4;
          else if (p.x > width + 4) p.x = -4;
          if (p.y < -4) p.y = height + 4;
          else if (p.y > height + 4) p.y = -4;
        }

        // Its own slow twinkle, so no two dots pulse together.
        const twinkle = still ? 0.72 : 0.55 + 0.45 * Math.sin(t * p.speed + p.phase);
        // The band, projected along a diagonal so it sweeps rather than wipes.
        const boost = still ? 0 : bandBoost(p.x * 0.82 + p.y * 0.58, head, BAND_WIDTH);

        let radius = p.r * (1 + boost * 0.7);
        let alpha = (0.3 + 0.34 * twinkle + boost * 0.5) * (0.5 + p.r * 0.24);
        let colour = colours[p.hue]!;

        if (pointer.strength > 0.001) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const force = pointerFalloff(Math.hypot(dx, dy), POINTER_RADIUS) * pointer.strength;
          if (force > 0) {
            // Pushed out of the way, brighter, larger, and shifted toward the
            // next colour along. The shove is what does the work: the dots part
            // around the cursor and pile into a ring, so the pocket reads as a
            // change in the field rather than as a spotlight on it.
            const distance = Math.hypot(dx, dy) || 1;
            const shove = force * 38;
            const px = p.x + (dx / distance) * shove;
            const py = p.y + (dy / distance) * shove;
            radius *= 1 + force * 1.7;
            alpha += force * 0.9;
            colour = mix(colour, colours[(p.hue + 1) % PALETTE_SIZE]!, Math.min(1, force * 1.6));
            paint(px, py, radius, colour, alpha);
            continue;
          }
        }
        paint(p.x, p.y, radius, colour, alpha);
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

    function tick(t: number) {
      pointer.strength += (pointer.wanted - pointer.strength) * 0.08;
      draw(t);
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
