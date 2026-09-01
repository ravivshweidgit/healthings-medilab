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
  healthingsClinicBtn: string;
  healthingsClinicHint: string;
  healthingsClinicSent: string;
  healthingsClinicAlready: string;
  healthingsClinicWaiting: string;
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
    'While a clinic is linked, one update goes out the first time you open the app each day. Tap Share anytime for an immediate upload (including meal photos). Stop sharing removes access.',
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
  neverShared: 'Nothing uploaded yet — open the app once while linked, or tap Share.',
  sponsored: 'AI sponsored by',
  sponsoredUntil: 'until',
  sponsorshipExpired: 'AI sponsorship ended',
  addAccount: 'Add a clinic',
  healthingsClinicBtn: 'Share with Healthings clinic',
  healthingsClinicHint: 'One tap — no typing.',
  healthingsClinicSent: 'Request sent. Healthings clinic will see it in their portal.',
  healthingsClinicAlready: 'Already sharing with Healthings clinic.',
  healthingsClinicWaiting: 'Waiting for Healthings clinic to approve.',
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
    'כשקליניקה מקושרת, עדכון אחד יוצא בפעם הראשונה שפותחים את האפליקציה בכל יום. שתפו — להעלאה מיידית (כולל צילומי ארוחות). הפסקת שיתוף מורידה גישה.',
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
  neverShared: 'עדיין לא הועלה — פתחו את האפליקציה פעם אחת כשמקושרים, או לחצו שתפו.',
  sponsored: 'AI בחסות',
  sponsoredUntil: 'עד',
  sponsorshipExpired: 'חסות ה־AI הסתיימה',
  addAccount: 'הוסיפו קליניקה',
  healthingsClinicBtn: 'שתפו עם קליניקת Healthings',
  healthingsClinicHint: 'לחיצה אחת — בלי להקליד.',
  healthingsClinicSent: 'הבקשה נשלחה. קליניקת Healthings תראה אותה בפורטל.',
  healthingsClinicAlready: 'כבר משתפים עם קליניקת Healthings.',
  healthingsClinicWaiting: 'ממתינים לאישור קליניקת Healthings.',
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
    'Con una clínica vinculada, se envía una actualización la primera vez que abres la app cada día. Toca Compartir para subir al momento (incluidas fotos de comidas). Dejar de compartir quita el acceso.',
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
  neverShared: 'Aún no hay envío — abre la app una vez estando vinculado, o toca Compartir.',
  sponsored: 'AI patrocinado por',
  sponsoredUntil: 'hasta',
  sponsorshipExpired: 'El patrocinio de AI terminó',
  addAccount: 'Añadir una clínica',
  healthingsClinicBtn: 'Compartir con la clínica Healthings',
  healthingsClinicHint: 'Un toque — sin escribir el correo.',
  healthingsClinicSent: 'Solicitud enviada. La clínica Healthings la verá en su portal.',
  healthingsClinicAlready: 'Ya compartes con la clínica Healthings.',
  healthingsClinicWaiting: 'Esperando aprobación de la clínica Healthings.',
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
    'Clinique liée : une mise à jour part à la première ouverture de l’app chaque jour. Touchez Partager pour un envoi immédiat (photos de repas incluses). Arrêter le partage retire l’accès.',
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
  neverShared: 'Rien d’envoyé — ouvrez l’app une fois en étant lié, ou touchez Partager.',
  sponsored: 'AI pris en charge par',
  sponsoredUntil: 'jusqu’au',
  sponsorshipExpired: 'Le parrainage AI est terminé',
  addAccount: 'Ajouter un cabinet',
  healthingsClinicBtn: 'Partager avec le cabinet Healthings',
  healthingsClinicHint: 'Un appui — sans taper l’adresse.',
  healthingsClinicSent: 'Demande envoyée. Le cabinet Healthings la verra dans son portail.',
  healthingsClinicAlready: 'Vous partagez déjà avec le cabinet Healthings.',
  healthingsClinicWaiting: 'En attente de l’accord du cabinet Healthings.',
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
    'Mit verknüpfter Praxis geht einmal täglich beim ersten App-Start ein Update raus. Teilen tippt für sofortigen Upload (inkl. Mahlzeitfotos). Teilen beenden entzieht den Zugang.',
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
  neverShared: 'Noch nichts hochgeladen — App einmal öffnen wenn verknüpft, oder Teilen tippen.',
  sponsored: 'AI gesponsert von',
  sponsoredUntil: 'bis',
  sponsorshipExpired: 'AI-Sponsoring beendet',
  addAccount: 'Praxis hinzufügen',
  healthingsClinicBtn: 'Mit Healthings-Praxis teilen',
  healthingsClinicHint: 'Ein Tipp — nichts eintippen.',
  healthingsClinicSent: 'Anfrage gesendet. Die Healthings-Praxis sieht sie im Portal.',
  healthingsClinicAlready: 'Sie teilen bereits mit der Healthings-Praxis.',
  healthingsClinicWaiting: 'Wartet auf Freigabe der Healthings-Praxis.',
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
    'مع عيادة مرتبطة، يُرسل تحديث واحد عند أول فتح للتطبيق كل يوم. اضغطوا مشاركة للرفع فورًا (بما فيها صور الوجبات). إيقاف المشاركة يلغي الوصول.',
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
  neverShared: 'لم يُرفع شيء بعد — افتحوا التطبيق مرة واحدة وأنتم مرتبطون، أو اضغطوا مشاركة.',
  sponsored: 'AI برعاية',
  sponsoredUntil: 'حتى',
  sponsorshipExpired: 'انتهت رعاية AI',
  addAccount: 'أضيفوا عيادة',
  healthingsClinicBtn: 'شاركوا مع عيادة Healthings',
  healthingsClinicHint: 'ضغطة واحدة — بلا كتابة.',
  healthingsClinicSent: 'أُرسل الطلب. عيادة Healthings تراه في البوابة.',
  healthingsClinicAlready: 'تشاركون بالفعل مع عيادة Healthings.',
  healthingsClinicWaiting: 'بانتظار موافقة عيادة Healthings.',
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
    'При привязанной клинике раз в день при первом открытии приложения уходит одно обновление. «Поделиться» — сразу (включая фото еды). Отзыв доступа прекращает отправку.',
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
  neverShared: 'Ещё ничего не загружено — откройте приложение раз при привязке или нажмите «Поделиться».',
  sponsored: 'AI спонсирует',
  sponsoredUntil: 'до',
  sponsorshipExpired: 'Спонсорство AI закончилось',
  addAccount: 'Добавить клинику',
  healthingsClinicBtn: 'Поделиться с клиникой Healthings',
  healthingsClinicHint: 'Одно нажатие — без набора адреса.',
  healthingsClinicSent: 'Запрос отправлен. Клиника Healthings увидит его в портале.',
  healthingsClinicAlready: 'Вы уже делитесь с клиникой Healthings.',
  healthingsClinicWaiting: 'Ждём подтверждения клиники Healthings.',
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
    'Com clínica ligada, vai um update na primeira abertura da app em cada dia. Partilhar envia já (inclui fotos das refeições). Parar de partilhar remove o acesso.',
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
  neverShared: 'Ainda sem envio — abra a app uma vez ligado, ou toque em Partilhar.',
  sponsored: 'AI patrocinado por',
  sponsoredUntil: 'até',
  sponsorshipExpired: 'O patrocínio AI terminou',
  addAccount: 'Adicionar uma clínica',
  healthingsClinicBtn: 'Partilhar com a clínica Healthings',
  healthingsClinicHint: 'Um toque — sem escrever o email.',
  healthingsClinicSent: 'Pedido enviado. A clínica Healthings vê-o no portal.',
  healthingsClinicAlready: 'Já está a partilhar com a clínica Healthings.',
  healthingsClinicWaiting: 'A aguardar aprovação da clínica Healthings.',
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
    'Con clinica collegata, un aggiornamento parte alla prima apertura dell’app ogni giorno. Condividi per l’invio immediato (anche foto pasti). Interrompere la condivisione toglie l’accesso.',
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
  neverShared: 'Ancora niente — apri l’app una volta se collegato, o tocca Condividi.',
  sponsored: 'AI sponsorizzato da',
  sponsoredUntil: 'fino al',
  sponsorshipExpired: 'Sponsor AI terminato',
  addAccount: 'Aggiungi una clinica',
  healthingsClinicBtn: 'Condividi con la clinica Healthings',
  healthingsClinicHint: 'Un tocco — senza digitare.',
  healthingsClinicSent: 'Richiesta inviata. La clinica Healthings la vede nel portale.',
  healthingsClinicAlready: 'Stai già condividendo con la clinica Healthings.',
  healthingsClinicWaiting: 'In attesa della conferma della clinica Healthings.',
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
    'Klinik bağlıyken her gün uygulamayı ilk açışınızda bir güncelleme gider. Paylaş — anında yükleme (yemek fotoğrafları dahil). Paylaşımı durdurmak erişimi kaldırır.',
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
  neverShared: 'Henüz yükleme yok — bağlıyken uygulamayı bir kez açın veya Paylaş’a dokunun.',
  sponsored: 'AI sponsoru',
  sponsoredUntil: 'bitiş',
  sponsorshipExpired: 'AI sponsorluğu bitti',
  addAccount: 'Klinik ekle',
  healthingsClinicBtn: 'Healthings kliniğiyle paylaş',
  healthingsClinicHint: 'Tek dokunuş — yazmaya gerek yok.',
  healthingsClinicSent: 'İstek gönderildi. Healthings kliniği portalde görür.',
  healthingsClinicAlready: 'Healthings kliniğiyle zaten paylaşıyorsunuz.',
  healthingsClinicWaiting: 'Healthings kliniğinin onayı bekleniyor.',
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
