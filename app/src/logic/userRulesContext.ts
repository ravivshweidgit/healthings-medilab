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
5. Do NOT blanket-flag whey. Do NOT use "lacks fish/nuts/olive oil" — only flag the item that brings forbidden fat per the user's actual rules.
6. SEVERITY LADDER (required when flagging):
   - warning = attention / consume in moderation / count toward daily fat or cholesterol totals. Soft lipid goals, one egg, moderate cheese, etc. Prefer wording like "count this toward your fat/cholesterol total" — NEVER "forbidden", "must not eat", or "אסור".
   - critical = hard My Rules ban, allergen-class risk, or explicit absolute prohibition in the user's rules.
7. Quantity + frequency + context matter: one egg with a cholesterol-aware goal is usually warning (or no flag), not critical. Do NOT apply medical X → food Y forbidden shortcuts.
8. rule_message must match THIS line's name + macros. Do not invent a fat % that contradicts name_local or fat_g (never "contains 2% fat" on "0% yogurt" / F0g). If the issue is the wrong product vs My Rules (0% when rules ask for 2%), say that: what this item is, and what the rules ask for.`;

/** Macro revision — verbatim user text only. */
export function formatMacroRevisionRulesBlock(rules: UserRules): string {
  const parts: string[] = ['=== MY RULES (verbatim — HARD constraints; numeric mins/maxes here win) ==='];
  const raw = rules.rawText?.trim();
  if (raw) parts.push(raw);
  else parts.push('(empty)');
  return parts.join('\n');
}
