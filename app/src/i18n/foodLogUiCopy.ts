/**
 * Food Log chrome — meal slots, energy labels, action buttons (coach language, 7 locales).
 */

export type FoodLogUiCopy = {
  breakfast: string;
  lunch: string;
  snack: string;
  dinner: string;
  eaten: string;
  activity: string;
  burned: string;
  deficit: string;
  surplus: string;
  meal: string;
  water: string;
  /** Per-item actions in meal window */
  editItem: string;
  deleteItem: string;
  editItemTitle: string;
  saveItem: string;
  cancel: string;
  deleteItemTitle: string;
  deleteItemMessage: (name: string) => string;
  fieldName: string;
  fieldGrams: string;
  fieldKcal: string;
  fieldProtein: string;
  fieldCarb: string;
  fieldFat: string;
  fieldFiber: string;
  fromPastMeal: string;
  fromPastTitle: string;
  useAsNewMeal: string;
  noMealsThatDay: string;
  back: string;
  saveMeal: string;
  done: string;
  logMeal: string;
  editMeal: string;
  camera: string;
  gallery: string;
  orDescribeIt: string;
  orDivider: string;
};

const EN: FoodLogUiCopy = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
  eaten: 'eaten',
  activity: 'activity',
  burned: 'burned',
  deficit: 'deficit',
  surplus: 'surplus',
  meal: 'Meal',
  water: 'Water',
  editItem: 'Edit',
  deleteItem: 'Delete',
  editItemTitle: 'Edit item',
  saveItem: 'Save',
  cancel: 'Cancel',
  deleteItemTitle: 'Delete item?',
  deleteItemMessage: (name) => `Remove “${name}” from this meal?`,
  fieldName: 'Name',
  fieldGrams: 'Grams',
  fieldKcal: 'kcal',
  fieldProtein: 'Protein (g)',
  fieldCarb: 'Carbs (g)',
  fieldFat: 'Fat (g)',
  fieldFiber: 'Fiber (g)',
  fromPastMeal: 'From past meal',
  fromPastTitle: 'Pick a past meal',
  useAsNewMeal: 'Use as new meal',
  noMealsThatDay: 'No meals on this day',
  back: 'Back',
  saveMeal: 'Save meal',
  done: 'Done',
  logMeal: 'Log Meal',
  editMeal: 'Edit Meal',
  camera: 'Camera',
  gallery: 'Gallery',
  orDescribeIt: '— or describe it —',
  orDivider: '— or —',
};

const HE: FoodLogUiCopy = {
  breakfast: 'ארוחת בוקר',
  lunch: 'ארוחת צהריים',
  snack: 'חטיף',
  dinner: 'ארוחת ערב',
  eaten: 'נאכל',
  activity: 'פעילות',
  burned: 'נשרף',
  deficit: 'גירעון',
  surplus: 'עודף',
  meal: 'ארוחה',
  water: 'מים',
  editItem: 'עריכה',
  deleteItem: 'מחיקה',
  editItemTitle: 'עריכת פריט',
  saveItem: 'שמירה',
  cancel: 'ביטול',
  deleteItemTitle: 'למחוק פריט?',
  deleteItemMessage: (name) => `להסיר את “${name}” מהארוחה?`,
  fieldName: 'שם',
  fieldGrams: 'גרם',
  fieldKcal: 'kcal',
  fieldProtein: 'חלבון (ג׳)',
  fieldCarb: 'פחמימות (ג׳)',
  fieldFat: 'שומן (ג׳)',
  fieldFiber: 'סיבים (ג׳)',
  fromPastMeal: 'מארוחה קודמת',
  fromPastTitle: 'בחירת ארוחה קודמת',
  useAsNewMeal: 'השתמש כארוחה חדשה',
  noMealsThatDay: 'אין ארוחות ביום זה',
  back: 'חזרה',
  saveMeal: 'שמור ארוחה',
  done: 'סיום',
  logMeal: 'רישום ארוחה',
  editMeal: 'עריכת ארוחה',
  camera: 'מצלמה',
  gallery: 'גלריה',
  orDescribeIt: '— או תארו במילים —',
  orDivider: '— או —',
};

const ES: FoodLogUiCopy = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Snack',
  dinner: 'Cena',
  eaten: 'comido',
  activity: 'actividad',
  burned: 'quemado',
  deficit: 'déficit',
  surplus: 'superávit',
  meal: 'Comida',
  water: 'Agua',
  editItem: 'Editar',
  deleteItem: 'Eliminar',
  editItemTitle: 'Editar ítem',
  saveItem: 'Guardar',
  cancel: 'Cancelar',
  deleteItemTitle: '¿Eliminar ítem?',
  deleteItemMessage: (name) => `¿Quitar “${name}” de esta comida?`,
  fieldName: 'Nombre',
  fieldGrams: 'Gramos',
  fieldKcal: 'kcal',
  fieldProtein: 'Proteína (g)',
  fieldCarb: 'Carbos (g)',
  fieldFat: 'Grasa (g)',
  fieldFiber: 'Fibra (g)',
  fromPastMeal: 'De comida anterior',
  fromPastTitle: 'Elegir comida anterior',
  useAsNewMeal: 'Usar como comida nueva',
  noMealsThatDay: 'No hay comidas este día',
  back: 'Atrás',
  saveMeal: 'Guardar comida',
  done: 'Listo',
  logMeal: 'Registrar comida',
  editMeal: 'Editar comida',
  camera: 'Cámara',
  gallery: 'Galería',
  orDescribeIt: '— o descríbela —',
  orDivider: '— o —',
};

const FR: FoodLogUiCopy = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  snack: 'Collation',
  dinner: 'Dîner',
  eaten: 'mangé',
  activity: 'activité',
  burned: 'brûlé',
  deficit: 'déficit',
  surplus: 'surplus',
  meal: 'Repas',
  water: 'Eau',
  editItem: 'Modifier',
  deleteItem: 'Supprimer',
  editItemTitle: 'Modifier l’aliment',
  saveItem: 'Enregistrer',
  cancel: 'Annuler',
  deleteItemTitle: 'Supprimer ?',
  deleteItemMessage: (name) => `Retirer « ${name} » de ce repas ?`,
  fieldName: 'Nom',
  fieldGrams: 'Grammes',
  fieldKcal: 'kcal',
  fieldProtein: 'Protéines (g)',
  fieldCarb: 'Glucides (g)',
  fieldFat: 'Lipides (g)',
  fieldFiber: 'Fibres (g)',
  fromPastMeal: 'Repas précédent',
  fromPastTitle: 'Choisir un repas passé',
  useAsNewMeal: 'Utiliser comme nouveau repas',
  noMealsThatDay: 'Aucun repas ce jour-là',
  back: 'Retour',
  saveMeal: 'Enregistrer le repas',
  done: 'Terminé',
  logMeal: 'Enregistrer un repas',
  editMeal: 'Modifier le repas',
  camera: 'Appareil photo',
  gallery: 'Galerie',
  orDescribeIt: '— ou décrivez-le —',
  orDivider: '— ou —',
};

const DE: FoodLogUiCopy = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  snack: 'Snack',
  dinner: 'Abendessen',
  eaten: 'gegessen',
  activity: 'Aktivität',
  burned: 'verbrannt',
  deficit: 'Defizit',
  surplus: 'Überschuss',
  meal: 'Mahlzeit',
  water: 'Wasser',
  editItem: 'Bearbeiten',
  deleteItem: 'Löschen',
  editItemTitle: 'Eintrag bearbeiten',
  saveItem: 'Speichern',
  cancel: 'Abbrechen',
  deleteItemTitle: 'Eintrag löschen?',
  deleteItemMessage: (name) => `„${name}“ aus dieser Mahlzeit entfernen?`,
  fieldName: 'Name',
  fieldGrams: 'Gramm',
  fieldKcal: 'kcal',
  fieldProtein: 'Eiweiß (g)',
  fieldCarb: 'Kohlenhydrate (g)',
  fieldFat: 'Fett (g)',
  fieldFiber: 'Ballaststoffe (g)',
  fromPastMeal: 'Aus früherer Mahlzeit',
  fromPastTitle: 'Frühere Mahlzeit wählen',
  useAsNewMeal: 'Als neue Mahlzeit verwenden',
  noMealsThatDay: 'Keine Mahlzeiten an diesem Tag',
  back: 'Zurück',
  saveMeal: 'Mahlzeit speichern',
  done: 'Fertig',
  logMeal: 'Mahlzeit erfassen',
  editMeal: 'Mahlzeit bearbeiten',
  camera: 'Kamera',
  gallery: 'Galerie',
  orDescribeIt: '— oder beschreiben —',
  orDivider: '— oder —',
};

const AR: FoodLogUiCopy = {
  breakfast: 'الفطور',
  lunch: 'الغداء',
  snack: 'وجبة خفيفة',
  dinner: 'العشاء',
  eaten: 'مأكول',
  activity: 'نشاط',
  burned: 'محروق',
  deficit: 'عجز',
  surplus: 'فائض',
  meal: 'وجبة',
  water: 'ماء',
  editItem: 'تعديل',
  deleteItem: 'حذف',
  editItemTitle: 'تعديل عنصر',
  saveItem: 'حفظ',
  cancel: 'إلغاء',
  deleteItemTitle: 'حذف العنصر؟',
  deleteItemMessage: (name) => `إزالة «${name}» من هذه الوجبة؟`,
  fieldName: 'الاسم',
  fieldGrams: 'غرام',
  fieldKcal: 'kcal',
  fieldProtein: 'بروتين (غ)',
  fieldCarb: 'كارب (غ)',
  fieldFat: 'دهون (غ)',
  fieldFiber: 'ألياف (غ)',
  fromPastMeal: 'من وجبة سابقة',
  fromPastTitle: 'اختر وجبة سابقة',
  useAsNewMeal: 'استخدام كوجبة جديدة',
  noMealsThatDay: 'لا وجبات في هذا اليوم',
  back: 'رجوع',
  saveMeal: 'حفظ الوجبة',
  done: 'تم',
  logMeal: 'تسجيل وجبة',
  editMeal: 'تعديل الوجبة',
  camera: 'الكاميرا',
  gallery: 'المعرض',
  orDescribeIt: '— أو صفها —',
  orDivider: '— أو —',
};

const RU: FoodLogUiCopy = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  snack: 'Перекус',
  dinner: 'Ужин',
  eaten: 'съедено',
  activity: 'активность',
  burned: 'сожжено',
  deficit: 'дефицит',
  surplus: 'профицит',
  meal: 'Приём пищи',
  water: 'Вода',
  editItem: 'Изменить',
  deleteItem: 'Удалить',
  editItemTitle: 'Изменить позицию',
  saveItem: 'Сохранить',
  cancel: 'Отмена',
  deleteItemTitle: 'Удалить позицию?',
  deleteItemMessage: (name) => `Убрать «${name}» из приёма пищи?`,
  fieldName: 'Название',
  fieldGrams: 'Граммы',
  fieldKcal: 'kcal',
  fieldProtein: 'Белки (г)',
  fieldCarb: 'Углеводы (г)',
  fieldFat: 'Жиры (г)',
  fieldFiber: 'Клетчатка (г)',
  fromPastMeal: 'Из прошлого приёма',
  fromPastTitle: 'Выбрать прошлый приём',
  useAsNewMeal: 'Использовать как новый',
  noMealsThatDay: 'Нет приёмов пищи в этот день',
  back: 'Назад',
  saveMeal: 'Сохранить приём',
  done: 'Готово',
  logMeal: 'Записать приём',
  editMeal: 'Изменить приём',
  camera: 'Камера',
  gallery: 'Галерея',
  orDescribeIt: '— или опишите —',
  orDivider: '— или —',
};

const BY_CODE: Record<string, FoodLogUiCopy> = {
  en: EN,
  he: HE,
  es: ES,
  fr: FR,
  de: DE,
  ar: AR,
  ru: RU,
};

export function getFoodLogUiCopy(langCode?: string | null): FoodLogUiCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return BY_CODE[c] ?? EN;
}
