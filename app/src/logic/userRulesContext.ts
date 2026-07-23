/**
 * Shared My Rules text — same source as mentor coach/chat USER DATA header.
 * Source of truth: rawText only (prompt52).
 */

import type { UserRules } from '../services/TargetService';

/** Lines injected into coach panel and chat. */
export function formatUserRulesLines(rules: UserRules): string[] {
  const raw = rules.rawText?.trim();
  if (!raw) return [];
  return ['My Rules:', `- ${raw.replace(/"/g, "'")}`];
}

export function formatUserRulesBlock(rules: UserRules): string {
  return formatUserRulesLines(rules).join('\n');
}

/** Injected into Gemini food analyze + save-time rule check — prompt guidance only, not code rules. */
export const MEAL_FAT_RULE_FLAGGING_GUIDANCE = `FAT / CHOLESTEROL — PER-ITEM (Gemini judgment, not keyword matching):
1. Evaluate EVERY meal line independently. Flag only lines that VIOLATE My Rules — never flag because something is missing from the meal.
2. Verbatim MY RULES wins over shortcuts: if rules explicitly allow whey isolate / אבקת חלבון אייזולט / מי גבינה as an exception, do NOT flag it.
3. Understand food identity from name + name_local + macros: plant protein (pea/soy/rice, חלבון מהצומח) is NOT whey; whey/casein (מי גבינה, אייזולט) is dairy — flag only when rules forbid dairy fat without an exception.
4. Plant-fat items (olive oil, nuts, seeds, avocado, pumpkin seeds) and fiber (psyllium) → compliant unless rules say otherwise.
5. Do NOT blanket-flag whey. Do NOT use "lacks fish/nuts/olive oil" — only flag the item that brings forbidden fat per the user's actual rules.`;

/** Macro revision — verbatim user text only. */
export function formatMacroRevisionRulesBlock(rules: UserRules): string {
  const parts: string[] = ['=== MY RULES (verbatim — HARD constraints; numeric mins/maxes here win) ==='];
  const raw = rules.rawText?.trim();
  if (raw) parts.push(raw);
  else parts.push('(empty)');
  return parts.join('\n');
}
