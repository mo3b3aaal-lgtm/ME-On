import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'tm_app_theme_v1';
const THEME_CHANGE_EVENT = 'classy-theme-change';

const LIGHT_THEME_COLOR = '#FFFFFF';
const DARK_THEME_COLOR = '#0B1829';

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'dark' || raw === 'light') {
      return raw;
    }
  } catch {
    // Ignore storage access errors in restricted webviews
  }
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark';
  }
  return 'light';
}

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const isDark = theme === 'dark';
  const root = document.documentElement;

  root.classList.toggle('dark', isDark);
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }
}

export function initTheme(): ThemeMode {
  const theme = getStoredTheme();
  applyThemeToDocument(theme);
  return theme;
}

export function setAppTheme(theme: ThemeMode): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage write errors
    }
  }
  applyThemeToDocument(theme);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_CHANGE_EVENT, { detail: theme }));
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => getStoredTheme());

  useEffect(() => {
    const syncFromDomOrStorage = (e?: Event) => {
      if (e && 'detail' in e) {
        const customDetail = (e as CustomEvent<ThemeMode>).detail;
        if (customDetail === 'dark' || customDetail === 'light') {
          setThemeState(customDetail);
          return;
        }
      }
      const next = getStoredTheme();
      applyThemeToDocument(next);
      setThemeState(next);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) {
        syncFromDomOrStorage();
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, syncFromDomOrStorage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncFromDomOrStorage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setAppTheme(nextTheme);
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme: ThemeMode = getStoredTheme() === 'dark' ? 'light' : 'dark';
    setAppTheme(nextTheme);
    setThemeState(nextTheme);
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  };
}
