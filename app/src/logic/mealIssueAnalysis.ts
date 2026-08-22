/**
 * Meal-issue helpers — local macro math + Gemini rule markers on FoodItem.
 * My Rules violations come from Gemini (analyzeFood rule_conflict + save-time check).
 */

import type { FoodItem } from '../services/GeminiService';
import type { DailyMacroTarget } from '../services/TargetService';
import {
  effectiveCarbCeilingG,
  hardAxis,
  type ResolvedAxisMeter,
} from '../services/ClinicMacroBoundsService';
import { deriveNetCarb_g } from './macroFiberCoupling';

export type MealIssueCode = 'carb_over' | 'kcal_over' | 'protein_low' | 'net_over' | 'rule_conflict';

export type MealIssue = {
  id: string;
  severity: 'warning' | 'critical';
  code: MealIssueCode;
  message: string;
  itemNames?: string[];
};

export type DayMacroTotals = {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
};

export type MealIssueInput = {
  items: FoodItem[];
  dayTotalsBeforeMeal: DayMacroTotals;
  macroTarget: DailyMacroTarget | null;
  mealTimestamp: number;
  /** HARD clinic meters for this meal's day. Empty = solo / no order yet — use the phone point. */
  clinicMeters?: ResolvedAxisMeter[];
};

/** Localized templates for app-generated macro / fallback rule messages. */
export type MealIssueMessages = {
  carbOver: (projected: number, over: number, target: number) => string;
  netOver?: (projected: number, over: number, target: number) => string;
  kcalOver: (projected: number, over: number, target: number) => string;
  proteinLow: (projected: number, expected: number, short: number) => string;
  ruleConflictFallback: (name: string) => string;
};

function itemDisplayName(item: FoodItem): string {
  return item.name_local ?? item.name;
}

function mealTotals(items: FoodItem[]): DayMacroTotals {
  return items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + item.kcal,
      protein_g: acc.protein_g + item.protein_g,
      carb_g: acc.carb_g + item.carb_g,
      fat_g: acc.fat_g + item.fat_g,
      fiber_g: acc.fiber_g + (item.fiber_g ?? 0),
    }),
    { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0 },
  );
}

function projectedDayTotals(before: DayMacroTotals, meal: DayMacroTotals): DayMacroTotals {
  return {
    kcal: before.kcal + meal.kcal,
    protein_g: before.protein_g + meal.protein_g,
    carb_g: before.carb_g + meal.carb_g,
    fat_g: before.fat_g + meal.fat_g,
    fiber_g: before.fiber_g + meal.fiber_g,
  };
}

function carbContributors(items: FoodItem[]): string[] {
  return items.filter((i) => i.carb_g >= 5).map(itemDisplayName);
}

function kcalContributors(items: FoodItem[]): string[] {
  const sorted = [...items].sort((a, b) => b.kcal - a.kcal);
  const top = sorted.filter((i) => i.kcal >= 80);
  return (top.length > 0 ? top : sorted.slice(0, 2)).map(itemDisplayName);
}

export function mergeMealRuleIssues(...groups: MealIssue[][]): MealIssue[] {
  const seen = new Set<string>();
  const out: MealIssue[] = [];
  for (const group of groups) {
    for (const issue of group) {
      const key = `${issue.code}::${(issue.itemNames ?? []).join('|').toLowerCase()}::${issue.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(issue);
    }
  }
  return out;
}

export function mealIssuesFromFoodItems(
  items: FoodItem[],
  messages?: Pick<MealIssueMessages, 'ruleConflictFallback'>,
): MealIssue[] {
  return items
    .filter((item) => item.rule_conflict)
    .map((item, index) => {
      const name = itemDisplayName(item);
      const severity: 'warning' | 'critical' =
        item.rule_severity === 'critical' ? 'critical' : 'warning';
      return {
        id: `item-rule-${index}-${name}`,
        severity,
        code: 'rule_conflict' as const,
        message:
          item.rule_message?.trim()
          || messages?.ruleConflictFallback(name)
          || `"${name}" conflicts with your dietary rules.`,
        itemNames: [name],
      };
    });
}

export function mealIssuesFromGeminiRules(geminiIssues: Array<{
  itemName: string;
  severity: 'warning' | 'critical';
  message: string;
}>): MealIssue[] {
  return geminiIssues.map((issue, index) => ({
    id: `gemini-rule-${index}-${issue.itemName}`,
    severity: issue.severity,
    code: 'rule_conflict' as const,
    message: issue.message,
    itemNames: [issue.itemName],
  }));
}

export function analyzeMacroMealIssues(
  input: MealIssueInput,
  messages?: MealIssueMessages,
): MealIssue[] {
  const { items, dayTotalsBeforeMeal, macroTarget, mealTimestamp, clinicMeters = [] } = input;
  if (items.length === 0) return [];

  const issues: MealIssue[] = [];
  const meal = mealTotals(items);
  const projected = projectedDayTotals(dayTotalsBeforeMeal, meal);

  const redesign = clinicMeters.length > 0;
  const carbCap = effectiveCarbCeilingG(clinicMeters, redesign ? null : macroTarget?.carb_g);
  if (carbCap != null && projected.carb_g > carbCap + 0.5) {
    const over = Math.round(projected.carb_g - carbCap);
    const projectedR = Math.round(projected.carb_g);
    const targetR = Math.round(carbCap);
    issues.push({
      id: 'carb-over',
      severity: 'warning',
      code: 'carb_over',
      message:
        messages?.carbOver(projectedR, over, targetR)
        ?? `Today's carbs would reach ${projectedR}g (${over}g over your ${targetR}g target).`,
      itemNames: carbContributors(items),
    });
  }

  const netCap = hardAxis(clinicMeters, 'net_carb_g')?.ceiling;
  if (netCap != null) {
    const projectedNet = deriveNetCarb_g(projected.carb_g, projected.fiber_g);
    if (projectedNet > netCap + 0.5) {
      const over = Math.round(projectedNet - netCap);
      const projectedR = Math.round(projectedNet);
      const targetR = Math.round(netCap);
      issues.push({
        id: 'net-over',
        severity: 'warning',
        code: 'net_over',
        message:
          messages?.netOver?.(projectedR, over, targetR)
          ?? `Today's net carbs would reach ${projectedR}g (${over}g over your ${targetR}g target).`,
        itemNames: carbContributors(items),
      });
    }
  }

  const kcalCap = hardAxis(clinicMeters, 'kcal')?.ceiling
    ?? (redesign ? undefined : macroTarget?.kcal);
  if (kcalCap != null && projected.kcal > kcalCap + 5) {
    const over = Math.round(projected.kcal - kcalCap);
    const projectedR = Math.round(projected.kcal);
    const targetR = Math.round(kcalCap);
    issues.push({
      id: 'kcal-over',
      severity: 'warning',
      code: 'kcal_over',
      message:
        messages?.kcalOver(projectedR, over, targetR)
        ?? `Today's calories would reach ${projectedR} kcal (${over} over your ${targetR} target).`,
      itemNames: kcalContributors(items),
    });
  }

  const proteinFloor =
    hardAxis(clinicMeters, 'protein_g')?.floor
    ?? (redesign ? undefined : macroTarget?.protein_g);
  if (proteinFloor != null) {
    const mealDate = new Date(mealTimestamp);
    const hoursIntoDay = mealDate.getHours() + mealDate.getMinutes() / 60;
    const paceFraction = Math.max(0.35, hoursIntoDay / 24);
    const expectedProtein = proteinFloor * paceFraction;
    if (hoursIntoDay >= 12 && projected.protein_g < expectedProtein * 0.65) {
      const short = Math.round(expectedProtein - projected.protein_g);
      const projectedR = Math.round(projected.protein_g);
      const expectedR = Math.round(expectedProtein);
      issues.push({
        id: 'protein-low',
        severity: 'warning',
        code: 'protein_low',
        message:
          messages?.proteinLow(projectedR, expectedR, short)
          ?? `Protein is behind pace for today (${projectedR}g vs ~${expectedR}g expected by now, ~${short}g short).`,
      });
    }
  }

  return issues;
}

export function flaggedItemIndices(items: FoodItem[], issues: MealIssue[]): Set<number> {
  const indices = foodItemRuleConflictIndices(items);
  const flaggedNames = new Set(
    issues.flatMap((issue) => issue.itemNames ?? []).map((n) => n.toLowerCase()),
  );
  if (flaggedNames.size === 0) return indices;

  items.forEach((item, index) => {
    const names = [item.name, item.name_local ?? ''].map((n) => n.toLowerCase());
    if (names.some((n) => flaggedNames.has(n))) indices.add(index);
  });
  return indices;
}

export function foodItemRuleConflictIndices(items: FoodItem[]): Set<number> {
  const indices = new Set<number>();
  items.forEach((item, index) => {
    if (item.rule_conflict) indices.add(index);
  });
  return indices;
}

export function mealItemsSnapshotKey(items: FoodItem[]): string {
  return JSON.stringify(
    items.map((i) => ({
      name: i.name,
      name_local: i.name_local,
      grams: i.grams,
      kcal: i.kcal,
      protein_g: i.protein_g,
      carb_g: i.carb_g,
      fat_g: i.fat_g,
      fiber_g: i.fiber_g,
      rule_conflict: i.rule_conflict,
      rule_message: i.rule_message,
    })),
  );
}

/** Meal composition only — for re-checking rules when items change (ignores stale rule flags). */
export function mealItemsCompositionKey(items: FoodItem[]): string {
  return JSON.stringify(
    items.map((i) => ({
      name: i.name,
      name_local: i.name_local,
      grams: i.grams,
      kcal: i.kcal,
      protein_g: i.protein_g,
      carb_g: i.carb_g,
      fat_g: i.fat_g,
      fiber_g: i.fiber_g,
    })),
  );
}

function namesMatchItem(itemName: string, item: FoodItem): boolean {
  const key = itemName.toLowerCase().trim();
  if (!key) return false;
  const labels = [item.name_local, item.name].filter(Boolean).map((n) => n!.toLowerCase().trim());
  return labels.some((label) => label === key || label.includes(key) || key.includes(label));
}

/** Re-apply Gemini rule check results onto items (clears stale rule_conflict from saved meals). */
export function syncFoodItemRuleFlags(
  items: FoodItem[],
  geminiIssues: Array<{ itemName: string; message: string; severity?: 'warning' | 'critical' }>,
): FoodItem[] {
  return items.map((item) => {
    const hit = geminiIssues.find((issue) => namesMatchItem(issue.itemName, item));
    return {
      ...item,
      rule_conflict: Boolean(hit),
      rule_message: hit?.message?.trim() || undefined,
      rule_severity: hit
        ? hit.severity === 'critical'
          ? 'critical'
          : 'warning'
        : undefined,
    };
  });
}

/** Per-item visual severity for Food Log rows (amber vs red). */
export function itemFlagSeverity(
  index: number,
  item: FoodItem,
  issues: MealIssue[],
  flaggedIndices: Set<number>,
): 'warning' | 'critical' | null {
  if (!flaggedIndices.has(index) && !item.rule_conflict) return null;
  if (item.rule_severity === 'critical') return 'critical';
  for (const issue of issues) {
    const names = issue.itemNames ?? [];
    if (!names.some((n) => namesMatchItem(n, item))) continue;
    if (issue.severity === 'critical') return 'critical';
  }
  return 'warning';
}

export function issueModalBody(issues: MealIssue[]): string {
  return issues
    .slice(0, 3)
    .map((i) => i.message)
    .join('\n');
}
