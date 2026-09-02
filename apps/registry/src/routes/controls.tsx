import type { ReactElement } from 'react';
import { useI18n, type Locale } from '../i18n';
import { useTheme, type Theme } from '../lib/theme';

/*
 * The two controls Apple's own pages do not need: appearance and language.
 *
 * They are drawn as the platform's segmented control rather than invented,
 * so they read as part of the same system as everything else on the page.
 */

const THEME_ICONS: Record<Theme, ReactElement> = {
  auto: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1.8a6.2 6.2 0 0 0 0 12.4V1.8Z" fill="currentColor" />
    </svg>
  ),
  light: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="3.2" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2 3.1 3.1" />
      </g>
    </svg>
  ),
  dark: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M13.4 10.1A5.8 5.8 0 0 1 6 2.6a5.9 5.9 0 1 0 7.4 7.5Z"
        fill="currentColor"
      />
    </svg>
  ),
};

const THEMES: Theme[] = ['auto', 'light', 'dark'];
const THEME_LABEL = { auto: 'nav.themeAuto', light: 'nav.themeLight', dark: 'nav.themeDark' } as const;

export function ThemeControl() {
  const { t } = useI18n();
  const [theme, setTheme] = useTheme();
  return (
    <div className="segmented" role="radiogroup" aria-label={t('nav.appearance')} data-testid="theme-control">
      {THEMES.map((candidate) => (
        <button
          key={candidate}
          type="button"
          role="radio"
          aria-checked={theme === candidate}
          aria-label={t(THEME_LABEL[candidate])}
          title={t(THEME_LABEL[candidate])}
          data-theme-option={candidate}
          onClick={() => setTheme(candidate)}
        >
          {THEME_ICONS[candidate]}
        </button>
      ))}
    </div>
  );
}

const LOCALES: Array<{ id: Locale; full: string; short: string }> = [
  { id: 'ja', full: '日本語', short: 'JA' },
  { id: 'en', full: 'English', short: 'EN' },
];

export function LanguageControl() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="segmented" role="radiogroup" aria-label={t('nav.language')} data-testid="language-control">
      {LOCALES.map((candidate) => (
        <button
          key={candidate.id}
          type="button"
          role="radio"
          aria-checked={locale === candidate.id}
          aria-label={candidate.full}
          lang={candidate.id}
          data-locale-option={candidate.id}
          onClick={() => setLocale(candidate.id)}
        >
          <span className="segmented__full">{candidate.full}</span>
          <span className="segmented__short">{candidate.short}</span>
        </button>
      ))}
    </div>
  );
}
