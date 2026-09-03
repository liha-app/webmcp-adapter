import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARK_GEOMETRY } from './mark';

/**
 * The components inline geometry that is generated somewhere else, and
 * generated things drift quietly. These are the checks that catch it.
 *
 * The two forms are not interchangeable, and the second half of this file says
 * so in tests rather than only in a comment: the mark keeps its sparkle and its
 * colour, the icon drops the sparkle and reverses out of the squircle.
 */
const root = join(import.meta.dirname, '../../..');
const brand = (name: string) => readFileSync(join(root, 'apps/registry/public/brand', name), 'utf8');
const icon = brand('liha-adapter-icon.svg');
const mark = brand('liha-adapter-mark.svg');
const component = readFileSync(join(root, 'packages/brand/src/mark.tsx'), 'utf8');

const paths = (svg: string) => [...svg.matchAll(/<path[^>]*\bd="([^"]+)"/g)].map((m) => m[1]!);

describe('BrandMark', () => {
  it('inlines exactly the generated mark, so the two cannot drift', () => {
    const [sparkle, body, eyeR, eyeL] = paths(mark);
    expect(component).toContain(`const MARK_SPARKLE = '${sparkle}'`);
    expect(component).toContain(`const MARK_BODY = '${body}'`);
    expect(component).toContain(`const MARK_EYE_R = '${eyeR}'`);
    expect(component).toContain(`const MARK_EYE_L = '${eyeL}'`);
    expect(component).toContain(`const MARK_VIEWBOX = '${mark.match(/viewBox="([^"]+)"/)![1]}'`);
  });

  it('keeps the sparkle, which is the difference between the mark and the icon', () => {
    // The mark goes beside the wordmark, where there is room for it. Drawing
    // the icon there instead put an app tile next to type for one release.
    expect(paths(mark)).toHaveLength(4);
    expect(paths(icon)).toHaveLength(3);
    const markFn = component.slice(component.indexOf('export function BrandMark'), component.indexOf('export function BrandIcon'));
    expect(markFn).toContain('MARK_SPARKLE');
    expect(markFn).not.toContain('<rect');
  });

  it('paints teal, and reverses to the text colour only when asked', () => {
    const teal = icon.match(/<rect[^>]*fill="([^"]+)"/)![1];
    expect(component).toContain(`export const BRAND_TEAL = '${teal}'`);
    const markFn = component.slice(component.indexOf('export function BrandMark'), component.indexOf('export function BrandIcon'));
    expect(markFn).toContain('currentColor');
    expect(markFn).toContain('BRAND_TEAL');
  });
});

describe('MARK_GEOMETRY', () => {
  it('hands out the same four paths the component draws', () => {
    expect(MARK_GEOMETRY.paths).toEqual(paths(mark));
    expect(MARK_GEOMETRY.viewBox).toBe(mark.match(/viewBox="([^"]+)"/)![1]);
  });
});

describe('BrandIcon', () => {
  it('inlines exactly the generated icon', () => {
    const [body, eyeR, eyeL] = paths(icon);
    expect(component).toContain(`const MARK_BODY = '${body}'`);
    expect(component).toContain(`const MARK_EYE_R = '${eyeR}'`);
    expect(component).toContain(`const MARK_EYE_L = '${eyeL}'`);
    expect(component).toContain(`const ICON_TRANSFORM = '${icon.match(/transform="([^"]+)"/)![1]}'`);
  });

  it('paints its eyes the way the icon file does', () => {
    // The face is a hole, so what shows through it is the squircle's fill.
    // Eyes painted that colour are invisible — which is exactly what happened.
    const iconFn = component.slice(component.indexOf('export function BrandIcon'));
    expect(iconFn).toContain('<rect width="64" height="64" rx="16" fill={BRAND_TEAL} />');
    const inside = iconFn.slice(iconFn.indexOf('<g transform'));
    expect(inside).not.toContain('BRAND_TEAL');
    expect(inside.match(/fill="#fff"/g)).toHaveLength(3);
  });
});
