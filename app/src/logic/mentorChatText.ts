/**
 * Clean mentor chat / coach reply text for display and export.
 */

import type { MentorType } from '../services/TargetService';

/** Strip leaked JSON section markers and trim. */
export function normalizeMentorChatText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\*\*text\*\*\s*/gi, '')
    .replace(/\*\*actionItems\*\*\s*/gi, '')
    .replace(/^\*\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();
}

function stripLeadingMentorEmoji(text: string): string {
  return text.replace(/^[🩺🥗💪]\s*/, '').trim();
}

function normalizeMentorKey(key: string): MentorType | null {
  const k = key.toLowerCase().replace(/[^a-z]/g, '');
  if (k === 'doctor') return 'doctor';
  if (k === 'nutritionist') return 'nutritionist';
  if (k === 'coach') return 'coach';
  return null;
}

const EMOJI_TO_MENTOR: Record<string, MentorType> = {
  '🩺': 'doctor',
  '🥗': 'nutritionist',
  '💪': 'coach',
};

export type MentorReplySegment = {
  mentor: MentorType | null;
  emoji: string | null;
  text: string;
};

/** Split a combined mentor reply into per-mentor segments (🩺 / 🥗 / 💪 lines). */
export function parseMentorReplySegments(text: string): MentorReplySegment[] {
  const normalized = normalizeMentorChatText(text);
  if (!normalized) return [];

  const hasMentorHeaders = /[🩺🥗💪]/.test(normalized);
  if (!hasMentorHeaders) {
    return [{ mentor: null, emoji: null, text: normalized }];
  }

  const parts = normalized.split(/(?=[🩺🥗💪])/).map((p) => p.trim()).filter(Boolean);
  const segments: MentorReplySegment[] = [];

  for (const part of parts) {
    const match = part.match(/^([🩺🥗💪])\s*/);
    if (!match) {
      segments.push({ mentor: null, emoji: null, text: part });
      continue;
    }
    const emoji = match[1]!;
    segments.push({
      mentor: EMOJI_TO_MENTOR[emoji] ?? null,
      emoji,
      text: part.slice(match[0].length).trim(),
    });
  }

  return segments.filter((s) => s.text.length > 0);
}

/** True when reply has at least one per-mentor emoji segment. */
export function hasMentorVoiceSegments(text: string): boolean {
  return parseMentorReplySegments(text).some((s) => s.mentor != null);
}

const MENTOR_EMOJI: Record<MentorType, string> = {
  doctor: '🩺',
  nutritionist: '🥗',
  coach: '💪',
};

/** Display order for combined multi-mentor replies. */
export const MENTOR_DISPLAY_ORDER: MentorType[] = ['nutritionist', 'coach', 'doctor'];

export type MentorLines = Partial<Record<MentorType, string>>;

/** Build display text with emoji headers from structured per-mentor lines. */
export function combineMentorLines(lines: MentorLines, activeMentors: MentorType[]): string {
  return MENTOR_DISPLAY_ORDER.filter((m) => activeMentors.includes(m))
    .map((m) => {
      const t = lines[m]?.trim();
      return t ? `${MENTOR_EMOJI[m]} ${t}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

/** Resolve coach/chat body from mentorLines object or legacy text field. */
export function resolveMentorReplyText(
  mentorLines: MentorLines | null | undefined,
  text: string | null | undefined,
  activeMentors: MentorType[],
): string {
  if (mentorLines && typeof mentorLines === 'object') {
    const combined = combineMentorLines(mentorLines, activeMentors);
    if (combined) return combined;
  }
  return normalizeMentorChatText(String(text ?? ''));
}

/** Pull mentorLines from common JSON shapes the model may return. */
export function extractMentorLinesFromParsed(
  parsed: Record<string, unknown>,
  activeMentors: MentorType[],
): MentorLines | null {
  const lines: MentorLines = {};

  const absorb = (obj: Record<string, unknown> | null | undefined) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    for (const [key, val] of Object.entries(obj)) {
      const mentor = normalizeMentorKey(key);
      if (mentor && activeMentors.includes(mentor) && typeof val === 'string' && val.trim()) {
        lines[mentor] = stripLeadingMentorEmoji(val.trim());
      }
    }
  };

  absorb(parsed.mentorLines as Record<string, unknown>);
  if (parsed.text && typeof parsed.text === 'object' && !Array.isArray(parsed.text)) {
    absorb(parsed.text as Record<string, unknown>);
  }
  for (const m of activeMentors) {
    const v = parsed[m];
    if (typeof v === 'string' && v.trim()) {
      lines[m] = stripLeadingMentorEmoji(v.trim());
    }
  }

  const count = activeMentors.filter((m) => lines[m]?.trim()).length;
  return count > 0 ? lines : null;
}

/** Segments for UI — prefer stored mentorLines, else emoji markers in text. */
export function buildMentorDisplaySegments(
  text: string,
  mentorLines: MentorLines | null | undefined,
  activeMentors: MentorType[],
): MentorReplySegment[] {
  if (mentorLines && activeMentors.length >= 2) {
    const fromLines = MENTOR_DISPLAY_ORDER.filter((m) => activeMentors.includes(m))
      .map((m) => {
        const t = mentorLines[m]?.trim();
        if (!t) return null;
        return { mentor: m, emoji: MENTOR_EMOJI[m], text: stripLeadingMentorEmoji(t) };
      })
      .filter((s): s is MentorReplySegment => s != null && s.text.length > 0);
    if (fromLines.length >= 2) return fromLines;
  }

  return parseMentorReplySegments(text);
}

/** True when 2+ mentors should render as separate cards. */
export function hasSeparateMentorVoices(
  text: string,
  mentorLines: MentorLines | null | undefined,
  activeMentors: MentorType[],
): boolean {
  if (activeMentors.length < 2) return false;
  if (mentorLines) {
    const n = activeMentors.filter((m) => mentorLines[m]?.trim()).length;
    if (n >= 2) return true;
  }
  return hasMentorVoiceSegments(text);
}

/** Parse free-chat reply — JSON mentorLines when multiple mentors, else plain prose. */
export function parseChatMentorReply(raw: string, activeMentors: MentorType[]): string {
  const trimmed = raw.trim();
  if (activeMentors.length < 2) {
    return normalizeMentorChatText(trimmed);
  }

  const stripped = trimmed.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = stripped.indexOf('{');
  if (start !== -1) {
    const end = stripped.lastIndexOf('}');
    if (end > start) {
      try {
        const parsed = JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
        const mentorLines = extractMentorLinesFromParsed(parsed, activeMentors);
        const textField = typeof parsed.text === 'string' ? parsed.text : undefined;
        return resolveMentorReplyText(mentorLines ?? undefined, textField, activeMentors);
      } catch {
        /* fall through to emoji / plain text */
      }
    }
  }

  return normalizeMentorChatText(trimmed);
}

export function mentorBubbleColors(mentor: MentorType | null): { backgroundColor: string; borderColor: string } {
  if (mentor === 'nutritionist') return { backgroundColor: '#EEF7EE', borderColor: '#A5D6A7' };
  if (mentor === 'coach') return { backgroundColor: '#EEF4FC', borderColor: '#90CAF9' };
  if (mentor === 'doctor') return { backgroundColor: '#FCEEF0', borderColor: '#EF9A9A' };
  return { backgroundColor: '#F3F6F9', borderColor: '#DDE3EA' };
}
