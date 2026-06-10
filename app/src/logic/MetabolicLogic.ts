import type { TimePoint } from '../services/HealthConnectService';

export type ActivityZone = {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  glucoseChangePercent: number;
};

export type MetabolicEfficiencyResult = {
  efficiencyScore: number;
  insight: string;
  activityZones: ActivityZone[];
};

const MIN_ACTIVITY_MINUTES = 20;
const MAX_GAP_MINUTES = 10;
const POST_ACTIVITY_WINDOW_MINUTES = 30;

const minutesBetween = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / (1000 * 60));

const nearestGlucoseValue = (glucose: TimePoint[], targetMs: number): number | null => {
  if (!glucose.length) return null;
  let best = glucose[0];
  let bestDelta = Math.abs(new Date(best.timestamp).getTime() - targetMs);

  for (const point of glucose) {
    const delta = Math.abs(new Date(point.timestamp).getTime() - targetMs);
    if (delta < bestDelta) {
      best = point;
      bestDelta = delta;
    }
  }

  return best.value;
};

export const calculateMetabolicEfficiency = (
  glucose: TimePoint[],
  steps: TimePoint[]
): MetabolicEfficiencyResult => {
  if (!glucose.length || !steps.length) {
    return {
      efficiencyScore: 0,
      insight: 'Not enough data yet. Connect Health Connect and sync at least 24h.',
      activityZones: [],
    };
  }

  const sortedSteps = [...steps]
    .map((s) => ({ ...s, timestampMs: new Date(s.timestamp).getTime() }))
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const zones: ActivityZone[] = [];
  let zoneStartIdx = -1;

  for (let i = 0; i < sortedSteps.length; i += 1) {
    const point = sortedSteps[i];
    const isActive = point.value > 0;

    if (isActive && zoneStartIdx === -1) {
      zoneStartIdx = i;
      continue;
    }

    if (zoneStartIdx !== -1) {
      const prev = sortedSteps[i - 1];
      const gap = minutesBetween(new Date(prev.timestampMs), new Date(point.timestampMs));
      const shouldCloseZone = !isActive || gap > MAX_GAP_MINUTES || i === sortedSteps.length - 1;
      if (shouldCloseZone) {
        const endIdx = i === sortedSteps.length - 1 && isActive ? i : i - 1;
        const start = sortedSteps[zoneStartIdx];
        const end = sortedSteps[endIdx];
        const durationMinutes = Math.max(1, minutesBetween(new Date(start.timestampMs), new Date(end.timestampMs)));

        if (durationMinutes >= MIN_ACTIVITY_MINUTES) {
          const baseline = nearestGlucoseValue(glucose, start.timestampMs);
          const post = nearestGlucoseValue(
            glucose,
            end.timestampMs + POST_ACTIVITY_WINDOW_MINUTES * 60 * 1000
          );
          const glucoseChangePercent =
            baseline && post ? ((baseline - post) / Math.max(1, baseline)) * 100 : 0;

          zones.push({
            startTime: start.timestamp,
            endTime: end.timestamp,
            durationMinutes,
            glucoseChangePercent,
          });
        }

        zoneStartIdx = -1;
      }
    }
  }

  if (!zones.length) {
    return {
      efficiencyScore: 35,
      insight: 'Activity detected, but no sustained 20+ minute zone yet.',
      activityZones: [],
    };
  }

  const avgSuppression = zones.reduce((sum, zone) => sum + Math.max(0, zone.glucoseChangePercent), 0) / zones.length;
  const avgDuration = zones.reduce((sum, zone) => sum + zone.durationMinutes, 0) / zones.length;

  const suppressionScore = Math.min(70, avgSuppression * 5);
  const durationScore = Math.min(30, (avgDuration / 60) * 30);
  const efficiencyScore = Math.round(Math.max(0, Math.min(100, suppressionScore + durationScore)));

  const latestZone = zones[zones.length - 1];
  const deltaVsAverage = latestZone.glucoseChangePercent - avgSuppression;
  const direction = deltaVsAverage >= 0 ? 'more' : 'less';
  const insight = `Your latest activity zone reduced glucose by ${Math.abs(deltaVsAverage).toFixed(
    1
  )}% ${direction} than your average.`;

  return {
    efficiencyScore,
    insight,
    activityZones: zones,
  };
};
