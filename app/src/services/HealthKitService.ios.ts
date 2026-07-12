/**
 * iOS HealthKit blood glucose — CareSens Air (and other CGM apps) → Apple Health → Healthings.
 * Mirrors Android Health Connect CGM read path.
 */
import {
  isHealthDataAvailable,
  queryQuantitySamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import type { RecentMetrics, TimePoint } from './healthMetricsTypes';

export type { RecentMetrics, TimePoint } from './healthMetricsTypes';

const DEFAULT_HISTORY_DAYS = 120;
const BLOOD_GLUCOSE = 'HKQuantityTypeIdentifierBloodGlucose' as const;

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
}

export const healthKitService = new HealthKitService();
