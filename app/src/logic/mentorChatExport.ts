/**
 * Mentor chat export — plain text + HTML (RTL-aware for Hebrew).
 */

import type { ChatMessage, CoachMessage, Gender, MentorType, UserLanguage } from '../services/TargetService';
import { MENTOR_CHAT_TAB_ORDER } from '../services/TargetService';
import { normalizeMentorChatText, buildMentorDisplaySegments, parseMentorReplySegments } from './mentorChatText';
import { chatMentorSenderLabel, mentorPossessiveLabel, mentorsCollectiveLabel } from './mentorLabels';

function isRtl(lang?: UserLanguage | null): boolean {
  return lang?.code === 'he' || lang?.code === 'ar';
}

function formatTime(iso: string, lang?: UserLanguage | null): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const locale = lang?.code === 'he' ? 'he-IL' : lang?.code === 'ar' ? 'ar' : undefined;
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function exportUi(
  lang?: UserLanguage | null,
  mentors: MentorType[] = [],
  mentorGender?: Gender | null,
) {
  const mentorLabel = chatMentorSenderLabel(mentors, lang, mentorGender);
  const collective = mentorsCollectiveLabel(lang, mentorGender);
  if (lang?.code === 'he') {
    return {
      pageTitle: `${collective} — Healthings Medilab`,
      title: `Healthings Medilab — ${collective}`,
      dateLabel: 'תאריך',
      exportedLabel: 'יוצא',
      youLabel: 'אני',
      mentorLabel,
      actionSection: `משימות — ${collective}`,
      chatSection: 'שיחה',
      noItems: '(אין משימות)',
      noCoach: '(אין הודעת מנטור פעילה)',
      noChat: '(אין הודעות)',
    };
  }
  if (lang?.code === 'ar') {
    return {
      pageTitle: `${collective} — Healthings Medilab`,
      title: `Healthings Medilab — ${collective}`,
      dateLabel: 'التاريخ',
      exportedLabel: 'تاريخ التصدير',
      youLabel: 'أنا',
      mentorLabel,
      actionSection: `مهام — ${collective}`,
      chatSection: 'المحادثة',
      noItems: '(لا مهام)',
      noCoach: '(لا رسالة مرشد نشطة)',
      noChat: '(لا رسائل)',
    };
  }
  return {
    pageTitle: `${collective} — Healthings Medilab`,
    title: `Healthings Medilab — ${collective}`,
    dateLabel: 'Date',
    exportedLabel: 'Exported',
    youLabel: 'Me',
    mentorLabel,
    actionSection: `Tasks — ${collective}`,
    chatSection: 'Chat',
    noItems: '(no action items)',
    noCoach: '(no active mentor message)',
    noChat: '(no messages)',
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineHtmlFromText(text: string): string {
  const normalized = normalizeMentorChatText(text);
  const escaped = escapeHtml(normalized);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>\n');
}

function mentorReplyHtml(
  text: string,
  lang?: UserLanguage | null,
  mentorGender?: Gender | null,
  mentorLines?: CoachMessage['mentorLines'],
  activeMentors: MentorType[] = [],
): string {
  const segments =
    mentorLines && activeMentors.length >= 2
      ? buildMentorDisplaySegments(text, mentorLines, activeMentors)
      : parseMentorReplySegments(text);
  if (segments.length <= 1 && !segments[0]?.mentor) {
    return `<div class="body" dir="auto">${inlineHtmlFromText(text)}</div>`;
  }
  return segments
    .map((seg) => {
      if (!seg.mentor) {
        return `<div class="body intro" dir="auto">${inlineHtmlFromText(seg.text)}</div>`;
      }
      const label = mentorPossessiveLabel(seg.mentor, lang, mentorGender);
      return `<div class="mentor-segment">
  <div class="mentor-segment-label">${escapeHtml(`${seg.emoji ?? ''} ${label}`.trim())}</div>
  <div class="body" dir="auto">${inlineHtmlFromText(seg.text)}</div>
</div>`;
    })
    .join('\n');
}

function formatActionItems(coachMsg: CoachMessage, lang?: UserLanguage | null, mentors: MentorType[] = [], mentorGender?: Gender | null): string[] {
  const lines: string[] = [];
  lines.push(coachMsg.text.trim());
  lines.push('');
  const ui = exportUi(lang, mentors, mentorGender);
  if (coachMsg.actionItems.length === 0) {
    lines.push(ui.noItems);
    return lines;
  }
  for (const item of coachMsg.actionItems) {
    const mark = item.done ? '☑' : '☐';
    lines.push(`${mark} ${item.text}`);
  }
  return lines;
}

function formatChatHistoryForMentor(
  mentor: MentorType,
  history: ChatMessage[],
  lang?: UserLanguage | null,
  mentorGender?: Gender | null,
): string[] {
  if (history.length === 0) return [];
  const label = mentorPossessiveLabel(mentor, lang, mentorGender);
  const ui = exportUi(lang, [mentor], mentorGender);
  return history.map((m) => {
    const who = m.role === 'user' ? ui.youLabel : label;
    const time = formatTime(m.sentAt, lang);
    return `[${time}] ${who}: ${normalizeMentorChatText(m.text)}`;
  });
}

function formatAllChatHistories(
  historyByMentor: Partial<Record<MentorType, ChatMessage[]>>,
  mentors: MentorType[],
  lang?: UserLanguage | null,
  mentorGender?: Gender | null,
): string[] {
  const ui = exportUi(lang, mentors, mentorGender);
  const lines: string[] = [];
  let any = false;
  for (const mentor of MENTOR_CHAT_TAB_ORDER) {
    if (!mentors.includes(mentor)) continue;
    const history = historyByMentor[mentor] ?? [];
    if (history.length === 0) continue;
    any = true;
    lines.push(`--- ${mentorPossessiveLabel(mentor, lang, mentorGender)} ---`);
    lines.push(...formatChatHistoryForMentor(mentor, history, lang, mentorGender));
    lines.push('');
  }
  if (!any) lines.push(ui.noChat);
  return lines;
}

export function formatMentorChatExport(params: {
  dayKey: string;
  mentors: MentorType[];
  coachMsg: CoachMessage | null;
  historyByMentor: Partial<Record<MentorType, ChatMessage[]>>;
  lang?: UserLanguage | null;
  mentorGender?: Gender | null;
}): string {
  const { dayKey, mentors, coachMsg, historyByMentor, lang, mentorGender } = params;
  const ui = exportUi(lang, mentors, mentorGender);
  const exportedAt = new Date().toISOString();

  const blocks: string[] = [
    ui.title,
    `${ui.dateLabel}: ${dayKey}`,
    `${ui.exportedLabel}: ${exportedAt}`,
    '',
  ];

  blocks.push(`=== ${ui.actionSection.toUpperCase()} ===`);
  if (coachMsg) {
    blocks.push(...formatActionItems(coachMsg, lang, mentors, mentorGender));
  } else {
    blocks.push(ui.noCoach);
  }

  blocks.push('');
  blocks.push(`=== ${ui.chatSection.toUpperCase()} ===`);
  blocks.push(...formatAllChatHistories(historyByMentor, mentors, lang, mentorGender));

  return blocks.join('\n');
}

export function formatMentorChatExportHtml(params: {
  dayKey: string;
  mentors: MentorType[];
  coachMsg: CoachMessage | null;
  historyByMentor: Partial<Record<MentorType, ChatMessage[]>>;
  lang?: UserLanguage | null;
  mentorGender?: Gender | null;
}): string {
  const { dayKey, mentors, coachMsg, historyByMentor, lang, mentorGender } = params;
  const rtl = isRtl(lang);
  const dir = rtl ? 'rtl' : 'ltr';
  const htmlLang = lang?.code ?? 'en';
  const ui = exportUi(lang, mentors, mentorGender);
  const exportedAt = new Date().toISOString();

  let actionCoachHtml = `<p class="muted">${escapeHtml(ui.noCoach)}</p>`;
  let actionListHtml = '';

  if (coachMsg) {
    actionCoachHtml = `<div class="coach-text">${mentorReplyHtml(coachMsg.text, lang, mentorGender, coachMsg.mentorLines, mentors)}</div>`;
    if (coachMsg.actionItems.length === 0) {
      actionListHtml = `<p class="muted">${escapeHtml(ui.noItems)}</p>`;
    } else {
      const items = coachMsg.actionItems
        .map((item) => {
          const mark = item.done ? '☑' : '☐';
          const cls = item.done ? 'done' : '';
          return `<li class="${cls}"><span class="check">${mark}</span> ${escapeHtml(item.text)}</li>`;
        })
        .join('\n');
      actionListHtml = `<ul class="action-list">${items}</ul>`;
    }
  }

  const chatSections: string[] = [];
  let anyChat = false;
  for (const mentor of MENTOR_CHAT_TAB_ORDER) {
    if (!mentors.includes(mentor)) continue;
    const history = historyByMentor[mentor] ?? [];
    if (history.length === 0) continue;
    anyChat = true;
    const sectionLabel = mentorPossessiveLabel(mentor, lang, mentorGender);
    const bubbles = history
      .map((m) => {
        const isUser = m.role === 'user';
        const who = isUser ? ui.youLabel : sectionLabel;
        const time = formatTime(m.sentAt, lang);
        const bubbleClass = isUser ? 'bubble user' : 'bubble mentor';
        const bodyHtml = isUser
          ? `<div class="body" dir="auto">${inlineHtmlFromText(m.text)}</div>`
          : `<div class="body" dir="auto">${inlineHtmlFromText(m.text)}</div>`;
        return `<article class="${bubbleClass}">
  <header><time>${escapeHtml(time)}</time>${isUser ? ` · <strong>${escapeHtml(who)}</strong>` : ''}</header>
  ${bodyHtml}
</article>`;
      })
      .join('\n');
    chatSections.push(`<section class="mentor-chat-section"><h3>${escapeHtml(sectionLabel)}</h3>${bubbles}</section>`);
  }
  const chatHtml = anyChat ? chatSections.join('\n') : `<p class="muted">${escapeHtml(ui.noChat)}</p>`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(htmlLang)}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(ui.pageTitle)}</title>
  <style>
    :root { color-scheme: light; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Hebrew", Arial, sans-serif;
      line-height: 1.55;
      margin: 0;
      padding: 20px;
      background: #f6f8fa;
      color: #1a1a1a;
    }
    .wrap { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 1.25rem; margin: 0 0 12px; }
    .meta { color: #555; font-size: 0.92rem; margin-bottom: 20px; }
    section {
      background: #fff;
      border: 1px solid #dde3ea;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }
    h2 { font-size: 1.05rem; margin: 0 0 12px; }
    .coach-text { margin-bottom: 12px; }
    .action-list { list-style: none; padding: 0; margin: 0; }
    .action-list li { padding: 6px 0; border-bottom: 1px solid #eef2f6; }
    .action-list li:last-child { border-bottom: 0; }
    .action-list .done { color: #666; text-decoration: line-through; }
    .check { font-size: 1.1em; margin-inline-end: 6px; }
    .bubble {
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }
    .bubble header { font-size: 0.82rem; color: #666; margin-bottom: 6px; }
    .bubble.user { background: #e8f4fd; border: 1px solid #c9e2f5; }
    .bubble.mentor { background: #f3f6f9; border: 1px solid #dde3ea; }
    .body { white-space: normal; word-wrap: break-word; }
    .body.intro { margin-bottom: 8px; }
    .mentor-segment { margin-top: 10px; }
    .mentor-segment-label { font-size: 0.88rem; font-weight: 700; color: #2E7D5A; margin-bottom: 4px; }
    .muted { color: #777; font-style: italic; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(ui.pageTitle)}</h1>
    <div class="meta">
      <div>${escapeHtml(ui.dateLabel)}: ${escapeHtml(dayKey)}</div>
      <div>${escapeHtml(ui.exportedLabel)}: ${escapeHtml(exportedAt)}</div>
    </div>
    <section>
      <h2>${escapeHtml(ui.actionSection)}</h2>
      ${actionCoachHtml}
      ${actionListHtml}
    </section>
    <section>
      <h2>${escapeHtml(ui.chatSection)}</h2>
      ${chatHtml}
    </section>
  </div>
</body>
</html>`;
}
