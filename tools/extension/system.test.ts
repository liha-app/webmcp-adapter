import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * One design system, in one file.
 *
 * Every page used to open with a palette of its own, and the five had drifted
 * into four greys and two blues — nothing was wrong enough to notice on any one
 * screen, and the extension looked like five things. These are the checks that
 * keep the next stylesheet from starting the same way.
 */
const root = join(import.meta.dirname, '../../apps/extension');
const PAGES = ['popup', 'manage', 'confirm', 'diagnostics', 'studio'] as const;
const read = (path: string) => readFileSync(join(root, 'src', path), 'utf8');
const system = read('ui/system.css');
/* The comments explain the choices and so name the colours that were not
 * chosen; the checks below are about what the file declares. */
const declarations = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const systemRules = declarations(system);

describe('every page', () => {
  it.each(PAGES)('links the system stylesheet, and links it first (%s)', (page) => {
    const sheets = [...read(`${page}/${page}.html`).matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(
      (match) => match[1]!,
    );
    expect(sheets[0]).toBe('../ui/system.css');
    expect(sheets).toContain(`${page}.css`);
  });

  it.each(PAGES)('does not open a palette of its own (%s)', (page) => {
    const css = declarations(read(`${page}/${page}.css`));
    // The tokens live in one place; a page that redeclares one has forked it.
    expect(css).not.toMatch(/--(?:label|secondary|separator|blue|ink|muted|line|accent|card|grouped)\s*:/);
    expect(css).not.toContain('color-scheme');
    expect(css).not.toMatch(/@media \(prefers-color-scheme/);
  });
});

describe('the system', () => {
  it('is the only file that declares the appearance', () => {
    expect(systemRules).toContain('color-scheme: light dark');
    // Both appearances come from light-dark() rather than a second block, so a
    // token added for one appearance cannot be forgotten for the other.
    expect(systemRules).not.toMatch(/@media \(prefers-color-scheme/);
  });

  it('draws on Apple\'s system colours rather than the marketing ones', () => {
    // #007aff is systemBlue. #0071e3 is the blue of a buy button on apple.com,
    // which is what the demos measure and what these pages must not.
    expect(systemRules).toContain('#007aff');
    expect(systemRules).not.toContain('#0071e3');
    // An Apple switch is green when it is on, whatever the app's tint is.
    expect(systemRules).toMatch(/--green:\s*light-dark\(#34c759/);
    expect(systemRules).toMatch(/:checked\s*\{\s*background:\s*var\(--green\)/);
  });

  it('ships with the extension', () => {
    const build = readFileSync(join(root, 'build.mjs'), 'utf8');
    expect(build).toContain("'system.css'");
  });
});
