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
  /** Dashboard visibility — Activity Log strip. */
  activityLog: string;
  activityLogHint: string;
  yes: string;
  no: string;
};

const EN: AppearanceCopy = {
  title: 'APPEARANCE',
  theme: 'Theme',
  system: 'System',
  light: 'Light',
  dark: 'Dark',
  hint: '“System” follows your phone setting.',
  activityLog: 'Activity log on dashboard',
  activityLogHint: 'Hide if you do not log workouts manually.',
  yes: 'Yes',
  no: 'No',
};

const HE: AppearanceCopy = {
  title: 'מראה',
  theme: 'ערכת נושא',
  system: 'מערכת',
  light: 'בהיר',
  dark: 'כהה',
  hint: '״מערכת״ עוקב אחרי הגדרת הטלפון.',
  activityLog: 'יומן פעילות בדשבורד',
  activityLogHint: 'הסתירו אם אינכם מתעדים אימונים ידנית.',
  yes: 'כן',
  no: 'לא',
};

const ES: AppearanceCopy = {
  title: 'APARIENCIA',
  theme: 'Tema',
  system: 'Sistema',
  light: 'Claro',
  dark: 'Oscuro',
  hint: '«Sistema» sigue la configuración de tu teléfono.',
  activityLog: 'Registro de actividad en el panel',
  activityLogHint: 'Oculta si no registras entrenamientos manualmente.',
  yes: 'Sí',
  no: 'No',
};

const FR: AppearanceCopy = {
  title: 'APPARENCE',
  theme: 'Thème',
  system: 'Système',
  light: 'Clair',
  dark: 'Sombre',
  hint: '« Système » suit le réglage de votre téléphone.',
  activityLog: 'Journal d’activité sur le tableau',
  activityLogHint: 'Masquez si vous ne journalisez pas les séances.',
  yes: 'Oui',
  no: 'Non',
};

const DE: AppearanceCopy = {
  title: 'DARSTELLUNG',
  theme: 'Design',
  system: 'System',
  light: 'Hell',
  dark: 'Dunkel',
  hint: '„System“ folgt der Einstellung deines Telefons.',
  activityLog: 'Aktivitätslog auf dem Dashboard',
  activityLogHint: 'Ausblenden, wenn Sie Workouts nicht manuell loggen.',
  yes: 'Ja',
  no: 'Nein',
};

const AR: AppearanceCopy = {
  title: 'المظهر',
  theme: 'المظهر',
  system: 'النظام',
  light: 'فاتح',
  dark: 'داكن',
  hint: '«النظام» يتبع إعداد هاتفك.',
  activityLog: 'سجل النشاط في لوحة التحكم',
  activityLogHint: 'أخفِه إن لم تسجّل التمارين يدويًا.',
  yes: 'نعم',
  no: 'لا',
};

const RU: AppearanceCopy = {
  title: 'ОФОРМЛЕНИЕ',
  theme: 'Тема',
  system: 'Система',
  light: 'Светлая',
  dark: 'Тёмная',
  hint: '«Система» следует настройке телефона.',
  activityLog: 'Дневник активности на панели',
  activityLogHint: 'Скройте, если не ведёте тренировки вручную.',
  yes: 'Да',
  no: 'Нет',
};

const PT: AppearanceCopy = {
  title: 'APARÊNCIA',
  theme: 'Tema',
  system: 'Sistema',
  light: 'Claro',
  dark: 'Escuro',
  hint: '«Sistema» segue a configuração do seu telefone.',
  activityLog: 'Diário de atividade no painel',
  activityLogHint: 'Oculte se não registrar treinos manualmente.',
  yes: 'Sim',
  no: 'Não',
};

const IT: AppearanceCopy = {
  title: 'ASPETTO',
  theme: 'Tema',
  system: 'Sistema',
  light: 'Chiaro',
  dark: 'Scuro',
  hint: '«Sistema» segue l’impostazione del telefono.',
  activityLog: 'Diario attività sulla dashboard',
  activityLogHint: 'Nascondi se non registri gli allenamenti.',
  yes: 'Sì',
  no: 'No',
};

const TR: AppearanceCopy = {
  title: 'GÖRÜNÜM',
  theme: 'Tema',
  system: 'Sistem',
  light: 'Açık',
  dark: 'Koyu',
  hint: '“Sistem” telefonunuzun ayarını izler.',
  activityLog: 'Gösterge panelinde aktivite günlüğü',
  activityLogHint: 'Antrenmanları elle kaydetmiyorsanız gizleyin.',
  yes: 'Evet',
  no: 'Hayır',
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
