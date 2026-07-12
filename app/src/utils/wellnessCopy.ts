import type { HealthDataSource } from '../services/healthRuntime';

export function greetingLine(name: string): string {
  const h = new Date().getHours();
  let salutation = 'Good evening';
  if (h < 12) salutation = 'Good morning';
  else if (h < 17) salutation = 'Good afternoon';
  return `${salutation}, ${name}`;
}

export function glucoseHeadline(mgDl: number): string {
  if (!mgDl || Number.isNaN(mgDl)) return 'Glucose readings will appear here.';
  if (mgDl >= 70 && mgDl <= 140) return 'Your glucose looks steady.';
  if (mgDl > 140) return 'Glucose is elevated — movement and meals matter.';
  return 'Glucose is on the low side — fuel thoughtfully.';
}

export function stepsHeadline(total: number): string {
  if (!total) return 'Steps will show once you move.';
  if (total >= 10000) return 'Strong day of movement.';
  if (total >= 5000) return 'Nice rhythm of activity today.';
  return 'Every step still counts.';
}

export function heartRateHeadline(bpm: number): string {
  if (!bpm || Number.isNaN(bpm)) return 'Heart rate will appear after sync.';
  if (bpm >= 60 && bpm <= 100) return `About ${bpm} BPM — steady resting band.`;
  if (bpm > 100) return `Around ${bpm} BPM — elevated vs resting.`;
  return `About ${bpm} BPM — on the low side.`;
}

export function metabolicScoreLine(score: number): string {
  if (score >= 65) return 'Your metabolic rhythm looks strong.';
  if (score >= 40) return 'Your metabolic score is building.';
  return 'Keep going — consistency builds your score.';
}

export function demoNoticeCopy(source: HealthDataSource): string | null {
  if (source === 'demo-expo-go') {
    return 'You’re viewing sample wellness data. Install the full app on Android to connect your personal readings.';
  }
  if (source === 'demo-non-android') {
    return 'Sample data for this screen — install the TestFlight build for live Apple Health CGM.';
  }
  return null;
}
