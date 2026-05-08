import type { RecentMetrics } from './SamsungHealthService';

const FIVE_MIN_MS = 5 * 60 * 1000;
const DEFAULT_START_MS = new Date('2026-04-19T00:00:00.000Z').getTime();

/**
 * Synthetic series for UI/dev when Health Connect is unavailable (Expo Go, iOS, etc.).
 * Includes a ~45-minute walk window so MetabolicLogic can detect an activity zone.
 */
export function generateDemoRecentMetrics(): RecentMetrics {
  const glucose: RecentMetrics['glucose'] = [];
  const steps: RecentMetrics['steps'] = [];
  const now = Date.now();
  const start = Math.min(DEFAULT_START_MS, now - 14 * 24 * 60 * 60 * 1000);

  let i = 0;
  for (let t = start; t <= now; t += FIVE_MIN_MS) {
    const phase = i / 100;
    const base = 102 + Math.sin(phase) * 22;
    glucose.push({
      timestamp: new Date(t).toISOString(),
      value: Math.round(base + (i % 9)),
    });

    const inWalk = i >= 200 && i <= 212;
    steps.push({
      timestamp: new Date(t).toISOString(),
      value: inWalk ? 140 + Math.round(Math.random() * 40) : Math.round(Math.random() * 35),
    });
    i += 1;
  }

  return { glucose, steps };
}
