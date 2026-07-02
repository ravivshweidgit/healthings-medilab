/**
 * Version history for My Rules — archives prior snapshot before each rawText change.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserRules, saveUserRules, type UserRules } from './TargetService';

export const USER_RULES_HISTORY_KEY = 'user_rules_history_v1';
export const MAX_HISTORY_ENTRIES = 30;

export type UserRulesHistoryEntry = {
  id: string;
  savedAt: string;
  source: 'patient' | 'clinic';
  clinicLabel?: string;
  rules: UserRules;
};

type UserRulesHistoryStore = {
  entries: UserRulesHistoryEntry[];
};

function newHistoryId(): string {
  return `urh-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function rawTextEqual(a: UserRules | null | undefined, b: UserRules): boolean {
  return (a?.rawText?.trim() ?? '') === (b.rawText?.trim() ?? '');
}

export async function getUserRulesHistory(): Promise<UserRulesHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(USER_RULES_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as UserRulesHistoryStore;
    return Array.isArray(parsed?.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

export async function appendUserRulesHistory(
  entry: Omit<UserRulesHistoryEntry, 'id'> & { id?: string },
): Promise<void> {
  const prev = await getUserRulesHistory();
  const row: UserRulesHistoryEntry = { ...entry, id: entry.id ?? newHistoryId() };
  const next = [row, ...prev].slice(0, MAX_HISTORY_ENTRIES);
  await AsyncStorage.setItem(USER_RULES_HISTORY_KEY, JSON.stringify({ entries: next }));
}

/** Archive prior rules when rawText changes, then persist the new active rules. */
export async function saveUserRulesWithHistory(
  next: UserRules,
  meta: { source: 'patient' | 'clinic'; clinicLabel?: string },
): Promise<void> {
  const prior = await getUserRules();
  if (prior?.rawText?.trim() && !rawTextEqual(prior, next)) {
    await appendUserRulesHistory({
      savedAt: new Date().toISOString(),
      source: meta.source,
      clinicLabel: meta.clinicLabel,
      rules: prior,
    });
  }
  await saveUserRules(next);
}

export function formatHistorySource(entry: UserRulesHistoryEntry): string {
  if (entry.source === 'clinic') return entry.clinicLabel?.trim() || 'Clinic';
  return 'You';
}

export function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function historyRowPreview(entry: UserRulesHistoryEntry): string {
  const summary = entry.rules.summary?.trim();
  if (summary) return summary;
  const line = entry.rules.rawText.trim().split('\n')[0] ?? '';
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
}
