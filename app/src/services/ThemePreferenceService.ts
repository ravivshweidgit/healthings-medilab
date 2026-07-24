/**
 * prompt96 — theme preference persistence (Phase 1).
 *
 * Single canonical key `healthings:themePref` (persistence-parity: no Platform.OS in
 * the key; portable Android↔iOS; belongs in backup/restore — Phase 4 wires the export
 * include list). Values: 'system' | 'light' | 'dark'; default 'system'.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const THEME_PREF_KEY = 'healthings:themePref';

export type ThemePref = 'system' | 'light' | 'dark';

export const DEFAULT_THEME_PREF: ThemePref = 'system';

function normalize(raw: string | null | undefined): ThemePref {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : DEFAULT_THEME_PREF;
}

export async function getThemePref(): Promise<ThemePref> {
  try {
    return normalize(await AsyncStorage.getItem(THEME_PREF_KEY));
  } catch {
    return DEFAULT_THEME_PREF;
  }
}

export async function saveThemePref(pref: ThemePref): Promise<void> {
  await AsyncStorage.setItem(THEME_PREF_KEY, normalize(pref));
}
