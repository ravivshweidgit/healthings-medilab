/**
 * Activity Log chrome — strip + modal (appLocale).
 */

export type ActivityLogUiCopy = {
  title: string;
  addActivity: string;
  editActivity: string;
  minutes: string;
  youtubeUrl: string;
  /** Optional dumbbell/bar load for strength videos */
  equipmentWeightKg: string;
  equipmentWeightHint: string;
  kcal: string;
  /** Button: AI estimate kcal from YouTube + body profile */
  aiCalc: string;
  aiCalcNeedLink: string;
  aiCalcNeedWeight: string;
  aiCalcBusy: string;
  /** Shown while Gemini watches the attached YouTube workout. */
  aiCalcBusyVideo: string;
  aiCalcDone: (kcalLabel: string) => string;
  save: string;
  cancel: string;
  delete: string;
  deleteTitle: string;
  deleteMessage: string;
  favorites: string;
  saveAsFavorite: string;
  manageFavorites: string;
  editFavorite: string;
  newFavorite: string;
  favoriteName: string;
  defaultMinutes: string;
  noFavorites: string;
  noSessions: string;
  wearable: string;
  manual: string;
  favorite: string;
  total: string;
  collapse: string;
  expand: string;
  nameRequired: string;
  minutesRequired: string;
  fromPastActivity: string;
  fromPastTitle: string;
  useAsNewActivity: string;
  noSessionsThatDay: string;
  back: string;
  orDivider: string;
};

const EN: ActivityLogUiCopy = {
  title: 'ACTIVITY LOG',
  addActivity: 'Add activity',
  editActivity: 'Edit activity',
  minutes: 'Minutes',
  youtubeUrl: 'youtube link',
  equipmentWeightKg: 'Load kg',
  equipmentWeightHint: 'Optional — dumbbell/bar weight you use (not body weight).',
  kcal: 'kcal',
  aiCalc: 'AI calc',
  aiCalcNeedLink: 'Add a YouTube link (or name) first.',
  aiCalcNeedWeight: 'Set your weight in Profile first.',
  aiCalcBusy: 'Estimating…',
  aiCalcBusyVideo: 'Watching workout video…',
  aiCalcDone: (kcalLabel) => `Set to ${kcalLabel}`,
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  deleteTitle: 'Delete activity?',
  deleteMessage: 'Remove this session from the log?',
  favorites: 'Favorites',
  saveAsFavorite: 'Save as favorite',
  manageFavorites: 'Manage favorites',
  editFavorite: 'Edit favorite',
  newFavorite: 'New favorite',
  favoriteName: 'Name',
  defaultMinutes: 'Default minutes',
  noFavorites: 'No favorites yet — save one from a session.',
  noSessions: 'No sessions this day',
  wearable: 'Watch',
  manual: 'Manual',
  favorite: 'Favorite',
  total: 'total',
  collapse: 'Collapse activity log',
  expand: 'Expand activity log',
  nameRequired: 'Enter a name',
  minutesRequired: 'Enter minutes',
  fromPastActivity: 'From past activity',
  fromPastTitle: 'Pick a past activity',
  useAsNewActivity: 'Use as new',
  noSessionsThatDay: 'No sessions that day',
  back: 'Back',
  orDivider: 'or',
};

const HE: ActivityLogUiCopy = {
  ...EN,
  title: 'יומן פעילות',
  addActivity: 'הוסף פעילות',
  editActivity: 'ערוך פעילות',
  minutes: 'דקות',
  youtubeUrl: 'קישור youtube',
  equipmentWeightKg: 'משקל עומס',
  equipmentWeightHint: 'אופציונלי — משקל משקולת/מוט שאתם מרים (לא משקל גוף).',
  aiCalc: 'חישוב AI',
  aiCalcNeedLink: 'הוסיפו קישור YouTube (או שם) קודם.',
  aiCalcNeedWeight: 'הגדירו משקל בפרופיל קודם.',
  aiCalcBusy: 'מעריך…',
  aiCalcBusyVideo: 'צופה בסרטון האימון…',
  aiCalcDone: (kcalLabel) => `עודכן ל-${kcalLabel}`,
  save: 'שמור',
  cancel: 'ביטול',
  delete: 'מחק',
  deleteTitle: 'למחוק פעילות?',
  deleteMessage: 'להסיר את הסשן מהיומן?',
  favorites: 'מועדפים',
  saveAsFavorite: 'שמור כמועדף',
  manageFavorites: 'ניהול מועדפים',
  noFavorites: 'אין מועדפים — שמרו אחד מסשן.',
  noSessions: 'אין סשנים ביום זה',
  wearable: 'שעון',
  manual: 'ידני',
  favorite: 'מועדף',
  total: 'סה״כ',
  fromPastActivity: 'מפעילות קודמת',
  fromPastTitle: 'בחרו פעילות מהעבר',
  useAsNewActivity: 'השתמש כחדש',
  noSessionsThatDay: 'אין סשנים ביום זה',
  back: 'חזרה',
  orDivider: 'או',
  nameRequired: 'הזינו שם',
  minutesRequired: 'הזינו דקות',
};

const ES: ActivityLogUiCopy = {
  ...EN,
  title: 'REGISTRO DE ACTIVIDAD',
  addActivity: 'Añadir actividad',
  editActivity: 'Editar actividad',
  minutes: 'Minutos',
  aiCalc: 'Cálculo AI',
  save: 'Guardar',
  cancel: 'Cancelar',
  delete: 'Eliminar',
  favorites: 'Favoritos',
  saveAsFavorite: 'Guardar como favorito',
  noSessions: 'Sin sesiones este día',
  fromPastActivity: 'De actividad pasada',
  fromPastTitle: 'Elegir actividad pasada',
  useAsNewActivity: 'Usar como nueva',
  back: 'Atrás',
};

const FR: ActivityLogUiCopy = {
  ...EN,
  title: 'JOURNAL D’ACTIVITÉ',
  addActivity: 'Ajouter une activité',
  editActivity: 'Modifier l’activité',
  minutes: 'Minutes',
  aiCalc: 'Calcul AI',
  save: 'Enregistrer',
  cancel: 'Annuler',
  delete: 'Supprimer',
  favorites: 'Favoris',
  saveAsFavorite: 'Enregistrer en favori',
  noSessions: 'Aucune séance ce jour',
  fromPastActivity: 'D’une activité passée',
  fromPastTitle: 'Choisir une activité passée',
  useAsNewActivity: 'Utiliser comme nouvelle',
  back: 'Retour',
};

const DE: ActivityLogUiCopy = {
  ...EN,
  title: 'AKTIVITÄTSLOG',
  addActivity: 'Aktivität hinzufügen',
  editActivity: 'Aktivität bearbeiten',
  minutes: 'Minuten',
  aiCalc: 'AI-Berechnung',
  save: 'Speichern',
  cancel: 'Abbrechen',
  delete: 'Löschen',
  favorites: 'Favoriten',
  saveAsFavorite: 'Als Favorit speichern',
  noSessions: 'Keine Einheiten an diesem Tag',
  fromPastActivity: 'Aus früherer Aktivität',
  fromPastTitle: 'Frühere Aktivität wählen',
  useAsNewActivity: 'Als neu verwenden',
  back: 'Zurück',
};

const AR: ActivityLogUiCopy = {
  ...EN,
  title: 'سجل النشاط',
  addActivity: 'إضافة نشاط',
  editActivity: 'تعديل النشاط',
  minutes: 'دقائق',
  aiCalc: 'حساب AI',
  save: 'حفظ',
  cancel: 'إلغاء',
  delete: 'حذف',
  favorites: 'المفضلة',
  saveAsFavorite: 'حفظ كمفضل',
  noSessions: 'لا جلسات هذا اليوم',
  fromPastActivity: 'من نشاط سابق',
  fromPastTitle: 'اختر نشاطًا سابقًا',
  useAsNewActivity: 'استخدم كجديد',
  back: 'رجوع',
};

const RU: ActivityLogUiCopy = {
  ...EN,
  title: 'ДНЕВНИК АКТИВНОСТИ',
  addActivity: 'Добавить активность',
  editActivity: 'Изменить активность',
  minutes: 'Минуты',
  aiCalc: 'Расчёт AI',
  save: 'Сохранить',
  cancel: 'Отмена',
  delete: 'Удалить',
  favorites: 'Избранное',
  saveAsFavorite: 'Сохранить в избранное',
  noSessions: 'Нет сессий в этот день',
  fromPastActivity: 'Из прошлой активности',
  fromPastTitle: 'Выберите прошлую активность',
  useAsNewActivity: 'Использовать как новую',
  back: 'Назад',
};

const PT: ActivityLogUiCopy = {
  ...EN,
  title: 'DIÁRIO DE ATIDADE',
  addActivity: 'Adicionar atividade',
  editActivity: 'Editar atividade',
  minutes: 'Minutos',
  aiCalc: 'Cálculo AI',
  save: 'Salvar',
  cancel: 'Cancelar',
  delete: 'Excluir',
  favorites: 'Favoritos',
  saveAsFavorite: 'Salvar como favorito',
  noSessions: 'Sem sessões neste dia',
  fromPastActivity: 'De atividade passada',
  fromPastTitle: 'Escolher atividade passada',
  useAsNewActivity: 'Usar como nova',
  back: 'Voltar',
};

const IT: ActivityLogUiCopy = {
  ...EN,
  title: 'DIARIO ATTIVITÀ',
  addActivity: 'Aggiungi attività',
  editActivity: 'Modifica attività',
  minutes: 'Minuti',
  aiCalc: 'Calcolo AI',
  save: 'Salva',
  cancel: 'Annulla',
  delete: 'Elimina',
  favorites: 'Preferiti',
  saveAsFavorite: 'Salva come preferito',
  noSessions: 'Nessuna sessione in questo giorno',
  fromPastActivity: 'Da attività passata',
  fromPastTitle: 'Scegli attività passata',
  useAsNewActivity: 'Usa come nuova',
  back: 'Indietro',
};

const TR: ActivityLogUiCopy = {
  ...EN,
  title: 'AKTİVİTE GÜNLÜĞÜ',
  addActivity: 'Aktivite ekle',
  editActivity: 'Aktiviteyi düzenle',
  minutes: 'Dakika',
  aiCalc: 'AI hesap',
  save: 'Kaydet',
  cancel: 'İptal',
  delete: 'Sil',
  favorites: 'Favoriler',
  saveAsFavorite: 'Favori olarak kaydet',
  noSessions: 'Bu günde seans yok',
  fromPastActivity: 'Geçmiş aktiviteden',
  fromPastTitle: 'Geçmiş aktivite seç',
  useAsNewActivity: 'Yeni olarak kullan',
  back: 'Geri',
};

const BY_CODE: Record<string, ActivityLogUiCopy> = {
  en: EN,
  he: HE,
  es: ES,
  fr: FR,
  de: DE,
  ar: AR,
  ru: RU,
  pt: PT,
  it: IT,
  tr: TR,
};

export function getActivityLogUiCopy(langCode?: string | null): ActivityLogUiCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return BY_CODE[c] ?? EN;
}
