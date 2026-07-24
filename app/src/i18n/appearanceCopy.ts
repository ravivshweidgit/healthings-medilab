/**
 * APPEARANCE (theme) picker copy — app locale (prompt96 Phase 4).
 *
 * Self-contained: unlike the other Profile strips, the title lives here rather than in
 * `profileSettingsStripCopy` so the whole feature reads from one file.
 *
 * Glossary: option labels are plain adjectives (Light / Dark), no product phrasing.
 * "System" means "follow the phone" — spelled out in `hint` rather than crammed into
 * the chip label, which has to stay short next to Light and Dark.
 */

export type AppearanceCopy = {
  /** Collapsible strip title — one word, uppercase like the sibling strips. */
  title: string;
  /** Chip row label. */
  theme: string;
  system: string;
  light: string;
  dark: string;
  hint: string;
};

const EN: AppearanceCopy = {
  title: 'APPEARANCE',
  theme: 'Theme',
  system: 'System',
  light: 'Light',
  dark: 'Dark',
  hint: '“System” follows your phone setting.',
};

const HE: AppearanceCopy = {
  title: 'מראה',
  theme: 'ערכת נושא',
  system: 'מערכת',
  light: 'בהיר',
  dark: 'כהה',
  hint: '״מערכת״ עוקב אחרי הגדרת הטלפון.',
};

const ES: AppearanceCopy = {
  title: 'APARIENCIA',
  theme: 'Tema',
  system: 'Sistema',
  light: 'Claro',
  dark: 'Oscuro',
  hint: '«Sistema» sigue la configuración de tu teléfono.',
};

const FR: AppearanceCopy = {
  title: 'APPARENCE',
  theme: 'Thème',
  system: 'Système',
  light: 'Clair',
  dark: 'Sombre',
  hint: '« Système » suit le réglage de votre téléphone.',
};

const DE: AppearanceCopy = {
  title: 'DARSTELLUNG',
  theme: 'Design',
  system: 'System',
  light: 'Hell',
  dark: 'Dunkel',
  hint: '„System“ folgt der Einstellung deines Telefons.',
};

const AR: AppearanceCopy = {
  title: 'المظهر',
  theme: 'المظهر',
  system: 'النظام',
  light: 'فاتح',
  dark: 'داكن',
  hint: '«النظام» يتبع إعداد هاتفك.',
};

const RU: AppearanceCopy = {
  title: 'ОФОРМЛЕНИЕ',
  theme: 'Тема',
  system: 'Система',
  light: 'Светлая',
  dark: 'Тёмная',
  hint: '«Система» следует настройке телефона.',
};

const PT: AppearanceCopy = {
  title: 'APARÊNCIA',
  theme: 'Tema',
  system: 'Sistema',
  light: 'Claro',
  dark: 'Escuro',
  hint: '«Sistema» segue a configuração do seu telefone.',
};

const IT: AppearanceCopy = {
  title: 'ASPETTO',
  theme: 'Tema',
  system: 'Sistema',
  light: 'Chiaro',
  dark: 'Scuro',
  hint: '«Sistema» segue l’impostazione del telefono.',
};

const TR: AppearanceCopy = {
  title: 'GÖRÜNÜM',
  theme: 'Tema',
  system: 'Sistem',
  light: 'Açık',
  dark: 'Koyu',
  hint: '“Sistem” telefonunuzun ayarını izler.',
};

export function getAppearanceCopy(langCode?: string | null): AppearanceCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  if (c === 'he') return HE;
  if (c === 'es') return ES;
  if (c === 'fr') return FR;
  if (c === 'de') return DE;
  if (c === 'ar') return AR;
  if (c === 'ru') return RU;
  if (c === 'pt') return PT;
  if (c === 'it') return IT;
  if (c === 'tr') return TR;
  return EN;
}
