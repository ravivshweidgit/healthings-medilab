/**
 * Profile → Help strip chrome (prompt98). Answers use appLocale via Gemini langInstruction.
 */

export type HelpStripCopy = {
  title: string;
  subtitle: string;
  placeholder: string;
  ask: string;
  emptyHint: string;
  errorGeneric: string;
  outOfCredits: string;
  /** Profile → open dashboard Help. */
  openFromProfile: string;
  /** Watch explainers section under chips (prompt107). */
  watchSection: string;
  /** Prefix for Help nav chips (prompt109) — “Open DATA SHARING”. */
  openPrefix: string;
};

const EN: HelpStripCopy = {
  title: 'HELP',
  subtitle: 'Ask how to use the app',
  placeholder: 'e.g. How do I update my scale?',
  ask: 'Ask',
  emptyHint: 'Type a question about Healthings features, settings, or Food Log.',
  errorGeneric: 'Could not get an answer. Check the network and try again.',
  outOfCredits: 'Out of AI credits. Add a token pack to continue.',
  openFromProfile: 'Open app Help',
  watchSection: 'Watch explainers',
  openPrefix: 'Open',
};

const HE: HelpStripCopy = {
  title: 'עזרה',
  subtitle: 'שאלו איך משתמשים באפליקציה',
  placeholder: 'למשל: איך מעדכנים את המשקל?',
  ask: 'שאלו',
  emptyHint: 'כתבו שאלה על התכונות, ההגדרות או יומן הארוחות.',
  errorGeneric: 'לא התקבלה תשובה. בדקו את הרשת ונסו שוב.',
  outOfCredits: 'נגמרו קרדיטי ה־AI. הוסיפו חבילת אסימונים להמשך.',
  openFromProfile: 'פתחו עזרה באפליקציה',
  watchSection: 'סרטוני הסבר',
  openPrefix: 'פתחו',
};

const ES: HelpStripCopy = {
  title: 'AYUDA',
  subtitle: 'Pregunta cómo usar la app',
  placeholder: 'p. ej. ¿Cómo actualizo mi báscula?',
  ask: 'Preguntar',
  emptyHint: 'Escribe una pregunta sobre funciones, ajustes o el diario de comidas.',
  errorGeneric: 'No se pudo obtener respuesta. Revisa la red e inténtalo de nuevo.',
  outOfCredits: 'Sin créditos de IA. Añade un paquete de tokens para continuar.',
  openFromProfile: 'Abrir Ayuda de la app',
  watchSection: 'Videos explicativos',
  openPrefix: 'Abrir',
};

const FR: HelpStripCopy = {
  title: 'AIDE',
  subtitle: 'Demandez comment utiliser l’app',
  placeholder: 'ex. Comment mettre à jour ma balance ?',
  ask: 'Demander',
  emptyHint: 'Posez une question sur les fonctions, les réglages ou le journal alimentaire.',
  errorGeneric: 'Pas de réponse. Vérifiez le réseau et réessayez.',
  outOfCredits: 'Plus de crédits IA. Ajoutez un pack de jetons pour continuer.',
  openFromProfile: 'Ouvrir l\'Aide de l\'app',
  watchSection: 'Vidéos explicatives',
  openPrefix: 'Ouvrir',
};

const DE: HelpStripCopy = {
  title: 'HILFE',
  subtitle: 'Fragen zur App-Nutzung',
  placeholder: 'z. B. Wie aktualisiere ich meine Waage?',
  ask: 'Fragen',
  emptyHint: 'Frage zu Funktionen, Einstellungen oder Essens-Log stellen.',
  errorGeneric: 'Keine Antwort. Netzwerk prüfen und erneut versuchen.',
  outOfCredits: 'Keine KI-Credits mehr. Token-Paket hinzufügen.',
  openFromProfile: 'App-Hilfe öffnen',
  watchSection: 'Erklärfilme',
  openPrefix: 'Öffnen',
};

const AR: HelpStripCopy = {
  title: 'مساعدة',
  subtitle: 'اسأل كيف تستخدم التطبيق',
  placeholder: 'مثلاً: كيف أحدّث الميزان؟',
  ask: 'اسأل',
  emptyHint: 'اكتب سؤالاً عن الميزات أو الإعدادات أو سجل الوجبات.',
  errorGeneric: 'تعذّر الحصول على إجابة. تحقق من الشبكة وحاول مجدداً.',
  outOfCredits: 'نفدت أرصدة الذكاء. أضف حزمة رموز للمتابعة.',
  openFromProfile: 'فتح مساعدة التطبيق',
  watchSection: 'فيديوهات شرح',
  openPrefix: 'افتح',
};

const RU: HelpStripCopy = {
  title: 'СПРАВКА',
  subtitle: 'Спросите, как пользоваться приложением',
  placeholder: 'напр. Как обновить весы?',
  ask: 'Спросить',
  emptyHint: 'Вопрос о функциях, настройках или дневнике питания.',
  errorGeneric: 'Не удалось получить ответ. Проверьте сеть и повторите.',
  outOfCredits: 'Кончились кредиты ИИ. Добавьте пакет токенов.',
  openFromProfile: 'Открыть справку приложения',
  watchSection: 'Видео-объяснения',
  openPrefix: 'Открыть',
};

const PT: HelpStripCopy = {
  title: 'AJUDA',
  subtitle: 'Pergunte como usar a app',
  placeholder: 'ex. Como atualizo a balança?',
  ask: 'Perguntar',
  emptyHint: 'Escreva uma pergunta sobre funções, definições ou diário alimentar.',
  errorGeneric: 'Não foi possível obter resposta. Verifique a rede e tente de novo.',
  outOfCredits: 'Sem créditos de IA. Adicione um pacote de tokens.',
  openFromProfile: 'Abrir Ajuda da app',
  watchSection: 'Vídeos explicativos',
  openPrefix: 'Abrir',
};

const IT: HelpStripCopy = {
  title: 'AIUTO',
  subtitle: 'Chiedi come usare l’app',
  placeholder: 'es. Come aggiorno la bilancia?',
  ask: 'Chiedi',
  emptyHint: 'Scrivi una domanda su funzioni, impostazioni o diario pasti.',
  errorGeneric: 'Impossibile ottenere una risposta. Controlla la rete e riprova.',
  outOfCredits: 'Crediti IA esauriti. Aggiungi un pacchetto di token.',
  openFromProfile: 'Apri Aiuto app',
  watchSection: 'Video esplicativi',
  openPrefix: 'Apri',
};

const TR: HelpStripCopy = {
  title: 'YARDIM',
  subtitle: 'Uygulamayı nasıl kullanacağınızı sorun',
  placeholder: 'örn. Tartımı nasıl güncellerim?',
  ask: 'Sor',
  emptyHint: 'Özellikler, ayarlar veya yemek günlüğü hakkında bir soru yazın.',
  errorGeneric: 'Yanıt alınamadı. Ağı kontrol edip tekrar deneyin.',
  outOfCredits: 'YZ kredisi bitti. Devam için jeton paketi ekleyin.',
  openFromProfile: 'Uygulama Yardımı\'nı aç',
  watchSection: 'Anlatım videoları',
  openPrefix: 'Aç',
};

export function getHelpStripCopy(langCode?: string | null): HelpStripCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  if (c === 'he') return HE;
  if (c === 'es') return ES;
  if (c === 'fr') return FR;
  if (c === 'de') return DE;
  if (c === 'ar') return AR;
  if (c === 'ru') return RU;
  if (c === 'pt') return PT;
  if (c === 'it') return IT;
  if (c === 'tr') return TR;
  return EN;
}
