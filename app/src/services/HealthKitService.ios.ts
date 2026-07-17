/**
 * iOS HealthKit — CGM glucose + steps/HR when Withings watch is off.
 * Mirrors Android Health Connect read path into the same metrics store.
 */
import {
  AuthorizationRequestStatus,
  AuthorizationStatus,
  authorizationStatusFor,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryQuantitySamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { localDayKeyFromMs } from '../logic/metabolicTrend7d';
import type { RecentMetrics, TimePoint } from './healthMetricsTypes';
import type { WithingsHeartRatePoint } from './WithingsApiService';

export type { RecentMetrics, TimePoint } from './healthMetricsTypes';

const DEFAULT_HISTORY_DAYS = 120;
const ACTIVITY_LOOKBACK_DAYS = 31;

const BLOOD_GLUCOSE = 'HKQuantityTypeIdentifierBloodGlucose' as const;
const STEP_COUNT = 'HKQuantityTypeIdentifierStepCount' as const;
const HEART_RATE = 'HKQuantityTypeIdentifierHeartRate' as const;
const ACTIVE_ENERGY = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;

const ACTIVITY_READ_TYPES = [STEP_COUNT, HEART_RATE, ACTIVE_ENERGY] as const;

export type WithingsAppleHealthWriteStatus = {
  /**
   * Inferred from Withings-sourced step samples (today/yesterday).
   * iOS does not expose another app’s Health write toggle to us.
   */
  inferred: 'likely_on' | 'likely_off' | 'unknown';
  label: string;
};

function toIsoTimestamp(value: Date | string | number | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function mapGlucoseSamples(
  samples: ReadonlyArray<{ startDate?: Date; quantity?: number }>,
): TimePoint[] {
  const out: TimePoint[] = [];
  for (const s of samples) {
    const value = Number(s.quantity);
    if (!Number.isFinite(value) || value <= 0) continue;
    out.push({
      timestamp: toIsoTimestamp(s.startDate),
      value: Math.round(value),
    });
  }
  return out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** Withings Health app / Watch sources writing into Apple Health. */
function isWithingsHkSample(sample: {
  sourceRevision?: { source?: { bundleIdentifier?: string; name?: string } };
}): boolean {
  const src = sample.sourceRevision?.source;
  const blob = `${src?.bundleIdentifier ?? ''} ${src?.name ?? ''}`.toLowerCase();
  return blob.includes('withings');
}

function hkSourceKey(sample: {
  sourceRevision?: { source?: { bundleIdentifier?: string; name?: string } };
}): string {
  const src = sample.sourceRevision?.source;
  return String(src?.bundleIdentifier || src?.name || 'unknown');
}

class HealthKitService {
  async initializeAndRequestPermissions(): Promise<boolean> {
    const available = isHealthDataAvailable();
    if (!available) {
      throw new Error('Apple Health is not available on this device.');
    }
    await requestAuthorization({
      toRead: [BLOOD_GLUCOSE],
      toShare: [],
    });
    return true;
  }

  /** Steps + HR + active energy (Watch off → phone health). */
  async requestActivityPermissions(): Promise<boolean> {
    const available = isHealthDataAvailable();
    if (!available) return false;
    try {
      await requestAuthorization({
        toRead: [...ACTIVITY_READ_TYPES],
        toShare: [],
      });
      return this.hasActivityReadPermission();
    } catch {
      return false;
    }
  }

  /**
   * Best-effort: HealthKit often hides read status; “unnecessary” means already prompted.
   * Also treat sharingAuthorized on step count as granted when visible.
   */
  async hasActivityReadPermission(): Promise<boolean> {
    try {
      if (!isHealthDataAvailable()) return false;
      const status = await getRequestStatusForAuthorization({
        toRead: [...ACTIVITY_READ_TYPES],
        toShare: [],
      });
      if (status === AuthorizationRequestStatus.unnecessary) return true;
      const stepAuth = authorizationStatusFor(STEP_COUNT);
      return stepAuth === AuthorizationStatus.sharingAuthorized;
    } catch {
      return false;
    }
  }

  async fetchRecentMetrics(startTime?: Date): Promise<RecentMetrics> {
    const available = isHealthDataAvailable();
    if (!available) {
      return { glucose: [] };
    }

    const endDate = new Date();
    const from =
      startTime ?? new Date(Date.now() - DEFAULT_HISTORY_DAYS * 24 * 60 * 60 * 1000);

    const samples = await queryQuantitySamples(BLOOD_GLUCOSE, {
      limit: -1,
      ascending: true,
      unit: 'mg/dL',
      filter: {
        date: {
          startDate: from,
          endDate,
        },
      },
    });

    return { glucose: mapGlucoseSamples(samples) };
  }

  /** Daily step totals — max per source per day, skip Withings (mirror Android HC). */
  async fetchDailyStepTotals(
    startDate: Date,
    endDate: Date = new Date(),
  ): Promise<Map<string, number>> {
    const byDayOrigin = new Map<string, Map<string, number>>();
    if (!isHealthDataAvailable()) return new Map();
    try {
      const samples = await queryQuantitySamples(STEP_COUNT, {
        limit: -1,
        ascending: true,
        unit: 'count',
        filter: {
          date: {
            startDate,
            endDate,
          },
        },
      });
      for (const s of samples) {
        if (isWithingsHkSample(s)) continue;
        const count = Number(s.quantity);
        if (!Number.isFinite(count) || count <= 0) continue;
        const ms = s.startDate instanceof Date ? s.startDate.getTime() : Date.parse(String(s.startDate));
        if (!Number.isFinite(ms)) continue;
        const dk = localDayKeyFromMs(ms);
        const origin = hkSourceKey(s);
        let origins = byDayOrigin.get(dk);
        if (!origins) {
          origins = new Map();
          byDayOrigin.set(dk, origins);
        }
        origins.set(origin, (origins.get(origin) ?? 0) + count);
      }
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
   * Infer Withings → Apple Health write from step samples today/yesterday.
   */
  async detectWithingsAppleHealthWriteStatus(): Promise<WithingsAppleHealthWriteStatus> {
    try {
      if (!isHealthDataAvailable()) {
        return {
          inferred: 'unknown',
          label: 'Withings → Apple Health write: unknown (Apple Health not available)',
        };
      }
      const end = new Date();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 1);
      const samples = await queryQuantitySamples(STEP_COUNT, {
        limit: -1,
        ascending: false,
        unit: 'count',
        filter: { date: { startDate: start, endDate: end } },
      });
      for (const s of samples) {
        if (isWithingsHkSample(s)) {
          return {
            inferred: 'likely_on',
            label:
              'Withings → Apple Health write: likely ON (Withings Steps today/yesterday). Turn off in Settings → Health → Data Access & Devices → Withings.',
          };
        }
      }
      return {
        inferred: 'likely_off',
        label:
          'Withings → Apple Health write: likely OFF (no Withings Steps today/yesterday).',
      };
    } catch {
      return {
        inferred: 'unknown',
        label:
          'Withings → Apple Health write: unknown — check Settings → Health → Data Access → Withings.',
      };
    }
  }

  async fetchActivityWindow(lookbackDays: number = ACTIVITY_LOOKBACK_DAYS): Promise<{
    heartRate: WithingsHeartRatePoint[];
    dailyActiveKcalByDay: Record<string, number>;
  }> {
    const empty = { heartRate: [] as WithingsHeartRatePoint[], dailyActiveKcalByDay: {} as Record<string, number> };
    if (!isHealthDataAvailable()) return empty;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Math.max(1, lookbackDays));

    try {
      const [hrSamples, energySamples] = await Promise.all([
        queryQuantitySamples(HEART_RATE, {
          limit: -1,
          ascending: true,
          unit: 'count/min',
          filter: { date: { startDate, endDate } },
        }),
        queryQuantitySamples(ACTIVE_ENERGY, {
          limit: -1,
          ascending: true,
          unit: 'kcal',
          filter: { date: { startDate, endDate } },
        }),
      ]);

      const heartRate: WithingsHeartRatePoint[] = [];
      for (const s of hrSamples) {
        const bpm = Number(s.quantity);
        if (!Number.isFinite(bpm) || bpm <= 0) continue;
        heartRate.push({
          timestamp: toIsoTimestamp(s.startDate),
          value: Math.round(bpm),
        });
      }

      const dailyActiveKcalByDay: Record<string, number> = {};
      for (const s of energySamples) {
        const kcal = Number(s.quantity);
        if (!Number.isFinite(kcal) || kcal <= 0) continue;
        const ms = s.startDate instanceof Date ? s.startDate.getTime() : Date.parse(String(s.startDate));
        if (!Number.isFinite(ms)) continue;
        const dk = localDayKeyFromMs(ms);
        dailyActiveKcalByDay[dk] = (dailyActiveKcalByDay[dk] ?? 0) + kcal;
      }
      for (const dk of Object.keys(dailyActiveKcalByDay)) {
        dailyActiveKcalByDay[dk] = Math.round(dailyActiveKcalByDay[dk]);
      }

      return { heartRate, dailyActiveKcalByDay };
    } catch {
      return empty;
    }
  }
}

export const healthKitService = new HealthKitService();
