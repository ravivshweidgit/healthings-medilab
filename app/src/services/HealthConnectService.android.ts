import {
  getGrantedPermissions,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';

import type { HealthConnectReadDebug, RecentMetrics } from './healthMetricsTypes';
import { parseBloodGlucoseMgDl } from './healthMetricsTypes';

export type { HealthConnectReadDebug, RecentMetrics, TimePoint } from './healthMetricsTypes';
export { parseBloodGlucoseMgDl, openHealthConnectSettings };

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

const ACTIVITY_READ_PERMISSIONS = [
  STEPS_READ_PERMISSION,
  { accessType: 'read', recordType: 'ExerciseSession' } as const,
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' } as const,
  { accessType: 'read', recordType: 'HeartRate' } as const,
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
  return records.map((record) => {
    const timestamp = String(
      record.time ?? record.endTime ?? record.startTime ?? new Date().toISOString(),
    );
    const value = parseBloodGlucoseMgDl(record);
    return { timestamp, value };
  });
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
      'Health Connect needs Blood glucose read access. Open Health Connect → App permissions → Healthings → allow Blood glucose.',
    );
  }

  async requestStepsPermission(): Promise<boolean> {
    return this.requestActivityPermissions();
  }

  async requestActivityPermissions(): Promise<boolean> {
    try {
      const isInitialized = await initialize();
      if (!isInitialized) return false;
      const granted = await requestPermission([...ACTIVITY_READ_PERMISSIONS]);
      return ACTIVITY_READ_PERMISSIONS.every((need) =>
        granted.some((p) => p.accessType === need.accessType && p.recordType === need.recordType),
      );
    } catch {
      return false;
    }
  }

  async hasActivityReadPermission(): Promise<boolean> {
    try {
      const isInitialized = await initialize();
      if (!isInitialized) return false;
      const granted = await getGrantedPermissions();
      return ACTIVITY_READ_PERMISSIONS.every((need) =>
        granted.some((p) => p.accessType === need.accessType && p.recordType === need.recordType),
      );
    } catch {
      return false;
    }
  }

  async readAllRecords(
    recordType: 'Steps' | 'ExerciseSession' | 'ActiveCaloriesBurned' | 'HeartRate',
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

  /** Daily step totals (Samsung Health → Health Connect) for activity kcal estimation. */
  async fetchDailyStepTotals(startDate: Date, endDate: Date = new Date()): Promise<Map<string, number>> {
    const byDay = new Map<string, number>();
    try {
      const isInitialized = await initialize();
      if (!isInitialized) return byDay;
      const page = (await readRecords('Steps' as never, {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
        pageSize: HC_PAGE_SIZE,
      } as never)) as { records?: Array<Record<string, unknown>> };
      for (const record of page.records ?? []) {
        const count = Number(record.count ?? 0);
        if (!Number.isFinite(count) || count <= 0) continue;
        const ts = String(record.endTime ?? record.startTime ?? record.time ?? '');
        const dk = ts.slice(0, 10);
        if (!dk) continue;
        byDay.set(dk, (byDay.get(dk) ?? 0) + count);
      }
    } catch {
      /* permission or HC unavailable */
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
    do {
      const page = (await readRecords('BloodGlucose' as never, {
        timeRangeFilter: {
          operator: 'between',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
        pageSize: HC_PAGE_SIZE,
        ...(pageToken ? { pageToken } : {}),
      } as never)) as { records?: Array<Record<string, unknown>>; pageToken?: string };

      const pageRecords = (page.records ?? []) as Array<Record<string, unknown>>;
      records.push(...pageRecords);
      pages.push(page);
      pageToken = page.pageToken || undefined;
      pageGuard += 1;
    } while (pageToken && pageGuard < HC_MAX_PAGES);

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
        rawReadResponse: pages.length === 1 ? pages[0] : pages,
      },
    };
  }
}

export const healthConnectService = new HealthConnectService();
