/**
 * Date/time formatting for coach language (userLanguage).
 * Uses Intl with stable BCP-47 tags for the 7 supported locales.
 */

const LOCALE_BY_CODE: Record<string, string> = {
  en: 'en-US',
  he: 'he-IL',
  es: 'es',
  fr: 'fr-FR',
  de: 'de-DE',
  ar: 'ar',
  ru: 'ru-RU',
  pt: 'pt-BR',
  it: 'it-IT',
  tr: 'tr-TR',
};

const TODAY_LABEL: Record<string, string> = {
  en: 'Today',
  he: 'היום',
  es: 'Hoy',
  fr: "Aujourd'hui",
  de: 'Heute',
  ar: 'اليوم',
  ru: 'Сегодня',
  pt: 'Hoje',
  it: 'Oggi',
  tr: 'Bugün',
};

export function dateLocaleTag(langCode?: string | null): string {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return LOCALE_BY_CODE[c] ?? LOCALE_BY_CODE.en;
}

function toDate(value: Date | number | string): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? new Date(value) : null;
  }
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t) : null;
}

export function formatLocalizedDate(
  value: Date | number | string,
  langCode: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  if (!d) return typeof value === 'string' ? value.slice(0, 10) : '';
  return d.toLocaleDateString(dateLocaleTag(langCode), options);
}

export function formatLocalizedDateTime(
  value: Date | number | string,
  langCode: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  if (!d) return typeof value === 'string' ? value.slice(0, 10) : '';
  return d.toLocaleString(dateLocaleTag(langCode), options);
}

export function formatLocalizedTime(
  value: Date | number | string,
  langCode: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
): string {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleTimeString(dateLocaleTag(langCode), options);
}

/** Food Log navigator / collapsed subtitle: "Today - Wed, Jul 22" in coach language. */
export function formatFoodLogDayLabel(
  ms: number,
  langCode: string | null | undefined,
  opts: { todayDayKey: string; dayKey: string },
): string {
  const code = (langCode || 'en').toLowerCase().slice(0, 2);
  const datePart = formatLocalizedDate(ms, langCode, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  if (opts.dayKey !== opts.todayDayKey) return datePart;
  const today = TODAY_LABEL[code] ?? TODAY_LABEL.en;
  return `${today} - ${datePart}`;
}

/** Short draw/session date: 22 Jul 2026 */
export function formatShortDate(
  value: Date | number | string,
  langCode?: string | null,
): string {
  return formatLocalizedDate(value, langCode, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Chart axis: weekday + day, or month + day for longer windows. */
export function formatAxisDayLabel(
  dayKey: string,
  langCode: string | null | undefined,
  windowDays: number,
): string {
  const parts = dayKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return dayKey;
  const [y, mo, da] = parts;
  const d = new Date(y, mo - 1, da);
  if (windowDays <= 8) {
    return formatLocalizedDate(d, langCode, { weekday: 'short', day: 'numeric' });
  }
  return formatLocalizedDate(d, langCode, { month: 'short', day: 'numeric' });
}
