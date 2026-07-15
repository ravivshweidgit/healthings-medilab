/**
 * Health Connect activity diagnostics — surfaces exactly what Healthings reads from HC
 * (granted permissions, raw record counts, per-day steps / active-cal / exercise).
 *
 * Two outputs:
 *  1. formatHealthConnectDiagnostics() → text for an in-app dialog the user can screenshot.
 *  2. persistHealthConnectDiagnostics() → writes a compact snapshot under HC_ACTIVITY_DIAG_KEY,
 *     which is NOT in the backup exclusion list, so it rides the cloud backup into Postgres
 *     for remote investigation when a screenshot is not enough.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { localDayKeyFromMs } from '../logic/metabolicTrend7d';
import { healthConnectService } from './HealthConnectService';
import { loadSourceConfig } from './SourceConfigService';

/** Documented AsyncStorage key (backed up → readable from Postgres via cloud backup). */
export const HC_ACTIVITY_DIAG_KEY = 'healthings:hcActivityDiag';

const DIAG_LOOKBACK_DAYS = 31;
const DIAG_TABLE_DAYS = 7;

type DayRow = {
  day: string;
  steps: number;
  activeKcal: number;
  totalKcal: number;
  exercises: number;
};

export type HcActivityDiag = {
  generatedAt: string;
  platform: string;
  available: boolean;
  sourceConfig: {
    activity: string;
    heartRate: string;
    glucose: string;
    bmr: string;
    bodyComposition: string;
  } | null;
  granted: {
    steps: boolean;
    activeCalories: boolean;
    exercise: boolean;
    heartRate: boolean;
    glucose: boolean;
  };
  raw: {
    stepRecords: number;
    activeCalRecords: number;
    totalCalRecords: number;
    exerciseRecords: number;
    distanceRecords: number;
    distanceMeters: number;
    lookbackDays: number;
  };
  days: DayRow[];
};

function hasRead(
  perms: Array<{ accessType?: string; recordType?: string }>,
  recordType: string,
): boolean {
  return perms.some((p) => p.accessType === 'read' && p.recordType === recordType);
}

/** Inline (no adapter import) so this stays platform-agnostic. */
function energyKcal(record: Record<string, unknown>): number {
  const energy = record.energy;
  if (energy && typeof energy === 'object') {
    const kcal = Number((energy as Record<string, unknown>).inKilocalories);
    if (Number.isFinite(kcal) && kcal > 0) return Math.round(kcal);
  }
  return 0;
}

function recentLocalDayKeys(count: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(localDayKeyFromMs(d.getTime()));
  }
  return keys;
}

function emptyDiag(generatedAt: string): HcActivityDiag {
  return {
    generatedAt,
    platform: Platform.OS,
    available: false,
    sourceConfig: null,
    granted: { steps: false, activeCalories: false, exercise: false, heartRate: false, glucose: false },
    raw: {
      stepRecords: 0,
      activeCalRecords: 0,
      totalCalRecords: 0,
      exerciseRecords: 0,
      distanceRecords: 0,
      distanceMeters: 0,
      lookbackDays: DIAG_LOOKBACK_DAYS,
    },
    days: [],
  };
}

/** Read HC through the same code path the app uses and summarize it. No AsyncStorage writes. */
export async function gatherHealthConnectDiagnostics(): Promise<HcActivityDiag> {
  const generatedAt = new Date().toISOString();
  if (Platform.OS !== 'android') return emptyDiag(generatedAt);

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - DIAG_LOOKBACK_DAYS);

  const [config, perms, stepRecords, calRecords, totalCalRecords, sessions, distanceRecords] =
    await Promise.all([
      loadSourceConfig(),
      healthConnectService.listGrantedPermissions(),
      healthConnectService.readAllRecords('Steps', start, end),
      healthConnectService.readAllRecords('ActiveCaloriesBurned', start, end),
      healthConnectService.readAllRecords('TotalCaloriesBurned', start, end),
      healthConnectService.readAllRecords('ExerciseSession', start, end),
      healthConnectService.readAllRecords('Distance', start, end),
    ]);

  const stepsByDay = new Map<string, number>();
  for (const r of stepRecords) {
    const count = Number(r.count ?? 0);
    if (!Number.isFinite(count) || count <= 0) continue;
    const ms = Date.parse(String(r.endTime ?? r.startTime ?? r.time ?? ''));
    if (!Number.isFinite(ms)) continue;
    const dk = localDayKeyFromMs(ms);
    stepsByDay.set(dk, (stepsByDay.get(dk) ?? 0) + count);
  }

  const kcalByDay = new Map<string, number>();
  for (const r of calRecords) {
    const kcal = energyKcal(r);
    if (kcal <= 0) continue;
    const ms = Date.parse(String(r.endTime ?? r.startTime ?? ''));
    if (!Number.isFinite(ms)) continue;
    const dk = localDayKeyFromMs(ms);
    kcalByDay.set(dk, (kcalByDay.get(dk) ?? 0) + kcal);
  }

  const totalKcalByDay = new Map<string, number>();
  for (const r of totalCalRecords) {
    const kcal = energyKcal(r);
    if (kcal <= 0) continue;
    const ms = Date.parse(String(r.endTime ?? r.startTime ?? ''));
    if (!Number.isFinite(ms)) continue;
    const dk = localDayKeyFromMs(ms);
    totalKcalByDay.set(dk, (totalKcalByDay.get(dk) ?? 0) + kcal);
  }

  let distanceMeters = 0;
  for (const r of distanceRecords) {
    const dist = r.distance;
    if (dist && typeof dist === 'object') {
      const m = Number((dist as Record<string, unknown>).inMeters);
      if (Number.isFinite(m) && m > 0) distanceMeters += m;
    }
  }

  const exByDay = new Map<string, number>();
  for (const s of sessions) {
    const ms = Date.parse(String(s.startTime ?? s.endTime ?? ''));
    if (!Number.isFinite(ms)) continue;
    const dk = localDayKeyFromMs(ms);
    exByDay.set(dk, (exByDay.get(dk) ?? 0) + 1);
  }

  const days: DayRow[] = recentLocalDayKeys(DIAG_TABLE_DAYS).map((day) => ({
    day,
    steps: stepsByDay.get(day) ?? 0,
    activeKcal: kcalByDay.get(day) ?? 0,
    totalKcal: totalKcalByDay.get(day) ?? 0,
    exercises: exByDay.get(day) ?? 0,
  }));

  return {
    generatedAt,
    platform: 'android',
    available: true,
    sourceConfig: {
      activity: config.activity,
      heartRate: config.heartRate,
      glucose: config.glucose,
      bmr: config.bmr,
      bodyComposition: config.bodyComposition,
    },
    granted: {
      steps: hasRead(perms, 'Steps'),
      activeCalories: hasRead(perms, 'ActiveCaloriesBurned'),
      exercise: hasRead(perms, 'ExerciseSession'),
      heartRate: hasRead(perms, 'HeartRate'),
      glucose: hasRead(perms, 'BloodGlucose'),
    },
    raw: {
      stepRecords: stepRecords.length,
      activeCalRecords: calRecords.length,
      totalCalRecords: totalCalRecords.length,
      exerciseRecords: sessions.length,
      distanceRecords: distanceRecords.length,
      distanceMeters: Math.round(distanceMeters),
      lookbackDays: DIAG_LOOKBACK_DAYS,
    },
    days,
  };
}

/** Store the latest snapshot so it flows into the next cloud backup (Postgres). */
export async function persistHealthConnectDiagnostics(diag: HcActivityDiag): Promise<void> {
  try {
    await AsyncStorage.setItem(HC_ACTIVITY_DIAG_KEY, JSON.stringify(diag));
  } catch {
    /* non-fatal — dialog still shows the live result */
  }
}

/** Human-readable text for the diagnostics dialog (screenshot-friendly). */
export function formatHealthConnectDiagnostics(diag: HcActivityDiag): string {
  if (!diag.available) return 'Health Connect diagnostics are available on Android only.';
  const g = diag.granted;
  const tick = (b: boolean) => (b ? '✓' : '✗');
  const lines: string[] = [];
  lines.push(`Source: activity=${diag.sourceConfig?.activity}, hr=${diag.sourceConfig?.heartRate}`);
  lines.push(
    `Granted: Steps ${tick(g.steps)}  ActiveCal ${tick(g.activeCalories)}  Exercise ${tick(g.exercise)}  HR ${tick(g.heartRate)}`,
  );
  lines.push(
    `Records (${diag.raw.lookbackDays}d): steps=${diag.raw.stepRecords} act=${diag.raw.activeCalRecords} total=${diag.raw.totalCalRecords} ex=${diag.raw.exerciseRecords} dist=${diag.raw.distanceRecords}`,
  );
  lines.push(`Distance (${diag.raw.lookbackDays}d): ${(diag.raw.distanceMeters / 1000).toFixed(1)} km`);
  lines.push('');
  lines.push('Day    steps | act | total | ex');
  for (const d of diag.days) {
    lines.push(
      `${d.day.slice(5)}  ${String(d.steps).padStart(5)} | ${String(d.activeKcal).padStart(4)} | ${String(d.totalKcal).padStart(5)} | ${d.exercises}`,
    );
  }
  return lines.join('\n');
}
