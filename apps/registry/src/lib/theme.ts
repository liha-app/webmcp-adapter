import { useCallback, useEffect, useState } from 'react';

/**
 * Appearance: follow the system, or override it.
 *
 * `auto` leaves `data-theme` off the root element, so the stylesheet's
 * `color-scheme: light dark` lets `light-dark()` follow the operating system.
 * The two explicit values pin `color-scheme`, which is the whole switch — no
 * duplicated palette, and nothing to keep in sync.
 */
export type Theme = 'auto' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'liha.theme';

export function isTheme(value: unknown): value is Theme {
  return value === 'auto' || value === 'light' || value === 'dark';
}

export function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // Storage blocked. Following the system is the right default anyway.
  }
  return 'auto';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
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

  // The inline script in index.html has already applied the stored value, so
  // this only matters if that script could not run.
  useEffect(() => applyTheme(theme), [theme]);

  return [theme, setTheme];
}
