/**
 * Dashboard AI entry strip — "AI" stays Latin; "chat" follows coach language.
 */

const CHAT_WORD: Record<string, string> = {
  en: 'chat',
  he: 'שיחה',
  es: 'chat',
  fr: 'discussion',
  de: 'Chat',
  ar: 'محادثة',
  ru: 'чат',
  pt: 'chat',
  it: 'chat',
  tr: 'sohbet',
};

export function aiChatTitle(langCode?: string | null): string {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  const chat = CHAT_WORD[c] ?? CHAT_WORD.en;
  return `AI ${chat}`;
}

export function aiChatOpenLabel(
  langCode: string | null | undefined,
  opts?: { actionDone?: number; actionTotal?: number },
): string {
  const title = aiChatTitle(langCode);
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  const { actionDone, actionTotal } = opts ?? {};
  if (
    actionDone != null &&
    actionTotal != null &&
    actionTotal > 0
  ) {
    if (c === 'he') return `פתח ${title}, ${actionDone} מתוך ${actionTotal} משימות`;
    if (c === 'ar') return `افتح ${title}، ${actionDone} من ${actionTotal} مهام`;
    if (c === 'es') return `Abrir ${title}, ${actionDone} de ${actionTotal} acciones`;
    if (c === 'fr') return `Ouvrir ${title}, ${actionDone} sur ${actionTotal} actions`;
    if (c === 'de') return `${title} öffnen, ${actionDone} von ${actionTotal} Aufgaben`;
    if (c === 'ru') return `Открыть ${title}, ${actionDone} из ${actionTotal} задач`;
    if (c === 'pt') return `Abrir ${title}, ${actionDone} de ${actionTotal} ações`;
    if (c === 'it') return `Apri ${title}, ${actionDone} di ${actionTotal} azioni`;
    if (c === 'tr') return `${title} aç, ${actionDone}/${actionTotal} görev`;
    return `Open ${title}, ${actionDone} of ${actionTotal} action items`;
  }
  if (c === 'he') return `פתח ${title} עם המנטורים`;
  if (c === 'ar') return `افتح ${title} مع المرشدين`;
  if (c === 'es') return `Abrir ${title} con tus mentores`;
  if (c === 'fr') return `Ouvrir ${title} avec vos mentors`;
  if (c === 'de') return `${title} mit Mentoren öffnen`;
  if (c === 'ru') return `Открыть ${title} с менторами`;
  if (c === 'pt') return `Abrir ${title} com seus mentores`;
  if (c === 'it') return `Apri ${title} con i tuoi mentor`;
  if (c === 'tr') return `${title} mentorlarınızla açın`;
  return `Open ${title} with your mentors`;
}
