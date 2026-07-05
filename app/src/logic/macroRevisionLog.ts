/**
 * Timestamped audit log of macro revision AI runs (last N entries).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type MacroRevisionTrigger =
  | 'dashboard-suggest'
  | 'chat-proposal'
  | 'weigh-in'
  | 'lab-import'
  | 'onboarding';

export type MacroRevisionSource = 'gemini' | 'fallback';

export type MacroRevisionLogEntry = {
  at: string;
  trigger: MacroRevisionTrigger;
  triggerDetail?: string;
  source: MacroRevisionSource;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  applied: boolean;
  blockReason?: string;
};

const LOG_KEY = 'macro_revision_log_v1';
const MAX_ENTRIES = 20;

export async function getMacroRevisionLog(): Promise<MacroRevisionLogEntry[]> {
  const raw = await AsyncStorage.getItem(LOG_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as MacroRevisionLogEntry[];
  } catch {
    return [];
  }
}

export async function appendMacroRevisionLog(entry: MacroRevisionLogEntry): Promise<void> {
  const prev = await getMacroRevisionLog();
  const next = [entry, ...prev].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(LOG_KEY, JSON.stringify(next));
}

/** Median carb_g from recent successful Gemini proposals (for outlier detection). */
export function medianRecentGeminiCarbs(entries: MacroRevisionLogEntry[], count = 3): number | null {
  const carbs = entries
    .filter((e) => e.source === 'gemini')
    .slice(0, count)
    .map((e) => e.carb_g);
  if (carbs.length === 0) return null;
  const sorted = [...carbs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}
