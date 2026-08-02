/**
 * Chat bubble actions + attach labels — all app locales (appLocale).
 */

export type ChatBubbleCopy = {
  copy: string;
  copiedTitle: string;
  copiedMessage: string;
  attachFile: string;
  attachUnsupportedTitle: string;
  attachUnsupportedBody: string;
  fileTooLargeTitle: string;
  fileTooLargeBody: string;
  emptyFileBody: string;
  openFileFailed: string;
  defaultFilePrompt: string;
};

const EN: ChatBubbleCopy = {
  copy: 'Copy',
  copiedTitle: 'Copied',
  copiedMessage: 'Text copied to clipboard.',
  attachFile: 'File',
  attachUnsupportedTitle: 'File type not supported',
  attachUnsupportedBody: 'Mentors accept PDF and plain text. Export Word as PDF or TXT and try again.',
  fileTooLargeTitle: 'File too large',
  fileTooLargeBody: 'Please use a smaller PDF (under ~4 MB).',
  emptyFileBody: 'That text file is empty.',
  openFileFailed: 'Could not open that file.',
  defaultFilePrompt: 'I attached a file. Please review it using my goals and dietary rules.',
};

const HE: ChatBubbleCopy = {
  copy: 'העתק',
  copiedTitle: 'הועתק',
  copiedMessage: 'הטקסט הועתק ללוח.',
  attachFile: 'קובץ',
  attachUnsupportedTitle: 'סוג קובץ לא נתמך',
  attachUnsupportedBody: 'המנטורים מקבלים PDF וטקסט. ייצאו Word ל-PDF או TXT ונסו שוב.',
  fileTooLargeTitle: 'הקובץ גדול מדי',
  fileTooLargeBody: 'השתמשו ב-PDF קטן יותר (עד כ־4 מ״ב).',
  emptyFileBody: 'קובץ הטקסט ריק.',
  openFileFailed: 'לא ניתן לפתוח את הקובץ.',
  defaultFilePrompt: 'צירפתי קובץ. אנא עיינו בו לפי היעדים והכללים שלי.',
};

const ES: ChatBubbleCopy = {
  copy: 'Copiar',
  copiedTitle: 'Copiado',
  copiedMessage: 'Texto copiado al portapapeles.',
  attachFile: 'Archivo',
  attachUnsupportedTitle: 'Tipo no admitido',
  attachUnsupportedBody: 'Los mentores aceptan PDF y texto. Exporte Word a PDF o TXT.',
  fileTooLargeTitle: 'Archivo demasiado grande',
  fileTooLargeBody: 'Use un PDF más pequeño (menos de ~4 MB).',
  emptyFileBody: 'Ese archivo de texto está vacío.',
  openFileFailed: 'No se pudo abrir el archivo.',
  defaultFilePrompt: 'Adjunto un archivo. Revíselo según mis objetivos y reglas.',
};

const FR: ChatBubbleCopy = {
  copy: 'Copier',
  copiedTitle: 'Copié',
  copiedMessage: 'Texte copié dans le presse-papiers.',
  attachFile: 'Fichier',
  attachUnsupportedTitle: 'Type non pris en charge',
  attachUnsupportedBody: 'Les mentors acceptent PDF et texte. Exportez Word en PDF ou TXT.',
  fileTooLargeTitle: 'Fichier trop volumineux',
  fileTooLargeBody: 'Utilisez un PDF plus petit (moins de ~4 Mo).',
  emptyFileBody: 'Ce fichier texte est vide.',
  openFileFailed: 'Impossible d’ouvrir ce fichier.',
  defaultFilePrompt: 'J’ai joint un fichier. Merci de le lire selon mes objectifs et règles.',
};

const DE: ChatBubbleCopy = {
  copy: 'Kopieren',
  copiedTitle: 'Kopiert',
  copiedMessage: 'Text in die Zwischenablage kopiert.',
  attachFile: 'Datei',
  attachUnsupportedTitle: 'Dateityp nicht unterstützt',
  attachUnsupportedBody: 'Mentoren akzeptieren PDF und Text. Word als PDF oder TXT exportieren.',
  fileTooLargeTitle: 'Datei zu groß',
  fileTooLargeBody: 'Bitte eine kleinere PDF verwenden (unter ~4 MB).',
  emptyFileBody: 'Diese Textdatei ist leer.',
  openFileFailed: 'Datei konnte nicht geöffnet werden.',
  defaultFilePrompt: 'Ich habe eine Datei angehängt. Bitte anhand meiner Ziele und Regeln prüfen.',
};

const AR: ChatBubbleCopy = {
  copy: 'نسخ',
  copiedTitle: 'تم النسخ',
  copiedMessage: 'تم نسخ النص إلى الحافظة.',
  attachFile: 'ملف',
  attachUnsupportedTitle: 'نوع الملف غير مدعوم',
  attachUnsupportedBody: 'المرشدون يقبلون PDF والنص. صدّر Word إلى PDF أو TXT.',
  fileTooLargeTitle: 'الملف كبير جداً',
  fileTooLargeBody: 'استخدم PDF أصغر (أقل من حوالي 4 ميجابايت).',
  emptyFileBody: 'ملف النص فارغ.',
  openFileFailed: 'تعذّر فتح الملف.',
  defaultFilePrompt: 'أرفقت ملفاً. راجعوه وفق أهدافي وقواعدي.',
};

const RU: ChatBubbleCopy = {
  copy: 'Копировать',
  copiedTitle: 'Скопировано',
  copiedMessage: 'Текст скопирован в буфер обмена.',
  attachFile: 'Файл',
  attachUnsupportedTitle: 'Тип файла не поддерживается',
  attachUnsupportedBody: 'Менторы принимают PDF и текст. Экспортируйте Word в PDF или TXT.',
  fileTooLargeTitle: 'Файл слишком большой',
  fileTooLargeBody: 'Используйте PDF меньше ~4 МБ.',
  emptyFileBody: 'Текстовый файл пуст.',
  openFileFailed: 'Не удалось открыть файл.',
  defaultFilePrompt: 'Я приложил(а) файл. Просмотрите его с учётом моих целей и правил.',
};

const PT: ChatBubbleCopy = {
  copy: 'Copiar',
  copiedTitle: 'Copiado',
  copiedMessage: 'Texto copiado para a área de transferência.',
  attachFile: 'Arquivo',
  attachUnsupportedTitle: 'Tipo não suportado',
  attachUnsupportedBody: 'Mentores aceitam PDF e texto. Exporte Word como PDF ou TXT.',
  fileTooLargeTitle: 'Arquivo muito grande',
  fileTooLargeBody: 'Use um PDF menor (menos de ~4 MB).',
  emptyFileBody: 'Esse arquivo de texto está vazio.',
  openFileFailed: 'Não foi possível abrir o arquivo.',
  defaultFilePrompt: 'Anexei um arquivo. Analise-o com base nas minhas metas e regras.',
};

const IT: ChatBubbleCopy = {
  copy: 'Copia',
  copiedTitle: 'Copiato',
  copiedMessage: 'Testo copiato negli appunti.',
  attachFile: 'File',
  attachUnsupportedTitle: 'Tipo non supportato',
  attachUnsupportedBody: 'I mentor accettano PDF e testo. Esporta Word come PDF o TXT.',
  fileTooLargeTitle: 'File troppo grande',
  fileTooLargeBody: 'Usa un PDF più piccolo (sotto ~4 MB).',
  emptyFileBody: 'Quel file di testo è vuoto.',
  openFileFailed: 'Impossibile aprire il file.',
  defaultFilePrompt: 'Ho allegato un file. Esaminalo in base ai miei obiettivi e regole.',
};

const TR: ChatBubbleCopy = {
  copy: 'Kopyala',
  copiedTitle: 'Kopyalandı',
  copiedMessage: 'Metin panoya kopyalandı.',
  attachFile: 'Dosya',
  attachUnsupportedTitle: 'Dosya türü desteklenmiyor',
  attachUnsupportedBody: 'Mentorlar PDF ve metin kabul eder. Word dosyasını PDF veya TXT olarak dışa aktarın.',
  fileTooLargeTitle: 'Dosya çok büyük',
  fileTooLargeBody: 'Daha küçük bir PDF kullanın (~4 MB altı).',
  emptyFileBody: 'Bu metin dosyası boş.',
  openFileFailed: 'Dosya açılamadı.',
  defaultFilePrompt: 'Bir dosya ekledim. Lütfen hedeflerime ve kurallarıma göre inceleyin.',
};

const BY_CODE: Record<string, ChatBubbleCopy> = {
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

export function getChatBubbleCopy(langCode?: string | null): ChatBubbleCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return BY_CODE[c] ?? EN;
}
