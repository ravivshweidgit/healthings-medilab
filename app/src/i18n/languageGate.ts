/**
 * First-run language gate (prompt81) — multilingual “Select language” + flags.
 * Flags are representative language affordances (not nationality claims).
 */

export type LanguageGateOption = {
  code: string;
  /** Regional indicator / flag emoji — functional, not decorative clutter */
  flag: string;
  /** “Select language” in this locale (hero stack — black ink in UI) */
  selectLanguage: string;
  /** Native endonym under the flag */
  nativeLabel: string;
  /** Always-English gloss for a11y */
  englishLabel: string;
};

export const LANGUAGE_GATE_OPTIONS: LanguageGateOption[] = [
  {
    code: 'en',
    flag: '🇬🇧',
    selectLanguage: 'Select language',
    nativeLabel: 'English',
    englishLabel: 'English',
  },
  {
    code: 'de',
    flag: '🇩🇪',
    selectLanguage: 'Sprache wählen',
    nativeLabel: 'Deutsch',
    englishLabel: 'German',
  },
  {
    code: 'es',
    flag: '🇪🇸',
    selectLanguage: 'Elige idioma',
    nativeLabel: 'Español',
    englishLabel: 'Spanish',
  },
  {
    code: 'fr',
    flag: '🇫🇷',
    selectLanguage: 'Choisir la langue',
    nativeLabel: 'Français',
    englishLabel: 'French',
  },
  {
    code: 'he',
    flag: '🇮🇱',
    selectLanguage: 'בחרו שפה',
    nativeLabel: 'עברית',
    englishLabel: 'Hebrew',
  },
  {
    code: 'ar',
    flag: '🇸🇦',
    selectLanguage: 'اختر اللغة',
    nativeLabel: 'العربية',
    englishLabel: 'Arabic',
  },
  {
    code: 'ru',
    flag: '🇷🇺',
    selectLanguage: 'Выберите язык',
    nativeLabel: 'Русский',
    englishLabel: 'Russian',
  },
];

export function languageGateOption(code: string): LanguageGateOption {
  return LANGUAGE_GATE_OPTIONS.find((o) => o.code === code) ?? LANGUAGE_GATE_OPTIONS[0];
}
