/**
 * Food log history for meal AI — resolve "usual meal", "last evening's shake", etc.
 */

import type { FoodEntry } from '../services/FoodLogService';
import { entryFiber_g } from '../services/FoodLogService';

export type FrequentMealPattern = {
  label: string;
  count: number;
  signature: string;
  sampleEntry: FoodEntry;
};

function formatMealTime(entry: FoodEntry): string {
  const d = new Date(entry.timestamp);
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function mealDayPart(entry: FoodEntry): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = new Date(entry.timestamp).getHours();
  if (h < 11) return 'morning';
  if (h < 16) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

function itemLabel(item: FoodEntry['items'][0]): string {
  return (item.name_local || item.name).trim();
}

function mealSignature(entry: FoodEntry): string {
  if (entry.items.length === 0) return `totals:${entry.totalKcal}`;
  return entry.items
    .map((i) => `${itemLabel(i).toLowerCase()}@${Math.round(i.grams)}g`)
    .sort()
    .join('|');
}

function mealTitle(entry: FoodEntry): string {
  if (entry.items.length === 0) {
    return `${entry.totalKcal} kcal meal`;
  }
  if (entry.items.length === 1) {
    return itemLabel(entry.items[0]!);
  }
  const names = entry.items.slice(0, 3).map(itemLabel);
  const more = entry.items.length > 3 ? ` +${entry.items.length - 3}` : '';
  return `${names.join(', ')}${more}`;
}

/** Top recurring meal patterns in the window (for "usual" / "my regular shake"). */
export function computeFrequentMealPatterns(
  entries: FoodEntry[],
  topN = 8,
): FrequentMealPattern[] {
  const bySig = new Map<string, { count: number; entry: FoodEntry }>();
  for (const entry of entries) {
    if (entry.items.length === 0) continue;
    const sig = mealSignature(entry);
    const prev = bySig.get(sig);
    if (prev) {
      prev.count += 1;
    } else {
      bySig.set(sig, { count: 1, entry });
    }
  }
  return [...bySig.entries()]
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, topN)
    .map(([signature, v]) => ({
      signature,
      count: v.count,
      sampleEntry: v.entry,
      label: mealTitle(v.entry),
    }));
}

function formatMealBlock(entry: FoodEntry, index: number): string[] {
  const lines: string[] = [];
  const dayPart = mealDayPart(entry);
  lines.push(
    `[${index}] id=${entry.id} | ${formatMealTime(entry)} | ${dayPart} | ${mealTitle(entry)}`,
  );
  lines.push(
    `    Total: ${entry.totalKcal} kcal | P${entry.totalProtein_g}g C${entry.totalCarb_g}g F${entry.totalFat_g}g Fi${entryFiber_g(entry)}g`,
  );
  for (const item of entry.items) {
    const name = itemLabel(item);
    let line =
      `    • ${name}: ${Math.round(item.grams)}g, ${Math.round(item.kcal)} kcal, P${item.protein_g}g C${item.carb_g}g F${item.fat_g}g Fi${item.fiber_g ?? 0}g`;
    const marks = item.markers;
    if (marks && Object.keys(marks).length > 0) {
      const bits = Object.entries(marks)
        .filter(([, v]) => v != null && Number.isFinite(v))
        .map(([k, v]) => `${k}:${v}`);
      if (bits.length) line += ` | ${bits.join(' ')}`;
    }
    lines.push(line);
  }
  return lines;
}

function formatFrequentBlock(patterns: FrequentMealPattern[]): string[] {
  if (patterns.length === 0) return [];
  const lines = ['FREQUENT MEALS (computed — for "usual" / "regular" / "my normal"):'];
  for (const p of patterns) {
    lines.push(`- "${p.label}" × ${p.count} in window (use meal id ${p.sampleEntry.id} as template)`);
  }
  return lines;
}

/** Compact history block injected into food-analysis system prompt. */
export function formatFoodLogHistoryForMealAi(
  entries: FoodEntry[],
  opts?: { excludeEntryId?: string; lookbackDays?: number },
): string | null {
  const excludeId = opts?.excludeEntryId;
  const sorted = [...entries]
    .filter((e) => e.id !== excludeId && e.items.length > 0)
    .sort((a, b) => b.timestamp - a.timestamp);

  if (sorted.length === 0) return null;

  const lookback = opts?.lookbackDays ?? 14;
  const lines = [
    `FOOD LOG HISTORY (last ${lookback} days — use to resolve references like "last evening", "yesterday", "usual shake", "same chicken meal"):`,
    'When the user references a past meal, COPY items (name, name_local, grams, kcal, macros, and any sat_fat_g / marker fields) from the matching entry unless they specify a change.',
    'Match by: time phrases (evening/morning/yesterday), food names, or FREQUENT MEALS below.',
    '',
  ];

  sorted.forEach((entry, i) => {
    lines.push(...formatMealBlock(entry, i + 1));
    lines.push('');
  });

  lines.push(...formatFrequentBlock(computeFrequentMealPatterns(sorted)));
  return lines.join('\n').trim();
}
