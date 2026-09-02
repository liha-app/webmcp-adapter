import { ext } from '../platform';
import { en } from './en';
import { ja } from './ja';

/**
 * The extension's own language.
 *
 * Chrome has `chrome.i18n`, and it follows the browser's locale with no way for
 * a person to override it. Someone running an English-language Chrome who reads
 * Japanese has no recourse there, so this is a stored preference instead — the
 * same catalogue-and-parity-test arrangement the portal uses, so the two do not
 * drift into different habits.
 *
 * What is *not* translated: anything an agent also reads. Tool names, tool
 * descriptions and adapter definitions are rendered from the adapter JSON
 * exactly as written, because the point of showing them is that what a person
 * audits is what an agent receives. A translated description would be a
 * different sentence than the one the model is acting on.
 */
export type Locale = 'en' | 'ja';
export const LOCALES: Locale[] = ['en', 'ja'];

export const LOCALE_LABEL: Record<Locale, string> = { en: 'English', ja: '日本語' };

const CATALOGUES: Record<Locale, Record<MessageKey, string>> = { en, ja };
const STORAGE_KEY = 'liha/locale';

export type MessageKey = keyof typeof en;

let active: Locale = 'en';

const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

/** `{0}` and `{1}`, positional, the way the portal's catalogue does it. */
const PLACEHOLDER = /\{(\d+)\}/g;

export function t(key: MessageKey, params: Array<string | number> = []): string {
  const template = CATALOGUES[active][key] ?? en[key];
  return template.replace(PLACEHOLDER, (_, index: string) => String(params[Number(index)] ?? ''));
}

export function currentLocale(): Locale {
  return active;
}

/**
 * Reads the stored choice, falling back to the browser's own language rather
 * than to English — someone who has never opened the setting should still get
 * the language their browser is already in.
 */
export async function loadLocale(): Promise<Locale> {
  try {
    const stored = (await ext.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
    if (isLocale(stored)) {
      active = stored;
      return active;
    }
  } catch {
    /* storage unavailable; fall through to the browser's language */
  }
  active = navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
  return active;
}

export async function setLocale(locale: Locale): Promise<void> {
  active = locale;
  try {
    await ext.storage.local.set({ [STORAGE_KEY]: locale });
  } catch {
    /* the choice still applies to this page */
  }
}

/** Sets `<html lang>` so the browser hyphenates and reads the page correctly. */
export function applyDocumentLanguage(): void {
  document.documentElement.lang = active;
}
