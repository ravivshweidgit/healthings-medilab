/**
 * Food Log save / permission / nutritionist-alert chrome — appLocale.
 */

export type FoodLogAlertCopy = {
  nutritionistAlert: string;
  editMealAction: string;
  saveAnyway: string;
  savingMeal: string;
  updatingFoodLog: string;
  /** Gemini meal analysis in flight */
  analyzing: string;
  permissionRequired: string;
  permissionCamera: string;
  permissionGallery: string;
  imageTooLargeTitle: string;
  imageTooLargeBody: string;
  aiAnalysisFailed: string;
  failedToSave: string;
  nothingToSave: string;
  carbOver: (projected: number, over: number, target: number) => string;
  kcalOver: (projected: number, over: number, target: number) => string;
  proteinLow: (projected: number, expected: number, short: number) => string;
  ruleConflictFallback: (name: string) => string;
};

const EN: FoodLogAlertCopy = {
  nutritionistAlert: 'Nutritionist alert',
  editMealAction: 'Edit meal',
  saveAnyway: 'Save anyway',
  savingMeal: 'Saving meal…',
  updatingFoodLog: 'Updating your food log',
  analyzing: 'Analyzing…',
  permissionRequired: 'Permission required',
  permissionCamera: 'Please allow camera access in Settings.',
  permissionGallery: 'Please allow photo library access in Settings.',
  imageTooLargeTitle: 'Image too large',
  imageTooLargeBody: 'This photo is very large and may fail. Try a smaller image or use the camera instead.',
  aiAnalysisFailed: 'AI analysis failed. Please try again.',
  failedToSave: 'Failed to save. Please try again.',
  nothingToSave: 'Nothing to save — meal items are missing. Edit or re-analyze, then save.',
  carbOver: (projected, over, target) =>
    `Today's carbs would reach ${projected}g (${over}g over your ${target}g target).`,
  kcalOver: (projected, over, target) =>
    `Today's calories would reach ${projected} kcal (${over} over your ${target} target).`,
  proteinLow: (projected, expected, short) =>
    `Protein is behind pace for today (${projected}g vs ~${expected}g expected by now, ~${short}g short).`,
  ruleConflictFallback: (name) => `"${name}" conflicts with your dietary rules.`,
};

const HE: FoodLogAlertCopy = {
  nutritionistAlert: 'התראת תזונה',
  editMealAction: 'עריכת ארוחה',
  saveAnyway: 'שמור בכל זאת',
  savingMeal: 'שומר ארוחה…',
  updatingFoodLog: 'מעדכן את יומן האוכל',
  analyzing: 'מנתח…',
  permissionRequired: 'נדרשת הרשאה',
  permissionCamera: 'אפשרו גישה למצלמה בהגדרות.',
  permissionGallery: 'אפשרו גישה לגלריה בהגדרות.',
  imageTooLargeTitle: 'התמונה גדולה מדי',
  imageTooLargeBody: 'התמונה גדולה מאוד ועלולה להיכשל. נסו תמונה קטנה יותר או השתמשו במצלמה.',
  aiAnalysisFailed: 'ניתוח ה-AI נכשל. נסו שוב.',
  failedToSave: 'השמירה נכשלה. נסו שוב.',
  nothingToSave: 'אין מה לשמור — חסרים פריטי ארוחה. ערכו או נתחו מחדש ושמרו.',
  carbOver: (projected, over, target) =>
    `פחמימות היום יגיעו ל־${projected}ג׳ (${over}ג׳ מעל יעד ${target}ג׳).`,
  kcalOver: (projected, over, target) =>
    `קלוריות היום יגיעו ל־${projected} kcal (${over} מעל יעד ${target}).`,
  proteinLow: (projected, expected, short) =>
    `החלבון מאחור לקצב היום (${projected}ג׳ מול ~${expected}ג׳ צפוי עד עכשיו, חסר ~${short}ג׳).`,
  ruleConflictFallback: (name) => `"${name}" מתנגש עם כללי התזונה שלך.`,
};

const ES: FoodLogAlertCopy = {
  nutritionistAlert: 'Alerta del nutricionista',
  editMealAction: 'Editar comida',
  saveAnyway: 'Guardar de todos modos',
  savingMeal: 'Guardando comida…',
  updatingFoodLog: 'Actualizando tu registro',
  analyzing: 'Analizando…',
  permissionRequired: 'Permiso requerido',
  permissionCamera: 'Permite el acceso a la cámara en Ajustes.',
  permissionGallery: 'Permite el acceso a la galería en Ajustes.',
  imageTooLargeTitle: 'Imagen demasiado grande',
  imageTooLargeBody: 'Esta foto es muy grande y puede fallar. Prueba una más pequeña o usa la cámara.',
  aiAnalysisFailed: 'Falló el análisis de IA. Inténtalo de nuevo.',
  failedToSave: 'No se pudo guardar. Inténtalo de nuevo.',
  nothingToSave: 'Nada que guardar — faltan ítems. Edita o vuelve a analizar y guarda.',
  carbOver: (projected, over, target) =>
    `Los carbos de hoy llegarían a ${projected}g (${over}g sobre tu meta de ${target}g).`,
  kcalOver: (projected, over, target) =>
    `Las calorías de hoy llegarían a ${projected} kcal (${over} sobre tu meta de ${target}).`,
  proteinLow: (projected, expected, short) =>
    `La proteína va retrasada hoy (${projected}g vs ~${expected}g esperados, ~${short}g menos).`,
  ruleConflictFallback: (name) => `"${name}" entra en conflicto con tus reglas alimentarias.`,
};

const FR: FoodLogAlertCopy = {
  nutritionistAlert: 'Alerte nutritionniste',
  editMealAction: 'Modifier le repas',
  saveAnyway: 'Enregistrer quand même',
  savingMeal: 'Enregistrement…',
  updatingFoodLog: 'Mise à jour du journal',
  analyzing: 'Analyse…',
  permissionRequired: 'Autorisation requise',
  permissionCamera: 'Autorisez l’appareil photo dans Réglages.',
  permissionGallery: 'Autorisez la photothèque dans Réglages.',
  imageTooLargeTitle: 'Image trop grande',
  imageTooLargeBody: 'Cette photo est très grande et peut échouer. Essayez une plus petite ou l’appareil photo.',
  aiAnalysisFailed: 'L’analyse IA a échoué. Réessayez.',
  failedToSave: 'Échec de l’enregistrement. Réessayez.',
  nothingToSave: 'Rien à enregistrer — éléments manquants. Modifiez ou réanalysez, puis enregistrez.',
  carbOver: (projected, over, target) =>
    `Les glucides du jour atteindraient ${projected}g (${over}g au-dessus de votre objectif de ${target}g).`,
  kcalOver: (projected, over, target) =>
    `Les calories du jour atteindraient ${projected} kcal (${over} au-dessus de votre objectif de ${target}).`,
  proteinLow: (projected, expected, short) =>
    `Protéines en retard aujourd’hui (${projected}g vs ~${expected}g attendus, ~${short}g de moins).`,
  ruleConflictFallback: (name) => `"${name}" est en conflit avec vos règles alimentaires.`,
};

const DE: FoodLogAlertCopy = {
  nutritionistAlert: 'Ernährungswarnung',
  editMealAction: 'Mahlzeit bearbeiten',
  saveAnyway: 'Trotzdem speichern',
  savingMeal: 'Mahlzeit wird gespeichert…',
  updatingFoodLog: 'Essensprotokoll wird aktualisiert',
  analyzing: 'Analysiere…',
  permissionRequired: 'Berechtigung erforderlich',
  permissionCamera: 'Bitte Kamerazugriff in den Einstellungen erlauben.',
  permissionGallery: 'Bitte Galeriezugriff in den Einstellungen erlauben.',
  imageTooLargeTitle: 'Bild zu groß',
  imageTooLargeBody: 'Dieses Foto ist sehr groß und kann fehlschlagen. Kleineres Bild oder Kamera nutzen.',
  aiAnalysisFailed: 'KI-Analyse fehlgeschlagen. Bitte erneut versuchen.',
  failedToSave: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
  nothingToSave: 'Nichts zu speichern — Einträge fehlen. Bearbeiten oder neu analysieren, dann speichern.',
  carbOver: (projected, over, target) =>
    `Kohlenhydrate heute würden ${projected}g erreichen (${over}g über Ihrem Ziel von ${target}g).`,
  kcalOver: (projected, over, target) =>
    `Kalorien heute würden ${projected} kcal erreichen (${over} über Ihrem Ziel von ${target}).`,
  proteinLow: (projected, expected, short) =>
    `Protein liegt heute hinter dem Tempo (${projected}g vs ~${expected}g erwartet, ~${short}g fehlend).`,
  ruleConflictFallback: (name) => `"${name}" widerspricht Ihren Ernährungsregeln.`,
};

const AR: FoodLogAlertCopy = {
  nutritionistAlert: 'تنبيه أخصائي التغذية',
  editMealAction: 'تعديل الوجبة',
  saveAnyway: 'حفظ على أي حال',
  savingMeal: 'جارٍ حفظ الوجبة…',
  updatingFoodLog: 'تحديث سجل الطعام',
  analyzing: 'جارٍ التحليل…',
  permissionRequired: 'الإذن مطلوب',
  permissionCamera: 'اسمح بالوصول إلى الكاميرا في الإعدادات.',
  permissionGallery: 'اسمح بالوصول إلى المعرض في الإعدادات.',
  imageTooLargeTitle: 'الصورة كبيرة جداً',
  imageTooLargeBody: 'هذه الصورة كبيرة جداً وقد تفشل. جرّب صورة أصغر أو الكاميرا.',
  aiAnalysisFailed: 'فشل تحليل الذكاء الاصطناعي. حاول مرة أخرى.',
  failedToSave: 'فشل الحفظ. حاول مرة أخرى.',
  nothingToSave: 'لا شيء للحفظ — عناصر الوجبة مفقودة. عدّل أو حلّل مجدداً ثم احفظ.',
  carbOver: (projected, over, target) =>
    `كربوهيدرات اليوم ستصل إلى ${projected}غ (${over}غ فوق هدفك ${target}غ).`,
  kcalOver: (projected, over, target) =>
    `سعرات اليوم ستصل إلى ${projected} kcal (${over} فوق هدفك ${target}).`,
  proteinLow: (projected, expected, short) =>
    `البروتين متأخر اليوم (${projected}غ مقابل ~${expected}غ متوقع، ينقص ~${short}غ).`,
  ruleConflictFallback: (name) => `"${name}" يتعارض مع قواعدك الغذائية.`,
};

const RU: FoodLogAlertCopy = {
  nutritionistAlert: 'Предупреждение нутрициолога',
  editMealAction: 'Изменить приём',
  saveAnyway: 'Всё равно сохранить',
  savingMeal: 'Сохранение…',
  updatingFoodLog: 'Обновление журнала еды',
  analyzing: 'Анализ…',
  permissionRequired: 'Нужно разрешение',
  permissionCamera: 'Разрешите доступ к камере в настройках.',
  permissionGallery: 'Разрешите доступ к галерее в настройках.',
  imageTooLargeTitle: 'Слишком большое изображение',
  imageTooLargeBody: 'Фото слишком большое и может не загрузиться. Попробуйте меньше или камеру.',
  aiAnalysisFailed: 'Анализ ИИ не удался. Попробуйте снова.',
  failedToSave: 'Не удалось сохранить. Попробуйте снова.',
  nothingToSave: 'Нечего сохранять — нет позиций. Измените или проанализируйте снова.',
  carbOver: (projected, over, target) =>
    `Углеводы за день достигнут ${projected}г (${over}г сверх цели ${target}г).`,
  kcalOver: (projected, over, target) =>
    `Калории за день достигнут ${projected} kcal (${over} сверх цели ${target}).`,
  proteinLow: (projected, expected, short) =>
    `Белок отстаёт сегодня (${projected}г при ~${expected}г к этому времени, не хватает ~${short}г).`,
  ruleConflictFallback: (name) => `"${name}" противоречит вашим правилам питания.`,
};

const PT: FoodLogAlertCopy = {
  nutritionistAlert: 'Alerta do nutricionista',
  editMealAction: 'Editar refeição',
  saveAnyway: 'Salvar mesmo assim',
  savingMeal: 'Salvando refeição…',
  updatingFoodLog: 'Atualizando o diário',
  analyzing: 'Analisando…',
  permissionRequired: 'Permissão necessária',
  permissionCamera: 'Permita o acesso à câmera em Ajustes.',
  permissionGallery: 'Permita o acesso à galeria em Ajustes.',
  imageTooLargeTitle: 'Imagem muito grande',
  imageTooLargeBody: 'Esta foto é muito grande e pode falhar. Tente uma menor ou use a câmera.',
  aiAnalysisFailed: 'A análise de IA falhou. Tente de novo.',
  failedToSave: 'Falha ao salvar. Tente de novo.',
  nothingToSave: 'Nada para salvar — itens ausentes. Edite ou analise de novo e salve.',
  carbOver: (projected, over, target) =>
    `Os carboidratos de hoje chegariam a ${projected}g (${over}g acima da meta de ${target}g).`,
  kcalOver: (projected, over, target) =>
    `As calorias de hoje chegariam a ${projected} kcal (${over} acima da meta de ${target}).`,
  proteinLow: (projected, expected, short) =>
    `Proteína atrasada hoje (${projected}g vs ~${expected}g esperados, ~${short}g a menos).`,
  ruleConflictFallback: (name) => `"${name}" conflita com suas regras alimentares.`,
};

const IT: FoodLogAlertCopy = {
  nutritionistAlert: 'Avviso nutrizionista',
  editMealAction: 'Modifica pasto',
  saveAnyway: 'Salva comunque',
  savingMeal: 'Salvataggio…',
  updatingFoodLog: 'Aggiornamento del diario',
  analyzing: 'Analisi…',
  permissionRequired: 'Autorizzazione richiesta',
  permissionCamera: 'Consenti l’accesso alla fotocamera nelle Impostazioni.',
  permissionGallery: 'Consenti l’accesso alla galleria nelle Impostazioni.',
  imageTooLargeTitle: 'Immagine troppo grande',
  imageTooLargeBody: 'Questa foto è molto grande e può fallire. Prova una più piccola o la fotocamera.',
  aiAnalysisFailed: 'Analisi IA non riuscita. Riprova.',
  failedToSave: 'Salvataggio non riuscito. Riprova.',
  nothingToSave: 'Niente da salvare — voci mancanti. Modifica o rianalizza, poi salva.',
  carbOver: (projected, over, target) =>
    `I carboidrati di oggi raggiungerebbero ${projected}g (${over}g oltre il tuo obiettivo di ${target}g).`,
  kcalOver: (projected, over, target) =>
    `Le calorie di oggi raggiungerebbero ${projected} kcal (${over} oltre il tuo obiettivo di ${target}).`,
  proteinLow: (projected, expected, short) =>
    `Proteine indietro oggi (${projected}g vs ~${expected}g attesi, ~${short}g in meno).`,
  ruleConflictFallback: (name) => `"${name}" è in conflitto con le tue regole alimentari.`,
};

const TR: FoodLogAlertCopy = {
  nutritionistAlert: 'Diyetisyen uyarısı',
  editMealAction: 'Öğünü düzenle',
  saveAnyway: 'Yine de kaydet',
  savingMeal: 'Öğün kaydediliyor…',
  updatingFoodLog: 'Yemek günlüğü güncelleniyor',
  analyzing: 'Analiz ediliyor…',
  permissionRequired: 'İzin gerekli',
  permissionCamera: 'Ayarlardan kamera erişimine izin verin.',
  permissionGallery: 'Ayarlardan galeri erişimine izin verin.',
  imageTooLargeTitle: 'Görüntü çok büyük',
  imageTooLargeBody: 'Bu fotoğraf çok büyük ve başarısız olabilir. Daha küçük deneyin veya kamerayı kullanın.',
  aiAnalysisFailed: 'Yapay zeka analizi başarısız. Tekrar deneyin.',
  failedToSave: 'Kaydetme başarısız. Tekrar deneyin.',
  nothingToSave: 'Kaydedilecek bir şey yok — öğeler eksik. Düzenleyin veya yeniden analiz edin.',
  carbOver: (projected, over, target) =>
    `Bugünkü karbonhidrat ${projected}g olur (${target}g hedefinizin ${over}g üzerinde).`,
  kcalOver: (projected, over, target) =>
    `Bugünkü kalori ${projected} kcal olur (${target} hedefinizin ${over} üzerinde).`,
  proteinLow: (projected, expected, short) =>
    `Protein bugün geride (${projected}g vs beklenen ~${expected}g, ~${short}g eksik).`,
  ruleConflictFallback: (name) => `"${name}" beslenme kurallarınızla çakışıyor.`,
};

const BY_CODE: Record<string, FoodLogAlertCopy> = {
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

export function getFoodLogAlertCopy(langCode?: string | null): FoodLogAlertCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return BY_CODE[c] ?? EN;
}
