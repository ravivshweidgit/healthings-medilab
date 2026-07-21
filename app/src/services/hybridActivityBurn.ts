/**
 * Hybrid activity burn (prompt80):
 * - Watch On: walk/run/hike energy from Withings daily distance × weight;
 *   bike & other non-distance sports from Withings workout kcal.
 * - Watch Off: phone steps/distance (caller uses SamsungStepsAdapter).
 *
 * Raw metricsStore keeps Withings workouts + distance; burn is derived at read time.
 */

import { localDayKeyFromMs } from '../logic/metabolicTrend7d';
import {
  distanceKmToActiveKcal,
  stepsToDistanceKm,
} from './SamsungStepsAdapter';
import type { WorkoutSession } from './WithingsApiService';

/** Withings categories whose energy is covered by daily getactivity distance. */
const DISTANCE_COVERED_CATEGORIES = new Set([
  1, // Walk
  2, // Run
  3, // Hike
]);

/**
 * True when session kcal must not be added on top of daily distance×weight.
 * Walk always; run/hike too (same daily distance meter).
 */
export function isDistanceCoveredWorkout(
  w: Pick<WorkoutSession, 'category' | 'activityLabel'>,
): boolean {
  if (DISTANCE_COVERED_CATEGORIES.has(w.category)) return true;
  const label = (w.activityLabel ?? '').trim().toLowerCase();
  if (!label) return false;
  return label === 'walk' || label === 'run' || label === 'hike'
    || label.startsWith('walk ')
    || label.startsWith('run ')
    || label.startsWith('hike ');
}

/** @deprecated alias — walk-only name; prefer isDistanceCoveredWorkout */
export function isWalkWorkout(
  w: Pick<WorkoutSession, 'category' | 'activityLabel'>,
): boolean {
  return isDistanceCoveredWorkout(w);
}

/** Withings getactivity distance is meters (after normalizeWithingsDistanceToMeters). */
export function withingsDistanceMToKm(distanceM: number): number {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return 0;
  return distanceM / 1000;
}

export function walkKcalFromWithingsDistanceM(
  distanceM: number | null | undefined,
  weightKg: number,
): number {
  if (weightKg <= 0) return 0;
  const km = withingsDistanceMToKm(distanceM ?? 0);
  return distanceKmToActiveKcal(km, weightKg);
}

/**
 * Ambulation kcal from Withings distance (preferred) or Withings steps×stride.
 */
export function walkKcalFromWithingsDay(opts: {
  distanceM?: number | null;
  steps?: number | null;
  weightKg: number;
  heightCm?: number | null;
  gender?: string | null;
}): number {
  const { distanceM, steps, weightKg, heightCm, gender } = opts;
  if (weightKg <= 0) return 0;
  if (distanceM != null && Number.isFinite(distanceM) && distanceM > 0) {
    return walkKcalFromWithingsDistanceM(distanceM, weightKg);
  }
  if (
    steps != null
    && steps > 0
    && heightCm != null
    && heightCm > 0
  ) {
    const km = stepsToDistanceKm(steps, heightCm, gender);
    return distanceKmToActiveKcal(km, weightKg);
  }
  return 0;
}

/**
 * Sum Withings (non-HC) workout kcal for a day, excluding walk/run/hike.
 * Optional calibration applies only to this workout portion (default 1).
 */
export function nonDistanceWorkoutKcalForDay(
  sessions: WorkoutSession[],
  dayKey: string,
  calibration: number = 1,
): number {
  const factor = Number.isFinite(calibration) && calibration > 0 ? calibration : 1;
  let sum = 0;
  for (const w of sessions) {
    if (w.source === 'health-connect') continue;
    if (localDayKeyFromMs(w.startMs) !== dayKey) continue;
    if (isDistanceCoveredWorkout(w)) continue;
    if (!Number.isFinite(w.kcal) || w.kcal <= 0) continue;
    sum += w.kcal * factor;
  }
  return sum;
}

/**
 * Watch On activity for one day:
 *   distance×weight (or Withings steps) + non-distance Withings workouts.
 * Does not use intraday passive calories or walk/run/hike session kcal.
 */
export function hybridWithingsActivityKcal(opts: {
  dayKey: string;
  distanceM?: number | null;
  steps?: number | null;
  weightKg: number;
  heightCm?: number | null;
  gender?: string | null;
  workouts: WorkoutSession[];
  /** Multiplier on non-distance workout kcal only (default 1). */
  workoutCalibration?: number;
}): number {
  const walk = walkKcalFromWithingsDay({
    distanceM: opts.distanceM,
    steps: opts.steps,
    weightKg: opts.weightKg,
    heightCm: opts.heightCm,
    gender: opts.gender,
  });
  const sports = nonDistanceWorkoutKcalForDay(
    opts.workouts,
    opts.dayKey,
    opts.workoutCalibration ?? 1,
  );
  return Math.round(walk + sports);
}
