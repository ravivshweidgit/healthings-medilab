/**
 * Manual body snapshot when user has no Withings scale.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { estimateBodyFromProfile, resolveFatPctFromInput, type ManualFatInput } from '../logic/bmrEstimate';
import type { Gender } from './TargetService';
import type { WeightMetricsForDashboard } from './WithingsApiService';

const MANUAL_BODY_KEY = 'manual_body_v1';
const MANUAL_BODY_HISTORY_KEY = 'manual_body_history_v1';
const HISTORY_CAP = 128;

export type ManualBodySource = 'ai-estimate' | 'user-entered';

export type FatPctSource = 'estimated' | 'user';

export type ManualBodySnapshot = {
  weight_kg: number;
  fat_pct: number;
  muscle_mass_kg: number;
  bmr_kcal: number;
  measuredAt: string;
  source: ManualBodySource;
  /** When omitted, treat as estimated (legacy snapshots). */
  fat_pct_source?: FatPctSource;
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

function resolveFatPctForWeighIn(
  existing: ManualBodySnapshot | null,
  opts: {
    gender: Gender;
    heightCm: number;
    ageYears: number;
    fatPct?: number;
    fatKg?: number;
    muscleKg?: number;
  },
  weightKg: number,
): { fat_pct: number; muscle_mass_kg: number; bmr_kcal: number; fat_pct_source: FatPctSource } {
  let resolvedPct: number | undefined = opts.fatPct;
  if (resolvedPct == null && opts.fatKg != null) {
    const fromKg = resolveFatPctFromInput(weightKg, { mode: 'kg', value: opts.fatKg });
    if (fromKg != null) resolvedPct = fromKg;
  }
  if (resolvedPct == null && opts.muscleKg != null) {
    const fromMuscle = resolveFatPctFromInput(weightKg, { mode: 'muscle', value: opts.muscleKg });
    if (fromMuscle != null) resolvedPct = fromMuscle;
  }

  const userFat =
    resolvedPct ??
    (existing?.fat_pct_source === 'user' ? existing.fat_pct : undefined);
  const est = estimateBodyFromProfile({
    gender: opts.gender,
    weightKg,
    heightCm: opts.heightCm,
    ageYears: opts.ageYears,
    fatPct: userFat,
  });
  const fat_pct_source: FatPctSource =
    resolvedPct != null || existing?.fat_pct_source === 'user' ? 'user' : 'estimated';
  return { ...est, fat_pct_source };
}

/** Log a new weigh-in; keeps user fat % when set, else AI-estimates from profile. */
export async function logManualWeighIn(
  weightKg: number,
  opts: {
    gender: Gender;
    heightCm: number;
    ageYears: number;
    fatPct?: number;
    fatKg?: number;
    muscleKg?: number;
  },
): Promise<ManualBodySnapshot> {
  const existing = await getManualBody();
  const est = resolveFatPctForWeighIn(existing, opts, weightKg);
  const snap: ManualBodySnapshot = {
    weight_kg: weightKg,
    fat_pct: est.fat_pct,
    muscle_mass_kg: est.muscle_mass_kg,
    bmr_kcal: est.bmr_kcal,
    measuredAt: new Date().toISOString(),
    source: 'user-entered',
    fat_pct_source: est.fat_pct_source,
  };
  await saveManualBody(snap);
  return snap;
}

/** Update body fat on the latest manual snapshot — % or kg or muscle kg (one degree of freedom). */
export async function saveManualBodyFatInput(
  input: ManualFatInput,
  opts: { gender: Gender; heightCm: number; ageYears: number },
): Promise<ManualBodySnapshot | null> {
  const existing = await getManualBody();
  if (!existing?.weight_kg) return null;
  const fatPct = resolveFatPctFromInput(existing.weight_kg, input);
  if (fatPct == null) return null;
  return saveManualFatPct(fatPct, opts);
}

/** Update body fat % on the latest manual snapshot (optional My Profile field). */
export async function saveManualFatPct(
  fatPct: number,
  opts: { gender: Gender; heightCm: number; ageYears: number },
): Promise<ManualBodySnapshot | null> {
  if (!(fatPct >= 3 && fatPct <= 65)) return null;
  const existing = await getManualBody();
  if (!existing?.weight_kg) return null;
  const est = estimateBodyFromProfile({
    gender: opts.gender,
    weightKg: existing.weight_kg,
    heightCm: opts.heightCm,
    ageYears: opts.ageYears,
    fatPct,
  });
  const snap: ManualBodySnapshot = {
    weight_kg: existing.weight_kg,
    fat_pct: est.fat_pct,
    muscle_mass_kg: est.muscle_mass_kg,
    bmr_kcal: est.bmr_kcal,
    measuredAt: existing.measuredAt,
    source: existing.source,
    fat_pct_source: 'user',
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
