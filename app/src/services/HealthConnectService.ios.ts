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

class HealthConnectService {
  async initializeAndRequestPermissions(): Promise<unknown[]> {
    throw new Error('Live CGM via Apple Health is not available on iPhone yet. Import a CSV or use Android.');
  }

  async requestStepsPermission(): Promise<boolean> {
    return false;
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

  async readAllRecords(): Promise<Array<Record<string, unknown>>> {
    return [];
  }

  async hasStepsReadPermission(): Promise<boolean> {
    return false;
  }

  async fetchDailyStepTotals(): Promise<Map<string, number>> {
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
