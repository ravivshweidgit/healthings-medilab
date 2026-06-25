/**
 * Shared My Rules text — same source as mentor coach/chat USER DATA header.
 */

import type { UserRules } from '../services/TargetService';

/** Lines injected into coach panel and chat (matches RulesStrip / GeminiService). */
export function formatUserRulesLines(rules: UserRules): string[] {
  const lines: string[] = [];
  lines.push(
    rules.summary
      ? `My Rules — AI understood (${rules.summary}):`
      : 'My Rules — AI understood:',
  );
  const ctx = rules.aiContext?.trim();
  if (ctx && !/קטוגנ|ketogenic|\bketo\b/i.test(ctx)) {
    lines.push(`Goals: ${ctx}`);
  }
  if (rules.constraints.length > 0) {
    lines.push(...rules.constraints.map((c) => `- ${c}`));
    if (rules.rawText?.trim()) {
      lines.push(`- Original: ${rules.rawText.trim().replace(/"/g, "'")}`);
    }
    return lines;
  }
  const raw = rules.rawText?.trim();
  if (raw) lines.push(`- ${raw.replace(/"/g, "'")}`);
  return lines;
}

export function formatUserRulesBlock(rules: UserRules): string {
  return formatUserRulesLines(rules).join('\n');
}

/** Macro revision — verbatim user text is authoritative; AI summary is secondary. */
export function formatMacroRevisionRulesBlock(rules: UserRules): string {
  const parts: string[] = ['=== MY RULES (verbatim — HARD constraints; numeric mins/maxes here win) ==='];
  const raw = rules.rawText?.trim();
  if (raw) parts.push(raw);
  else parts.push('(empty)');
  parts.push('', '=== AI summary (secondary — do not drop verbatim numbers above) ===');
  if (rules.summary) parts.push(`Summary: ${rules.summary}`);
  const ctx = rules.aiContext?.trim();
  if (ctx && !/קטוגנ|ketogenic|\bketo\b/i.test(ctx)) {
    parts.push(`Goals: ${ctx}`);
  }
  for (const c of rules.constraints ?? []) parts.push(`- ${c}`);
  return parts.join('\n');
}
