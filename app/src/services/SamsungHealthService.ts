import {
  getGrantedPermissions,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';

export type TimePoint = {
  timestamp: string;
  value: number;
};

export type RecentMetrics = {
  /** Blood glucose from Health Connect (CareSens / Samsung Health path). */
  glucose: TimePoint[];
  /** Demo-only — never read from Health Connect. */
  steps?: TimePoint[];
  heartRate?: TimePoint[];
};

const HOURS_24_MS = 24 * 60 * 60 * 1000;
/** How far back to query Health Connect when no explicit start is passed (CareSens / Samsung history). */
const DEFAULT_HISTORY_DAYS = 120;

const CORE_READ_PERMISSIONS = [
  { accessType: 'read', recordType: 'BloodGlucose' } as const,
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

export type HealthConnectReadDebug = {
  queryStart: string;
  queryEnd: string;
  grantedPermissions: unknown;
  rawReadResponse: unknown;
};

function mapGlucoseRecords(records: Array<Record<string, unknown>>): TimePoint[] {
  return records.map((record) => {
    const timestamp = String(
      record.time ?? record.endTime ?? record.startTime ?? new Date().toISOString(),
    );
    const value = parseBloodGlucoseMgDl(record);
    return { timestamp, value };
  });
}

class SamsungHealthService {
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
      // Use the permission dialog result directly — getGrantedPermissions() can lag right after grant.
      granted = await requestPermission([...CORE_READ_PERMISSIONS]);
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
      'Health Connect needs Blood glucose read access. Open Health Connect → App permissions → Healthings → allow Blood glucose.'
    );
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

    const glucoseRecords = await readRecords('BloodGlucose' as never, {
      timeRangeFilter: {
        operator: 'between',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    } as never);

    const records = (glucoseRecords.records ?? []) as Array<Record<string, unknown>>;
    const glucose = mapGlucoseRecords(records);
    if (glucose.length > 0) {
      this.markAccessOk();
    }

    return {
      metrics: { glucose },
      debug: {
        queryStart: startTime.toISOString(),
        queryEnd: endTime.toISOString(),
        grantedPermissions,
        rawReadResponse: glucoseRecords,
      },
    };
  }
}

export const samsungHealthService = new SamsungHealthService();

export { openHealthConnectSettings };

/** Health Connect / react-native-health-connect glucose level shapes. */
export function parseBloodGlucoseMgDl(record: Record<string, unknown>): number {
  const raw = record.level ?? record.value;
  if (raw && typeof raw === 'object') {
    const level = raw as Record<string, unknown>;
    // Native HC format from react-native-health-connect (see ReactBloodGlucoseRecord.kt).
    if ('inMilligramsPerDeciliter' in level) {
      const mg = Number(level.inMilligramsPerDeciliter);
      if (Number.isFinite(mg) && mg > 0) return Math.round(mg);
    }
    if ('inMillimolesPerLiter' in level) {
      const mmol = Number(level.inMillimolesPerLiter);
      if (Number.isFinite(mmol) && mmol > 0) return Math.round(mmol * 18.0182);
    }
    if ('value' in level) {
      const v = Number(level.value);
      const unit = String(level.unit ?? '');
      if (Number.isFinite(v) && v > 0) {
        if (unit === 'millimolesPerLiter') return Math.round(v * 18.0182);
        return Math.round(v);
      }
    }
  }
  const n = Number(raw ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}
