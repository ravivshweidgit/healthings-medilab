/**
 * prompt96 — Theme context + `useTheme()` (Phase 1).
 *
 * Resolves the effective color scheme from the stored user preference
 * (`system|light|dark`) combined with the OS scheme (`useColorScheme()`), and exposes
 * the active `ThemeColors`. Components migrate to `useTheme().colors` in Phase 2.
 *
 * Phase-1 safety: while `DARK_ENABLED` is `false`, `isDark` is forced `false` and
 * `colors` is always `lightColors`, so nothing renders dark even if the phone or the
 * saved preference says dark. Flip `DARK_ENABLED` (tokens.ts) in Phase 3.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { DARK_ENABLED, colorsFor, lightColors, type ThemeColors } from './tokens';
import {
  DEFAULT_THEME_PREF,
  getThemePref,
  saveThemePref,
  type ThemePref,
} from '../services/ThemePreferenceService';

export type ThemeContextValue = {
  /** User preference: system | light | dark. */
  pref: ThemePref;
  /** Effective flag after resolving pref + OS + DARK_ENABLED gate. */
  isDark: boolean;
  /** Active token set to consume in styles. */
  colors: ThemeColors;
  /** Persist + apply a new preference. */
  setThemePref: (next: ThemePref) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  pref: DEFAULT_THEME_PREF,
  isDark: false,
  colors: lightColors,
  setThemePref: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const osScheme = useColorScheme();
  const [pref, setPref] = useState<ThemePref>(DEFAULT_THEME_PREF);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await getThemePref();
      if (!cancelled) setPref(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setThemePref = useCallback((next: ThemePref) => {
    setPref(next);
    void saveThemePref(next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const wantsDark = pref === 'dark' || (pref === 'system' && osScheme === 'dark');
    const isDark = DARK_ENABLED && wantsDark;
    return {
      pref,
      isDark,
      colors: colorsFor(isDark ? 'dark' : 'light'),
      setThemePref,
    };
  }, [pref, osScheme, setThemePref]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the active theme. Safe outside a provider (falls back to light). */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
