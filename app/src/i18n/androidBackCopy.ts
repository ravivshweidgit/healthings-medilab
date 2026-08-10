/**
 * Android hardware Back on dashboard root — confirm before exit (prompt108).
 */

export type AndroidBackCopy = {
  exitTitle: string;
  exitMessage: string;
  exitConfirm: string;
  stay: string;
};

const EN: AndroidBackCopy = {
  exitTitle: 'Leave Healthings?',
  exitMessage: 'You are on the home screen. Exit the app?',
  exitConfirm: 'Exit',
  stay: 'Stay',
};

const HE: AndroidBackCopy = {
  exitTitle: 'לצאת מ-Healthings?',
  exitMessage: 'אתם במסך הראשי. לצאת מהאפליקציה?',
  exitConfirm: 'יציאה',
  stay: 'להישאר',
};

const BY_CODE: Record<string, AndroidBackCopy> = {
  en: EN,
  he: HE,
  es: {
    ...EN,
    exitTitle: '¿Salir de Healthings?',
    exitMessage: 'Estás en la pantalla principal. ¿Salir de la app?',
    exitConfirm: 'Salir',
    stay: 'Quedarse',
  },
  fr: {
    ...EN,
    exitTitle: 'Quitter Healthings ?',
    exitMessage: 'Vous êtes à l’accueil. Quitter l’app ?',
    exitConfirm: 'Quitter',
    stay: 'Rester',
  },
  de: {
    ...EN,
    exitTitle: 'Healthings verlassen?',
    exitMessage: 'Sie sind auf dem Startbildschirm. App beenden?',
    exitConfirm: 'Beenden',
    stay: 'Bleiben',
  },
  ar: {
    ...EN,
    exitTitle: 'مغادرة Healthings؟',
    exitMessage: 'أنت في الشاشة الرئيسية. الخروج من التطبيق؟',
    exitConfirm: 'خروج',
    stay: 'البقاء',
  },
  ru: {
    ...EN,
    exitTitle: 'Выйти из Healthings?',
    exitMessage: 'Вы на главном экране. Закрыть приложение?',
    exitConfirm: 'Выйти',
    stay: 'Остаться',
  },
  pt: {
    ...EN,
    exitTitle: 'Sair do Healthings?',
    exitMessage: 'Você está na tela inicial. Sair do app?',
    exitConfirm: 'Sair',
    stay: 'Ficar',
  },
  it: {
    ...EN,
    exitTitle: 'Uscire da Healthings?',
    exitMessage: 'Sei nella schermata principale. Uscire dall’app?',
    exitConfirm: 'Esci',
    stay: 'Resta',
  },
  tr: {
    ...EN,
    exitTitle: 'Healthings’ten çıkılsın mı?',
    exitMessage: 'Ana ekrandasınız. Uygulamadan çıkılsın mı?',
    exitConfirm: 'Çık',
    stay: 'Kal',
  },
};

export function getAndroidBackCopy(langCode?: string | null): AndroidBackCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return BY_CODE[c] ?? EN;
}
