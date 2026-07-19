/**
 * iOS stub — Health Connect is Android-only (prompt65). CSV CGM + Withings cloud on iPhone.
 */

import type { HealthConnectReadDebug, RecentMetrics } from './healthMetricsTypes';
import { parseBloodGlucoseMgDl } from './healthMetricsTypes';

export type { HealthConnectReadDebug, RecentMetrics, TimePoint } from './healthMetricsTypes';
export { parseBloodGlucoseMgDl };

export async function openHealthConnectSettings(): Promise<void> {
  /* no-op on iOS */
}

export async function openHealthConnectPlayStore(): Promise<void> {
  /* no-op on iOS */
}

export type ActivityPermissionDetail = {
  ok: boolean;
  message: string;
  openSettings?: boolean;
  installOrUpdate?: boolean;
};

export type WithingsHcWriteStatus = {
  inferred: 'likely_on' | 'likely_off' | 'unknown';
  label: string;
};

class HealthConnectService {
  async ensureGlucoseReadable(): Promise<void> {
    await this.initializeAndRequestPermissions();
  }

  async initializeAndRequestPermissions(): Promise<unknown[]> {
    throw new Error('Live CGM via Apple Health is not available on iPhone yet. Import a CSV or use Android.');
  }

  async requestStepsPermission(): Promise<boolean> {
    return false;
  }

  async requestActivityPermissionsWithDetail(): Promise<ActivityPermissionDetail> {
    return { ok: false, message: 'Health Connect is Android-only.' };
  }

  async requestActivityPermissions(): Promise<boolean> {
    return false;
  }

  async hasActivityReadPermission(): Promise<boolean> {
    return false;
  }

  async listGrantedPermissions(): Promise<Array<{ accessType?: string; recordType?: string }>> {
    return [];
  }

  async detectWithingsHcWriteStatus(): Promise<WithingsHcWriteStatus> {
    return {
      inferred: 'unknown',
      label: 'Withings → Health Connect: n/a on iPhone (use Apple Health path).',
    };
  }

  async detectWithingsStepsInHealthConnect(): Promise<boolean> {
    return false;
  }

  async readAllRecords(): Promise<Array<Record<string, unknown>>> {
    return [];
  }

  async hasStepsReadPermission(): Promise<boolean> {
    return false;
  }

  async fetchDailyStepTotals(): Promise<Map<string, number>> {
    return new Map();
  }

  async fetchDailyActiveKcalTotals(): Promise<Map<string, number>> {
    return new Map();
  }

  async fetchDailyDistanceKmTotals(): Promise<Map<string, number>> {
    return new Map();
  }

  async fetchRecentMetrics(): Promise<RecentMetrics> {
    return { glucose: [] };
  }

  async fetchRecentMetricsWithDebug(): Promise<{ metrics: RecentMetrics; debug: HealthConnectReadDebug }> {
    const now = new Date().toISOString();
    return {
      metrics: { glucose: [] },
      debug: {
        queryStart: now,
        queryEnd: now,
        grantedPermissions: [],
        rawReadResponse: null,
      },
    };
  }
}

export const healthConnectService = new HealthConnectService();
