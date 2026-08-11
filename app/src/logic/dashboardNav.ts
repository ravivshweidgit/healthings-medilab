/**
 * Dashboard Help navigation targets (prompt109).
 * Gemini may only emit ids from this enum; unknown ids are dropped.
 */

import { aiChatTitle } from '../i18n/aiChatCopy';
import { getActivityLogUiCopy } from '../i18n/activityLogUiCopy';
import { getAppearanceCopy } from '../i18n/appearanceCopy';
import { getLabResultsStripCopy } from '../i18n/labResultsStripCopy';
import { getMetabolicStripCopy } from '../i18n/metabolicStripCopy';
import { getNutritionSessionsStripCopy } from '../i18n/nutritionSessionsStripCopy';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';

const FOOD_LOG_TITLE: Record<string, string> = {
  en: 'FOOD LOG',
  he: 'יומן ארוחות',
  es: 'DIARIO DE COMIDAS',
  fr: 'JOURNAL DES REPAS',
  de: 'ESSENSTAGEBUCH',
  ar: 'سجل الوجبات',
  ru: 'ДНЕВНИК ПИТАНИЯ',
  pt: 'DIÁRIO ALIMENTAR',
  it: 'DIARIO PASTI',
  tr: 'YEMEK GÜNLÜĞÜ',
};

export const DASH_NAV_TARGETS = [
  'data-sharing',
  'food-log',
  'activity-log',
  'glucose-chart',
  'trend-energy',
  'lab-results',
  'nutritionist-sessions',
  'rules',
  'macros',
  'gear',
  'mentors',
  'reports',
  'app-backup',
  'account',
  'ai-chat',
  'profile',
  'targets',
  'units',
  'language',
  'appearance',
] as const;

export type DashNavTarget = (typeof DASH_NAV_TARGETS)[number];

const TARGET_SET = new Set<string>(DASH_NAV_TARGETS);

export function isDashNavTarget(raw: string): raw is DashNavTarget {
  return TARGET_SET.has(raw);
}

/** Nested under Profile & Settings — expand the parent card first. */
export function dashNavNeedsSettingsCard(t: DashNavTarget): boolean {
  return (
    t === 'data-sharing' ||
    t === 'rules' ||
    t === 'macros' ||
    t === 'gear' ||
    t === 'mentors' ||
    t === 'reports' ||
    t === 'app-backup' ||
    t === 'account' ||
    t === 'profile' ||
    t === 'targets' ||
    t === 'units' ||
    t === 'language' ||
    t === 'appearance'
  );
}

export function dashNavLabel(target: DashNavTarget, langCode?: string | null): string {
  const p = getProfileSettingsStripCopy(langCode);
  const m = getMetabolicStripCopy(langCode);
  switch (target) {
    case 'data-sharing':
      return p.dataSharing;
    case 'food-log':
      return FOOD_LOG_TITLE[(langCode || 'en').slice(0, 2)] ?? FOOD_LOG_TITLE.en!;
    case 'activity-log':
      return getActivityLogUiCopy(langCode).title;
    case 'glucose-chart':
      return m.glucoseTitle;
    case 'trend-energy':
      return m.trendTitle;
    case 'lab-results':
      return getLabResultsStripCopy(langCode).title;
    case 'nutritionist-sessions':
      return getNutritionSessionsStripCopy(langCode).title;
    case 'rules':
      return p.myRules;
    case 'macros':
      return p.myMacros;
    case 'gear':
      return p.gear;
    case 'mentors':
      return p.myMentors;
    case 'reports':
      return p.reports;
    case 'app-backup':
      return p.appBackup;
    case 'account':
      return p.account;
    case 'ai-chat':
      return aiChatTitle(langCode);
    case 'profile':
      return p.myProfile;
    case 'targets':
      return p.myTargets;
    case 'units':
      return p.units;
    case 'language':
      return p.language;
    case 'appearance':
      return getAppearanceCopy(langCode).title;
    default:
      return target;
  }
}

export type HelpNavResult = {
  text: string;
  targets: DashNavTarget[];
};

/**
 * Split a trailing `TARGETS: a,b` envelope line. Routing only — not clinical parsing.
 */
export function splitHelpTargets(raw: string): HelpNavResult {
  const lines = String(raw || '').replace(/\s+$/, '').split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i]!.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^TARGETS:\s*(.*)$/i);
    if (!m) break;
    const seen = new Set<DashNavTarget>();
    const targets: DashNavTarget[] = [];
    for (const part of m[1]!.split(/[,;\s]+/)) {
      const id = part.trim().toLowerCase();
      if (!isDashNavTarget(id) || seen.has(id)) continue;
      seen.add(id);
      targets.push(id);
      if (targets.length >= 3) break;
    }
    const text = [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n').trim();
    return { text, targets };
  }
  return { text: String(raw || '').trim(), targets: [] };
}

export const DASH_NAV_TARGET_LIST = DASH_NAV_TARGETS.join(', ');
