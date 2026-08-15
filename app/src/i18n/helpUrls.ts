/**
 * Help URLs by app locale (prompt81).
 * Canonical: https://healthings.ai/{locale}/help/{slug}.html
 * Legacy /help/{slug}.html redirects to /en/help/ on the site.
 */

const HELP_ORIGIN = 'https://healthings.ai';

export type HelpSlug =
  | 'quick-start-welcome'
  | 'quick-start-units'
  | 'quick-start-profile'
  | 'quick-start-language'
  | 'mentor-voice-gender'
  | 'withings-scale'
  | 'quick-start-watch'
  | 'cgm'
  | 'withings-link'
  | 'starting-weight'
  | 'phone-health-activity'
  | 'reports-import'
  | 'targets-help'
  | 'meal-logging'
  | 'manual-body';

export const HELP_LOCALES = ['en', 'he', 'es', 'fr', 'de', 'ar', 'ru', 'pt', 'it', 'tr'] as const;
export type HelpLocale = (typeof HELP_LOCALES)[number];

const HELP_LOCALE_SET = new Set<string>(HELP_LOCALES);

export function helpLocale(code: string): HelpLocale {
  const c = (code || 'en').toLowerCase().slice(0, 2);
  return HELP_LOCALE_SET.has(c) ? (c as HelpLocale) : 'en';
}

export function helpUrl(langCode: string, slug: HelpSlug): string {
  const loc = helpLocale(langCode);
  return `${HELP_ORIGIN}/${loc}/help/${slug}.html`;
}

/** Example plates pages ship EN + HE only; other app locales open English. */
export function platesUrl(langCode: string, collection = 'lipid-protocol'): string {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  const loc = c === 'he' ? 'he' : 'en';
  return `${HELP_ORIGIN}/${loc}/plates/${collection}.html`;
}
