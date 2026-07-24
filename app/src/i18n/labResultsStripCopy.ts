/**
 * Lab results strip chrome — coach language locales.
 * Panel codes / analyte codes stay English (glossary).
 */

export type LabResultsStripCopy = {
  title: string;
  addReport: string;
  emptyHint: string;
  latestPrefix: string;
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
  choosePdf: string;
  saving: string;
  reading: string;
};

const EN: LabResultsStripCopy = {
  title: 'LAB RESULTS',
  addReport: 'Add report',
  emptyHint: 'Import a Clalit online lab PDF',
  latestPrefix: 'Latest',
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
  choosePdf: 'Choose PDF',
  saving: 'Saving…',
  reading: 'Reading lab report…',
};

const HE: LabResultsStripCopy = {
  title: 'תוצאות מעבדה',
  addReport: 'הוסף דוח',
  emptyHint: 'ייבאו PDF מכללית און־ליין',
  latestPrefix: 'אחרון',
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
  choosePdf: 'בחר PDF',
  saving: 'שומר…',
  reading: 'קורא את הדוח…',
};

const ES: LabResultsStripCopy = {
  title: 'RESULTADOS DE LABORATORIO',
  addReport: 'Añadir informe',
  emptyHint: 'Importa un PDF de laboratorio (p. ej. Clalit online)',
  latestPrefix: 'Último',
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
  choosePdf: 'Elegir PDF',
  saving: 'Guardando…',
  reading: 'Leyendo el informe…',
};

const FR: LabResultsStripCopy = {
  title: "RÉSULTATS D'ANALYSES",
  addReport: 'Ajouter un rapport',
  emptyHint: 'Importer un PDF de laboratoire (ex. Clalit en ligne)',
  latestPrefix: 'Dernier',
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
  choosePdf: 'Choisir un PDF',
  saving: 'Enregistrement…',
  reading: 'Lecture du rapport…',
};

const DE: LabResultsStripCopy = {
  title: 'LABORERGEBNISSE',
  addReport: 'Bericht hinzufügen',
  emptyHint: 'Labor-PDF importieren (z. B. Clalit online)',
  latestPrefix: 'Zuletzt',
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
  choosePdf: 'PDF wählen',
  saving: 'Speichern…',
  reading: 'Befund wird gelesen…',
};

const AR: LabResultsStripCopy = {
  title: 'نتائج المختبر',
  addReport: 'إضافة تقرير',
  emptyHint: 'استورد ملف PDF من مختبر (مثل Clalit عبر الإنترنت)',
  latestPrefix: 'الأحدث',
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
  choosePdf: 'اختر PDF',
  saving: 'جارٍ الحفظ…',
  reading: 'جارٍ قراءة التقرير…',
};

const RU: LabResultsStripCopy = {
  title: 'РЕЗУЛЬТАТЫ АНАЛИЗОВ',
  addReport: 'Добавить отчёт',
  emptyHint: 'Импортируйте PDF лабораторных анализов (например Clalit online)',
  latestPrefix: 'Последний',
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
  choosePdf: 'Выбрать PDF',
  saving: 'Сохранение…',
  reading: 'Чтение отчёта…',
};

const PT: LabResultsStripCopy = {
  title: 'RESULTADOS DE LABORATÓRIO',
  addReport: 'Adicionar laudo',
  emptyHint: 'Importe um PDF de laboratório (ex.: Clalit online)',
  latestPrefix: 'Mais recente',
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
  choosePdf: 'Escolher PDF',
  saving: 'Salvando…',
  reading: 'Lendo o laudo…',
};

const IT: LabResultsStripCopy = {
  title: 'REFERTI DI LABORATORIO',
  addReport: 'Aggiungi referto',
  emptyHint: 'Importa un PDF di laboratorio (es. Clalit online)',
  latestPrefix: 'Ultimo',
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
  choosePdf: 'Scegli PDF',
  saving: 'Salvataggio…',
  reading: 'Lettura del referto…',
};

const TR: LabResultsStripCopy = {
  title: 'LABORATUVAR SONUÇLARI',
  addReport: 'Rapor ekle',
  emptyHint: 'Bir laboratuvar PDF’si içe aktarın (örn. Clalit online)',
  latestPrefix: 'En son',
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
  choosePdf: 'PDF seç',
  saving: 'Kaydediliyor…',
  reading: 'Rapor okunuyor…',
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
