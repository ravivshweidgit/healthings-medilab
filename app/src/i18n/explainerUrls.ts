/**
 * Hosted explainer Watch URLs (prompt107).
 * Canonical: https://healthings.ai/{mediaLocale}/watch/{id}.html
 * mediaLocale = de for German; fr for permission films when FR; else en (EN VO + HE burns).
 */

import { helpLocale } from './helpUrls';

const ORIGIN = 'https://healthings.ai';

export type ExplainerId =
  | 'what-is-healthings'
  | 'phone-health'
  | 'cgm-pipeline'
  | 'gear'
  | 'scale-choice'
  | 'scale-trends'
  | 'meal-entry'
  | 'meal-grams'
  | 'activity-youtube'
  | 'closed-loop';

/** Help strip / catalog order. */
export const EXPLAINER_CATALOG: ExplainerId[] = [
  'what-is-healthings',
  'meal-entry',
  'meal-grams',
  'activity-youtube',
  'gear',
  'scale-choice',
  'scale-trends',
  'phone-health',
  'cgm-pipeline',
  'closed-loop',
];

const FR_SPOKEN: ReadonlySet<ExplainerId> = new Set(['phone-health', 'cgm-pipeline']);

export type ExplainerMediaLocale = 'en' | 'de' | 'fr';

/** Which hosted video file to play for this app language. */
export function explainerMediaLocale(langCode: string, id: ExplainerId): ExplainerMediaLocale {
  const loc = helpLocale(langCode);
  if (loc === 'de') return 'de';
  if (loc === 'fr' && FR_SPOKEN.has(id)) return 'fr';
  return 'en';
}

/** Thin watch page (preferred over raw mp4 for in-app Linking.openURL). */
export function explainerWatchUrl(langCode: string, id: ExplainerId): string {
  const media = explainerMediaLocale(langCode, id);
  return `${ORIGIN}/${media}/watch/${id}.html`;
}

/** Direct mp4 (debug / download). */
export function explainerMp4Url(langCode: string, id: ExplainerId): string {
  const media = explainerMediaLocale(langCode, id);
  return `${ORIGIN}/videos/${media}/${id}.mp4`;
}
