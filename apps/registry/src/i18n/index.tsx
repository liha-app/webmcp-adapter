import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type MessageKey } from './en';
import { ja } from './ja';

/**
 * Two languages, one set of keys.
 *
 * `ja` is typed as a complete record of `en`'s keys, so a string added to the
 * page in one language and forgotten in the other is a compile error rather
 * than a half-translated page in production.
 *
 * Adapter-supplied text — names, descriptions, tool descriptions — is left in
 * the language its author wrote it in, which is how a store listing behaves.
 * Only the text this project wrote is translated.
 */
export type Locale = 'en' | 'ja';

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, ja };

export const LOCALE_STORAGE_KEY = 'liha.locale';

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ja';
}

/** localStorage first, then the browser's own preference, then English. */
export function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Private mode, or storage blocked. The browser preference still works.
  }
  return navigator.language?.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** A translated string, with {0}, {1}… replaced by `params`. */
  t: (key: MessageKey, params?: Array<string | number>) => string;
  /** The same, but the placeholders take React nodes — for inline <code>. */
  tx: (key: MessageKey, nodes: ReactNode[]) => ReactNode;
}

const I18nContext = createContext<I18n | null>(null);

const PLACEHOLDER = /\{(\d+)\}/g;

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // The choice still applies to this page; it just will not be remembered.
    }
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: Array<string | number>) => {
      const template = MESSAGES[locale][key];
      if (!params) return template;
      return template.replace(PLACEHOLDER, (match, index: string) => String(params[Number(index)] ?? match));
    },
    [locale],
  );

  const tx = useCallback(
    (key: MessageKey, nodes: ReactNode[]) => {
      const parts = MESSAGES[locale][key].split(PLACEHOLDER);
      // split() with one capture group alternates literal, index, literal…
      return parts.map((part, index) =>
        index % 2 === 1 ? <span key={index}>{nodes[Number(part)]}</span> : part,
      );
    },
    [locale],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = MESSAGES[locale]['meta.title'];
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', MESSAGES[locale]['meta.description']);
  }, [locale]);

  const value = useMemo<I18n>(() => ({ locale, setLocale, t, tx }), [locale, setLocale, t, tx]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

export type { MessageKey };
