/**
 * Lab PDF country preference — Lab Reports UI only (prompt113).
 * Never derive from user language. Null until the user picks.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LAB_COUNTRY_KEY = 'lab_country';

/** ISO 3166-1 alpha-2, or null if not chosen yet. */
export async function getLabCountry(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(LAB_COUNTRY_KEY);
  if (!raw) return null;
  const code = raw.trim().toUpperCase().slice(0, 2);
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export async function setLabCountry(code: string): Promise<void> {
  const normalized = code.trim().toUpperCase().slice(0, 2);
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new Error('Invalid country code');
  }
  await AsyncStorage.setItem(LAB_COUNTRY_KEY, normalized);
}

export async function clearLabCountry(): Promise<void> {
  await AsyncStorage.removeItem(LAB_COUNTRY_KEY);
}
