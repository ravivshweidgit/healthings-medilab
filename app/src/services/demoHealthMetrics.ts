import type { RecentMetrics } from './HealthConnectService';

const FIVE_MIN_MS = 5 * 60 * 1000;
const DEFAULT_START_MS = new Date('2026-04-19T00:00:00.000Z').getTime();

/** 7 samples × 5 min = 30 min sustained activity (MetabolicLogic uses consecutive points with steps > 0). */
const DEMO_ACTIVE_SAMPLES = 7;
/** 48 samples × 5 min = 4 h rest between activity bursts. */
const DEMO_REST_SAMPLES = 48;
const DEMO_ACTIVITY_CYCLE = DEMO_ACTIVE_SAMPLES + DEMO_REST_SAMPLES;

/**
 * Synthetic series for UI/dev when Health Connect is unavailable (Expo Go, iOS, etc.).
 * Repeating pattern: 30 min walking → 4 h no activity, so activity strips stay readable on the chart.
 */
export function generateDemoRecentMetrics(): RecentMetrics {
  const glucose: RecentMetrics['glucose'] = [];
  const steps: RecentMetrics['steps'] = [];
  const heartRate: RecentMetrics['heartRate'] = [];
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

    const posInCycle = i % DEMO_ACTIVITY_CYCLE;
    const inWalk = posInCycle < DEMO_ACTIVE_SAMPLES;
    steps.push({
      timestamp: new Date(t).toISOString(),
      value: inWalk ? 140 + Math.round(Math.random() * 40) : 0,
    });

    /** Synthetic BPM: resting band + faster ripple so the lower chart reads like a pulse trace next to glucose. */
    const slow = Math.sin(phase * 1.2) * 18;
    const ripple = Math.sin(phase * 8.5) * 12 + Math.sin(phase * 17) * 6;
    const walkBump = inWalk ? 22 + Math.sin(i * 0.8) * 15 : 0;
    const bpm = 72 + slow + ripple + walkBump + (Math.random() * 6 - 3);
    heartRate.push({
      timestamp: new Date(t).toISOString(),
      value: Math.round(Math.max(52, Math.min(165, bpm))),
    });

    i += 1;
  }

  return { glucose, steps, heartRate };
}
