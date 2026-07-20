/**
 * First-run language gate (prompt81) — multilingual “Select language” hero + flags.
 * Flags are representative language affordances (not nationality claims).
 */

export type LanguageGateOption = {
  code: string;
  /** Regional indicator / flag emoji — functional, not decorative clutter */
  flag: string;
  /** “Select language” in this locale — intense rainbow hero line */
  selectLanguage: string;
  /** Vivid rainbow accent (full intensity, never muted) */
  accentColor: string;
  /** Native endonym */
  nativeLabel: string;
  /** Always-English gloss */
  englishLabel: string;
};

export const LANGUAGE_GATE_OPTIONS: LanguageGateOption[] = [
  {
    code: 'en',
    flag: '🇬🇧',
    selectLanguage: 'Select language',
    accentColor: '#FF1744',
    nativeLabel: 'English',
    englishLabel: 'English',
  },
  {
    code: 'de',
    flag: '🇩🇪',
    selectLanguage: 'Sprache wählen',
    accentColor: '#2979FF',
    nativeLabel: 'Deutsch',
    englishLabel: 'German',
  },
  {
    code: 'es',
    flag: '🇪🇸',
    selectLanguage: 'Elige idioma',
    accentColor: '#FFAB00',
    nativeLabel: 'Español',
    englishLabel: 'Spanish',
  },
  {
    code: 'fr',
    flag: '🇫🇷',
    selectLanguage: 'Choisir la langue',
    accentColor: '#00E676',
    nativeLabel: 'Français',
    englishLabel: 'French',
  },
  {
    code: 'he',
    flag: '🇮🇱',
    selectLanguage: 'בחרו שפה',
    accentColor: '#FF6D00',
    nativeLabel: 'עברית',
    englishLabel: 'Hebrew',
  },
  {
    code: 'ar',
    flag: '🇸🇦',
    selectLanguage: 'اختر اللغة',
    accentColor: '#D500F9',
    nativeLabel: 'العربية',
    englishLabel: 'Arabic',
  },
  {
    code: 'ru',
    flag: '🇷🇺',
    selectLanguage: 'Выберите язык',
    accentColor: '#F50057',
    nativeLabel: 'Русский',
    englishLabel: 'Russian',
  },
];

export function languageGateOption(code: string): LanguageGateOption {
  return LANGUAGE_GATE_OPTIONS.find((o) => o.code === code) ?? LANGUAGE_GATE_OPTIONS[0];
}
