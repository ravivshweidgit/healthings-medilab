/**
 * prompt96 — theme preference persistence (Phase 1, defaults in Phase 4).
 *
 * Single canonical key `healthings:themePref` (persistence-parity: no Platform.OS in
 * the key; portable Android↔iOS; included in backup/restore). Values:
 * 'system' | 'light' | 'dark'.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_COMPLETE_KEY } from './ProfileCompletenessService';

export const THEME_PREF_KEY = 'healthings:themePref';

export type ThemePref = 'system' | 'light' | 'dark';

/** Pre-selected option for new installs (they choose in Quick Start). */
export const DEFAULT_THEME_PREF: ThemePref = 'system';

function normalize(raw: string | null | undefined): ThemePref {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : DEFAULT_THEME_PREF;
}

/**
 * Default for an install that has never chosen a theme.
 *
 * Users who already finished onboarding never see the Quick Start theme step, so
 * 'system' would silently flip anyone with a dark phone to a dark app on the update
 * that enables dark. They get 'light' instead and opt in from Profile. New installs
 * keep 'system' pre-selected.
 */
async function defaultForInstall(): Promise<ThemePref> {
  try {
    const onboarded = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return onboarded ? 'light' : DEFAULT_THEME_PREF;
  } catch {
    return DEFAULT_THEME_PREF;
  }
}

export async function getThemePref(): Promise<ThemePref> {
  try {
    const raw = await AsyncStorage.getItem(THEME_PREF_KEY);
    if (raw != null) return normalize(raw);
    // Resolve once and persist, so the Profile picker reflects a real stored value
    // instead of recomputing the implicit default on every read.
    const resolved = await defaultForInstall();
    await AsyncStorage.setItem(THEME_PREF_KEY, resolved);
    return resolved;
  } catch {
    return DEFAULT_THEME_PREF;
  }
}

export async function saveThemePref(pref: ThemePref): Promise<void> {
  await AsyncStorage.setItem(THEME_PREF_KEY, normalize(pref));
}
