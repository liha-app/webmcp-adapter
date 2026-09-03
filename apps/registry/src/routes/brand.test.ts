import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The brand assets are generated, and generated things drift quietly.
 *
 * The icon reverses the mark: the body becomes white and the face — which is a
 * hole in the body — shows the squircle behind it. The eyes have to invert with
 * it. They did not, so for one commit the favicon had no eyes and nothing here
 * noticed. These are the checks that would have.
 */
const root = join(import.meta.dirname, '../../../..');
const brand = (name: string) => readFileSync(join(root, 'apps/registry/public/brand', name), 'utf8');
const icon = brand('liha-adapter-icon.svg');
const glyph = brand('liha-adapter-glyph.svg');
const mark = brand('liha-adapter-mark.svg');
const favicon = readFileSync(join(root, 'apps/registry/public/favicon.svg'), 'utf8');

const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]!);
const paths = (svg: string) => [...svg.matchAll(/<path[^>]*\bd="([^"]+)"/g)].map((m) => m[1]!);

describe('the app icon', () => {
  it('draws the squircle, the body and both eyes', () => {
    expect(icon).toMatch(/<rect[^>]*rx="16"/);
    expect(paths(icon)).toHaveLength(3);
  });

  it('keeps the eyes visible against the face', () => {
    // The face is a hole, so what shows through it is the squircle's own fill.
    // Eyes painted that colour are invisible — which is exactly what happened.
    const squircle = icon.match(/<rect[^>]*fill="([^"]+)"/)![1];
    const eyeFills = fills(icon).slice(-2);
    expect(eyeFills).toHaveLength(2);
    for (const eye of eyeFills) expect(eye).not.toBe(squircle);
  });

  it('does not paint the body the same colour as the ground either', () => {
    const squircle = icon.match(/<rect[^>]*fill="([^"]+)"/)![1];
    const body = icon.match(/<g[^>]*>\s*<path fill="([^"]+)"/)![1];
    expect(body).not.toBe(squircle);
  });

  it('is what the home-screen tile asks for, and not what the tab asks for', () => {
    // A tab sits its icon on the browser's own chrome, where a filled teal
    // square reads as a tile someone pasted in. The squircle belongs on a home
    // screen, and that is the only place index.html points at it.
    const page = readFileSync(join(root, 'apps/registry/index.html'), 'utf8');
    expect(page).toContain('<link rel="apple-touch-icon" href="/brand/liha-adapter-icon.svg" />');
    expect(page).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />');
    expect(favicon).not.toBe(icon);
  });
});

describe('the toolbar glyph', () => {
  it('is the figure in the ink, not the figure reversed out of a ground', () => {
    // The whole point of the third form. A `rect` here means the extension went
    // back to wearing a filled teal tile in the toolbar.
    expect(glyph).not.toMatch(/<rect/);
    const teal = mark.match(/fill="(#[0-9a-fA-F]{6})"/)![1]!;
    expect(fills(glyph)).toEqual([teal, teal, teal]);
  });

  it('drops the sparkle and frames on the figure', () => {
    // Three paths, not four: at 16px the sparkle is one dim pixel, and the room
    // it takes comes out of the figure.
    expect(paths(glyph)).toHaveLength(3);
    const [x, y, w, h] = glyph.match(/viewBox="([^"]+)"/)![1]!.split(/\s+/).map(Number);
    expect(w).toBe(h);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });

  it('is what the extension rasterises', () => {
    const generator = readFileSync(join(root, 'tools/brand/icons.mjs'), 'utf8');
    expect(generator).toContain('liha-adapter-glyph.svg');
    expect(generator).not.toContain('liha-adapter-icon.svg');
  });
});

describe('the mark', () => {
  it('carries the sparkle, the body and both eyes', () => {
    expect(paths(mark)).toHaveLength(4);
  });

  it('paints with attributes, not a shared class', () => {
    // Every mark in the Liha family exports as `.cls-1`, so two of them inlined
    // in one document make the second repaint the first.
    for (const svg of [mark, icon, brand('liha-adapter-mark-mono.svg')]) {
      expect(svg).not.toMatch(/class=|<style/);
    }
  });

  it('ships artwork rather than content-credential metadata', () => {
    // The export is 72KB, 70KB of which is a C2PA blob.
    expect(mark).not.toMatch(/c2pa|<metadata/i);
    expect(mark.length).toBeLessThan(8000);
  });

  it('is what favicon.svg serves', () => {
    expect(favicon).toBe(mark);
  });

  it('takes its colour from the master drawing', () => {
    const source = readFileSync(join(root, 'tools/brand/source.svg'), 'utf8');
    const ink = source.match(/fill:\s*(#[0-9a-fA-F]{6})/)![1]!.toLowerCase();
    expect(fills(mark).map((f) => f.toLowerCase())).toEqual([ink, ink, ink, ink]);
  });
});
