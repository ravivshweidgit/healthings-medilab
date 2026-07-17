/**
 * Convert step counts (and optional measured distance) to estimated active kcal.
 * Phone-health path uses this only — never Health Connect / Apple Health ActiveCalories.
 *
 * Best-practice walking estimate:
 * 1) Stride length ≈ height × 0.413 (female) / 0.415 (male)  (anthropometric)
 * 2) Distance_km = steps × stride_m / 1000  (or use HC/HK Distance when present)
 * 3) Active kcal ≈ weight_kg × distance_km × 0.55
 *    (calibrated to consumer wearables ≈ Samsung walking activity; ~43 kcal/km at 80 kg)
 */

import { Platform } from 'react-native';
import { localDayKeyFromMs } from '../logic/metabolicTrend7d';
import {
  PHONE_HEALTH_DEEP_LOOKBACK_DAYS,
  PHONE_HEALTH_SHALLOW_LOOKBACK_DAYS,
} from './HealthConnectActivityService';
import { healthConnectService } from './HealthConnectService';
import { healthKitService } from './HealthKitService';
import { isHealthKitActivity, isPhoneHealthActivity, loadSourceConfig } from './SourceConfigService';

export { PHONE_HEALTH_DEEP_LOOKBACK_DAYS, PHONE_HEALTH_SHALLOW_LOOKBACK_DAYS };

/**
 * kcal per kg per km for level walking.
 * Samsung sample: 485 kcal / 11.2 km ≈ 43.3 → at ~80 kg implies ~0.54.
 */
export const WALK_KCAL_PER_KG_PER_KM = 0.55;

/** Stride length in meters from height (cm) and sex. */
export function strideLengthM(heightCm: number, gender?: string | null): number {
  if (heightCm <= 0) return 0;
  const factor = gender === 'female' ? 0.413 : 0.415;
  return (heightCm * factor) / 100;
}

/** Distance from step count + height. */
export function stepsToDistanceKm(
  steps: number,
  heightCm: number,
  gender?: string | null,
): number {
  if (steps <= 0 || heightCm <= 0) return 0;
  return (steps * strideLengthM(heightCm, gender)) / 1000;
}

/** Active kcal from measured or estimated distance + body weight. */
export function distanceKmToActiveKcal(distanceKm: number, weightKg: number): number {
  if (distanceKm <= 0 || weightKg <= 0) return 0;
  return Math.round(weightKg * distanceKm * WALK_KCAL_PER_KG_PER_KM);
}

/**
 * Prefer measured distance when > 0; else steps → distance via height/stride.
 * Then distance × weight → active kcal.
 */
export function activeKcalFromStepsOrDistance(opts: {
  steps: number;
  weightKg: number;
  heightCm: number;
  gender?: string | null;
  /** Measured distance in km (Health Connect / HealthKit Distance), if any. */
  distanceKm?: number | null;
}): number {
  const { steps, weightKg, heightCm, gender, distanceKm } = opts;
  if (weightKg <= 0) return 0;
  const measured = distanceKm != null && Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;
  const dist = measured > 0 ? measured : stepsToDistanceKm(steps, heightCm, gender);
  return distanceKmToActiveKcal(dist, weightKg);
}

/** @deprecated Prefer activeKcalFromStepsOrDistance — same math. */
export function stepsToActiveKcal(
  steps: number,
  weightKg: number,
  heightCm: number,
  gender?: string | null,
): number {
  return activeKcalFromStepsOrDistance({ steps, weightKg, heightCm, gender });
}

/** Build day → active kcal from step (+ optional distance) maps. */
export function dailyActiveKcalFromStepsMaps(
  stepsByDay: Map<string, number>,
  opts: {
    weightKg: number;
    heightCm: number;
    gender?: string | null;
    distanceKmByDay?: Map<string, number>;
  },
): Record<string, number> {
  const out: Record<string, number> = {};
  const keys = new Set([...stepsByDay.keys(), ...(opts.distanceKmByDay?.keys() ?? [])]);
  for (const dk of keys) {
    const kcal = activeKcalFromStepsOrDistance({
      steps: stepsByDay.get(dk) ?? 0,
      weightKg: opts.weightKg,
      heightCm: opts.heightCm,
      gender: opts.gender,
      distanceKm: opts.distanceKmByDay?.get(dk),
    });
    if (kcal > 0) out[dk] = kcal;
  }
  return out;
}

/** Fetch daily step totals for manual energy timeline (last N days). */
export async function fetchDailyStepTotalsForTrend(
  lookbackDays: number,
  _weightKg: number,
  _heightCm: number,
  _gender?: string | null,
): Promise<Map<string, number>> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (Math.max(1, lookbackDays) - 1));
  const config = await loadSourceConfig();
  if (!isPhoneHealthActivity(config.activity)) return new Map();
  if (Platform.OS === 'ios') {
    if (!isHealthKitActivity(config.activity)) return new Map();
    return healthKitService.fetchDailyStepTotals(start);
  }
  return healthConnectService.fetchDailyStepTotals(start);
}

/** Best-effort sync of last shallow window for onboarding / refresh. */
export async function syncSamsungStepsIfConfigured(
  weightKg: number,
  heightCm: number,
  gender?: string | null,
): Promise<{ todaySteps: number; todayActiveKcal: number } | null> {
  const totals = await fetchDailyStepTotalsForTrend(
    PHONE_HEALTH_SHALLOW_LOOKBACK_DAYS,
    weightKg,
    heightCm,
    gender,
  );
  const todayKey = localDayKeyFromMs(Date.now());
  const todaySteps = totals.get(todayKey) ?? 0;
  if (todaySteps <= 0) return null;
  return {
    todaySteps,
    todayActiveKcal: stepsToActiveKcal(todaySteps, weightKg, heightCm, gender),
  };
}
