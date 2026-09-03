import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ja } from './ja';

/**
 * TypeScript already guarantees that `ja` has every key `en` has. What it
 * cannot see is the inside of the strings, and that is where translation bugs
 * actually live: a template that interpolates a count in one language and
 * silently drops it in the other renders a sentence with a hole in it.
 */
const placeholders = (value: string): string[] => [...value.matchAll(/\{(\d+)\}/g)].map((match) => match[1]!).sort();

/**
 * Keys that are the same in both languages on purpose: proper nouns, API
 * surface, and "Adapter", which this project treats as an untranslated term in
 * Japanese too — 「すべてのAdapter」 rather than a coined translation.
 */
const INTENTIONALLY_IDENTICAL = new Set([
  'hero.eyebrow',
  // The protocol's name, which is the same word in both languages.
  'agent.railWebmcp',
  // The Studio's own name, which is what it is called in the extension too.
  'create.eyebrow',
  'nav.github',
  'flow.registerTool',
  'how.stepAdapterJson',
  'how.stepMainWorld',
  'how.stepRegister',
  'how.stepRegisterDetail',
  'adapter.noteCapabilityLabel',
  'adapter.noteStepsLabel',
  'adapter.notePlaceholdersLabel',
  'store.extName',
  'setup.download',
  'demos.adapter',
]);

describe('message catalogue', () => {
  it('translates every key', () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
  });

  it('interpolates the same values in both languages', () => {
    for (const [key, english] of Object.entries(en)) {
      expect({ key, slots: placeholders(ja[key as keyof typeof en]) }).toEqual({
        key,
        slots: placeholders(english),
      });
    }
  });

  it('has no untranslated strings left behind', () => {
    const untranslated = Object.entries(en)
      .filter(([key, english]) => ja[key as keyof typeof en] === english && !INTENTIONALLY_IDENTICAL.has(key))
      .map(([key]) => key);
    expect(untranslated).toEqual([]);
  });

  it('leaves no empty message in either language', () => {
    for (const [key, english] of Object.entries(en)) {
      expect(english.trim(), `en.${key}`).not.toBe('');
      expect(ja[key as keyof typeof en].trim(), `ja.${key}`).not.toBe('');
    }
  });
});
