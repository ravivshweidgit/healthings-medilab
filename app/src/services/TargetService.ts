/**
 * TargetService — stores user birthdate and height locally.
 * Both values are set once and rarely change.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const BIRTHDATE_KEY = 'user_birthdate';   // ISO date string e.g. "1980-03-15"
const HEIGHT_KEY    = 'user_height_cm';   // shared with WithingsApiService cache
const GENDER_KEY    = 'user_gender';      // 'male' | 'female' | 'other'

export type Gender = 'male' | 'female' | 'other';

// ─── Birthdate ────────────────────────────────────────────────────────────────

/** Returns stored ISO birthdate string or null if not set. */
export async function getBirthdate(): Promise<string | null> {
  return AsyncStorage.getItem(BIRTHDATE_KEY);
}

/** Persists ISO birthdate string (e.g. "1980-03-15"). */
export async function setBirthdate(isoDate: string): Promise<void> {
  await AsyncStorage.setItem(BIRTHDATE_KEY, isoDate);
}

/** Computes full years of age from a stored ISO birthdate string. */
export function computeAge(isoDate: string): number {
  const birth = new Date(isoDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// ─── Gender ───────────────────────────────────────────────────────────────────

export async function getGender(): Promise<Gender | null> {
  const raw = await AsyncStorage.getItem(GENDER_KEY);
  if (raw === 'male' || raw === 'female' || raw === 'other') return raw;
  return null;
}

export async function setGender(gender: Gender): Promise<void> {
  await AsyncStorage.setItem(GENDER_KEY, gender);
}

// ─── Height ───────────────────────────────────────────────────────────────────

/** Returns cached height in cm or null. */
export async function getCachedHeightCm(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(HEIGHT_KEY);
  if (!raw) return null;
  const cm = parseFloat(raw);
  return isNaN(cm) || cm <= 0 ? null : cm;
}

/** Manually store height in cm (e.g. user-entered fallback). */
export async function setHeightCm(cm: number): Promise<void> {
  await AsyncStorage.setItem(HEIGHT_KEY, String(Math.round(cm)));
}

// ─── Body composition target ──────────────────────────────────────────────────

const BODY_TARGET_KEY = 'body_target';

export type BodyTarget = {
  /** User's actual targets (editable, may differ from AI suggestion) */
  targetWeight_kg: number;
  targetFatPct: number;
  targetMuscleMass_kg: number;
  /** AI's original suggestion — always preserved for reference */
  aiWeight_kg: number;
  aiFatPct: number;
  aiMuscle_kg: number;
  /** Baseline at the time target was set */
  startWeight_kg: number;
  startFatPct: number;
  startMuscle_kg: number;
  /** AI reasoning text */
  reasoning: string;
  /** ISO string of when AI ran */
  analyzedAt: string;
  estimatedWeeks?: number;
};

export async function getBodyTarget(): Promise<BodyTarget | null> {
  const raw = await AsyncStorage.getItem(BODY_TARGET_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as BodyTarget; } catch { return null; }
}

export async function saveBodyTarget(target: BodyTarget): Promise<void> {
  await AsyncStorage.setItem(BODY_TARGET_KEY, JSON.stringify(target));
}

export async function clearBodyTarget(): Promise<void> {
  await AsyncStorage.removeItem(BODY_TARGET_KEY);
}
