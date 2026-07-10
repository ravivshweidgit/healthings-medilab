/** iOS stub — Health Connect activity adapter is Android-only. */

import type { WithingsHeartRatePoint, WorkoutSession } from './WithingsApiService';

export function parseHcEnergyKcal(): number {
  return 0;
}

export function mapHcExerciseSessions(): WorkoutSession[] {
  return [];
}

export function dailyActiveKcalFromRecords(): Map<string, number> {
  return new Map();
}

export function mapHcHeartRateRecords(): WithingsHeartRatePoint[] {
  return [];
}
