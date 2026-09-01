/**
 * Selector generation for the Recorder.
 *
 * Class names are deliberately never used. Utility and CSS-module classes churn
 * on every redeploy, so a class-based selector produces an adapter that looks
 * fine on the day it is recorded and silently breaks a week later. The
 * preference order below runs from "the site author declared this a stable
 * hook" down to "we had to fall back on structure", and every candidate is
 * reported with how many elements it actually matched so the Studio can show
 * whether it is unique.
 */
export interface SelectorCandidate {
  selector: string;
  strategy: string;
  matches: number;
  /** False for structural selectors, which break when the DOM is rearranged. */
  stable: boolean;
}

const TEST_ATTRS = ['data-testid', 'data-test-id', 'data-test', 'data-qa', 'data-cy'];

/** Attributes that look like framework bookkeeping rather than an author's hook. */
const VOLATILE_ATTR = /^(data-reactid|data-react|data-v-|data-svelte|data-emotion|data-styled)/i;
const VOLATILE_VALUE = /^[0-9a-f]{8,}$/i;
const VOLATILE_ID = /(^:r[0-9a-z]+:$|\d{4,}|^[0-9a-f]{8,}$)/i;

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** `CSS.escape` is not available in every DOM implementation, so fall back. */
function escapeIdentifier(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/([^\w-])/g, '\\$1');
}

function attributeCandidates(element: Element): Array<{ selector: string; strategy: string }> {
  const tag = element.tagName.toLowerCase();
  const out: Array<{ selector: string; strategy: string }> = [];

  for (const attr of TEST_ATTRS) {
    const value = element.getAttribute(attr);
    if (value) out.push({ selector: `[${attr}=${quote(value)}]`, strategy: attr });
  }

  for (const attr of element.attributes) {
    if (!attr.name.startsWith('data-')) continue;
    if (TEST_ATTRS.includes(attr.name)) continue;
    if (VOLATILE_ATTR.test(attr.name) || !attr.value || VOLATILE_VALUE.test(attr.value)) continue;
    out.push({ selector: `[${attr.name}=${quote(attr.value)}]`, strategy: attr.name });
  }

  const id = element.getAttribute('id');
  if (id && !VOLATILE_ID.test(id)) out.push({ selector: `#${escapeIdentifier(id)}`, strategy: 'id' });

  const name = element.getAttribute('name');
  if (name) out.push({ selector: `${tag}[name=${quote(name)}]`, strategy: 'name' });

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) out.push({ selector: `[aria-label=${quote(ariaLabel)}]`, strategy: 'aria-label' });

  const role = element.getAttribute('role');
  if (role) out.push({ selector: `${tag}[role=${quote(role)}]`, strategy: 'role' });

  const type = element.getAttribute('type');
  if (tag === 'input' && type) out.push({ selector: `input[type=${quote(type)}]`, strategy: 'input-type' });

  return out;
}

/** A structural path, used only when nothing declarative identifies the element. */
function structuralSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  for (let depth = 0; current && depth < 6; depth++) {
    const tag = current.tagName.toLowerCase();
    if (tag === 'body' || tag === 'html') break;
    const parent: Element | null = current.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const siblings = [...parent.children].filter((child) => child.tagName === current!.tagName);
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(current) + 1})` : tag);
    current = parent;
  }
  return parts.join(' > ');
}

function countMatches(selector: string, root: Document): number {
  try {
    return root.querySelectorAll(selector).length;
  } catch {
    return -1;
  }
}

/**
 * Finds nearby ancestors that carry a declarative hook, so a non-unique
 * candidate can be scoped: `[data-testid='task-list'] button[name='delete']`.
 */
function ancestorScopes(element: Element, root: Document): string[] {
  const scopes: string[] = [];
  let current = element.parentElement;
  for (let depth = 0; current && depth < 5; depth++) {
    for (const candidate of attributeCandidates(current)) {
      if (countMatches(candidate.selector, root) === 1) {
        scopes.push(candidate.selector);
        break;
      }
    }
    current = current.parentElement;
  }
  return scopes;
}

export function buildSelectorCandidates(element: Element, root: Document = document): SelectorCandidate[] {
  const seen = new Set<string>();
  const candidates: SelectorCandidate[] = [];

  const push = (selector: string, strategy: string, stable: boolean) => {
    if (seen.has(selector)) return;
    seen.add(selector);
    candidates.push({ selector, strategy, matches: countMatches(selector, root), stable });
  };

  const direct = attributeCandidates(element);
  for (const candidate of direct) push(candidate.selector, candidate.strategy, true);

  // Scope the ambiguous ones under a stable ancestor before falling back.
  const scopes = ancestorScopes(element, root);
  for (const scope of scopes) {
    for (const candidate of direct) {
      push(`${scope} ${candidate.selector}`, `scoped:${candidate.strategy}`, true);
    }
  }

  push(structuralSelector(element), 'structural', false);
  return candidates.sort((a, b) => Number(b.matches === 1) - Number(a.matches === 1));
}

/** The best candidate: unique if possible, most stable otherwise. */
export function bestSelector(candidates: readonly SelectorCandidate[]): SelectorCandidate | null {
  return (
    candidates.find((candidate) => candidate.matches === 1 && candidate.stable) ??
    candidates.find((candidate) => candidate.matches === 1) ??
    candidates[0] ??
    null
  );
}
