/**
 * Fetch Health Connect activity + HR (Garmin, Samsung, etc.) — persistence via MetricsPersistenceService.
 */

import { Platform } from 'react-native';
import {
  dailyActiveKcalFromRecords,
  mapHcExerciseSessions,
  mapHcHeartRateRecords,
} from './HealthConnectActivityAdapter';
import { healthConnectService } from './HealthConnectService';
import {
  isHealthConnectActivity,
  isHealthConnectHeartRate,
  loadSourceConfig,
  type ActivitySource,
} from './SourceConfigService';
import type { WithingsHeartRatePoint, WorkoutSession } from './WithingsApiService';

const LOOKBACK_DAYS = 31;

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

/** Read HC exercise, calories, and optional HR — no AsyncStorage writes. */
export async function fetchHealthConnectActivity(): Promise<HealthConnectActivityFetch> {
  if (Platform.OS !== 'android') {
    return { ...EMPTY_FETCH };
  }
  const config = await loadSourceConfig();
  if (!isHealthConnectActivity(config.activity)) {
    return { ...EMPTY_FETCH };
  }

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - LOOKBACK_DAYS);

  const readHr = isHealthConnectHeartRate(config.heartRate);
  const [sessions, calories, hrRecords] = await Promise.all([
    healthConnectService.readAllRecords('ExerciseSession', start, end),
    healthConnectService.readAllRecords('ActiveCaloriesBurned', start, end),
    readHr ? healthConnectService.readAllRecords('HeartRate', start, end) : Promise.resolve([]),
  ]);

  const workouts = mapHcExerciseSessions(sessions, calories);
  const dailyMap = dailyActiveKcalFromRecords(calories);
  const dailyActiveKcalByDay: Record<string, number> = {};
  for (const [dk, kcal] of dailyMap) {
    dailyActiveKcalByDay[dk] = kcal;
  }

  return {
    workouts,
    dailyActiveKcalByDay,
    heartRate: readHr ? mapHcHeartRateRecords(hrRecords) : [],
  };
}

export function activityUsesHealthConnect(activity: ActivitySource): boolean {
  return isHealthConnectActivity(activity);
}
