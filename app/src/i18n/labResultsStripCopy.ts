/**
 * Lab results strip chrome — coach language locales.
 * Panel codes / analyte codes stay English (glossary).
 */

export type LabResultsStripCopy = {
  title: string;
  addReport: string;
  emptyHint: string;
  tests: string;
  testsCount: (n: number) => string;
  view: string;
  exportLabel: string;
  importLabel: string;
  collapseA11y: string;
  expandA11y: string;
  savedTitle: string;
  savedBody: string;
  exportFailed: string;
  importTitle: string;
  importNone: string;
  importComplete: string;
  importCount: (n: number) => string;
  importFailed: string;
  trendHint: string;
  modalTitle: string;
  save: string;
  deleteReport: string;
  deleteConfirmTitle: string;
  deleteConfirmBody: string;
  deleteCancel: string;
  deleteFailed: string;
  deletedTitle: string;
  deletedBody: string;
  choosePdf: string;
  saving: string;
  reading: string;
  lipidTrendsTitle: string;
  lipidCollapseA11y: string;
  lipidExpandA11y: string;
  customTrendTitle: string;
  customCollapseA11y: string;
  customExpandA11y: string;
  customPickPlaceholder: string;
  customSearchPlaceholder: string;
  customNeedTwo: string;
  customNoMarkers: string;
  customClear: string;
  /** prompt112 — HMO confirm before parse */
  identifyingPdf: string;
  providerConfirmTitle: string;
  providerConfirmBody: (name: string) => string;
  /** When Pass 1 returned unknown — ask user to pick. */
  providerConfirmUnknownBody: string;
  providerContinue: (name: string) => string;
  providerNotSure: string;
  providerClalit: string;
  providerMeuhedet: string;
  providerMaccabi: string;
  providerLeumit: string;
  /** prompt113 — country gate (chrome only; country/provider names from server) */
  countryPickerTitle: string;
  countryPickerBody: string;
  countryRequired: string;
  countrySelectedLabel: (name: string) => string;
  changeCountry: string;
  chooseCountryCta: string;
  loadingCountries: string;
};

const EN: LabResultsStripCopy = {
  title: 'LAB RESULTS',
  addReport: 'Add report',
  emptyHint: 'Import a Clalit online lab PDF',
  tests: 'tests',
  testsCount: (n) => `${n} test${n === 1 ? '' : 's'}`,
  view: 'view',
  exportLabel: 'Export',
  importLabel: 'Import',
  collapseA11y: 'Collapse lab results',
  expandA11y: 'Expand lab results',
  savedTitle: 'Saved',
  savedBody: 'Mentors can now see these results',
  exportFailed: 'Export failed',
  importTitle: 'Import',
  importNone: 'No new reports in file',
  importComplete: 'Import complete',
  importCount: (n) => `${n} report${n === 1 ? '' : 's'} imported`,
  importFailed: 'Import failed',
  trendHint: 'Import another draw to see cholesterol trends',
  modalTitle: 'Lab results',
  save: 'Save',
  deleteReport: 'Delete report',
  deleteConfirmTitle: 'Delete this lab report?',
  deleteConfirmBody: 'Removes this draw from the phone. Re-import the PDF for a clean parse.',
  deleteCancel: 'Cancel',
  deleteFailed: 'Could not delete report',
  deletedTitle: 'Deleted',
  deletedBody: 'Lab report removed. You can import the PDF again.',
  choosePdf: 'Choose PDF',
  saving: 'Saving…',
  reading: 'Reading lab report…',
  lipidTrendsTitle: 'Cholesterol trends',
  lipidCollapseA11y: 'Collapse cholesterol trends',
  lipidExpandA11y: 'Expand cholesterol trends',
  customTrendTitle: 'Lab trend',
  customCollapseA11y: 'Collapse lab trend',
  customExpandA11y: 'Expand lab trend',
  customPickPlaceholder: 'Choose a lab test…',
  customSearchPlaceholder: 'Search tests',
  customNeedTwo: 'Import another draw to chart this test',
  customNoMarkers: 'No other lab tests to chart yet',
  customClear: 'Clear',
  identifyingPdf: 'Checking which HMO printed this…',
  providerConfirmTitle: 'Which lab portal?',
  providerConfirmBody: (name) =>
    `This looks like ${name}. Confirm for a more accurate read — especially Meuhedet gauges.`,
  providerConfirmUnknownBody:
    "Couldn't tell which portal. Pick one below — Meuhedet gauges need the right layout.",
  providerContinue: (name) => `Continue as ${name}`,
  providerNotSure: 'Not sure — use default',
  providerClalit: 'Clalit',
  providerMeuhedet: 'Meuhedet',
  providerMaccabi: 'Maccabi',
  providerLeumit: 'Leumit',
  countryPickerTitle: 'Where are your lab reports from?',
  countryPickerBody:
    'Pick a country first — we use the right layout pack for that country’s labs. This is not your app language.',
  countryRequired: 'Choose a country before importing a PDF.',
  countrySelectedLabel: (name) => `Lab country: ${name}`,
  changeCountry: 'Change country',
  chooseCountryCta: 'Choose country',
  loadingCountries: 'Loading countries…',
};

const HE: LabResultsStripCopy = {
  title: 'תוצאות מעבדה',
  addReport: 'הוסף דוח',
  emptyHint: 'ייבאו PDF מכללית און־ליין',
  tests: 'בדיקות',
  testsCount: (n) => `${n} בדיקות`,
  view: 'צפייה',
  exportLabel: 'ייצוא',
  importLabel: 'ייבוא',
  collapseA11y: 'כווץ תוצאות מעבדה',
  expandA11y: 'הרחב תוצאות מעבדה',
  savedTitle: 'נשמר',
  savedBody: 'המנטורים יכולים לראות את התוצאות',
  exportFailed: 'ייצוא נכשל',
  importTitle: 'ייבוא',
  importNone: 'לא נמצאו דוחות חדשים',
  importComplete: 'ייבוא הושלם',
  importCount: (n) => `${n} דוחות יובאו`,
  importFailed: 'ייבוא נכשל',
  trendHint: 'ייבאו דוח נוסף כדי לראות מגמת כולסטרול',
  modalTitle: 'תוצאות מעבדה',
  save: 'שמור',
  deleteReport: 'מחק דוח',
  deleteConfirmTitle: 'למחוק את דוח המעבדה?',
  deleteConfirmBody: 'הדוח יוסר מהטלפון. אפשר לייבא שוב את ה־PDF לקריאה נקייה.',
  deleteCancel: 'ביטול',
  deleteFailed: 'לא ניתן למחוק את הדוח',
  deletedTitle: 'נמחק',
  deletedBody: 'הדוח הוסר. אפשר לייבא את ה־PDF שוב.',
  choosePdf: 'בחר PDF',
  saving: 'שומר…',
  reading: 'קורא את הדוח…',
  lipidTrendsTitle: 'מגמת כולסטרול',
  lipidCollapseA11y: 'כווץ מגמת כולסטרול',
  lipidExpandA11y: 'הרחב מגמת כולסטרול',
  customTrendTitle: 'מגמת מעבדה',
  customCollapseA11y: 'כווץ מגמת מעבדה',
  customExpandA11y: 'הרחב מגמת מעבדה',
  customPickPlaceholder: 'בחרו בדיקת מעבדה…',
  customSearchPlaceholder: 'חיפוש בדיקות',
  customNeedTwo: 'ייבאו דגימה נוספת כדי לשרטט את הבדיקה',
  customNoMarkers: 'אין עדיין בדיקות אחרות לשרטוט',
  customClear: 'נקה',
  identifyingPdf: 'בודקים איזו קופת חולים הדפיסה…',
  providerConfirmTitle: 'איזו מערכת מעבדה?',
  providerConfirmBody: (name) =>
    `נראה שזה ${name}. אשרו לקריאה מדויקת יותר — במיוחד במאוחדת.`,
  providerConfirmUnknownBody:
    'לא זיהינו את המערכת. בחרו למטה — במאוחדת חשוב לבחור נכון בגלל הסרגלים.',
  providerContinue: (name) => `המשך כ־${name}`,
  providerNotSure: 'לא בטוחים — ברירת מחדל',
  providerClalit: 'כללית',
  providerMeuhedet: 'מאוחדת',
  providerMaccabi: 'מכבי',
  providerLeumit: 'לאומית',
  countryPickerTitle: 'מאיזו מדינה דוחות המעבדה?',
  countryPickerBody:
    'בחרו מדינה לפני הייבוא — לכל מדינה מודל קריאה משלה. זו לא שפת האפליקציה.',
  countryRequired: 'בחרו מדינה לפני ייבוא PDF.',
  countrySelectedLabel: (name) => `מדינת מעבדה: ${name}`,
  changeCountry: 'החלפת מדינה',
  chooseCountryCta: 'בחירת מדינה',
  loadingCountries: 'טוענים מדינות…',
};

const ES: LabResultsStripCopy = {
  title: 'RESULTADOS DE LABORATORIO',
  addReport: 'Añadir informe',
  emptyHint: 'Importa un PDF de laboratorio (p. ej. Clalit online)',
  tests: 'pruebas',
  testsCount: (n) => `${n} prueba${n === 1 ? '' : 's'}`,
  view: 'ver',
  exportLabel: 'Exportar',
  importLabel: 'Importar',
  collapseA11y: 'Contraer resultados de laboratorio',
  expandA11y: 'Expandir resultados de laboratorio',
  savedTitle: 'Guardado',
  savedBody: 'Los mentores ya pueden ver estos resultados',
  exportFailed: 'Error al exportar',
  importTitle: 'Importar',
  importNone: 'No hay informes nuevos en el archivo',
  importComplete: 'Importación completada',
  importCount: (n) => `${n} informe${n === 1 ? '' : 's'} importado${n === 1 ? '' : 's'}`,
  importFailed: 'Error al importar',
  trendHint: 'Importa otro análisis para ver la tendencia del colesterol',
  modalTitle: 'Resultados de laboratorio',
  save: 'Guardar',
  deleteReport: 'Eliminar informe',
  deleteConfirmTitle: '¿Eliminar este informe?',
  deleteConfirmBody: 'Se quita del teléfono. Vuelve a importar el PDF para un análisis limpio.',
  deleteCancel: 'Cancelar',
  deleteFailed: 'No se pudo eliminar',
  deletedTitle: 'Eliminado',
  deletedBody: 'Informe eliminado. Puedes importar el PDF de nuevo.',
  choosePdf: 'Elegir PDF',
  saving: 'Guardando…',
  reading: 'Leyendo el informe…',
  lipidTrendsTitle: 'Tendencias de colesterol',
  lipidCollapseA11y: 'Contraer tendencias de colesterol',
  lipidExpandA11y: 'Expandir tendencias de colesterol',
  customTrendTitle: 'Tendencia de laboratorio',
  customCollapseA11y: 'Contraer tendencia de laboratorio',
  customExpandA11y: 'Expandir tendencia de laboratorio',
  customPickPlaceholder: 'Elegir una prueba…',
  customSearchPlaceholder: 'Buscar pruebas',
  customNeedTwo: 'Importe otra extracción para graficar esta prueba',
  customNoMarkers: 'Aún no hay otras pruebas para graficar',
  customClear: 'Borrar',
  identifyingPdf: 'Comprobando qué portal imprimió esto…',
  providerConfirmTitle: '¿Qué laboratorio?',
  providerConfirmBody: (name) =>
    `Parece ${name}. Confirma para una lectura más precisa — sobre todo Meuhedet.`,
  providerConfirmUnknownBody:
    'No se pudo identificar el portal. Elige abajo — Meuhedet necesita el diseño correcto.',
  providerContinue: (name) => `Continuar como ${name}`,
  providerNotSure: 'No estoy seguro — predeterminado',
  providerClalit: 'Clalit',
  providerMeuhedet: 'Meuhedet',
  providerMaccabi: 'Maccabi',
  providerLeumit: 'Leumit',
  countryPickerTitle: '¿De qué país son tus análisis?',
  countryPickerBody:
    'Elige un país antes de importar — cada país tiene su propio modelo de lectura. No es el idioma de la app.',
  countryRequired: 'Elige un país antes de importar un PDF.',
  countrySelectedLabel: (name) => `País del laboratorio: ${name}`,
  changeCountry: 'Cambiar país',
  chooseCountryCta: 'Elegir país',
  loadingCountries: 'Cargando países…',
};

const FR: LabResultsStripCopy = {
  title: "RÉSULTATS D'ANALYSES",
  addReport: 'Ajouter un rapport',
  emptyHint: 'Importer un PDF de laboratoire (ex. Clalit en ligne)',
  tests: 'analyses',
  testsCount: (n) => `${n} analyse${n === 1 ? '' : 's'}`,
  view: 'voir',
  exportLabel: 'Exporter',
  importLabel: 'Importer',
  collapseA11y: "Réduire les résultats d'analyses",
  expandA11y: "Développer les résultats d'analyses",
  savedTitle: 'Enregistré',
  savedBody: 'Les mentors peuvent maintenant voir ces résultats',
  exportFailed: "Échec de l'export",
  importTitle: 'Import',
  importNone: 'Aucun nouveau rapport dans le fichier',
  importComplete: 'Import terminé',
  importCount: (n) => `${n} rapport${n === 1 ? '' : 's'} importé${n === 1 ? '' : 's'}`,
  importFailed: "Échec de l'import",
  trendHint: 'Importez un autre bilan pour voir la tendance du cholestérol',
  modalTitle: "Résultats d'analyses",
  save: 'Enregistrer',
  deleteReport: 'Supprimer le rapport',
  deleteConfirmTitle: 'Supprimer ce rapport ?',
  deleteConfirmBody: 'Retiré du téléphone. Réimportez le PDF pour une lecture propre.',
  deleteCancel: 'Annuler',
  deleteFailed: 'Impossible de supprimer',
  deletedTitle: 'Supprimé',
  deletedBody: 'Rapport supprimé. Vous pouvez réimporter le PDF.',
  choosePdf: 'Choisir un PDF',
  saving: 'Enregistrement…',
  reading: 'Lecture du rapport…',
  lipidTrendsTitle: 'Tendances cholestérol',
  lipidCollapseA11y: 'Réduire les tendances cholestérol',
  lipidExpandA11y: 'Développer les tendances cholestérol',
  customTrendTitle: 'Tendance analyse',
  customCollapseA11y: 'Réduire la tendance analyse',
  customExpandA11y: 'Développer la tendance analyse',
  customPickPlaceholder: 'Choisir une analyse…',
  customSearchPlaceholder: 'Rechercher',
  customNeedTwo: 'Importez un autre prélèvement pour tracer cette analyse',
  customNoMarkers: 'Pas encore d’autres analyses à tracer',
  customClear: 'Effacer',
  identifyingPdf: 'Vérification du portail labo…',
  providerConfirmTitle: 'Quel portail labo ?',
  providerConfirmBody: (name) =>
    `Cela ressemble à ${name}. Confirmez pour une lecture plus précise — surtout Meuhedet.`,
  providerConfirmUnknownBody:
    'Portail non reconnu. Choisissez ci-dessous — Meuhedet a besoin du bon modèle.',
  providerContinue: (name) => `Continuer comme ${name}`,
  providerNotSure: 'Pas sûr — défaut',
  providerClalit: 'Clalit',
  providerMeuhedet: 'Meuhedet',
  providerMaccabi: 'Maccabi',
  providerLeumit: 'Leumit',
  countryPickerTitle: 'De quel pays viennent vos analyses ?',
  countryPickerBody:
    'Choisissez un pays avant d’importer — chaque pays a son modèle de lecture. Ce n’est pas la langue de l’app.',
  countryRequired: 'Choisissez un pays avant d’importer un PDF.',
  countrySelectedLabel: (name) => `Pays du labo : ${name}`,
  changeCountry: 'Changer de pays',
  chooseCountryCta: 'Choisir le pays',
  loadingCountries: 'Chargement des pays…',
};

const DE: LabResultsStripCopy = {
  title: 'LABORERGEBNISSE',
  addReport: 'Bericht hinzufügen',
  emptyHint: 'Labor-PDF importieren (z. B. Clalit online)',
  tests: 'Werte',
  testsCount: (n) => `${n} Wert${n === 1 ? '' : 'e'}`,
  view: 'anzeigen',
  exportLabel: 'Exportieren',
  importLabel: 'Importieren',
  collapseA11y: 'Laborergebnisse einklappen',
  expandA11y: 'Laborergebnisse ausklappen',
  savedTitle: 'Gespeichert',
  savedBody: 'Mentoren können diese Ergebnisse jetzt sehen',
  exportFailed: 'Export fehlgeschlagen',
  importTitle: 'Import',
  importNone: 'Keine neuen Berichte in der Datei',
  importComplete: 'Import abgeschlossen',
  importCount: (n) => `${n} Bericht${n === 1 ? '' : 'e'} importiert`,
  importFailed: 'Import fehlgeschlagen',
  trendHint: 'Weiteren Befund importieren, um den Cholesterin-Trend zu sehen',
  modalTitle: 'Laborergebnisse',
  save: 'Speichern',
  deleteReport: 'Bericht löschen',
  deleteConfirmTitle: 'Diesen Laborbericht löschen?',
  deleteConfirmBody: 'Wird vom Telefon entfernt. PDF erneut importieren für eine saubere Auswertung.',
  deleteCancel: 'Abbrechen',
  deleteFailed: 'Löschen fehlgeschlagen',
  deletedTitle: 'Gelöscht',
  deletedBody: 'Bericht entfernt. Sie können das PDF erneut importieren.',
  choosePdf: 'PDF wählen',
  saving: 'Speichern…',
  reading: 'Befund wird gelesen…',
  lipidTrendsTitle: 'Cholesterin-Trends',
  lipidCollapseA11y: 'Cholesterin-Trends einklappen',
  lipidExpandA11y: 'Cholesterin-Trends ausklappen',
  customTrendTitle: 'Labor-Trend',
  customCollapseA11y: 'Labor-Trend einklappen',
  customExpandA11y: 'Labor-Trend ausklappen',
  customPickPlaceholder: 'Laborwert wählen…',
  customSearchPlaceholder: 'Werte suchen',
  customNeedTwo: 'Importieren Sie eine weitere Entnahme für dieses Diagramm',
  customNoMarkers: 'Noch keine anderen Laborwerte zum Diagramm',
  customClear: 'Löschen',
  identifyingPdf: 'Prüfe, welches Portal das gedruckt hat…',
  providerConfirmTitle: 'Welches Lab-Portal?',
  providerConfirmBody: (name) =>
    `Sieht aus wie ${name}. Bestätigen für genauere Lesung — besonders Meuhedet.`,
  providerConfirmUnknownBody:
    'Portal unklar. Unten wählen — Meuhedet braucht das richtige Layout.',
  providerContinue: (name) => `Weiter als ${name}`,
  providerNotSure: 'Unsicher — Standard',
  providerClalit: 'Clalit',
  providerMeuhedet: 'Meuhedet',
  providerMaccabi: 'Maccabi',
  providerLeumit: 'Leumit',
  countryPickerTitle: 'Aus welchem Land sind die Laborberichte?',
  countryPickerBody:
    'Land zuerst wählen — jedes Land hat ein eigenes Lesemodell. Das ist nicht die App-Sprache.',
  countryRequired: 'Land wählen, bevor Sie ein PDF importieren.',
  countrySelectedLabel: (name) => `Laborland: ${name}`,
  changeCountry: 'Land ändern',
  chooseCountryCta: 'Land wählen',
  loadingCountries: 'Länder werden geladen…',
};

const AR: LabResultsStripCopy = {
  title: 'نتائج المختبر',
  addReport: 'إضافة تقرير',
  emptyHint: 'استورد ملف PDF من مختبر (مثل Clalit عبر الإنترنت)',
  tests: 'فحوصات',
  testsCount: (n) => `${n} فحوصات`,
  view: 'عرض',
  exportLabel: 'تصدير',
  importLabel: 'استيراد',
  collapseA11y: 'طي نتائج المختبر',
  expandA11y: 'توسيع نتائج المختبر',
  savedTitle: 'تم الحفظ',
  savedBody: 'يمكن للمرشدين الآن رؤية هذه النتائج',
  exportFailed: 'فشل التصدير',
  importTitle: 'استيراد',
  importNone: 'لا توجد تقارير جديدة في الملف',
  importComplete: 'اكتمل الاستيراد',
  importCount: (n) => `تم استيراد ${n} تقارير`,
  importFailed: 'فشل الاستيراد',
  trendHint: 'استورد تحليلاً آخر لرؤية اتجاه الكوليسترول',
  modalTitle: 'نتائج المختبر',
  save: 'حفظ',
  deleteReport: 'حذف التقرير',
  deleteConfirmTitle: 'حذف تقرير المختبر؟',
  deleteConfirmBody: 'يُزال من الهاتف. أعد استيراد الـ PDF لقراءة نظيفة.',
  deleteCancel: 'إلغاء',
  deleteFailed: 'تعذّر الحذف',
  deletedTitle: 'تم الحذف',
  deletedBody: 'أُزيل التقرير. يمكنك استيراد الـ PDF مجددًا.',
  choosePdf: 'اختر PDF',
  saving: 'جارٍ الحفظ…',
  reading: 'جارٍ قراءة التقرير…',
  lipidTrendsTitle: 'اتجاهات الكوليسترول',
  lipidCollapseA11y: 'طي اتجاهات الكوليسترول',
  lipidExpandA11y: 'توسيع اتجاهات الكوليسترول',
  customTrendTitle: 'اتجاه المختبر',
  customCollapseA11y: 'طي اتجاه المختبر',
  customExpandA11y: 'توسيع اتجاه المختبر',
  customPickPlaceholder: 'اختر فحصاً…',
  customSearchPlaceholder: 'بحث في الفحوصات',
  customNeedTwo: 'استورد سحباً آخر لرسم هذا الفحص',
  customNoMarkers: 'لا توجد فحوصات أخرى للرسم بعد',
  customClear: 'مسح',
  identifyingPdf: 'جارٍ التعرّف على بوابة المختبر…',
  providerConfirmTitle: 'أي بوابة مختبر؟',
  providerConfirmBody: (name) =>
    `يبدو أن هذا ${name}. أكّدوا لقراءة أدق — خاصة Meuhedet.`,
  providerConfirmUnknownBody:
    'لم نتعرف على البوابة. اختاروا من الأسفل — Meuhedet يحتاج التخطيط الصحيح.',
  providerContinue: (name) => `متابعة كـ ${name}`,
  providerNotSure: 'غير متأكد — افتراضي',
  providerClalit: 'Clalit',
  providerMeuhedet: 'Meuhedet',
  providerMaccabi: 'Maccabi',
  providerLeumit: 'Leumit',
  countryPickerTitle: 'من أي بلد تقارير المختبر؟',
  countryPickerBody:
    'اختاروا بلداً قبل الاستيراد — لكل بلد نموذج قراءة خاص. هذه ليست لغة التطبيق.',
  countryRequired: 'اختاروا بلداً قبل استيراد PDF.',
  countrySelectedLabel: (name) => `بلد المختبر: ${name}`,
  changeCountry: 'تغيير البلد',
  chooseCountryCta: 'اختيار البلد',
  loadingCountries: 'جارٍ تحميل البلدان…',
};

const RU: LabResultsStripCopy = {
  title: 'РЕЗУЛЬТАТЫ АНАЛИЗОВ',
  addReport: 'Добавить отчёт',
  emptyHint: 'Импортируйте PDF лабораторных анализов (например Clalit online)',
  tests: 'показателей',
  testsCount: (n) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} показатель`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} показателя`;
    return `${n} показателей`;
  },
  view: 'смотреть',
  exportLabel: 'Экспорт',
  importLabel: 'Импорт',
  collapseA11y: 'Свернуть результаты анализов',
  expandA11y: 'Развернуть результаты анализов',
  savedTitle: 'Сохранено',
  savedBody: 'Менторы теперь могут видеть эти результаты',
  exportFailed: 'Ошибка экспорта',
  importTitle: 'Импорт',
  importNone: 'В файле нет новых отчётов',
  importComplete: 'Импорт завершён',
  importCount: (n) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `Импортирован ${n} отчёт`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `Импортировано ${n} отчёта`;
    return `Импортировано ${n} отчётов`;
  },
  importFailed: 'Ошибка импорта',
  trendHint: 'Импортируйте ещё один анализ, чтобы увидеть тренд холестерина',
  modalTitle: 'Результаты анализов',
  save: 'Сохранить',
  deleteReport: 'Удалить отчёт',
  deleteConfirmTitle: 'Удалить этот отчёт?',
  deleteConfirmBody: 'Отчёт удалится с телефона. Импортируйте PDF снова для чистого разбора.',
  deleteCancel: 'Отмена',
  deleteFailed: 'Не удалось удалить',
  deletedTitle: 'Удалено',
  deletedBody: 'Отчёт удалён. Можно снова импортировать PDF.',
  choosePdf: 'Выбрать PDF',
  saving: 'Сохранение…',
  reading: 'Чтение отчёта…',
  lipidTrendsTitle: 'Тренды холестерина',
  lipidCollapseA11y: 'Свернуть тренды холестерина',
  lipidExpandA11y: 'Развернуть тренды холестерина',
  customTrendTitle: 'Тренд анализа',
  customCollapseA11y: 'Свернуть тренд анализа',
  customExpandA11y: 'Развернуть тренд анализа',
  customPickPlaceholder: 'Выберите анализ…',
  customSearchPlaceholder: 'Поиск анализов',
  customNeedTwo: 'Импортируйте ещё один забор, чтобы построить график',
  customNoMarkers: 'Пока нет других анализов для графика',
  customClear: 'Очистить',
  identifyingPdf: 'Определяем портал лаборатории…',
  providerConfirmTitle: 'Какой портал лаборатории?',
  providerConfirmBody: (name) =>
    `Похоже на ${name}. Подтвердите для более точного чтения — особенно Meuhedet.`,
  providerConfirmUnknownBody:
    'Портал не распознан. Выберите ниже — Meuhedet нужен правильный макет.',
  providerContinue: (name) => `Продолжить как ${name}`,
  providerNotSure: 'Не уверен — по умолчанию',
  providerClalit: 'Clalit',
  providerMeuhedet: 'Meuhedet',
  providerMaccabi: 'Maccabi',
  providerLeumit: 'Leumit',
  countryPickerTitle: 'Из какой страны анализы?',
  countryPickerBody:
    'Сначала выберите страну — у каждой свой пакет разбора. Это не язык приложения.',
  countryRequired: 'Выберите страну перед импортом PDF.',
  countrySelectedLabel: (name) => `Страна лаборатории: ${name}`,
  changeCountry: 'Сменить страну',
  chooseCountryCta: 'Выбрать страну',
  loadingCountries: 'Загрузка стран…',
};

const PT: LabResultsStripCopy = {
  title: 'RESULTADOS DE LABORATÓRIO',
  addReport: 'Adicionar laudo',
  emptyHint: 'Importe um PDF de laboratório (ex.: Clalit online)',
  tests: 'exames',
  testsCount: (n) => `${n} exame${n === 1 ? '' : 's'}`,
  view: 'ver',
  exportLabel: 'Exportar',
  importLabel: 'Importar',
  collapseA11y: 'Recolher resultados de laboratório',
  expandA11y: 'Expandir resultados de laboratório',
  savedTitle: 'Salvo',
  savedBody: 'Os mentores já podem ver estes resultados',
  exportFailed: 'Falha na exportação',
  importTitle: 'Importar',
  importNone: 'Nenhum laudo novo no arquivo',
  importComplete: 'Importação concluída',
  importCount: (n) => `${n} laudo${n === 1 ? '' : 's'} importado${n === 1 ? '' : 's'}`,
  importFailed: 'Falha na importação',
  trendHint: 'Importe outro exame para ver a tendência do colesterol',
  modalTitle: 'Resultados de laboratório',
  save: 'Salvar',
  deleteReport: 'Excluir laudo',
  deleteConfirmTitle: 'Excluir este laudo?',
  deleteConfirmBody: 'Remove do telefone. Importe o PDF de novo para uma leitura limpa.',
  deleteCancel: 'Cancelar',
  deleteFailed: 'Não foi possível excluir',
  deletedTitle: 'Excluído',
  deletedBody: 'Laudo removido. Pode importar o PDF novamente.',
  choosePdf: 'Escolher PDF',
  saving: 'Salvando…',
  reading: 'Lendo o laudo…',
  lipidTrendsTitle: 'Tendências de colesterol',
  lipidCollapseA11y: 'Recolher tendências de colesterol',
  lipidExpandA11y: 'Expandir tendências de colesterol',
  customTrendTitle: 'Tendência de laboratório',
  customCollapseA11y: 'Recolher tendência de laboratório',
  customExpandA11y: 'Expandir tendência de laboratório',
  customPickPlaceholder: 'Escolher um exame…',
  customSearchPlaceholder: 'Pesquisar exames',
  customNeedTwo: 'Importe outra coleta para traçar este exame',
  customNoMarkers: 'Ainda não há outros exames para traçar',
  customClear: 'Limpar',
  identifyingPdf: 'A verificar qual portal imprimiu isto…',
  providerConfirmTitle: 'Qual portal de laboratório?',
  providerConfirmBody: (name) =>
    `Parece ${name}. Confirme para uma leitura mais precisa — sobretudo Meuhedet.`,
  providerConfirmUnknownBody:
    'Não reconhecemos o portal. Escolha abaixo — Meuhedet precisa do layout certo.',
  providerContinue: (name) => `Continuar como ${name}`,
  providerNotSure: 'Não tenho a certeza — predefinido',
  providerClalit: 'Clalit',
  providerMeuhedet: 'Meuhedet',
  providerMaccabi: 'Maccabi',
  providerLeumit: 'Leumit',
  countryPickerTitle: 'De que país são as análises?',
  countryPickerBody:
    'Escolha um país antes de importar — cada país tem o seu modelo de leitura. Não é o idioma da app.',
  countryRequired: 'Escolha um país antes de importar um PDF.',
  countrySelectedLabel: (name) => `País do laboratório: ${name}`,
  changeCountry: 'Mudar país',
  chooseCountryCta: 'Escolher país',
  loadingCountries: 'A carregar países…',
};

const IT: LabResultsStripCopy = {
  title: 'REFERTI DI LABORATORIO',
  addReport: 'Aggiungi referto',
  emptyHint: 'Importa un PDF di laboratorio (es. Clalit online)',
  tests: 'esami',
  testsCount: (n) => `${n} esame${n === 1 ? '' : 'i'}`,
  view: 'vedi',
  exportLabel: 'Esporta',
  importLabel: 'Importa',
  collapseA11y: 'Comprimi referti di laboratorio',
  expandA11y: 'Espandi referti di laboratorio',
  savedTitle: 'Salvato',
  savedBody: 'I mentor possono ora vedere questi risultati',
  exportFailed: 'Esportazione non riuscita',
  importTitle: 'Importa',
  importNone: 'Nessun referto nuovo nel file',
  importComplete: 'Importazione completata',
  importCount: (n) => `${n} referto${n === 1 ? '' : 'i'} importato${n === 1 ? '' : 'i'}`,
  importFailed: 'Importazione non riuscita',
  trendHint: 'Importa un altro esame per vedere l’andamento del colesterolo',
  modalTitle: 'Referti di laboratorio',
  save: 'Salva',
  deleteReport: 'Elimina referto',
  deleteConfirmTitle: 'Eliminare questo referto?',
  deleteConfirmBody: 'Viene rimosso dal telefono. Reimporta il PDF per una lettura pulita.',
  deleteCancel: 'Annulla',
  deleteFailed: 'Eliminazione non riuscita',
  deletedTitle: 'Eliminato',
  deletedBody: 'Referto rimosso. Puoi importare di nuovo il PDF.',
  choosePdf: 'Scegli PDF',
  saving: 'Salvataggio…',
  reading: 'Lettura del referto…',
  lipidTrendsTitle: 'Andamento colesterolo',
  lipidCollapseA11y: 'Comprimi andamento colesterolo',
  lipidExpandA11y: 'Espandi andamento colesterolo',
  customTrendTitle: 'Andamento esame',
  customCollapseA11y: 'Comprimi andamento esame',
  customExpandA11y: 'Espandi andamento esame',
  customPickPlaceholder: 'Scegli un esame…',
  customSearchPlaceholder: 'Cerca esami',
  customNeedTwo: 'Importa un altro prelievo per tracciare questo esame',
  customNoMarkers: 'Nessun altro esame da tracciare ancora',
  customClear: 'Cancella',
  identifyingPdf: 'Controllo quale portale ha stampato questo…',
  providerConfirmTitle: 'Quale portale lab?',
  providerConfirmBody: (name) =>
    `Sembra ${name}. Conferma per una lettura più precisa — soprattutto Meuhedet.`,
  providerConfirmUnknownBody:
    'Portale non riconosciuto. Scegli sotto — Meuhedet serve il layout giusto.',
  providerContinue: (name) => `Continua come ${name}`,
  providerNotSure: 'Non sicuro — predefinito',
  providerClalit: 'Clalit',
  providerMeuhedet: 'Meuhedet',
  providerMaccabi: 'Maccabi',
  providerLeumit: 'Leumit',
  countryPickerTitle: 'Di quale paese sono le analisi?',
  countryPickerBody:
    'Scegli un paese prima di importare — ogni paese ha il suo modello di lettura. Non è la lingua dell’app.',
  countryRequired: 'Scegli un paese prima di importare un PDF.',
  countrySelectedLabel: (name) => `Paese del laboratorio: ${name}`,
  changeCountry: 'Cambia paese',
  chooseCountryCta: 'Scegli paese',
  loadingCountries: 'Caricamento paesi…',
};

const TR: LabResultsStripCopy = {
  title: 'LABORATUVAR SONUÇLARI',
  addReport: 'Rapor ekle',
  emptyHint: 'Bir laboratuvar PDF’si içe aktarın (örn. Clalit online)',
  tests: 'test',
  testsCount: (n) => `${n} test`,
  view: 'görüntüle',
  exportLabel: 'Dışa aktar',
  importLabel: 'İçe aktar',
  collapseA11y: 'Laboratuvar sonuçlarını daralt',
  expandA11y: 'Laboratuvar sonuçlarını genişlet',
  savedTitle: 'Kaydedildi',
  savedBody: 'Mentorlar artık bu sonuçları görebilir',
  exportFailed: 'Dışa aktarma başarısız',
  importTitle: 'İçe aktar',
  importNone: 'Dosyada yeni rapor yok',
  importComplete: 'İçe aktarma tamamlandı',
  importCount: (n) => `${n} rapor içe aktarıldı`,
  importFailed: 'İçe aktarma başarısız',
  trendHint: 'Kolesterol eğilimini görmek için başka bir tahlil içe aktarın',
  modalTitle: 'Laboratuvar sonuçları',
  save: 'Kaydet',
  deleteReport: 'Raporu sil',
  deleteConfirmTitle: 'Bu laboratuvar raporu silinsin mi?',
  deleteConfirmBody: 'Telefondan kaldırılır. Temiz okuma için PDF’yi yeniden içe aktarın.',
  deleteCancel: 'İptal',
  deleteFailed: 'Silinemedi',
  deletedTitle: 'Silindi',
  deletedBody: 'Rapor kaldırıldı. PDF’yi yeniden içe aktarabilirsiniz.',
  choosePdf: 'PDF seç',
  saving: 'Kaydediliyor…',
  reading: 'Rapor okunuyor…',
  lipidTrendsTitle: 'Kolesterol eğilimleri',
  lipidCollapseA11y: 'Kolesterol eğilimlerini daralt',
  lipidExpandA11y: 'Kolesterol eğilimlerini genişlet',
  customTrendTitle: 'Laboratuvar eğilimi',
  customCollapseA11y: 'Laboratuvar eğilimini daralt',
  customExpandA11y: 'Laboratuvar eğilimini genişlet',
  customPickPlaceholder: 'Bir test seçin…',
  customSearchPlaceholder: 'Test ara',
  customNeedTwo: 'Bu testi çizmek için başka bir alım içe aktarın',
  customNoMarkers: 'Henüz çizilecek başka test yok',
  customClear: 'Temizle',
  identifyingPdf: 'Hangi laboratuvar portalının yazdırdığı kontrol ediliyor…',
  providerConfirmTitle: 'Hangi laboratuvar portalı?',
  providerConfirmBody: (name) =>
    `Bu ${name} gibi görünüyor. Daha doğru okuma için onaylayın — özellikle Meuhedet.`,
  providerConfirmUnknownBody:
    'Portal tanınmadı. Aşağıdan seçin — Meuhedet doğru düzeni ister.',
  providerContinue: (name) => `${name} olarak devam`,
  providerNotSure: 'Emin değilim — varsayılan',
  providerClalit: 'Clalit',
  providerMeuhedet: 'Meuhedet',
  providerMaccabi: 'Maccabi',
  providerLeumit: 'Leumit',
  countryPickerTitle: 'Lab raporları hangi ülkeden?',
  countryPickerBody:
    'İçe aktarmadan önce ülke seçin — her ülkenin kendi okuma modeli var. Bu uygulama dili değil.',
  countryRequired: 'PDF içe aktarmadan önce ülke seçin.',
  countrySelectedLabel: (name) => `Lab ülkesi: ${name}`,
  changeCountry: 'Ülkeyi değiştir',
  chooseCountryCta: 'Ülke seç',
  loadingCountries: 'Ülkeler yükleniyor…',
};

const BY_CODE: Record<string, LabResultsStripCopy> = {
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

export function getLabResultsStripCopy(langCode?: string | null): LabResultsStripCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return BY_CODE[c] ?? EN;
}
