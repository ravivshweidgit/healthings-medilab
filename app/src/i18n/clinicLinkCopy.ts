/**
 * Data sharing strip — appLocale (prompt108 follow-on / clinic share how-to).
 * Emails stay LTR. Brand/path healthings.ai stays English.
 */

export type ClinicLinkCopy = {
  subtitle: string;
  clinicSyncHint: string;
  emailPh: string;
  send: string;
  waiting: string;
  invited: string;
  approve: string;
  reject: string;
  sharesWith: string;
  share: string;
  shareOk: string;
  revoke: string;
  revokeConfirm: string;
  cancel: string;
  noShares: string;
  mentorWeb: string;
  lastShared: string;
  neverShared: string;
  sponsored: string;
  sponsoredUntil: string;
  sponsorshipExpired: string;
  addAccount: string;
  addPack: string;
  addPackOk: string;
  creditsLine: (n: number, clinicPayer: boolean, autoReload: boolean) => string;
  packAdded: (added: number, balance: number) => string;
  loadFailed: string;
  actionFailed: string;
  collapse: string;
  expand: string;
};

const EN: ClinicLinkCopy = {
  subtitle: 'Who can see your data — optional.',
  clinicSyncHint:
    'After you tap Share, your clinic can pick it up from the server — even if you close the app. Opening the app also uploads when they ask for an update.',
  emailPh: 'clinic@example.com',
  send: 'Send request',
  waiting: 'Waiting for approval',
  invited: 'invited you to share',
  approve: 'Approve',
  reject: 'Decline',
  sharesWith: 'Sharing with',
  share: 'Share',
  shareOk: 'Update sent. Your clinic can open it in their portal.',
  revoke: 'Stop sharing',
  revokeConfirm: 'Remove this clinic from your list?',
  cancel: 'Cancel',
  noShares: 'No one on the list — the app works fine without sharing.',
  mentorWeb: 'Clinic account: patients and AI sponsorship live at healthings.ai/clinic',
  lastShared: 'Last shared',
  neverShared: 'Nothing uploaded yet — tap Share, or wait if your clinic asked for an update.',
  sponsored: 'AI sponsored by',
  sponsoredUntil: 'until',
  sponsorshipExpired: 'AI sponsorship ended',
  addAccount: 'Add a clinic',
  addPack: 'Add AI credits',
  addPackOk: 'Credits added',
  creditsLine: (n, clinicPayer, autoReload) => {
    const bits = [`AI credits: ${n}`];
    if (clinicPayer) bits.push('clinic pays');
    if (autoReload) bits.push('auto-reload on');
    return bits.join(' · ');
  },
  packAdded: (added, balance) => `+${added} credits · balance ${balance}`,
  loadFailed: 'Could not load sharing settings.',
  actionFailed: 'That didn’t go through. Try again.',
  collapse: 'Collapse data sharing',
  expand: 'Expand data sharing',
};

const HE: ClinicLinkCopy = {
  subtitle: 'מי יוכל לראות את הנתונים שלכם — לא חובה.',
  clinicSyncHint:
    'אחרי שתלחצו שתפו, הקליניקה יכולה לאסוף מהשרת — גם אם סוגרים את האפליקציה. כשפותחים אותה שוב, היא גם מעלה אם הקליניקה ביקשה עדכון.',
  emailPh: 'clinic@example.com',
  send: 'שלחו בקשה',
  waiting: 'ממתינים לאישור',
  invited: 'הזמינה אתכם לשתף',
  approve: 'אשרו',
  reject: 'דחו',
  sharesWith: 'משתפים עם',
  share: 'שתפו',
  shareOk: 'העדכון נשלח. הקליניקה יכולה לפתוח אותו בפורטל.',
  revoke: 'הפסיקו שיתוף',
  revokeConfirm: 'להסיר את הקליניקה מהרשימה?',
  cancel: 'ביטול',
  noShares: 'אין אף אחד ברשימה — האפליקציה עובדת גם בלי שיתוף.',
  mentorWeb: 'חשבון קליניקה: מטופלים וחסויות AI ב־healthings.ai/clinic',
  lastShared: 'שותף לאחרונה',
  neverShared: 'עדיין לא הועלה — לחצו שתפו, או המתינו אם הקליניקה ביקשה עדכון.',
  sponsored: 'AI בחסות',
  sponsoredUntil: 'עד',
  sponsorshipExpired: 'חסות ה־AI הסתיימה',
  addAccount: 'הוסיפו קליניקה',
  addPack: 'הוסיפו קרדיטי AI',
  addPackOk: 'הקרדיטים נוספו',
  creditsLine: (n, clinicPayer, autoReload) => {
    const bits = [`קרדיטי AI: ${n}`];
    if (clinicPayer) bits.push('הקליניקה משלמת');
    if (autoReload) bits.push('טעינה אוטומטית');
    return bits.join(' · ');
  },
  packAdded: (added, balance) => `+${added} קרדיטים · יתרה ${balance}`,
  loadFailed: 'לא הצלחנו לטעון את הגדרות השיתוף.',
  actionFailed: 'זה לא עבר. נסו שוב.',
  collapse: 'כווץ שיתוף נתונים',
  expand: 'הרחב שיתוף נתונים',
};

const ES: ClinicLinkCopy = {
  ...EN,
  subtitle: 'Quién puede ver tus datos — opcional.',
  clinicSyncHint:
    'Cuando tocas Compartir, la clínica lo recoge del servidor — aunque cierres la app. Al abrirla también se sube si piden una actualización.',
  send: 'Enviar solicitud',
  waiting: 'Esperando aprobación',
  invited: 'te invitó a compartir',
  approve: 'Aprobar',
  reject: 'Rechazar',
  sharesWith: 'Compartiendo con',
  share: 'Compartir',
  shareOk: 'Actualización enviada. La clínica puede abrirla en su portal.',
  revoke: 'Dejar de compartir',
  revokeConfirm: '¿Quitar esta clínica de tu lista?',
  cancel: 'Cancelar',
  noShares: 'Nadie en la lista — la app funciona bien sin compartir.',
  mentorWeb: 'Cuenta de clínica: pacientes y patrocinio AI en healthings.ai/clinic',
  lastShared: 'Último envío',
  neverShared: 'Aún no hay envío — toca Compartir, o espera si la clínica pidió una actualización.',
  sponsored: 'AI patrocinado por',
  sponsoredUntil: 'hasta',
  sponsorshipExpired: 'El patrocinio de AI terminó',
  addAccount: 'Añadir una clínica',
  addPack: 'Añadir créditos AI',
  addPackOk: 'Créditos añadidos',
  creditsLine: (n, clinicPayer, autoReload) => {
    const bits = [`Créditos AI: ${n}`];
    if (clinicPayer) bits.push('paga la clínica');
    if (autoReload) bits.push('recarga automática');
    return bits.join(' · ');
  },
  packAdded: (added, balance) => `+${added} créditos · saldo ${balance}`,
  loadFailed: 'No se pudieron cargar los ajustes de uso compartido.',
  actionFailed: 'No se pudo. Inténtalo de nuevo.',
  collapse: 'Contraer uso compartido',
  expand: 'Expandir uso compartido',
};

const FR: ClinicLinkCopy = {
  ...EN,
  subtitle: 'Qui peut voir vos données — facultatif.',
  clinicSyncHint:
    'Après Partager, le cabinet peut récupérer depuis le serveur — même si vous fermez l’app. À la réouverture, elle envoie aussi si le cabinet demande une mise à jour.',
  send: 'Envoyer la demande',
  waiting: 'En attente d’accord',
  invited: 'vous invite à partager',
  approve: 'Accepter',
  reject: 'Refuser',
  sharesWith: 'Partage avec',
  share: 'Partager',
  shareOk: 'Mise à jour envoyée. Le cabinet peut l’ouvrir dans son portail.',
  revoke: 'Arrêter le partage',
  revokeConfirm: 'Retirer ce cabinet de votre liste ?',
  cancel: 'Annuler',
  noShares: 'Personne sur la liste — l’app marche très bien sans partage.',
  mentorWeb: 'Compte cabinet : patients et parrainage AI sur healthings.ai/clinic',
  lastShared: 'Dernier envoi',
  neverShared: 'Rien d’envoyé — touchez Partager, ou attendez si le cabinet a demandé une mise à jour.',
  sponsored: 'AI pris en charge par',
  sponsoredUntil: 'jusqu’au',
  sponsorshipExpired: 'Le parrainage AI est terminé',
  addAccount: 'Ajouter un cabinet',
  addPack: 'Ajouter des crédits AI',
  addPackOk: 'Crédits ajoutés',
  creditsLine: (n, clinicPayer, autoReload) => {
    const bits = [`Crédits AI : ${n}`];
    if (clinicPayer) bits.push('le cabinet paie');
    if (autoReload) bits.push('rechargement auto');
    return bits.join(' · ');
  },
  packAdded: (added, balance) => `+${added} crédits · solde ${balance}`,
  loadFailed: 'Impossible de charger les réglages de partage.',
  actionFailed: 'Ça n’a pas marché. Réessayez.',
  collapse: 'Réduire le partage',
  expand: 'Développer le partage',
};

const DE: ClinicLinkCopy = {
  ...EN,
  subtitle: 'Wer Ihre Daten sehen darf — freiwillig.',
  clinicSyncHint:
    'Nach Teilen kann die Praxis es vom Server holen — auch wenn Sie die App schließen. Beim Öffnen lädt sie auch hoch, wenn die Praxis ein Update anfordert.',
  send: 'Anfrage senden',
  waiting: 'Wartet auf Freigabe',
  invited: 'lädt Sie zum Teilen ein',
  approve: 'Zustimmen',
  reject: 'Ablehnen',
  sharesWith: 'Geteilt mit',
  share: 'Teilen',
  shareOk: 'Update gesendet. Die Praxis kann es im Portal öffnen.',
  revoke: 'Teilen beenden',
  revokeConfirm: 'Diese Praxis von der Liste nehmen?',
  cancel: 'Abbrechen',
  noShares: 'Niemand auf der Liste — die App läuft auch ohne Teilen.',
  mentorWeb: 'Praxis-Konto: Patienten und AI-Sponsoring unter healthings.ai/clinic',
  lastShared: 'Zuletzt geteilt',
  neverShared: 'Noch nichts hochgeladen — tippen Sie Teilen, oder warten Sie, wenn die Praxis ein Update angefordert hat.',
  sponsored: 'AI gesponsert von',
  sponsoredUntil: 'bis',
  sponsorshipExpired: 'AI-Sponsoring beendet',
  addAccount: 'Praxis hinzufügen',
  addPack: 'AI-Guthaben hinzufügen',
  addPackOk: 'Guthaben hinzugefügt',
  creditsLine: (n, clinicPayer, autoReload) => {
    const bits = [`AI-Guthaben: ${n}`];
    if (clinicPayer) bits.push('Praxis zahlt');
    if (autoReload) bits.push('Auto-Aufladung an');
    return bits.join(' · ');
  },
  packAdded: (added, balance) => `+${added} Guthaben · Stand ${balance}`,
  loadFailed: 'Freigabe-Einstellungen konnten nicht geladen werden.',
  actionFailed: 'Das hat nicht geklappt. Bitte erneut versuchen.',
  collapse: 'Datenfreigabe einklappen',
  expand: 'Datenfreigabe ausklappen',
};

const AR: ClinicLinkCopy = {
  ...EN,
  subtitle: 'من يمكنه رؤية بياناتكم — اختياري.',
  clinicSyncHint:
    'بعد مشاركة، تستطيع العيادة جمعها من الخادم — حتى بعد إغلاق التطبيق. عند فتحه يُرفع أيضًا إذا طلبت العيادة تحديثًا.',
  send: 'أرسلوا الطلب',
  waiting: 'بانتظار الموافقة',
  invited: 'دعتكم للمشاركة',
  approve: 'وافقوا',
  reject: 'ارفضوا',
  sharesWith: 'مشاركة مع',
  share: 'شاركوا',
  shareOk: 'أُرسل التحديث. العيادة تفتحه في البوابة.',
  revoke: 'أوقفوا المشاركة',
  revokeConfirm: 'إزالة هذه العيادة من القائمة؟',
  cancel: 'إلغاء',
  noShares: 'لا أحد في القائمة — التطبيق يعمل جيدًا بلا مشاركة.',
  mentorWeb: 'حساب العيادة: المرضى ورعاية AI على healthings.ai/clinic',
  lastShared: 'آخر مشاركة',
  neverShared: 'لم يُرفع شيء بعد — اضغطوا شاركوا، أو انتظروا إذا طلبت العيادة تحديثًا.',
  sponsored: 'AI برعاية',
  sponsoredUntil: 'حتى',
  sponsorshipExpired: 'انتهت رعاية AI',
  addAccount: 'أضيفوا عيادة',
  addPack: 'أضيفوا رصيد AI',
  addPackOk: 'أُضيف الرصيد',
  creditsLine: (n, clinicPayer, autoReload) => {
    const bits = [`رصيد AI: ${n}`];
    if (clinicPayer) bits.push('العيادة تدفع');
    if (autoReload) bits.push('إعادة شحن تلقائي');
    return bits.join(' · ');
  },
  packAdded: (added, balance) => `+${added} رصيد · المتبقي ${balance}`,
  loadFailed: 'تعذّر تحميل إعدادات المشاركة.',
  actionFailed: 'لم ينجح. حاولوا مرة أخرى.',
  collapse: 'طي مشاركة البيانات',
  expand: 'توسيع مشاركة البيانات',
};

const RU: ClinicLinkCopy = {
  ...EN,
  subtitle: 'Кто видит ваши данные — по желанию.',
  clinicSyncHint:
    'После «Поделиться» клиника заберёт снимок с сервера — даже если закрыть приложение. При открытии оно тоже отправит, если клиника запросила обновление.',
  send: 'Отправить запрос',
  waiting: 'Ждём подтверждения',
  invited: 'пригласила вас поделиться',
  approve: 'Принять',
  reject: 'Отклонить',
  sharesWith: 'Делитесь с',
  share: 'Поделиться',
  shareOk: 'Обновление отправлено. Клиника откроет его в портале.',
  revoke: 'Остановить доступ',
  revokeConfirm: 'Убрать эту клинику из списка?',
  cancel: 'Отмена',
  noShares: 'В списке никого — приложение работает и без общего доступа.',
  mentorWeb: 'Аккаунт клиники: пациенты и спонсорство AI на healthings.ai/clinic',
  lastShared: 'Последняя отправка',
  neverShared: 'Ещё ничего не загружено — нажмите «Поделиться» или подождите, если клиника запросила обновление.',
  sponsored: 'AI спонсирует',
  sponsoredUntil: 'до',
  sponsorshipExpired: 'Спонсорство AI закончилось',
  addAccount: 'Добавить клинику',
  addPack: 'Добавить кредиты AI',
  addPackOk: 'Кредиты добавлены',
  creditsLine: (n, clinicPayer, autoReload) => {
    const bits = [`Кредиты AI: ${n}`];
    if (clinicPayer) bits.push('платит клиника');
    if (autoReload) bits.push('автопополнение');
    return bits.join(' · ');
  },
  packAdded: (added, balance) => `+${added} кредитов · баланс ${balance}`,
  loadFailed: 'Не удалось загрузить настройки доступа.',
  actionFailed: 'Не получилось. Попробуйте ещё раз.',
  collapse: 'Свернуть доступ к данным',
  expand: 'Развернуть доступ к данным',
};

const PT: ClinicLinkCopy = {
  ...EN,
  subtitle: 'Quem pode ver os seus dados — opcional.',
  clinicSyncHint:
    'Depois de Partilhar, a clínica recolhe no servidor — mesmo se fechar a app. Ao abrir, também envia se a clínica pediu uma atualização.',
  send: 'Enviar pedido',
  waiting: 'A aguardar aprovação',
  invited: 'convidou-o a partilhar',
  approve: 'Aprovar',
  reject: 'Recusar',
  sharesWith: 'A partilhar com',
  share: 'Partilhar',
  shareOk: 'Atualização enviada. A clínica pode abri-la no portal.',
  revoke: 'Parar de partilhar',
  revokeConfirm: 'Remover esta clínica da lista?',
  cancel: 'Cancelar',
  noShares: 'Ninguém na lista — a app funciona bem sem partilhar.',
  mentorWeb: 'Conta da clínica: pacientes e patrocínio AI em healthings.ai/clinic',
  lastShared: 'Último envio',
  neverShared: 'Ainda sem envio — toque em Partilhar, ou aguarde se a clínica pediu uma atualização.',
  sponsored: 'AI patrocinado por',
  sponsoredUntil: 'até',
  sponsorshipExpired: 'O patrocínio AI terminou',
  addAccount: 'Adicionar uma clínica',
  addPack: 'Adicionar créditos AI',
  addPackOk: 'Créditos adicionados',
  creditsLine: (n, clinicPayer, autoReload) => {
    const bits = [`Créditos AI: ${n}`];
    if (clinicPayer) bits.push('a clínica paga');
    if (autoReload) bits.push('recarga automática');
    return bits.join(' · ');
  },
  packAdded: (added, balance) => `+${added} créditos · saldo ${balance}`,
  loadFailed: 'Não foi possível carregar as definições de partilha.',
  actionFailed: 'Não resultou. Tente de novo.',
  collapse: 'Recolher partilha de dados',
  expand: 'Expandir partilha de dados',
};

const IT: ClinicLinkCopy = {
  ...EN,
  subtitle: 'Chi può vedere i tuoi dati — facoltativo.',
  clinicSyncHint:
    'Dopo Condividi, la clinica lo raccoglie dal server — anche se chiudi l’app. All’apertura carica anche se la clinica chiede un aggiornamento.',
  send: 'Invia richiesta',
  waiting: 'In attesa di conferma',
  invited: 'ti ha invitato a condividere',
  approve: 'Approva',
  reject: 'Rifiuta',
  sharesWith: 'Condivisione con',
  share: 'Condividi',
  shareOk: 'Aggiornamento inviato. La clinica può aprirlo nel portale.',
  revoke: 'Interrompi condivisione',
  revokeConfirm: 'Togliere questa clinica dall’elenco?',
  cancel: 'Annulla',
  noShares: 'Nessuno in elenco — l’app funziona bene anche senza condividere.',
  mentorWeb: 'Account clinica: pazienti e sponsor AI su healthings.ai/clinic',
  lastShared: 'Ultimo invio',
  neverShared: 'Ancora niente — tocca Condividi, o aspetta se la clinica ha chiesto un aggiornamento.',
  sponsored: 'AI sponsorizzato da',
  sponsoredUntil: 'fino al',
  sponsorshipExpired: 'Sponsor AI terminato',
  addAccount: 'Aggiungi una clinica',
  addPack: 'Aggiungi crediti AI',
  addPackOk: 'Crediti aggiunti',
  creditsLine: (n, clinicPayer, autoReload) => {
    const bits = [`Crediti AI: ${n}`];
    if (clinicPayer) bits.push('paga la clinica');
    if (autoReload) bits.push('ricarica automatica');
    return bits.join(' · ');
  },
  packAdded: (added, balance) => `+${added} crediti · saldo ${balance}`,
  loadFailed: 'Impossibile caricare le impostazioni di condivisione.',
  actionFailed: 'Non è andata. Riprova.',
  collapse: 'Comprimi condivisione dati',
  expand: 'Espandi condivisione dati',
};

const TR: ClinicLinkCopy = {
  ...EN,
  subtitle: 'Verilerinizi kim görebilir — isteğe bağlı.',
  clinicSyncHint:
    'Paylaş’a basınca klinik sunucudan alır — uygulamayı kapatsanız da. Açınca, klinik güncelleme istediyse yine yükler.',
  send: 'İstek gönder',
  waiting: 'Onay bekleniyor',
  invited: 'sizi paylaşmaya davet etti',
  approve: 'Onayla',
  reject: 'Reddet',
  sharesWith: 'Paylaşılan:',
  share: 'Paylaş',
  shareOk: 'Güncelleme gönderildi. Klinik portalda açabilir.',
  revoke: 'Paylaşımı durdur',
  revokeConfirm: 'Bu klinik listeden çıksın mı?',
  cancel: 'İptal',
  noShares: 'Listede kimse yok — uygulama paylaşmadan da çalışır.',
  mentorWeb: 'Klinik hesabı: hastalar ve AI sponsorluğu healthings.ai/clinic',
  lastShared: 'Son paylaşım',
  neverShared: 'Henüz yükleme yok — Paylaş’a dokunun veya klinik güncelleme istediyse bekleyin.',
  sponsored: 'AI sponsoru',
  sponsoredUntil: 'bitiş',
  sponsorshipExpired: 'AI sponsorluğu bitti',
  addAccount: 'Klinik ekle',
  addPack: 'AI kredisi ekle',
  addPackOk: 'Kredi eklendi',
  creditsLine: (n, clinicPayer, autoReload) => {
    const bits = [`AI kredisi: ${n}`];
    if (clinicPayer) bits.push('klinik ödüyor');
    if (autoReload) bits.push('otomatik yükleme açık');
    return bits.join(' · ');
  },
  packAdded: (added, balance) => `+${added} kredi · bakiye ${balance}`,
  loadFailed: 'Paylaşım ayarları yüklenemedi.',
  actionFailed: 'Olmadı. Tekrar deneyin.',
  collapse: 'Veri paylaşımını daralt',
  expand: 'Veri paylaşımını genişlet',
};

const BY_CODE: Record<string, ClinicLinkCopy> = {
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

export function getClinicLinkCopy(langCode?: string | null): ClinicLinkCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return BY_CODE[c] ?? EN;
}
