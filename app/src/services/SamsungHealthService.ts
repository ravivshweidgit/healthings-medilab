import {
  getGrantedPermissions,
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
  /** BPM samples (flattened from Health Connect `HeartRate` records). */
  heartRate: TimePoint[];
};

const HOURS_24_MS = 24 * 60 * 60 * 1000;
/** How far back to query Health Connect when no explicit start is passed (CareSens / Samsung history). */
const DEFAULT_HISTORY_DAYS = 120;

const CORE_READ_PERMISSIONS = [
  { accessType: 'read', recordType: 'BloodGlucose' } as const,
  { accessType: 'read', recordType: 'Steps' } as const,
  { accessType: 'read', recordType: 'HeartRate' } as const,
];

function hasCoreReadAccess(
  granted: Array<{ accessType?: string; recordType?: string }>
): boolean {
  return CORE_READ_PERMISSIONS.every((need) =>
    granted.some((p) => p.accessType === need.accessType && p.recordType === need.recordType)
  );
}

function defaultHealthQueryStart(): Date {
  return new Date(Date.now() - DEFAULT_HISTORY_DAYS * 24 * 60 * 60 * 1000);
}

class SamsungHealthService {
  async initializeAndRequestPermissions(): Promise<boolean> {
    const isInitialized = await initialize();
    if (!isInitialized) {
      throw new Error('Failed to initialize Health Connect.');
    }

    let granted = await getGrantedPermissions();
    if (!hasCoreReadAccess(granted)) {
      await requestPermission([...CORE_READ_PERMISSIONS]);
      granted = await getGrantedPermissions();
    }

    if (!hasCoreReadAccess(granted)) {
      throw new Error(
        'Health Connect permissions were not granted. Open system Health Connect settings and allow Blood Glucose, Steps, and Heart rate for this app.'
      );
    }

    return true;
  }

  async fetchRecentMetrics(startDate: Date = defaultHealthQueryStart()): Promise<RecentMetrics> {
    const endTime = new Date();
    const safeStartDate = Number.isNaN(startDate.getTime()) ? defaultHealthQueryStart() : startDate;
    const startTime = safeStartDate > endTime ? new Date(endTime.getTime() - HOURS_24_MS) : safeStartDate;

    const [glucoseRecords, stepRecords, heartRateRecords] = await Promise.all([
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
      readRecords('HeartRate' as never, {
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

    const heartRate: TimePoint[] = [];
    for (const record of heartRateRecords.records as Array<Record<string, unknown>>) {
      const samples = record.samples;
      if (!Array.isArray(samples)) continue;
      for (const sample of samples as Array<Record<string, unknown>>) {
        const timestamp = String(sample.time ?? record.endTime ?? record.startTime ?? '');
        const bpm = Number(sample.beatsPerMinute ?? 0);
        if (timestamp && Number.isFinite(bpm) && bpm > 0) {
          heartRate.push({ timestamp, value: Math.round(bpm) });
        }
      }
    }
    heartRate.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return { glucose, steps, heartRate };
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
