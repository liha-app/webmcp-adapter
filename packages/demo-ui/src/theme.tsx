import { useCallback, useEffect, useState, type ReactElement } from 'react';

/**
 * Appearance, shared by the three demo sites.
 *
 * The same arrangement the portal uses, and deliberately so: a visitor who
 * picks light on the catalogue and then lands on a demo should not be thrown
 * into dark because that site happens to follow the system instead. `auto`
 * leaves `data-theme` off the root so `color-scheme: light dark` follows the
 * operating system; the two explicit values pin it. One palette, defined once
 * with `light-dark()`, and nothing to keep in step.
 *
 * The choice cannot be shared across the sites — they are separate origins, so
 * separate storage — but the behaviour and the control are the same everywhere.
 */
export type Theme = 'auto' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'liha.theme';

export function isTheme(value: unknown): value is Theme {
  return value === 'auto' || value === 'light' || value === 'dark';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // Storage blocked. Following the system is the right default anyway.
  }
  return 'auto';
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => initialTheme());

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Applied for this page; simply not remembered for the next one.
    }
  }, []);

  // theme.js has already applied the stored value before first paint; this
  // only matters when that script could not run.
  useEffect(() => applyTheme(theme), [theme]);

  return [theme, setTheme];
}

const ICONS: Record<Theme, ReactElement> = {
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
      <path d="M13.4 10.1A5.8 5.8 0 0 1 6 2.6a5.9 5.9 0 1 0 7.4 7.5Z" fill="currentColor" />
    </svg>
  ),
};

const THEMES: Theme[] = ['auto', 'light', 'dark'];
const LABEL: Record<Theme, string> = { auto: 'Match system', light: 'Light', dark: 'Dark' };

/** Drawn as the platform's segmented control, the same one the portal shows. */
export function ThemeControl() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="segmented" role="radiogroup" aria-label="Appearance" data-testid="theme-control">
      {THEMES.map((candidate) => (
        <button
          key={candidate}
          type="button"
          role="radio"
          aria-checked={theme === candidate}
          aria-label={LABEL[candidate]}
          title={LABEL[candidate]}
          data-theme-option={candidate}
          onClick={() => setTheme(candidate)}
        >
          {ICONS[candidate]}
        </button>
      ))}
    </div>
  );
}
