import { beforeEach, describe, expect, it } from 'vitest';
import { bestSelector, buildSelectorCandidates } from './selectors';

const setBody = (html: string) => {
  document.body.innerHTML = html;
};

beforeEach(() => setBody(''));

function best(selector: string): string {
  const element = document.querySelector(selector)!;
  return bestSelector(buildSelectorCandidates(element))?.selector ?? '';
}

describe('selector strategy', () => {
  it('prefers an explicit test id above everything else', () => {
    setBody('<button id="go" name="go" data-testid="submit-order" aria-label="Go">Go</button>');
    expect(best('button')).toBe("[data-testid='submit-order']");
  });

  it('uses a stable data attribute when there is no test id', () => {
    setBody('<button data-action="add-customer" class="btn btn-primary x9f2">Add</button>');
    expect(best('button')).toBe("[data-action='add-customer']");
  });

  it('falls back through id, name and aria-label', () => {
    setBody('<input id="email-field" name="email" aria-label="Email">');
    expect(best('input')).toBe('#email-field');
    setBody('<input name="email" aria-label="Email">');
    expect(best('input')).toBe("input[name='email']");
    setBody('<input aria-label="Email">');
    expect(best('input')).toBe("[aria-label='Email']");
  });

  // Utility and CSS-module class names churn on every redeploy, so an adapter
  // built on them looks fine the day it is recorded and breaks a week later.
  it('never produces a class-based selector', () => {
    setBody('<button class="btn primary css-1x2y3z">Go</button>');
    const candidates = buildSelectorCandidates(document.querySelector('button')!);
    for (const candidate of candidates) expect(candidate.selector).not.toContain('.');
  });

  it('ignores framework-generated ids and hashed attribute values', () => {
    setBody('<button id=":r7:" data-emotion="css-1a2b3c4d" data-action="save">Save</button>');
    const selectors = buildSelectorCandidates(document.querySelector('button')!).map((c) => c.selector);
    expect(selectors).not.toContain('#:r7:');
    expect(selectors.some((selector) => selector.includes('data-emotion'))).toBe(false);
    expect(best('button')).toBe("[data-action='save']");
  });

  it('scopes an ambiguous selector under a stable ancestor', () => {
    setBody(`
      <div data-testid="row-a"><button data-action="delete">x</button></div>
      <div data-testid="row-b"><button data-action="delete">x</button></div>`);
    const element = document.querySelector('[data-testid="row-a"] button')!;
    const chosen = bestSelector(buildSelectorCandidates(element));
    expect(chosen?.matches).toBe(1);
    expect(chosen?.selector).toBe("[data-testid='row-a'] [data-action='delete']");
  });

  it('reports how many elements each candidate matched', () => {
    setBody('<button data-action="go">a</button><button data-action="go">b</button>');
    const candidates = buildSelectorCandidates(document.querySelector('button')!);
    expect(candidates.find((c) => c.selector === "[data-action='go']")?.matches).toBe(2);
  });

  it('falls back to a structural selector and marks it unstable', () => {
    setBody('<main><section><p>one</p><p>two</p></section></main>');
    const element = document.querySelectorAll('p')[1]!;
    const chosen = bestSelector(buildSelectorCandidates(element));
    expect(chosen?.stable).toBe(false);
    expect(chosen?.selector).toContain('nth-of-type(2)');
    expect(document.querySelectorAll(chosen!.selector)).toHaveLength(1);
  });

  it('escapes quotes in attribute values', () => {
    setBody(`<button aria-label="Bob's task">x</button>`);
    const chosen = bestSelector(buildSelectorCandidates(document.querySelector('button')!));
    expect(() => document.querySelectorAll(chosen!.selector)).not.toThrow();
    expect(document.querySelectorAll(chosen!.selector)).toHaveLength(1);
  });
});
