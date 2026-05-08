import {
  initialize,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';

export type TimePoint = {
  timestamp: string;
  value: number;
};

export type RecentMetrics = {
  glucose: TimePoint[];
  steps: TimePoint[];
};

const HOURS_24_MS = 24 * 60 * 60 * 1000;
const DEFAULT_START_DATE = new Date('2026-04-19T00:00:00.000Z');

class SamsungHealthService {
  async initializeAndRequestPermissions(): Promise<boolean> {
    const isInitialized = await initialize();
    if (!isInitialized) {
      throw new Error('Failed to initialize Health Connect.');
    }

    const granted = await requestPermission([
      {
        accessType: 'read',
        recordType: 'BloodGlucose',
      } as const,
      {
        accessType: 'read',
        recordType: 'Steps',
      } as const,
    ]);

    if (granted.length === 0) {
      throw new Error(
        'Health Connect permissions were not granted. Open system Health Connect settings and allow Blood Glucose and Steps for this app.'
      );
    }

    return true;
  }

  async fetchRecentMetrics(startDate: Date = DEFAULT_START_DATE): Promise<RecentMetrics> {
    const endTime = new Date();
    const safeStartDate = Number.isNaN(startDate.getTime()) ? DEFAULT_START_DATE : startDate;
    const startTime = safeStartDate > endTime ? new Date(endTime.getTime() - HOURS_24_MS) : safeStartDate;

    const [glucoseRecords, stepRecords] = await Promise.all([
      readRecords('BloodGlucose' as never, {
        timeRangeFilter: {
          operator: 'between',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      } as never),
      readRecords('Steps' as never, {
        timeRangeFilter: {
          operator: 'between',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      } as never),
    ]);

    const glucose: TimePoint[] = (glucoseRecords.records as Array<Record<string, unknown>>).map((record) => {
      const timestamp = String(
        record.time ?? record.endTime ?? record.startTime ?? new Date().toISOString()
      );
      const value = parseBloodGlucoseMgDl(record);
      return { timestamp, value };
    });

    const steps: TimePoint[] = (stepRecords.records as Array<Record<string, unknown>>).map((record) => {
      const timestamp = String(
        record.endTime ?? record.time ?? record.startTime ?? new Date().toISOString()
      );
      const value = Number(record.count ?? record.value ?? 0);
      return { timestamp, value };
    });

    return { glucose, steps };
  }
}

export const samsungHealthService = new SamsungHealthService();

/** Health Connect stores glucose as `{ level: { value, unit } }` (mg/dL or mmol/L). */
function parseBloodGlucoseMgDl(record: Record<string, unknown>): number {
  const raw = record.level ?? record.value;
  if (raw && typeof raw === 'object' && 'value' in raw) {
    const v = Number((raw as { value: number }).value);
    const unit = String((raw as { unit?: string }).unit ?? '');
    if (unit === 'millimolesPerLiter') {
      return Math.round(v * 18.0182);
    }
    return Math.round(v);
  }
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
