/**
 * CGM sync edge probe — last fetch vs chart.
 * Mirrors into daily app log (prompt105) + Android files/cgm-sync-diag.json for adb.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { TimePoint } from './healthMetricsTypes';

export const CGM_SYNC_DIAG_KEY = 'healthings:cgmSyncDiag_v1';

const EXTERNAL_DIAG =
  'file:///storage/emulated/0/Android/data/com.healthings.medilab/files/cgm-sync-diag.json';

export type CgmSyncDiag = {
  at: string;
  reason: string;
  source: string;
  lookbackDays: number;
  liveN: number;
  storeN: number;
  viewN: number;
  filterDropN: number;
  prevLast: string | null;
  liveLast: string | null;
  viewLast: string | null;
  liveLastMgdl: number | null;
  viewLastMgdl: number | null;
  lagSec: number | null;
  error: string | null;
};

export function latestGlucosePoint(points: TimePoint[]): { ts: string; mgdl: number; ms: number } | null {
  if (points.length === 0) return null;
  let best = points[0]!;
  let bestMs = Date.parse(best.timestamp);
  if (!Number.isFinite(bestMs)) bestMs = -Infinity;
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const ms = Date.parse(p.timestamp);
    if (Number.isFinite(ms) && ms > bestMs) {
      best = p;
      bestMs = ms;
    }
  }
  if (!Number.isFinite(bestMs)) return null;
  return { ts: best.timestamp, mgdl: best.value, ms: bestMs };
}

export async function saveCgmSyncDiag(diag: CgmSyncDiag): Promise<void> {
  try {
    await AsyncStorage.setItem(CGM_SYNC_DIAG_KEY, JSON.stringify(diag));
  } catch {
    /* ignore */
  }
  if (Platform.OS !== 'android') return;
  try {
    await FileSystem.writeAsStringAsync(EXTERNAL_DIAG, JSON.stringify(diag, null, 2), {
      encoding: 'utf8',
    });
  } catch {
    /* external path may be unavailable */
  }
}
