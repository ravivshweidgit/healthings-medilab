/**
 * Android stub — HealthKit is iOS-only. CGM on Android uses Health Connect.
 */
import type { RecentMetrics } from './healthMetricsTypes';

export type { RecentMetrics, TimePoint } from './healthMetricsTypes';

class HealthKitServiceStub {
  async initializeAndRequestPermissions(): Promise<boolean> {
    throw new Error('Apple Health is only available on iPhone.');
  }

  async fetchRecentMetrics(_startTime?: Date): Promise<RecentMetrics> {
    return { glucose: [] };
  }
}

export const healthKitService = new HealthKitServiceStub();
