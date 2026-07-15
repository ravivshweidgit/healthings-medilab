/**
 * Map Health Connect exercise + active-calorie records → WorkoutSession.
 */

import { ExerciseType } from 'react-native-health-connect';
import { localDayKeyFromMs } from '../logic/metabolicTrend7d';
import { isKeepableWorkout, type WorkoutSession } from './WithingsApiService';

const HC_EXERCISE_LABELS: Record<number, string> = {
  [ExerciseType.WALKING]: 'Walk',
  [ExerciseType.RUNNING]: 'Run',
  [ExerciseType.RUNNING_TREADMILL]: 'Treadmill run',
  [ExerciseType.HIKING]: 'Hike',
  [ExerciseType.BIKING]: 'Biking',
  [ExerciseType.BIKING_STATIONARY]: 'Indoor biking',
  [ExerciseType.SWIMMING_POOL]: 'Swim',
  [ExerciseType.SWIMMING_OPEN_WATER]: 'Open water swim',
  [ExerciseType.ELLIPTICAL]: 'Elliptical',
  [ExerciseType.ROWING_MACHINE]: 'Rowing',
  [ExerciseType.YOGA]: 'Yoga',
  [ExerciseType.STRENGTH_TRAINING]: 'Strength',
  [ExerciseType.HIGH_INTENSITY_INTERVAL_TRAINING]: 'HIIT',
  [ExerciseType.OTHER_WORKOUT]: 'Workout',
};

function parseInstantMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function parseHcEnergyKcal(record: Record<string, unknown>): number {
  const energy = record.energy;
  if (energy && typeof energy === 'object') {
    const e = energy as Record<string, unknown>;
    const kcal = Number(e.inKilocalories);
    if (Number.isFinite(kcal) && kcal > 0) return Math.round(kcal);
  }
  return 0;
}

function labelForExerciseType(exerciseType: number, title?: string): string {
  const trimmed = title?.trim();
  if (trimmed) return trimmed;
  return HC_EXERCISE_LABELS[exerciseType] ?? `Workout ${exerciseType}`;
}

function kcalOverlappingWindow(
  calories: Array<Record<string, unknown>>,
  startMs: number,
  endMs: number,
): number {
  let total = 0;
  for (const record of calories) {
    const rs = parseInstantMs(record.startTime);
    const re = parseInstantMs(record.endTime ?? record.startTime);
    if (rs == null || re == null) continue;
    if (re <= startMs || rs >= endMs) continue;
    total += parseHcEnergyKcal(record);
  }
  return Math.round(total);
}

export function mapHcExerciseSessions(
  sessions: Array<Record<string, unknown>>,
  activeCalories: Array<Record<string, unknown>>,
): WorkoutSession[] {
  const mapped: WorkoutSession[] = [];
  for (const record of sessions) {
    const startMs = parseInstantMs(record.startTime);
    const endMs = parseInstantMs(record.endTime ?? record.startTime);
    if (startMs == null || endMs == null || !isKeepableWorkout({ startMs, endMs })) continue;
    const exerciseType = Number(record.exerciseType ?? 0);
    const kcal = kcalOverlappingWindow(activeCalories, startMs, endMs);
    mapped.push({
      category: Number.isFinite(exerciseType) ? exerciseType : 0,
      activityLabel: labelForExerciseType(exerciseType, typeof record.title === 'string' ? record.title : undefined),
      startMs,
      endMs,
      kcal,
      source: 'health-connect',
    });
  }
  return mapped.sort((a, b) => a.startMs - b.startMs);
}

/** Sum active kcal records by local calendar day (YYYY-MM-DD). */
export function dailyActiveKcalFromRecords(
  calories: Array<Record<string, unknown>>,
): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const record of calories) {
    const kcal = parseHcEnergyKcal(record);
    if (kcal <= 0) continue;
    const ms = parseInstantMs(record.endTime ?? record.startTime);
    if (ms == null) continue;
    const dk = localDayKeyFromMs(ms);
    byDay.set(dk, (byDay.get(dk) ?? 0) + kcal);
  }
  return byDay;
}

/** Flatten HC HeartRate interval records (Garmin, etc.) → timestamped bpm points. */
export function mapHcHeartRateRecords(
  records: Array<Record<string, unknown>>,
): Array<{ timestamp: string; value: number }> {
  const points: Array<{ timestamp: string; value: number }> = [];
  for (const record of records) {
    const samples = record.samples;
    if (Array.isArray(samples)) {
      for (const sample of samples) {
        if (!sample || typeof sample !== 'object') continue;
        const s = sample as Record<string, unknown>;
        const bpm = Number(s.beatsPerMinute);
        const time = String(s.time ?? record.endTime ?? record.startTime ?? '');
        if (!time || !Number.isFinite(bpm) || bpm <= 0) continue;
        points.push({ timestamp: time, value: Math.round(bpm) });
      }
      continue;
    }
    const bpm = Number(record.beatsPerMinute);
    const time = String(record.time ?? record.endTime ?? record.startTime ?? '');
    if (time && Number.isFinite(bpm) && bpm > 0) {
      points.push({ timestamp: time, value: Math.round(bpm) });
    }
  }
  points.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const deduped: Array<{ timestamp: string; value: number }> = [];
  const seen = new Set<string>();
  for (const p of points) {
    const key = `${p.timestamp}:${p.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
  }
  return deduped;
}
