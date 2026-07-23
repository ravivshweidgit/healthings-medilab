/**
 * My Profile — Your setup toggles (Yes / No / Save) — coach language, 7 locales.
 * Device brand names (Withings, Health Connect, Apple Health, CGM, CareSens) stay English.
 */

export type YourSetupCopy = {
  title: string;
  yes: string;
  no: string;
  save: string;
  gender: string;
  male: string;
  female: string;
  other: string;
  height: string;
  birthDate: string;
  /** e.g. "Age: 42 years" */
  ageYears: (n: number) => string;
  /** Under Profile Save — what this button persists. */
  saveHint: string;
  withingsScale: string;
  withingsWatch: string;
  /** Collapsed gear subtitle — bare noun (no Withings). */
  scaleShort: string;
  watchShort: string;
  cgm: string;
  hintScaleLink: string;
  hintWatchLink: string;
  hintWatchOffIos: string;
  hintWatchOffAndroid: string;
  hintCgmIos: string;
  hintCgmAndroid: string;
  linkWithings: string;
  relinkWithings: string;
  quickStartAgain: string;
  /** CareSens CSV import button label. */
  careSensImport: string;
};

const EN: YourSetupCopy = {
  title: 'Your setup',
  yes: 'Yes',
  no: 'No',
  save: 'Save',
  gender: 'Gender',
  male: 'Male',
  female: 'Female',
  other: 'Other',
  height: 'Height',
  birthDate: 'Birth Date',
  ageYears: (n) => `Age: ${n} years`,
  saveHint: 'Gender, height & birth date',
  withingsScale: 'Withings scale',
  withingsWatch: 'Withings watch',
  scaleShort: 'Scale',
  watchShort: 'Watch',
  cgm: 'CGM',
  hintScaleLink: 'Link Withings on the dashboard to sync scale data.',
  hintWatchLink: 'Link Withings below to sync watch activity.',
  hintWatchOffIos: 'Steps & HR from Apple Health — see Allow access below.',
  hintWatchOffAndroid: 'Steps & HR from Health Connect — see Allow access below.',
  hintCgmIos: 'CareSens Air → Apple Health sharing on. Then Sync in Healthings.',
  hintCgmAndroid: 'Allow Blood glucose in Health Connect settings.',
  linkWithings: 'Link Withings',
  relinkWithings: 'Re-link Withings',
  quickStartAgain: 'Quick Start again',
  careSensImport: 'Import',
};

const HE: YourSetupCopy = {
  title: 'ההגדרה שלך',
  yes: 'כן',
  no: 'לא',
  save: 'שמור',
  gender: 'מין',
  male: 'זכר',
  female: 'נקבה',
  other: 'אחר',
  height: 'גובה',
  birthDate: 'תאריך לידה',
  ageYears: (n) => `גיל: ${n}`,
  saveHint: 'מין, גובה ותאריך לידה',
  withingsScale: 'משקל Withings',
  withingsWatch: 'שעון Withings',
  scaleShort: 'משקל',
  watchShort: 'שעון',
  cgm: 'CGM',
  hintScaleLink: 'קשרו Withings במסך הראשי כדי לסנכרן את המשקל.',
  hintWatchLink: 'קשרו Withings למטה כדי לסנכרן פעילות מהשעון.',
  hintWatchOffIos: 'צעדים ודופק מ־Apple Health — ראו Allow access למטה.',
  hintWatchOffAndroid: 'צעדים ודופק מ־Health Connect — ראו Allow access למטה.',
  hintCgmIos: 'CareSens Air → שיתוף ב־Apple Health. אחר כך Sync ב־Healthings.',
  hintCgmAndroid: 'אפשרו Blood glucose בהגדרות Health Connect.',
  linkWithings: 'קשר Withings',
  relinkWithings: 'קשר מחדש Withings',
  quickStartAgain: 'התחלה מהירה מחדש',
  careSensImport: 'ייבוא',
};

const ES: YourSetupCopy = {
  title: 'Tu configuración',
  yes: 'Sí',
  no: 'No',
  save: 'Guardar',
  gender: 'Sexo',
  male: 'Hombre',
  female: 'Mujer',
  other: 'Otro',
  height: 'Altura',
  birthDate: 'Fecha de nacimiento',
  ageYears: (n) => `Edad: ${n} años`,
  saveHint: 'Sexo, altura y fecha de nacimiento',
  withingsScale: 'Báscula Withings',
  withingsWatch: 'Reloj Withings',
  scaleShort: 'Báscula',
  watchShort: 'Reloj',
  cgm: 'CGM',
  hintScaleLink: 'Vincula Withings en el panel para sincronizar la báscula.',
  hintWatchLink: 'Vincula Withings abajo para sincronizar la actividad del reloj.',
  hintWatchOffIos: 'Pasos y FC desde Apple Health — ver Allow access abajo.',
  hintWatchOffAndroid: 'Pasos y FC desde Health Connect — ver Allow access abajo.',
  hintCgmIos: 'CareSens Air → compartir en Apple Health. Luego Sync en Healthings.',
  hintCgmAndroid: 'Permite Blood glucose en Ajustes de Health Connect.',
  linkWithings: 'Vincular Withings',
  relinkWithings: 'Re-vincular Withings',
  quickStartAgain: 'Inicio rápido de nuevo',
  careSensImport: 'Importar',
};

const FR: YourSetupCopy = {
  title: 'Votre configuration',
  yes: 'Oui',
  no: 'Non',
  save: 'Enregistrer',
  gender: 'Sexe',
  male: 'Homme',
  female: 'Femme',
  other: 'Autre',
  height: 'Taille',
  birthDate: 'Date de naissance',
  ageYears: (n) => `Âge : ${n} ans`,
  saveHint: 'Sexe, taille et date de naissance',
  withingsScale: 'Balance Withings',
  withingsWatch: 'Montre Withings',
  scaleShort: 'Balance',
  watchShort: 'Montre',
  cgm: 'CGM',
  hintScaleLink: 'Liez Withings sur le tableau de bord pour synchroniser la balance.',
  hintWatchLink: 'Liez Withings ci-dessous pour synchroniser l’activité de la montre.',
  hintWatchOffIos: 'Pas et FC via Apple Health — voir Allow access ci-dessous.',
  hintWatchOffAndroid: 'Pas et FC via Health Connect — voir Allow access ci-dessous.',
  hintCgmIos: 'CareSens Air → partage Apple Health. Puis Sync dans Healthings.',
  hintCgmAndroid: 'Autorisez Blood glucose dans les réglages Health Connect.',
  linkWithings: 'Lier Withings',
  relinkWithings: 'Re-lier Withings',
  quickStartAgain: 'Recommencer le démarrage rapide',
  careSensImport: 'Importer',
};

const DE: YourSetupCopy = {
  title: 'Dein Setup',
  yes: 'Ja',
  no: 'Nein',
  save: 'Speichern',
  gender: 'Geschlecht',
  male: 'Männlich',
  female: 'Weiblich',
  other: 'Andere',
  height: 'Größe',
  birthDate: 'Geburtsdatum',
  ageYears: (n) => `Alter: ${n} Jahre`,
  saveHint: 'Geschlecht, Größe & Geburtsdatum',
  withingsScale: 'Withings-Waage',
  withingsWatch: 'Withings-Uhr',
  scaleShort: 'Waage',
  watchShort: 'Uhr',
  cgm: 'CGM',
  hintScaleLink: 'Withings auf dem Dashboard verknüpfen, um die Waage zu synchronisieren.',
  hintWatchLink: 'Withings unten verknüpfen, um die Uhrenaktivität zu synchronisieren.',
  hintWatchOffIos: 'Schritte & HF aus Apple Health — siehe Allow access unten.',
  hintWatchOffAndroid: 'Schritte & HF aus Health Connect — siehe Allow access unten.',
  hintCgmIos: 'CareSens Air → Freigabe in Apple Health. Dann Sync in Healthings.',
  hintCgmAndroid: 'Blood glucose in den Health-Connect-Einstellungen erlauben.',
  linkWithings: 'Withings verknüpfen',
  relinkWithings: 'Withings erneut verknüpfen',
  quickStartAgain: 'Schnellstart erneut',
  careSensImport: 'Importieren',
};

const AR: YourSetupCopy = {
  title: 'إعدادك',
  yes: 'نعم',
  no: 'لا',
  save: 'حفظ',
  gender: 'الجنس',
  male: 'ذكر',
  female: 'أنثى',
  other: 'آخر',
  height: 'الطول',
  birthDate: 'تاريخ الميلاد',
  ageYears: (n) => `العمر: ${n}`,
  saveHint: 'الجنس والطول وتاريخ الميلاد',
  withingsScale: 'ميزان Withings',
  withingsWatch: 'ساعة Withings',
  scaleShort: 'ميزان',
  watchShort: 'ساعة',
  cgm: 'CGM',
  hintScaleLink: 'اربط Withings في لوحة التحكم لمزامنة الميزان.',
  hintWatchLink: 'اربط Withings أدناه لمزامنة نشاط الساعة.',
  hintWatchOffIos: 'الخطوات ومعدل القلب من Apple Health — انظر Allow access أدناه.',
  hintWatchOffAndroid: 'الخطوات ومعدل القلب من Health Connect — انظر Allow access أدناه.',
  hintCgmIos: 'CareSens Air → مشاركة Apple Health. ثم Sync في Healthings.',
  hintCgmAndroid: 'اسمح بـ Blood glucose في إعدادات Health Connect.',
  linkWithings: 'ربط Withings',
  relinkWithings: 'إعادة ربط Withings',
  quickStartAgain: 'بداية سريعة مرة أخرى',
  careSensImport: 'استيراد',
};

const RU: YourSetupCopy = {
  title: 'Ваша настройка',
  yes: 'Да',
  no: 'Нет',
  save: 'Сохранить',
  gender: 'Пол',
  male: 'Мужской',
  female: 'Женский',
  other: 'Другой',
  height: 'Рост',
  birthDate: 'Дата рождения',
  ageYears: (n) => `Возраст: ${n} лет`,
  saveHint: 'Пол, рост и дата рождения',
  withingsScale: 'Весы Withings',
  withingsWatch: 'Часы Withings',
  scaleShort: 'Весы',
  watchShort: 'Часы',
  cgm: 'CGM',
  hintScaleLink: 'Привяжите Withings на панели, чтобы синхронизировать весы.',
  hintWatchLink: 'Привяжите Withings ниже, чтобы синхронизировать активность часов.',
  hintWatchOffIos: 'Шаги и ЧСС из Apple Health — см. Allow access ниже.',
  hintWatchOffAndroid: 'Шаги и ЧСС из Health Connect — см. Allow access ниже.',
  hintCgmIos: 'CareSens Air → доступ в Apple Health. Затем Sync в Healthings.',
  hintCgmAndroid: 'Разрешите Blood glucose в настройках Health Connect.',
  linkWithings: 'Привязать Withings',
  relinkWithings: 'Привязать Withings заново',
  quickStartAgain: 'Быстрый старт снова',
  careSensImport: 'Импорт',
};

const BY_CODE: Record<string, YourSetupCopy> = {
  en: EN,
  he: HE,
  es: ES,
  fr: FR,
  de: DE,
  ar: AR,
  ru: RU,
};

export function getYourSetupCopy(langCode?: string | null): YourSetupCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return BY_CODE[c] ?? EN;
}
