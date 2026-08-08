/**
 * Food Log photo / merge chrome — appLocale (prompt106 HE pass).
 * Speak-like-a-person; food examples may stay local in placeholders.
 */

export type FoodLogPhotoUiCopy = {
  photoAssistant: string;
  fromPhoto: string;
  newPhoto: string;
  useAsMeal: string;
  addToMeal: string;
  removeFromMeal: string;
  removeLeftoversHint: string;
  previewUpdate: string;
  addingPhotoItems: string;
  removingPhotoItems: string;
  currentMeal: string;
  afterUpdate: string;
  change: string;
  approveUpdate: string;
  photoItemsAdded: string;
  photoItemsRemoved: string;
  emptyItems: string;
  describePlaceholder: string;
  chatPlaceholderPhoto: string;
  chatPlaceholderHistory: string;
};

const EN: FoodLogPhotoUiCopy = {
  photoAssistant: 'Photo assistant',
  fromPhoto: 'From photo',
  newPhoto: 'New photo',
  useAsMeal: 'Use as meal',
  addToMeal: '+ Add to meal',
  removeFromMeal: '− Remove from meal',
  removeLeftoversHint: 'Remove = photo shows food you did not eat (leftovers)',
  previewUpdate: 'Preview update',
  addingPhotoItems: 'Adding photo items to meal',
  removingPhotoItems: 'Removing items shown in photo',
  currentMeal: 'Current meal',
  afterUpdate: 'After update',
  change: 'Change',
  approveUpdate: '✓ Approve update',
  photoItemsAdded: 'Photo items added to meal',
  photoItemsRemoved: 'Matching items removed from meal',
  emptyItems: 'Empty',
  describePlaceholder: 'e.g. "protein shake" or "add last evening\'s shake"',
  chatPlaceholderPhoto: 'Correct photo list: "only half the pita", "add coffee"…',
  chatPlaceholderHistory: 'Correct or from history: "same chicken meal", "my usual shake"…',
};

const HE: FoodLogPhotoUiCopy = {
  photoAssistant: 'עוזר תמונה',
  fromPhoto: 'מהתמונה',
  newPhoto: 'תמונה חדשה',
  useAsMeal: 'השתמש כארוחה',
  addToMeal: '+ הוסף לארוחה',
  removeFromMeal: '− הסר מהארוחה',
  removeLeftoversHint: 'הסרה = בתמונה יש אוכל שלא אכלתם (שאריות)',
  previewUpdate: 'תצוגה מקדימה',
  addingPhotoItems: 'מוסיפים פריטים מהתמונה',
  removingPhotoItems: 'מסירים פריטים שמופיעים בתמונה',
  currentMeal: 'הארוחה עכשיו',
  afterUpdate: 'אחרי העדכון',
  change: 'שינוי',
  approveUpdate: '✓ אשר עדכון',
  photoItemsAdded: 'נוספו פריטים מהתמונה',
  photoItemsRemoved: 'הוסרו פריטים תואמים',
  emptyItems: 'ריק',
  describePlaceholder: 'למשל "שייק חלבון" או "הוסף את השייק מאתמול בערב"',
  chatPlaceholderPhoto: 'תיקון מהתמונה: "חצי פיתה", "הוסף קפה"…',
  chatPlaceholderHistory: 'תיקון או מהעבר: "אותה ארוחת עוף", "השייק הרגיל שלי"…',
};

const ES: FoodLogPhotoUiCopy = {
  photoAssistant: 'Asistente de foto',
  fromPhoto: 'De la foto',
  newPhoto: 'Foto nueva',
  useAsMeal: 'Usar como comida',
  addToMeal: '+ Añadir a la comida',
  removeFromMeal: '− Quitar de la comida',
  removeLeftoversHint: 'Quitar = la foto muestra comida que no comiste (sobrantes)',
  previewUpdate: 'Vista previa',
  addingPhotoItems: 'Añadiendo ítems de la foto',
  removingPhotoItems: 'Quitando ítems que aparecen en la foto',
  currentMeal: 'Comida actual',
  afterUpdate: 'Después del cambio',
  change: 'Cambio',
  approveUpdate: '✓ Aprobar cambio',
  photoItemsAdded: 'Ítems de la foto añadidos',
  photoItemsRemoved: 'Ítems coincidentes quitados',
  emptyItems: 'Vacío',
  describePlaceholder: 'p. ej. "batido de proteína" o "añade el de anoche"',
  chatPlaceholderPhoto: 'Corrige la foto: "solo media pita", "añade café"…',
  chatPlaceholderHistory: 'Corrige o del historial: "el mismo pollo", "mi batido habitual"…',
};

const FR: FoodLogPhotoUiCopy = {
  photoAssistant: 'Assistant photo',
  fromPhoto: 'Depuis la photo',
  newPhoto: 'Nouvelle photo',
  useAsMeal: 'Utiliser comme repas',
  addToMeal: '+ Ajouter au repas',
  removeFromMeal: '− Retirer du repas',
  removeLeftoversHint: 'Retirer = la photo montre des aliments non mangés (restes)',
  previewUpdate: 'Aperçu',
  addingPhotoItems: 'Ajout des aliments de la photo',
  removingPhotoItems: 'Retrait des aliments visibles sur la photo',
  currentMeal: 'Repas actuel',
  afterUpdate: 'Après mise à jour',
  change: 'Changement',
  approveUpdate: '✓ Approuver',
  photoItemsAdded: 'Aliments de la photo ajoutés',
  photoItemsRemoved: 'Aliments correspondants retirés',
  emptyItems: 'Vide',
  describePlaceholder: 'ex. « shake protéiné » ou « ajoute celui d’hier soir »',
  chatPlaceholderPhoto: 'Corriger la photo : « une demi-pita », « ajoute un café »…',
  chatPlaceholderHistory: 'Corriger ou depuis l’historique : « le même poulet », « mon shake habituel »…',
};

const DE: FoodLogPhotoUiCopy = {
  photoAssistant: 'Foto-Assistent',
  fromPhoto: 'Aus dem Foto',
  newPhoto: 'Neues Foto',
  useAsMeal: 'Als Mahlzeit nutzen',
  addToMeal: '+ Zur Mahlzeit hinzufügen',
  removeFromMeal: '− Aus Mahlzeit entfernen',
  removeLeftoversHint: 'Entfernen = Foto zeigt Essen, das du nicht gegessen hast (Reste)',
  previewUpdate: 'Vorschau',
  addingPhotoItems: 'Foto-Einträge werden hinzugefügt',
  removingPhotoItems: 'Einträge aus dem Foto werden entfernt',
  currentMeal: 'Aktuelle Mahlzeit',
  afterUpdate: 'Nach dem Update',
  change: 'Änderung',
  approveUpdate: '✓ Update bestätigen',
  photoItemsAdded: 'Foto-Einträge hinzugefügt',
  photoItemsRemoved: 'Passende Einträge entfernt',
  emptyItems: 'Leer',
  describePlaceholder: 'z. B. „Proteinshake“ oder „gestern Abend hinzufügen“',
  chatPlaceholderPhoto: 'Foto korrigieren: „nur halbe Pita“, „Kaffee dazu“…',
  chatPlaceholderHistory: 'Korrigieren oder aus Verlauf: „dasselbe Hähnchen“, „mein üblicher Shake“…',
};

const AR: FoodLogPhotoUiCopy = {
  photoAssistant: 'مساعد الصورة',
  fromPhoto: 'من الصورة',
  newPhoto: 'صورة جديدة',
  useAsMeal: 'استخدم كوجبة',
  addToMeal: '+ أضف للوجبة',
  removeFromMeal: '− أزل من الوجبة',
  removeLeftoversHint: 'الإزالة = الصورة تعرض طعامًا لم تأكلوه (بقايا)',
  previewUpdate: 'معاينة التحديث',
  addingPhotoItems: 'إضافة أصناف من الصورة',
  removingPhotoItems: 'إزالة أصناف ظاهرة في الصورة',
  currentMeal: 'الوجبة الآن',
  afterUpdate: 'بعد التحديث',
  change: 'التغيير',
  approveUpdate: '✓ اعتماد التحديث',
  photoItemsAdded: 'أُضيفت أصناف من الصورة',
  photoItemsRemoved: 'أُزيلت الأصناف المطابقة',
  emptyItems: 'فارغ',
  describePlaceholder: 'مثلًا "شيك بروتين" أو "أضف شيك مساء أمس"',
  chatPlaceholderPhoto: 'تصحيح من الصورة: "نصف بيتا"، "أضف قهوة"…',
  chatPlaceholderHistory: 'تصحيح أو من السابق: "نفس وجبة الدجاج"، "شيكي المعتاد"…',
};

const RU: FoodLogPhotoUiCopy = {
  photoAssistant: 'Фото-помощник',
  fromPhoto: 'С фото',
  newPhoto: 'Новое фото',
  useAsMeal: 'Использовать как приём',
  addToMeal: '+ Добавить к приёму',
  removeFromMeal: '− Убрать из приёма',
  removeLeftoversHint: 'Убрать = на фото еда, которую вы не ели (остатки)',
  previewUpdate: 'Предпросмотр',
  addingPhotoItems: 'Добавляем позиции с фото',
  removingPhotoItems: 'Убираем позиции с фото',
  currentMeal: 'Сейчас',
  afterUpdate: 'После обновления',
  change: 'Изменение',
  approveUpdate: '✓ Подтвердить',
  photoItemsAdded: 'Позиции с фото добавлены',
  photoItemsRemoved: 'Совпадающие позиции удалены',
  emptyItems: 'Пусто',
  describePlaceholder: 'напр. «протеиновый шейк» или «добавь вчерашний»',
  chatPlaceholderPhoto: 'Исправить фото: «пол питы», «добавь кофе»…',
  chatPlaceholderHistory: 'Исправить или из истории: «та же курица», «мой обычный шейк»…',
};

const PT: FoodLogPhotoUiCopy = {
  photoAssistant: 'Assistente de foto',
  fromPhoto: 'Da foto',
  newPhoto: 'Nova foto',
  useAsMeal: 'Usar como refeição',
  addToMeal: '+ Adicionar à refeição',
  removeFromMeal: '− Remover da refeição',
  removeLeftoversHint: 'Remover = a foto mostra comida que você não comeu (sobras)',
  previewUpdate: 'Prévia da atualização',
  addingPhotoItems: 'Adicionando itens da foto',
  removingPhotoItems: 'Removendo itens da foto',
  currentMeal: 'Refeição atual',
  afterUpdate: 'Depois da atualização',
  change: 'Mudança',
  approveUpdate: '✓ Aprovar atualização',
  photoItemsAdded: 'Itens da foto adicionados',
  photoItemsRemoved: 'Itens correspondentes removidos',
  emptyItems: 'Vazio',
  describePlaceholder: 'ex.: "shake de proteína" ou "adicione o de ontem à noite"',
  chatPlaceholderPhoto: 'Corrigir a foto: "só meia pita", "adicione café"…',
  chatPlaceholderHistory: 'Corrigir ou do histórico: "o mesmo frango", "meu shake habitual"…',
};

const IT: FoodLogPhotoUiCopy = {
  photoAssistant: 'Assistente foto',
  fromPhoto: 'Dalla foto',
  newPhoto: 'Nuova foto',
  useAsMeal: 'Usa come pasto',
  addToMeal: '+ Aggiungi al pasto',
  removeFromMeal: '− Rimuovi dal pasto',
  removeLeftoversHint: 'Rimuovi = la foto mostra cibo non mangiato (avanzi)',
  previewUpdate: 'Anteprima',
  addingPhotoItems: 'Aggiunta voci dalla foto',
  removingPhotoItems: 'Rimozione voci mostrate nella foto',
  currentMeal: 'Pasto attuale',
  afterUpdate: 'Dopo l’aggiornamento',
  change: 'Modifica',
  approveUpdate: '✓ Approva aggiornamento',
  photoItemsAdded: 'Voci dalla foto aggiunte',
  photoItemsRemoved: 'Voci corrispondenti rimosse',
  emptyItems: 'Vuoto',
  describePlaceholder: 'es. "shake proteico" o "aggiungi quello di ieri sera"',
  chatPlaceholderPhoto: 'Correggi la foto: "solo mezza pita", "aggiungi caffè"…',
  chatPlaceholderHistory: 'Correggi o dalla cronologia: "lo stesso pollo", "il mio shake solito"…',
};

const TR: FoodLogPhotoUiCopy = {
  photoAssistant: 'Foto asistanı',
  fromPhoto: 'Fotodan',
  newPhoto: 'Yeni foto',
  useAsMeal: 'Öğün olarak kullan',
  addToMeal: '+ Öğüne ekle',
  removeFromMeal: '− Öğünden çıkar',
  removeLeftoversHint: 'Çıkar = foto yemediğiniz yiyeceği gösteriyor (artıklar)',
  previewUpdate: 'Önizleme',
  addingPhotoItems: 'Fotodaki öğeler ekleniyor',
  removingPhotoItems: 'Fotodaki öğeler çıkarılıyor',
  currentMeal: 'Şu anki öğün',
  afterUpdate: 'Güncellemeden sonra',
  change: 'Değişim',
  approveUpdate: '✓ Güncellemeyi onayla',
  photoItemsAdded: 'Fotodaki öğeler eklendi',
  photoItemsRemoved: 'Eşleşen öğeler çıkarıldı',
  emptyItems: 'Boş',
  describePlaceholder: 'örn. "protein shake" veya "dünkü shake’i ekle"',
  chatPlaceholderPhoto: 'Fotoyu düzelt: "yarım pita", "kahve ekle"…',
  chatPlaceholderHistory: 'Düzelt veya geçmişten: "aynı tavuk", "her zamanki shake"…',
};

const BY_CODE: Record<string, FoodLogPhotoUiCopy> = {
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

export function getFoodLogPhotoUiCopy(langCode?: string | null): FoodLogPhotoUiCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return BY_CODE[c] ?? EN;
}
