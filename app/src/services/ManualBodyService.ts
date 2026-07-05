/**
 * Manual body snapshot when user has no Withings scale.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { estimateBodyFromProfile } from '../logic/bmrEstimate';
import type { Gender } from './TargetService';
import type { WeightMetricsForDashboard } from './WithingsApiService';

const MANUAL_BODY_KEY = 'manual_body_v1';
const MANUAL_BODY_HISTORY_KEY = 'manual_body_history_v1';
const HISTORY_CAP = 128;

export type ManualBodySource = 'ai-estimate' | 'user-entered';

export type ManualBodySnapshot = {
  weight_kg: number;
  fat_pct: number;
  muscle_mass_kg: number;
  bmr_kcal: number;
  measuredAt: string;
  source: ManualBodySource;
};

export async function getManualBody(): Promise<ManualBodySnapshot | null> {
  const raw = await AsyncStorage.getItem(MANUAL_BODY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ManualBodySnapshot;
  } catch {
    return null;
  }
}

export async function getManualBodyHistory(): Promise<ManualBodySnapshot[]> {
  const raw = await AsyncStorage.getItem(MANUAL_BODY_HISTORY_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ManualBodySnapshot[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through */
    }
  }
  const current = await getManualBody();
  if (current) return [current];
  return [];
}

async function writeHistory(entries: ManualBodySnapshot[]): Promise<void> {
  await AsyncStorage.setItem(MANUAL_BODY_HISTORY_KEY, JSON.stringify(entries.slice(-HISTORY_CAP)));
}

export async function appendManualBodyHistory(snapshot: ManualBodySnapshot): Promise<void> {
  const history = await getManualBodyHistory();
  const last = history[history.length - 1];
  if (
    last &&
    last.weight_kg === snapshot.weight_kg &&
    localDayKeyFromSnapshot(last) === localDayKeyFromSnapshot(snapshot)
  ) {
    history[history.length - 1] = snapshot;
  } else {
    history.push(snapshot);
  }
  await writeHistory(history);
}

function localDayKeyFromSnapshot(s: ManualBodySnapshot): string {
  return s.measuredAt.slice(0, 10);
}

export async function saveManualBody(snapshot: ManualBodySnapshot): Promise<void> {
  await AsyncStorage.setItem(MANUAL_BODY_KEY, JSON.stringify(snapshot));
  await appendManualBodyHistory(snapshot);
}

/** Log a new weigh-in; refreshes composition estimate from profile. */
export async function logManualWeighIn(
  weightKg: number,
  opts: { gender: Gender; heightCm: number; ageYears: number },
): Promise<ManualBodySnapshot> {
  const est = estimateBodyFromProfile({
    gender: opts.gender,
    weightKg,
    heightCm: opts.heightCm,
    ageYears: opts.ageYears,
  });
  const snap: ManualBodySnapshot = {
    weight_kg: weightKg,
    fat_pct: est.fat_pct,
    muscle_mass_kg: est.muscle_mass_kg,
    bmr_kcal: est.bmr_kcal,
    measuredAt: new Date().toISOString(),
    source: 'user-entered',
  };
  await saveManualBody(snap);
  return snap;
}

export function manualBodyToDashboardMetrics(m: ManualBodySnapshot): WeightMetricsForDashboard {
  return {
    measuredAt: m.measuredAt,
    weightKg: m.weight_kg,
    fatMassKg: Math.round((m.weight_kg * m.fat_pct) / 100 * 10) / 10,
    muscleMassKg: m.muscle_mass_kg,
    visceralFatIndex: null,
    bmrKcalDay: m.bmr_kcal,
  };
}

export function fatPctFromManual(m: ManualBodySnapshot): number {
  return m.fat_pct;
}

export function countDistinctWeighInDays(history: ManualBodySnapshot[]): number {
  return new Set(history.map((h) => h.measuredAt.slice(0, 10))).size;
}
