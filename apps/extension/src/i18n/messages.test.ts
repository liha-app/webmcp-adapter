import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ja } from './ja';

/**
 * The type of `ja` already forces every key to exist. What it cannot check is
 * whether the sentence on the other side means the same thing, so these cover
 * the failures that survive the compiler: an argument that appears in one
 * language and not the other, a message left in English because it looked
 * finished, and an empty string.
 */
const PLACEHOLDER = /\{(\d+)\}/g;
const slots = (text: string) => [...text.matchAll(PLACEHOLDER)].map((match) => match[1]).sort();

/**
 * Identical in both languages on purpose. Every one is something a reader has
 * to type, search for, or match against what the tool itself declares — a
 * capability name, an API name, a product name. Translating them would make the
 * screen read better and the instruction impossible to follow.
 */
const INTENTIONALLY_IDENTICAL = new Set([
  'popup.webmcp',
  'popup.studio',
  'confirm.adapter',
  'confirm.capability',
  'studio.adapter',
  'studio.capability',
  'studio.adapterJson',
  'diag.scriptingApi',
]);

describe('the extension’s messages', () => {
  const keys = Object.keys(en) as Array<keyof typeof en>;

  it('translates every key', () => {
    expect(Object.keys(ja).sort()).toEqual(keys.slice().sort());
  });

  it.each(keys)('takes the same arguments in both languages: %s', (key) => {
    expect(slots(ja[key])).toEqual(slots(en[key]));
  });

  it('leaves nothing empty', () => {
    for (const key of keys) expect(ja[key].trim(), key).not.toBe('');
  });

  it('has no message left untranslated by accident', () => {
    const same = keys.filter((key) => ja[key] === en[key] && !INTENTIONALLY_IDENTICAL.has(key));
    expect(same).toEqual([]);
  });

  it('keeps the identifiers a reader has to act on in Latin script', () => {
    // Not cosmetic: someone told to enable a flag has to be able to type it.
    for (const key of keys) {
      for (const literal of ['document.modelContext', 'chrome://flags/#enable-webmcp-testing', 'MAIN world']) {
        if (en[key].includes(literal)) expect(ja[key], key).toContain(literal);
      }
    }
  });
});
