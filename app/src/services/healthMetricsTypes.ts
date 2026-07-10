/** Shared glucose / HC metric shapes (no native Health Connect imports). */

export type TimePoint = {
  timestamp: string;
  value: number;
};

export type RecentMetrics = {
  /** Blood glucose from Health Connect (xDrip+ live path; CareSens CSV merge). */
  glucose: TimePoint[];
  /** Demo-only — never read from Health Connect. */
  steps?: TimePoint[];
  heartRate?: TimePoint[];
};

export type HealthConnectReadDebug = {
  queryStart: string;
  queryEnd: string;
  grantedPermissions: unknown;
  rawReadResponse: unknown;
};

/** Health Connect / react-native-health-connect glucose level shapes. */
export function parseBloodGlucoseMgDl(record: Record<string, unknown>): number {
  const raw = record.level ?? record.value;
  if (raw && typeof raw === 'object') {
    const level = raw as Record<string, unknown>;
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
