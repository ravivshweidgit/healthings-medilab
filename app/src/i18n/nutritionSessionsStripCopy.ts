/**
 * Nutritionist sessions strip chrome — coach language (7 locales).
 * These are RD visit summaries, not generic “nutrition reports”.
 */

export type NutritionSessionsStripCopy = {
  title: string;
  addSession: string;
  emptyHint: string;
  activePrefix: string;
  collapseA11y: string;
  expandA11y: string;
  savedTitle: string;
  savedBody: string;
  deleteTitle: string;
  cancel: string;
  delete: string;
  activeBadge: string;
  view: string;
  setActive: string;
  close: string;
  importTitle: string;
};

const EN: NutritionSessionsStripCopy = {
  title: 'NUTRITIONIST SESSIONS',
  addSession: 'Add session',
  emptyHint: 'Import a nutritionist session summary PDF',
  activePrefix: 'Active',
  collapseA11y: 'Collapse nutritionist sessions',
  expandA11y: 'Expand nutritionist sessions',
  savedTitle: 'Saved',
  savedBody: 'Session saved and set as active — mentors will use this plan',
  deleteTitle: 'Delete session?',
  cancel: 'Cancel',
  delete: 'Delete',
  activeBadge: 'Active',
  view: 'view',
  setActive: 'Set active',
  close: 'Close',
  importTitle: 'Import nutritionist session',
};

const HE: NutritionSessionsStripCopy = {
  title: 'פגישות תזונאית',
  addSession: 'הוסף פגישה',
  emptyHint: 'ייבאו סיכום מפגש PDF מהתזונאית',
  activePrefix: 'פעיל',
  collapseA11y: 'כווץ פגישות תזונאית',
  expandA11y: 'הרחב פגישות תזונאית',
  savedTitle: 'נשמר',
  savedBody: 'הפגישה הפעילה עודכנה — המנטורים יראו את התוכנית',
  deleteTitle: 'מחיקת פגישה?',
  cancel: 'ביטול',
  delete: 'מחק',
  activeBadge: 'פעיל',
  view: 'צפייה',
  setActive: 'הגדר כפעיל',
  close: 'סגור',
  importTitle: 'ייבוא סיכום פגישה',
};

const ES: NutritionSessionsStripCopy = {
  title: 'SESIONES CON NUTRICIONISTA',
  addSession: 'Añadir sesión',
  emptyHint: 'Importa el PDF del resumen de sesión con el nutricionista',
  activePrefix: 'Activa',
  collapseA11y: 'Contraer sesiones con nutricionista',
  expandA11y: 'Expandir sesiones con nutricionista',
  savedTitle: 'Guardado',
  savedBody: 'Sesión guardada y activada — los mentores usarán este plan',
  deleteTitle: '¿Eliminar sesión?',
  cancel: 'Cancelar',
  delete: 'Eliminar',
  activeBadge: 'Activa',
  view: 'ver',
  setActive: 'Activar',
  close: 'Cerrar',
  importTitle: 'Importar sesión con nutricionista',
};

const FR: NutritionSessionsStripCopy = {
  title: 'SÉANCES NUTRITIONNISTE',
  addSession: 'Ajouter une séance',
  emptyHint: 'Importer le PDF du compte-rendu de séance nutritionniste',
  activePrefix: 'Active',
  collapseA11y: 'Réduire les séances nutritionniste',
  expandA11y: 'Développer les séances nutritionniste',
  savedTitle: 'Enregistré',
  savedBody: 'Séance enregistrée et activée — les mentors utiliseront ce plan',
  deleteTitle: 'Supprimer la séance ?',
  cancel: 'Annuler',
  delete: 'Supprimer',
  activeBadge: 'Active',
  view: 'voir',
  setActive: 'Activer',
  close: 'Fermer',
  importTitle: 'Importer une séance nutritionniste',
};

const DE: NutritionSessionsStripCopy = {
  title: 'ERNÄHRUNGSSITZUNGEN',
  addSession: 'Sitzung hinzufügen',
  emptyHint: 'PDF-Zusammenfassung der Ernährungssitzung importieren',
  activePrefix: 'Aktiv',
  collapseA11y: 'Ernährungssitzungen einklappen',
  expandA11y: 'Ernährungssitzungen ausklappen',
  savedTitle: 'Gespeichert',
  savedBody: 'Sitzung gespeichert und aktiviert — Mentoren nutzen diesen Plan',
  deleteTitle: 'Sitzung löschen?',
  cancel: 'Abbrechen',
  delete: 'Löschen',
  activeBadge: 'Aktiv',
  view: 'anzeigen',
  setActive: 'Aktivieren',
  close: 'Schließen',
  importTitle: 'Ernährungssitzung importieren',
};

const AR: NutritionSessionsStripCopy = {
  title: 'جلسات أخصائي التغذية',
  addSession: 'إضافة جلسة',
  emptyHint: 'استورد ملخص جلسة PDF من أخصائي التغذية',
  activePrefix: 'نشط',
  collapseA11y: 'طي جلسات أخصائي التغذية',
  expandA11y: 'توسيع جلسات أخصائي التغذية',
  savedTitle: 'تم الحفظ',
  savedBody: 'تم حفظ الجلسة وتفعيلها — سيستخدم المرشدون هذه الخطة',
  deleteTitle: 'حذف الجلسة؟',
  cancel: 'إلغاء',
  delete: 'حذف',
  activeBadge: 'نشط',
  view: 'عرض',
  setActive: 'تعيين كنشط',
  close: 'إغلاق',
  importTitle: 'استيراد ملخص جلسة',
};

const RU: NutritionSessionsStripCopy = {
  title: 'СЕАНСЫ НУТРИЦИОЛОГА',
  addSession: 'Добавить сеанс',
  emptyHint: 'Импортируйте PDF-саммари сеанса с нутрициологом',
  activePrefix: 'Активен',
  collapseA11y: 'Свернуть сеансы нутрициолога',
  expandA11y: 'Развернуть сеансы нутрициолога',
  savedTitle: 'Сохранено',
  savedBody: 'Сеанс сохранён и активирован — менторы будут использовать этот план',
  deleteTitle: 'Удалить сеанс?',
  cancel: 'Отмена',
  delete: 'Удалить',
  activeBadge: 'Активен',
  view: 'смотреть',
  setActive: 'Сделать активным',
  close: 'Закрыть',
  importTitle: 'Импорт сеанса нутрициолога',
};

const BY_CODE: Record<string, NutritionSessionsStripCopy> = {
  en: EN,
  he: HE,
  es: ES,
  fr: FR,
  de: DE,
  ar: AR,
  ru: RU,
};

export function getNutritionSessionsStripCopy(
  langCode?: string | null,
): NutritionSessionsStripCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return BY_CODE[c] ?? EN;
}
