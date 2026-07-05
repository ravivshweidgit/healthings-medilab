/**
 * Convert Health Connect step counts to estimated active kcal (not Samsung-reported kcal).
 */

import { healthConnectService } from './HealthConnectService';

/** stepLength_m ≈ height_cm × factor / 100; active_kcal ≈ weight_kg × distance_km × 0.8 */
export function stepsToActiveKcal(steps: number, weightKg: number, heightCm: number, gender?: string | null): number {
  if (steps <= 0 || weightKg <= 0 || heightCm <= 0) return 0;
  const factor = gender === 'female' ? 0.413 : 0.415;
  const stepLengthM = (heightCm * factor) / 100;
  const distanceKm = (steps * stepLengthM) / 1000;
  return Math.round(weightKg * distanceKm * 0.8);
}

/** Fetch daily step totals for manual energy timeline (last N days). */
export async function fetchDailyStepTotalsForTrend(
  lookbackDays: number,
  weightKg: number,
  heightCm: number,
  gender?: string | null,
): Promise<Map<string, number>> {
  const start = new Date();
  start.setDate(start.getDate() - Math.max(1, lookbackDays));
  return healthConnectService.fetchDailyStepTotals(start);
}

/** Best-effort sync of last 7d step totals for onboarding / refresh. */
export async function syncSamsungStepsIfConfigured(
  weightKg: number,
  heightCm: number,
  gender?: string | null,
): Promise<{ todaySteps: number; todayActiveKcal: number } | null> {
  const totals = await fetchDailyStepTotalsForTrend(7, weightKg, heightCm, gender);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySteps = totals.get(todayKey) ?? 0;
  if (todaySteps <= 0) return null;
  return {
    todaySteps,
    todayActiveKcal: stepsToActiveKcal(todaySteps, weightKg, heightCm, gender),
  };
}
