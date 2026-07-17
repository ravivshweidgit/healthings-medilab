/**
 * Android stub — HealthKit is iOS-only. CGM / activity on Android uses Health Connect.
 */
import type { RecentMetrics } from './healthMetricsTypes';
import type { WithingsHeartRatePoint } from './WithingsApiService';

export type { RecentMetrics, TimePoint } from './healthMetricsTypes';

class HealthKitServiceStub {
  async initializeAndRequestPermissions(): Promise<boolean> {
    throw new Error('Apple Health is only available on iPhone.');
  }

  async requestActivityPermissions(): Promise<boolean> {
    return false;
  }

  async hasActivityReadPermission(): Promise<boolean> {
    return false;
  }

  async fetchRecentMetrics(_startTime?: Date): Promise<RecentMetrics> {
    return { glucose: [] };
  }

  async fetchDailyStepTotals(
    _startDate: Date,
    _endDate?: Date,
  ): Promise<Map<string, number>> {
    return new Map();
  }

  async detectWithingsAppleHealthWriteStatus(): Promise<{
    inferred: 'likely_on' | 'likely_off' | 'unknown';
    label: string;
  }> {
    return { inferred: 'unknown', label: 'Withings → Apple Health: Android stub' };
  }

  async fetchActivityWindow(_lookbackDays?: number): Promise<{
    heartRate: WithingsHeartRatePoint[];
    dailyActiveKcalByDay: Record<string, number>;
  }> {
    return { heartRate: [], dailyActiveKcalByDay: {} };
  }
}

export const healthKitService = new HealthKitServiceStub();
