/**
 * CareSens CSV import result copy — Your setup (prompt106 Phase C).
 * Brand name CareSens stays English.
 */

export type CareSensImportOkParams = {
  newPoints: number;
  chartCount: number;
  sessionCount: number;
  range: string;
};

export type CareSensImportCopy = {
  a11yImport: string;
  /** Success — range first, then counts a person can scan. */
  ok: (p: CareSensImportOkParams) => string;
  noFile: string;
  /** Truncated read or file-name lag (incomplete export copy). */
  incomplete: string;
  empty: string;
  badColumns: string;
  noGlucose: string;
  failed: string;
};

const EN: CareSensImportCopy = {
  a11yImport: 'Import CareSens Air CSV',
  ok: (p) =>
    `Imported — ${p.range}\n${p.newPoints} new · ${p.chartCount} on chart · ${p.sessionCount} sensor session${p.sessionCount === 1 ? '' : 's'}`,
  noFile: 'No file was selected.',
  incomplete:
    'This CareSens file looks incomplete. Copy the full export to the phone and import again.',
  empty: 'This CSV is empty — export again from CareSens Air.',
  badColumns:
    'Couldn’t find glucose columns. Export a CareSens Air CSV from the official app.',
  noGlucose: 'No glucose rows found in this CSV.',
  failed: 'Couldn’t import CareSens CSV — try again.',
};

const HE: CareSensImportCopy = {
  a11yImport: 'ייבוא CareSens Air CSV',
  ok: (p) =>
    `יובא — ${p.range}\n${p.newPoints} חדשות · ${p.chartCount} בגרף · ${p.sessionCount} חיישנים`,
  noFile: 'לא נבחר קובץ.',
  incomplete: 'הקובץ נראה חלקי. העתיקו את ייצוא CareSens המלא לטלפון וייבאו שוב.',
  empty: 'ה־CSV ריק — ייצאו שוב מ־CareSens Air.',
  badColumns: 'לא נמצאו עמודות גלוקוז. ייצאו CSV מ־CareSens Air הרשמי.',
  noGlucose: 'לא נמצאו שורות גלוקוז בקובץ.',
  failed: 'הייבוא נכשל — נסו שוב.',
};

const ES: CareSensImportCopy = {
  a11yImport: 'Importar CSV de CareSens Air',
  ok: (p) =>
    `Importado — ${p.range}\n${p.newPoints} nuevas · ${p.chartCount} en gráfico · ${p.sessionCount} sensores`,
  noFile: 'No se seleccionó ningún archivo.',
  incomplete:
    'Este archivo de CareSens parece incompleto. Copia la exportación completa al teléfono e importa de nuevo.',
  empty: 'Este CSV está vacío — vuelve a exportar desde CareSens Air.',
  badColumns:
    'No se encontraron columnas de glucosa. Exporta un CSV de CareSens Air desde la app oficial.',
  noGlucose: 'No hay filas de glucosa en este CSV.',
  failed: 'No se pudo importar el CSV de CareSens — inténtalo de nuevo.',
};

const FR: CareSensImportCopy = {
  a11yImport: 'Importer le CSV CareSens Air',
  ok: (p) =>
    `Importé — ${p.range}\n${p.newPoints} nouvelles · ${p.chartCount} sur le graphique · ${p.sessionCount} capteur${p.sessionCount === 1 ? '' : 's'}`,
  noFile: 'Aucun fichier sélectionné.',
  incomplete:
    'Ce fichier CareSens semble incomplet. Copiez l’export complet sur le téléphone et réimportez.',
  empty: 'Ce CSV est vide — exportez à nouveau depuis CareSens Air.',
  badColumns:
    'Colonnes glucose introuvables. Exportez un CSV CareSens Air depuis l’app officielle.',
  noGlucose: 'Aucune ligne de glucose dans ce CSV.',
  failed: 'Échec de l’import CareSens — réessayez.',
};

const DE: CareSensImportCopy = {
  a11yImport: 'CareSens Air CSV importieren',
  ok: (p) =>
    `Importiert — ${p.range}\n${p.newPoints} neu · ${p.chartCount} im Diagramm · ${p.sessionCount} Sensor${p.sessionCount === 1 ? '' : 'en'}`,
  noFile: 'Keine Datei ausgewählt.',
  incomplete:
    'Diese CareSens-Datei wirkt unvollständig. Vollständigen Export aufs Telefon kopieren und erneut importieren.',
  empty: 'Diese CSV ist leer — erneut aus CareSens Air exportieren.',
  badColumns:
    'Glukose-Spalten nicht gefunden. CareSens Air CSV aus der offiziellen App exportieren.',
  noGlucose: 'Keine Glukosezeilen in dieser CSV.',
  failed: 'CareSens-Import fehlgeschlagen — erneut versuchen.',
};

const AR: CareSensImportCopy = {
  a11yImport: 'استيراد CareSens Air CSV',
  ok: (p) =>
    `تم الاستيراد — ${p.range}\n${p.newPoints} جديدة · ${p.chartCount} على الرسم · ${p.sessionCount} مستشعرات`,
  noFile: 'لم يُحدَّد ملف.',
  incomplete: 'يبدو ملف CareSens ناقصًا. انسخوا التصدير الكامل إلى الهاتف واستوردوا مجددًا.',
  empty: 'ملف CSV فارغ — صدّروا مجددًا من CareSens Air.',
  badColumns: 'لم تُعثر على أعمدة الجلوكوز. صدّروا CSV من تطبيق CareSens Air الرسمي.',
  noGlucose: 'لا توجد صفوف جلوكوز في هذا الملف.',
  failed: 'فشل الاستيراد — حاولوا مرة أخرى.',
};

const RU: CareSensImportCopy = {
  a11yImport: 'Импорт CSV CareSens Air',
  ok: (p) =>
    `Импортировано — ${p.range}\n${p.newPoints} новых · ${p.chartCount} на графике · ${p.sessionCount} сенсор${p.sessionCount === 1 ? '' : 'а'}`,
  noFile: 'Файл не выбран.',
  incomplete:
    'Файл CareSens выглядит неполным. Скопируйте полный экспорт на телефон и импортируйте снова.',
  empty: 'CSV пуст — экспортируйте снова из CareSens Air.',
  badColumns:
    'Не найдены столбцы глюкозы. Экспортируйте CSV из официального приложения CareSens Air.',
  noGlucose: 'В этом CSV нет строк глюкозы.',
  failed: 'Не удалось импортировать CareSens — попробуйте снова.',
};

const PT: CareSensImportCopy = {
  a11yImport: 'Importar CSV do CareSens Air',
  ok: (p) =>
    `Importado — ${p.range}\n${p.newPoints} novas · ${p.chartCount} no gráfico · ${p.sessionCount} sensores`,
  noFile: 'Nenhum arquivo selecionado.',
  incomplete:
    'Este arquivo CareSens parece incompleto. Copie a exportação completa para o telefone e importe de novo.',
  empty: 'Este CSV está vazio — exporte de novo no CareSens Air.',
  badColumns:
    'Colunas de glicose não encontradas. Exporte um CSV do CareSens Air pelo app oficial.',
  noGlucose: 'Nenhuma linha de glicose neste CSV.',
  failed: 'Não foi possível importar o CareSens — tente de novo.',
};

const IT: CareSensImportCopy = {
  a11yImport: 'Importa CSV CareSens Air',
  ok: (p) =>
    `Importato — ${p.range}\n${p.newPoints} nuove · ${p.chartCount} sul grafico · ${p.sessionCount} sensori`,
  noFile: 'Nessun file selezionato.',
  incomplete:
    'Questo file CareSens sembra incompleto. Copia l’export completo sul telefono e importa di nuovo.',
  empty: 'Questo CSV è vuoto — esporta di nuovo da CareSens Air.',
  badColumns:
    'Colonne glucosio non trovate. Esporta un CSV CareSens Air dall’app ufficiale.',
  noGlucose: 'Nessuna riga di glucosio in questo CSV.',
  failed: 'Import CareSens non riuscito — riprova.',
};

const TR: CareSensImportCopy = {
  a11yImport: 'CareSens Air CSV içe aktar',
  ok: (p) =>
    `İçe aktarıldı — ${p.range}\n${p.newPoints} yeni · ${p.chartCount} grafikte · ${p.sessionCount} sensör`,
  noFile: 'Dosya seçilmedi.',
  incomplete:
    'Bu CareSens dosyası eksik görünüyor. Tam dışa aktarmayı telefona kopyalayıp yeniden içe aktarın.',
  empty: 'Bu CSV boş — CareSens Air’den yeniden dışa aktarın.',
  badColumns:
    'Glukoz sütunları bulunamadı. Resmi CareSens Air uygulamasından CSV dışa aktarın.',
  noGlucose: 'Bu CSV’de glukoz satırı yok.',
  failed: 'CareSens içe aktarılamadı — tekrar deneyin.',
};

const BY_CODE: Record<string, CareSensImportCopy> = {
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

export function getCareSensImportCopy(langCode?: string | null): CareSensImportCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return BY_CODE[c] ?? EN;
}

/** Map parser / IO errors (English internals) to calm localized copy. */
export function mapCareSensImportError(err: unknown, copy: CareSensImportCopy): string {
  const m = err instanceof Error ? err.message : '';
  if (!m) return copy.failed;
  if (/truncated|incomplete/i.test(m)) return copy.incomplete;
  if (/empty or has no data|CSV is empty/i.test(m)) return copy.empty;
  if (/Date and Time|Glucose Value/i.test(m)) return copy.badColumns;
  if (/No glucose rows/i.test(m)) return copy.noGlucose;
  if (/Could not read CareSens|Unrecognized date/i.test(m)) return copy.failed;
  return copy.failed;
}
