/**
 * Fetch Health Connect activity + HR (any brand writing to HC) — persistence via MetricsPersistenceService.
 * Daily activity energy = steps (and optional Distance) → kcal. Never ActiveCaloriesBurned.
 */

import { Platform } from 'react-native';
import { mapHcExerciseSessions, mapHcHeartRateRecords } from './HealthConnectActivityAdapter';
import { healthConnectService } from './HealthConnectService';
import { dailyActiveKcalFromStepsMaps } from './SamsungStepsAdapter';
import {
  isHealthConnectActivity,
  isHealthConnectHeartRate,
  loadSourceConfig,
  type ActivitySource,
} from './SourceConfigService';
import type { WithingsHeartRatePoint, WorkoutSession } from './WithingsApiService';

/** Routine sync — today + previous 2 local days (3 total) so “yesterday” survives midnight. */
export const PHONE_HEALTH_SHALLOW_LOOKBACK_DAYS = 3;
/** On-demand / first-fill deep pull (workouts + HR; activity kcal from steps). */
export const PHONE_HEALTH_DEEP_LOOKBACK_DAYS = 31;

export type PhoneWalkProfile = {
  weightKg: number;
  heightCm: number;
  gender?: string | null;
};

export type HealthConnectActivityFetch = {
  workouts: WorkoutSession[];
  heartRate: WithingsHeartRatePoint[];
  dailyActiveKcalByDay: Record<string, number>;
};

const EMPTY_FETCH: HealthConnectActivityFetch = {
  workouts: [],
  heartRate: [],
  dailyActiveKcalByDay: {},
};

/** Read HC steps/distance→kcal, exercise labels, optional HR — no AsyncStorage writes. */
export async function fetchHealthConnectActivity(
  lookbackDays: number = PHONE_HEALTH_SHALLOW_LOOKBACK_DAYS,
  profile: PhoneWalkProfile = { weightKg: 70, heightCm: 170 },
): Promise<HealthConnectActivityFetch> {
  if (Platform.OS !== 'android') {
    return { ...EMPTY_FETCH };
  }
  const config = await loadSourceConfig();
  if (!isHealthConnectActivity(config.activity)) {
    return { ...EMPTY_FETCH };
  }

  const end = new Date();
  // Start at local midnight of the oldest owned day (today − (lookback−1)).
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (Math.max(1, lookbackDays) - 1));

  const readHr = isHealthConnectHeartRate(config.heartRate);
  const [sessions, hrRecords, stepsByDay, distanceKmByDay] = await Promise.all([
    healthConnectService.readAllRecords('ExerciseSession', start, end),
    readHr ? healthConnectService.readAllRecords('HeartRate', start, end) : Promise.resolve([]),
    healthConnectService.fetchDailyStepTotals(start, end),
    healthConnectService.fetchDailyDistanceKmTotals(start, end),
  ]);

  const weightKg = profile.weightKg > 0 ? profile.weightKg : 70;
  const heightCm = profile.heightCm > 0 ? profile.heightCm : 170;

  // Exercise sessions for chart labels only — energy comes from steps/distance.
  const workouts = mapHcExerciseSessions(sessions, []).map((w) => ({ ...w, kcal: 0 }));

  const dailyActiveKcalByDay = dailyActiveKcalFromStepsMaps(stepsByDay, {
    weightKg,
    heightCm,
    gender: profile.gender,
    distanceKmByDay,
  });

  return {
    workouts,
    dailyActiveKcalByDay,
    heartRate: readHr ? mapHcHeartRateRecords(hrRecords) : [],
  };
}

export function activityUsesHealthConnect(activity: ActivitySource): boolean {
  return isHealthConnectActivity(activity);
}
