/**
 * HR sync diagnostics — compare Withings API vs persisted store vs chart.
 * Saved to AsyncStorage after each intraday sync for phone debugging.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKeyStartMs, localDayKeyFromMs } from '../logic/metabolicTrend7d';
import type { WithingsHeartRatePoint } from './WithingsApiService';

export const WITHINGS_HR_SYNC_DIAG_KEY = 'withings_hr_sync_diag_v1';

export type HrSyncFailureLayer = 'api' | 'merge' | 'persist' | 'ok' | 'unknown';

export type WithingsHrSyncDiag = {
  at: string;
  /** getintradayactivity today-only fetch */
  apiTodayCount: number;
  apiTodayLatest: string | null;
  apiStatus: number | null;
  apiError: string | null;
  /** Today's slice from 7-day history fetch (no endAtNow) */
  api7dTodayCount: number;
  api7dTodayLatest: string | null;
  storeBeforeTodayCount: number;
  storeBeforeTodayLatest: string | null;
  storeAfterTodayCount: number;
  storeAfterTodayLatest: string | null;
  saveError: string | null;
  tokenScope: string | null;
  hasActivityScope: boolean;
  failureLayer: HrSyncFailureLayer;
  note: string;
};

export function localDayStartMs(): number {
  return dayKeyStartMs(localDayKeyFromMs(Date.now()));
}

export function filterTodayHr<T extends { timestamp: string }>(points: T[]): T[] {
  const start = localDayStartMs();
  return points.filter((p) => {
    const ms = Date.parse(p.timestamp);
    return !Number.isNaN(ms) && ms >= start;
  });
}

export function maxHrTimestamp(points: { timestamp: string }[]): string | null {
  if (points.length === 0) return null;
  let bestMs = -Infinity;
  let best: string | null = null;
  for (const p of points) {
    const ms = Date.parse(p.timestamp);
    if (!Number.isNaN(ms) && ms > bestMs) {
      bestMs = ms;
      best = p.timestamp;
    }
  }
  return best;
}

export function formatHrDiagTime(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function hasActivityScope(scope: string | null | undefined): boolean {
  if (!scope) return false;
  return scope
    .split(',')
    .map((s) => s.trim())
    .includes('user.activity');
}

export function inferHrFailureLayer(diag: Omit<WithingsHrSyncDiag, 'failureLayer' | 'note'>): {
  failureLayer: HrSyncFailureLayer;
  note: string;
} {
  const apiMs = diag.apiTodayLatest ? Date.parse(diag.apiTodayLatest) : NaN;
  const storeMs = diag.storeAfterTodayLatest ? Date.parse(diag.storeAfterTodayLatest) : NaN;

  if (!diag.hasActivityScope) {
    return {
      failureLayer: 'api',
      note: 'Token missing user.activity — tap Re-link Withings',
    };
  }
  if (diag.apiStatus != null && diag.apiStatus !== 0) {
    return {
      failureLayer: 'api',
      note: `API status ${diag.apiStatus}${diag.apiError ? `: ${diag.apiError}` : ''}`,
    };
  }
  if (diag.saveError) {
    return {
      failureLayer: 'persist',
      note: `AsyncStorage save failed: ${diag.saveError}`,
    };
  }
  if (diag.apiTodayCount === 0 && diag.storeAfterTodayCount > 0) {
    return {
      failureLayer: 'api',
      note: 'API returned no HR today; kept previous store (empty fetch guard)',
    };
  }
  if (
    Number.isFinite(apiMs) &&
    Number.isFinite(storeMs) &&
    storeMs + 60_000 < apiMs
  ) {
    return {
      failureLayer: 'merge',
      note: `Store older than API (${formatHrDiagTime(diag.storeAfterTodayLatest)} vs API ${formatHrDiagTime(diag.apiTodayLatest)})`,
    };
  }
  if (Number.isFinite(apiMs) && Number.isFinite(storeMs) && Math.abs(apiMs - storeMs) < 120_000) {
    return {
      failureLayer: 'ok',
      note: `API and store aligned (~${formatHrDiagTime(diag.apiTodayLatest)})`,
    };
  }
  if (diag.apiTodayCount > 0 && !Number.isFinite(storeMs)) {
    return {
      failureLayer: 'merge',
      note: 'API has data but store today is empty after merge',
    };
  }
  return {
    failureLayer: 'unknown',
    note: 'Check API vs store timestamps',
  };
}

export async function saveWithingsHrSyncDiag(diag: WithingsHrSyncDiag): Promise<void> {
  try {
    await AsyncStorage.setItem(WITHINGS_HR_SYNC_DIAG_KEY, JSON.stringify(diag));
  } catch {
    // non-fatal
  }
}

export async function loadWithingsHrSyncDiag(): Promise<WithingsHrSyncDiag | null> {
  try {
    const raw = await AsyncStorage.getItem(WITHINGS_HR_SYNC_DIAG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WithingsHrSyncDiag;
  } catch {
    return null;
  }
}

export function buildHrSyncDiag(opts: {
  apiToday: WithingsHeartRatePoint[];
  api7dToday: WithingsHeartRatePoint[];
  storeBefore: WithingsHeartRatePoint[];
  storeAfter: WithingsHeartRatePoint[];
  apiStatus: number | null;
  apiError: string | null;
  saveError: string | null;
  tokenScope: string | null;
}): WithingsHrSyncDiag {
  const base = {
    at: new Date().toISOString(),
    apiTodayCount: opts.apiToday.length,
    apiTodayLatest: maxHrTimestamp(opts.apiToday),
    apiStatus: opts.apiStatus,
    apiError: opts.apiError,
    api7dTodayCount: opts.api7dToday.length,
    api7dTodayLatest: maxHrTimestamp(opts.api7dToday),
    storeBeforeTodayCount: filterTodayHr(opts.storeBefore).length,
    storeBeforeTodayLatest: maxHrTimestamp(filterTodayHr(opts.storeBefore)),
    storeAfterTodayCount: filterTodayHr(opts.storeAfter).length,
    storeAfterTodayLatest: maxHrTimestamp(filterTodayHr(opts.storeAfter)),
    saveError: opts.saveError,
    tokenScope: opts.tokenScope,
    hasActivityScope: hasActivityScope(opts.tokenScope),
  };
  const { failureLayer, note } = inferHrFailureLayer(base);
  return { ...base, failureLayer, note };
}

export function formatHrSyncDiagLine(diag: WithingsHrSyncDiag | null): string | null {
  if (!diag || diag.failureLayer === 'ok') return null;
  return [
    `HR sync · API ${formatHrDiagTime(diag.apiTodayLatest)} (${diag.apiTodayCount})`,
    `store ${formatHrDiagTime(diag.storeAfterTodayLatest)} (${diag.storeAfterTodayCount})`,
    diag.note,
  ].join(' · ');
}
