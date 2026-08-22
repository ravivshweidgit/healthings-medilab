/**
 * Slash-command catalog for chat autocomplete (on "/" type).
 * English tokens only — hints localized via hintHe. Menu omitted until prompt40b.
 */

import { detectPeriodReviewQuery } from '../services/ReviewService';
import type { MentorType } from '../services/TargetService';

export type SlashCommandOption = {
  match: string;
  insert: string;
  hintEn: string;
  hintHe: string;
  mentors?: MentorType[];
};

export const CHAT_SLASH_COMMANDS: SlashCommandOption[] = [
  {
    match: '/7',
    insert: '/7 ',
    hintEn: '7-day review (or type /N, 1–128 days)',
    hintHe: 'סקירת 7 ימים · או /N (1–128)',
  },
  {
    match: '/30',
    insert: '/30 ',
    hintEn: '30-day review',
    hintHe: 'סקירת 30 יום',
  },
  {
    match: '/yesterday',
    insert: '/yesterday ',
    hintEn: 'Yesterday only',
    hintHe: 'אתמול בלבד',
  },
];

function isSlashHeadComplete(head: string): boolean {
  if (detectPeriodReviewQuery(head)) return true;
  return false;
}

/** Higher rank = shown first in autocomplete. */
function slashSuggestionRank(
  opt: SlashCommandOption,
  activeMentor: MentorType,
  token: string,
  index: number,
): number {
  let rank = CHAT_SLASH_COMMANDS.length - index;
  const mentorSpecific = opt.mentors?.includes(activeMentor) ?? false;

  if (mentorSpecific) rank += 1000;
  if (token.length > 1 && opt.match.toLowerCase().startsWith(token.toLowerCase())) rank += 500;
  return rank;
}

/** True when user finished the command token and is typing a trailing hint. */
export function isSlashCommandTypingHint(text: string): boolean {
  const t = text.trimStart();
  if (!t.startsWith('/')) return false;
  const spaceIdx = t.indexOf(' ');
  if (spaceIdx === -1) return false;
  const head = t.slice(0, spaceIdx);
  return isSlashHeadComplete(head);
}

export function filterSlashCommandSuggestions(
  text: string,
  activeMentor: MentorType,
  langCode?: string | null,
): Array<SlashCommandOption & { hint: string }> {
  const t = text.trimStart();
  if (!t.startsWith('/') || isSlashCommandTypingHint(text)) return [];

  const spaceIdx = t.indexOf(' ');
  const token = spaceIdx === -1 ? t : t.slice(0, spaceIdx);
  const tokenLower = token.toLowerCase();

  const filtered = CHAT_SLASH_COMMANDS.map((opt, index) => ({ opt, index })).filter(({ opt }) => {
    if (opt.mentors && !opt.mentors.includes(activeMentor)) return false;
    const m = opt.match;
    return (
      m.toLowerCase().startsWith(tokenLower) ||
      tokenLower.startsWith(m.toLowerCase()) ||
      (token.length <= 1 && m.startsWith('/'))
    );
  });

  const he = langCode === 'he';
  return filtered
    .sort(
      (a, b) =>
        slashSuggestionRank(b.opt, activeMentor, token, b.index) -
        slashSuggestionRank(a.opt, activeMentor, token, a.index),
    )
    .map(({ opt }) => ({ ...opt, hint: he ? opt.hintHe : opt.hintEn }));
}
