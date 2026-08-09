import {
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';
import { Linking } from 'react-native';

import { localDayKeyFromMs } from '../logic/metabolicTrend7d';
import { appLog } from './AppDailyLogService';
import type { HealthConnectReadDebug, RecentMetrics } from './healthMetricsTypes';
import { parseBloodGlucoseMgDl } from './healthMetricsTypes';
import { isWithingsHcOrigin } from './HealthConnectActivityAdapter';

export type { HealthConnectReadDebug, RecentMetrics, TimePoint } from './healthMetricsTypes';
export { parseBloodGlucoseMgDl, openHealthConnectSettings };

export type WithingsHcWriteStatus = {
  /**
   * Inferred from Withings-origin Steps in HC (today/yesterday).
   * Android does not expose another app’s write-permission switch to us.
   */
  inferred: 'likely_on' | 'likely_off' | 'unknown';
  label: string;
};

export type ActivityPermissionDetail = {
  ok: boolean;
  /** User-facing explanation when ok is false (or partial). */
  message: string;
  /** Suggest opening HC app permissions. */
  openSettings?: boolean;
  /** Suggest installing / updating Health Connect from Play Store. */
  installOrUpdate?: boolean;
};

/** Mirrors react-native-health-connect SdkAvailabilityStatus (not re-exported from package root). */
const HC_SDK = {
  UNAVAILABLE: 1,
  UPDATE_REQUIRED: 2,
  AVAILABLE: 3,
} as const;

const HC_PLAY_STORE =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

export async function openHealthConnectPlayStore(): Promise<void> {
  try {
    await Linking.openURL(HC_PLAY_STORE);
  } catch {
    /* ignore */
  }
}

const HOURS_24_MS = 24 * 60 * 60 * 1000;
/** How far back to query Health Connect when no explicit start is passed (CGM history). */
const DEFAULT_HISTORY_DAYS = 120;
/** Health Connect max records per page (HC caps pageSize at 5000). */
const HC_PAGE_SIZE = 5000;
/** Safety cap on pagination loops: 5000 × 200 = 1M readings (~9.5 years of 5-min CGM). */
const HC_MAX_PAGES = 200;

const CORE_READ_PERMISSIONS = [
  { accessType: 'read', recordType: 'BloodGlucose' } as const,
];

const STEPS_READ_PERMISSION = { accessType: 'read', recordType: 'Steps' } as const;
/** Android 14+: without this, HC often returns only ~recent days even when Steps is granted. */
const HISTORY_READ_PERMISSION = {
  accessType: 'read',
  recordType: 'ReadHealthDataHistory',
} as const;

/** Request with Blood glucose — not required for access OK (older Android / denied still read). */
const GLUCOSE_READ_PERMISSIONS = [...CORE_READ_PERMISSIONS, HISTORY_READ_PERMISSION] as const;

const ACTIVITY_READ_PERMISSIONS = [
  STEPS_READ_PERMISSION,
  { accessType: 'read', recordType: 'ExerciseSession' } as const,
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' } as const,
  { accessType: 'read', recordType: 'HeartRate' } as const,
  HISTORY_READ_PERMISSION,
];

function hasCoreReadAccess(
  granted: Array<{ accessType?: string; recordType?: string }>,
): boolean {
  return CORE_READ_PERMISSIONS.every((need) =>
    granted.some((p) => p.accessType === need.accessType && p.recordType === need.recordType),
  );
}

function defaultHealthQueryStart(): Date {
  return new Date(Date.now() - DEFAULT_HISTORY_DAYS * 24 * 60 * 60 * 1000);
}

function mapGlucoseRecords(records: Array<Record<string, unknown>>) {
  const out: Array<{ timestamp: string; value: number }> = [];
  for (const record of records) {
    const timestamp = String(
      record.time ?? record.endTime ?? record.startTime ?? '',
    );
    if (!timestamp) continue;
    const value = parseBloodGlucoseMgDl(record);
    if (!(value > 0)) continue;
    out.push({ timestamp, value });
  }
  return out;
}

class HealthConnectService {
  /** Once read or permission check succeeds, avoid re-prompting on transient getGrantedPermissions() gaps. */
  private sessionAccessOk = false;

  private markAccessOk(): void {
    this.sessionAccessOk = true;
  }

  /** Probe read when permission APIs disagree (known HC / Android 14 quirk). */
  private async probeBloodGlucoseRead(): Promise<boolean> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - HOURS_24_MS);
      await readRecords('BloodGlucose' as never, {
        timeRangeFilter: {
          operator: 'between',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      } as never);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fast path for routine CGM sync: initialize + check grants only.
   * Skips requestPermission UI when this session already confirmed access.
   */
  async ensureGlucoseReadable(): Promise<void> {
    if (this.sessionAccessOk) {
      const isInitialized = await initialize();
      if (!isInitialized) {
        throw new Error('Failed to initialize Health Connect.');
      }
      return;
    }
    await this.initializeAndRequestPermissions();
  }

  async initializeAndRequestPermissions(): Promise<unknown[]> {
    const isInitialized = await initialize();
    if (!isInitialized) {
      throw new Error('Failed to initialize Health Connect.');
    }

    let granted = await getGrantedPermissions();
    if (hasCoreReadAccess(granted)) {
      this.markAccessOk();
      return granted;
    }

    if (!this.sessionAccessOk) {
      // Ask history with glucose (Android 14+ depth); Blood glucose alone still unlocks sync.
      granted = await requestPermission([...GLUCOSE_READ_PERMISSIONS]);
      if (hasCoreReadAccess(granted)) {
        this.markAccessOk();
        return granted;
      }
    }

    granted = await getGrantedPermissions();
    if (hasCoreReadAccess(granted)) {
      this.markAccessOk();
      return granted;
    }

    if (this.sessionAccessOk || (await this.probeBloodGlucoseRead())) {
      this.markAccessOk();
      return granted;
    }

    throw new Error(
      'Health Connect needs Blood glucose read access. Open Health Connect → App permissions → Healthings → allow Blood glucose.',
    );
  }

  async requestStepsPermission(): Promise<boolean> {
    return this.requestActivityPermissions();
  }

  /**
   * Must be called from a direct user tap (Allow access). Android often will not show the
   * permission sheet if requestPermission runs from a delayed toggle / InteractionManager.
   */
  async requestActivityPermissionsWithDetail(): Promise<ActivityPermissionDetail> {
    try {
      const status = await getSdkStatus();
      if (status === HC_SDK.UNAVAILABLE) {
        return {
          ok: false,
          message:
            'Health Connect is not available on this phone. Install or update Health Connect from the Play Store, then tap Allow access again.',
          installOrUpdate: true,
        };
      }
      if (status === HC_SDK.UPDATE_REQUIRED) {
        return {
          ok: false,
          message:
            'Health Connect needs an update. Open the Play Store, update Health Connect, then tap Allow access again.',
          installOrUpdate: true,
        };
      }

      const isInitialized = await initialize();
      if (!isInitialized) {
        return {
          ok: false,
          message:
            'Could not open Health Connect. Install or update Health Connect, then try Allow access again.',
          installOrUpdate: true,
        };
      }

      const granted = await requestPermission([...ACTIVITY_READ_PERMISSIONS] as Parameters<
        typeof requestPermission
      >[0]);
      const hasSteps = granted.some(
        (p) => p.accessType === STEPS_READ_PERMISSION.accessType && p.recordType === STEPS_READ_PERMISSION.recordType,
      );
      if (hasSteps) {
        const hasHistory = granted.some(
          (p) =>
            p.accessType === HISTORY_READ_PERMISSION.accessType
            && p.recordType === HISTORY_READ_PERMISSION.recordType,
        );
        return {
          ok: true,
          message: hasHistory
            ? 'Healthings can read steps and history from Health Connect. Use Deep sync for up to 128 days.'
            : 'Healthings can read steps. If older days stay empty, open Health Connect → App permissions → Healthings → allow access to past data, then Deep sync.',
        };
      }

      return {
        ok: false,
        message:
          'Steps were not allowed. Tap Open Health Connect → App permissions → Healthings → turn on Steps (and past data / history if shown).',
        openSettings: true,
      };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        message: `Could not request Health Connect access (${raw}). Try Open Health Connect → App permissions → Healthings.`,
        openSettings: true,
      };
    }
  }

  async requestActivityPermissions(): Promise<boolean> {
    const detail = await this.requestActivityPermissionsWithDetail();
    return detail.ok;
  }

  async hasActivityReadPermission(): Promise<boolean> {
    try {
      const isInitialized = await initialize();
      if (!isInitialized) return false;
      const granted = await getGrantedPermissions();
      // Steps alone is enough to show activity; HR/exercise are optional extras we still request.
      return granted.some(
        (p) => p.accessType === STEPS_READ_PERMISSION.accessType && p.recordType === STEPS_READ_PERMISSION.recordType,
      );
    } catch {
      return false;
    }
  }

  /** Raw granted read/write permissions — for diagnostics ("what has the user allowed"). */
  async listGrantedPermissions(): Promise<Array<{ accessType?: string; recordType?: string }>> {
    try {
      const isInitialized = await initialize();
      if (!isInitialized) return [];
      return (await getGrantedPermissions()) as Array<{ accessType?: string; recordType?: string }>;
    } catch {
      return [];
    }
  }

  /**
   * Infer whether Withings is still writing Steps into HC.
   * We cannot read Withings’ HC permission toggle — only whether Withings-origin
   * Steps exist for today/yesterday.
   */
  async detectWithingsHcWriteStatus(): Promise<WithingsHcWriteStatus> {
    try {
      const isInitialized = await initialize();
      if (!isInitialized) {
        return {
          inferred: 'unknown',
          label: 'Withings → Health Connect write: unknown (Health Connect not ready)',
        };
      }
      const end = new Date();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 1); // today + yesterday
      let pageToken: string | undefined;
      let pageGuard = 0;
      let sawWithings = false;
      do {
        const page = (await readRecords('Steps' as never, {
          timeRangeFilter: {
            operator: 'between',
            startTime: start.toISOString(),
            endTime: end.toISOString(),
          },
          pageSize: 200,
          ...(pageToken ? { pageToken } : {}),
        } as never)) as { records?: Array<Record<string, unknown>>; pageToken?: string };
        for (const record of page.records ?? []) {
          if (isWithingsHcOrigin(record)) {
            sawWithings = true;
            break;
          }
        }
        if (sawWithings) break;
        pageToken = page.pageToken || undefined;
        pageGuard += 1;
      } while (pageToken && pageGuard < 5);

      if (sawWithings) {
        return {
          inferred: 'likely_on',
          label:
            'Withings → Health Connect write: likely ON (Withings Steps today/yesterday). Turn off in Health Connect → App permissions → Withings.',
        };
      }
      return {
        inferred: 'likely_off',
        label:
          'Withings → Health Connect write: likely OFF (no Withings Steps today/yesterday).',
      };
    } catch {
      return {
        inferred: 'unknown',
        label: 'Withings → Health Connect write: unknown (could not read Health Connect)',
      };
    }
  }

  /** @deprecated Prefer detectWithingsHcWriteStatus */
  async detectWithingsStepsInHealthConnect(): Promise<boolean> {
    const s = await this.detectWithingsHcWriteStatus();
    return s.inferred === 'likely_on';
  }

  async readAllRecords(
    recordType:
      | 'Steps'
      | 'ExerciseSession'
      | 'ActiveCaloriesBurned'
      | 'TotalCaloriesBurned'
      | 'Distance'
      | 'HeartRate',
    startDate: Date,
    endDate: Date = new Date(),
  ): Promise<Array<Record<string, unknown>>> {
    const records: Array<Record<string, unknown>> = [];
    try {
      const isInitialized = await initialize();
      if (!isInitialized) return records;
      let pageToken: string | undefined;
      let pageGuard = 0;
      do {
        const page = (await readRecords(recordType as never, {
          timeRangeFilter: {
            operator: 'between',
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
          },
          pageSize: HC_PAGE_SIZE,
          ...(pageToken ? { pageToken } : {}),
        } as never)) as { records?: Array<Record<string, unknown>>; pageToken?: string };
        records.push(...(page.records ?? []));
        pageToken = page.pageToken || undefined;
        pageGuard += 1;
      } while (pageToken && pageGuard < HC_MAX_PAGES);
    } catch {
      /* permission or HC unavailable */
    }
    return records;
  }

  async hasStepsReadPermission(): Promise<boolean> {
    return this.hasActivityReadPermission();
  }

  /**
   * Daily step totals for Watch Off.
   * Multiple apps (Samsung + Withings) often each write a full-day total; HC aggregate then
   * ~doubles. Strategy: sum within each dataOrigin, then take the MAX origin for the day
   * (skip Withings). Matches Samsung Health step counts.
   */
  async fetchDailyStepTotals(startDate: Date, endDate: Date = new Date()): Promise<Map<string, number>> {
    const byDayOrigin = new Map<string, Map<string, number>>();
    const add = (dk: string, origin: string, count: number) => {
      let origins = byDayOrigin.get(dk);
      if (!origins) {
        origins = new Map();
        byDayOrigin.set(dk, origins);
      }
      origins.set(origin, (origins.get(origin) ?? 0) + count);
    };
    try {
      const isInitialized = await initialize();
      if (!isInitialized) return new Map();
      let pageToken: string | undefined;
      let pageGuard = 0;
      do {
        const page = (await readRecords('Steps' as never, {
          timeRangeFilter: {
            operator: 'between',
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
          },
          pageSize: HC_PAGE_SIZE,
          ...(pageToken ? { pageToken } : {}),
        } as never)) as { records?: Array<Record<string, unknown>>; pageToken?: string };
        for (const record of page.records ?? []) {
          if (isWithingsHcOrigin(record)) continue;
          const count = Number(record.count ?? 0);
          if (!Number.isFinite(count) || count <= 0) continue;
          const ts = String(record.endTime ?? record.startTime ?? record.time ?? '');
          const ms = Date.parse(ts);
          if (!Number.isFinite(ms)) continue;
          const dk = localDayKeyFromMs(ms);
          const meta = record.metadata;
          const origin =
            meta && typeof meta === 'object'
              ? String((meta as Record<string, unknown>).dataOrigin ?? 'unknown')
              : 'unknown';
          add(dk, origin, count);
        }
        pageToken = page.pageToken || undefined;
        pageGuard += 1;
      } while (pageToken && pageGuard < HC_MAX_PAGES);
    } catch {
      return new Map();
    }
    const byDay = new Map<string, number>();
    for (const [dk, origins] of byDayOrigin) {
      let best = 0;
      for (const n of origins.values()) {
        if (n > best) best = n;
      }
      if (best > 0) byDay.set(dk, Math.round(best));
    }
    return byDay;
  }

  /**
   * Daily distance (km): max across non-Withings origins (same reason as steps).
   */
  async fetchDailyDistanceKmTotals(
    startDate: Date,
    endDate: Date = new Date(),
  ): Promise<Map<string, number>> {
    const byDayOrigin = new Map<string, Map<string, number>>();
    const add = (dk: string, origin: string, km: number) => {
      let origins = byDayOrigin.get(dk);
      if (!origins) {
        origins = new Map();
        byDayOrigin.set(dk, origins);
      }
      origins.set(origin, (origins.get(origin) ?? 0) + km);
    };
    try {
      const isInitialized = await initialize();
      if (!isInitialized) return new Map();
      let pageToken: string | undefined;
      let pageGuard = 0;
      do {
        const page = (await readRecords('Distance' as never, {
          timeRangeFilter: {
            operator: 'between',
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
          },
          pageSize: HC_PAGE_SIZE,
          ...(pageToken ? { pageToken } : {}),
        } as never)) as { records?: Array<Record<string, unknown>>; pageToken?: string };
        for (const record of page.records ?? []) {
          if (isWithingsHcOrigin(record)) continue;
          const distance = record.distance;
          let km = 0;
          if (distance && typeof distance === 'object') {
            const d = distance as Record<string, unknown>;
            km = Number(d.inKilometers ?? 0);
            if (!Number.isFinite(km) || km <= 0) {
              const meters = Number(d.inMeters ?? 0);
              km = Number.isFinite(meters) && meters > 0 ? meters / 1000 : 0;
            }
          }
          if (km <= 0) continue;
          const ts = String(record.endTime ?? record.startTime ?? record.time ?? '');
          const ms = Date.parse(ts);
          if (!Number.isFinite(ms)) continue;
          const dk = localDayKeyFromMs(ms);
          const meta = record.metadata;
          const origin =
            meta && typeof meta === 'object'
              ? String((meta as Record<string, unknown>).dataOrigin ?? 'unknown')
              : 'unknown';
          add(dk, origin, km);
        }
        pageToken = page.pageToken || undefined;
        pageGuard += 1;
      } while (pageToken && pageGuard < HC_MAX_PAGES);
    } catch {
      return new Map();
    }
    const byDay = new Map<string, number>();
    for (const [dk, origins] of byDayOrigin) {
      let best = 0;
      for (const n of origins.values()) {
        if (n > best) best = n;
      }
      if (best > 0) byDay.set(dk, best);
    }
    return byDay;
  }

  async fetchRecentMetrics(startDate: Date = defaultHealthQueryStart()): Promise<RecentMetrics> {
    const { metrics } = await this.fetchRecentMetricsWithDebug(startDate);
    return metrics;
  }

  async fetchRecentMetricsWithDebug(
    startDate: Date = defaultHealthQueryStart(),
  ): Promise<{ metrics: RecentMetrics; debug: HealthConnectReadDebug }> {
    const endTime = new Date();
    const safeStartDate = Number.isNaN(startDate.getTime()) ? defaultHealthQueryStart() : startDate;
    const startTime = safeStartDate > endTime ? new Date(endTime.getTime() - HOURS_24_MS) : safeStartDate;
    const grantedPermissions = await getGrantedPermissions();

    const records: Array<Record<string, unknown>> = [];
    const pages: unknown[] = [];
    let pageToken: string | undefined;
    let pageGuard = 0;
    // Default ascending (oldest→newest). Newest-first was tried and can throw on some
    // HC / RN-HC builds; syncCgmStore used to swallow that and freeze the chart edge.
    // Never pass ascendingOrder together with pageToken (HC IllegalStateException).
    do {
      const page = (await readRecords('BloodGlucose' as never, {
        timeRangeFilter: {
          operator: 'between',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
        pageSize: HC_PAGE_SIZE,
        ...(pageToken ? { pageToken } : { ascendingOrder: true }),
      } as never)) as { records?: Array<Record<string, unknown>>; pageToken?: string };

      const pageRecords = (page.records ?? []) as Array<Record<string, unknown>>;
      records.push(...pageRecords);
      pages.push(page);
      const next = page.pageToken;
      // HC uses -1 / empty when exhausted.
      pageToken =
        next != null && String(next) !== '' && String(next) !== '-1' ? String(next) : undefined;
      pageGuard += 1;
    } while (pageToken && pageGuard < HC_MAX_PAGES);

    const glucose = mapGlucoseRecords(records);
    if (glucose.length > 0) {
      this.markAccessOk();
    }

    let lastTs: string | null = null;
    let lastMgdl: number | null = null;
    let lastMs = -Infinity;
    for (const p of glucose) {
      const ms = Date.parse(p.timestamp);
      if (Number.isFinite(ms) && ms >= lastMs) {
        lastMs = ms;
        lastTs = p.timestamp;
        lastMgdl = p.value;
      }
    }
    appLog('INFO', 'cgm/hc_fetch', {
      pages: pageGuard,
      raw_n: records.length,
      mapped_n: glucose.length,
      parse_drop_n: Math.max(0, records.length - glucose.length),
      query_start: startTime.toISOString(),
      query_end: endTime.toISOString(),
      last_ts: lastTs,
      last_mgdl: lastMgdl,
      lag_sec: lastMs > 0 ? Math.max(0, Math.round((Date.now() - lastMs) / 1000)) : null,
    });

    return {
      metrics: { glucose },
      debug: {
        queryStart: startTime.toISOString(),
        queryEnd: endTime.toISOString(),
        grantedPermissions,
        rawReadResponse: pages.length === 1 ? pages[0] : pages,
      },
    };
  }
}

export const healthConnectService = new HealthConnectService();
