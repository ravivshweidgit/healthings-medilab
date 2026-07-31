/**
 * PROFILE & SETTINGS nested strip titles — coach language.
 * No “My / שלי” — ownership is already clear from the parent card.
 */

export type ProfileSettingsStripCopy = {
  myProfile: string;
  language: string;
  units: string;
  gear: string;
  myTargets: string;
  myMentors: string;
  myRules: string;
  myMacros: string;
  account: string;
  dataSharing: string;
  reports: string;
  appBackup: string;
  help: string;
  exportBackup: string;
  importBackup: string;
  /** Data sharing collapsed subtitle. */
  noAccountsWhitelisted: string;
  waitingApproval: string;
  sharesWith: string;
  accountsWhitelisted: (n: number) => string;
};

const EN: ProfileSettingsStripCopy = {
  myProfile: 'PROFILE',
  language: 'LANGUAGE',
  units: 'UNITS',
  gear: 'GEAR',
  myTargets: 'TARGETS',
  myMentors: 'MENTORS',
  myRules: 'RULES',
  myMacros: 'MACROS',
  account: 'ACCOUNT',
  dataSharing: 'DATA SHARING',
  reports: 'REPORTS',
  appBackup: 'APP BACKUP',
  help: 'HELP',
  exportBackup: 'Export',
  importBackup: 'Import',
  noAccountsWhitelisted: 'No accounts whitelisted — app works fully without sharing',
  waitingApproval: 'Waiting for approval',
  sharesWith: 'Shares data with',
  accountsWhitelisted: (n) =>
    n === 1 ? '1 account whitelisted' : `${n} accounts whitelisted`,
};

const HE: ProfileSettingsStripCopy = {
  myProfile: 'פרופיל',
  language: 'שפה',
  units: 'יחידות',
  gear: 'ציוד',
  myTargets: 'יעדים',
  myMentors: 'מנטורים',
  myRules: 'כללים',
  myMacros: 'מאקרו',
  account: 'חשבון',
  dataSharing: 'שיתוף נתונים',
  reports: 'דוחות',
  appBackup: 'גיבוי אפליקציה',
  help: 'עזרה',
  exportBackup: 'ייצוא',
  importBackup: 'ייבוא',
  noAccountsWhitelisted: 'אין חשבונות ברשימה — האפליקציה עובדת במלואה בלי שיתוף',
  waitingApproval: 'ממתין לאישור',
  sharesWith: 'משתף נתונים עם',
  accountsWhitelisted: (n) =>
    n === 1 ? 'חשבון אחד ברשימה' : `${n} חשבונות ברשימה`,
};

const ES: ProfileSettingsStripCopy = {
  myProfile: 'PERFIL',
  language: 'IDIOMA',
  units: 'UNIDADES',
  gear: 'EQUIPO',
  myTargets: 'OBJETIVOS',
  myMentors: 'MENTORES',
  myRules: 'REGLAS',
  myMacros: 'MACROS',
  account: 'CUENTA',
  dataSharing: 'COMPARTIR DATOS',
  reports: 'INFORMES',
  appBackup: 'COPIA DE SEGURIDAD',
  help: 'AYUDA',
  exportBackup: 'Exportar',
  importBackup: 'Importar',
  noAccountsWhitelisted: 'Ninguna cuenta autorizada — la app funciona sin compartir',
  waitingApproval: 'Esperando aprobación',
  sharesWith: 'Comparte datos con',
  accountsWhitelisted: (n) =>
    n === 1 ? '1 cuenta autorizada' : `${n} cuentas autorizadas`,
};

const FR: ProfileSettingsStripCopy = {
  myProfile: 'PROFIL',
  language: 'LANGUE',
  units: 'UNITÉS',
  gear: 'MATÉRIEL',
  myTargets: 'OBJECTIFS',
  myMentors: 'MENTORS',
  myRules: 'RÈGLES',
  myMacros: 'MACROS',
  account: 'COMPTE',
  dataSharing: 'PARTAGE DE DONNÉES',
  reports: 'RAPPORTS',
  appBackup: 'SAUVEGARDE',
  help: 'AIDE',
  exportBackup: 'Exporter',
  importBackup: 'Importer',
  noAccountsWhitelisted: 'Aucun compte autorisé — l’app fonctionne sans partage',
  waitingApproval: 'En attente d’approbation',
  sharesWith: 'Partage les données avec',
  accountsWhitelisted: (n) =>
    n === 1 ? '1 compte autorisé' : `${n} comptes autorisés`,
};

const DE: ProfileSettingsStripCopy = {
  myProfile: 'PROFIL',
  language: 'SPRACHE',
  units: 'EINHEITEN',
  gear: 'GERÄTE',
  myTargets: 'ZIELE',
  myMentors: 'MENTOREN',
  myRules: 'REGELN',
  myMacros: 'MAKROS',
  account: 'KONTO',
  dataSharing: 'DATENFREIGABE',
  reports: 'BERICHTE',
  appBackup: 'APP-BACKUP',
  help: 'HILFE',
  exportBackup: 'Exportieren',
  importBackup: 'Importieren',
  noAccountsWhitelisted: 'Keine freigegebenen Konten — App funktioniert ohne Teilen',
  waitingApproval: 'Warte auf Freigabe',
  sharesWith: 'Teilt Daten mit',
  accountsWhitelisted: (n) =>
    n === 1 ? '1 Konto freigegeben' : `${n} Konten freigegeben`,
};

const AR: ProfileSettingsStripCopy = {
  myProfile: 'الملف',
  language: 'اللغة',
  units: 'الوحدات',
  gear: 'الأجهزة',
  myTargets: 'الأهداف',
  myMentors: 'المرشدون',
  myRules: 'القواعد',
  myMacros: 'الماكرو',
  account: 'الحساب',
  dataSharing: 'مشاركة البيانات',
  reports: 'التقارير',
  appBackup: 'نسخ احتياطي',
  help: 'مساعدة',
  exportBackup: 'تصدير',
  importBackup: 'استيراد',
  noAccountsWhitelisted: 'لا حسابات في القائمة — التطبيق يعمل بالكامل دون مشاركة',
  waitingApproval: 'بانتظار الموافقة',
  sharesWith: 'يشارك البيانات مع',
  accountsWhitelisted: (n) =>
    n === 1 ? 'حساب واحد في القائمة' : `${n} حسابات في القائمة`,
};

const RU: ProfileSettingsStripCopy = {
  myProfile: 'ПРОФИЛЬ',
  language: 'ЯЗЫК',
  units: 'ЕДИНИЦЫ',
  gear: 'УСТРОЙСТВА',
  myTargets: 'ЦЕЛИ',
  myMentors: 'НАСТАВНИКИ',
  myRules: 'ПРАВИЛА',
  myMacros: 'МАКРОСЫ',
  account: 'АККАУНТ',
  dataSharing: 'ОБМЕН ДАННЫМИ',
  reports: 'ОТЧЁТЫ',
  appBackup: 'РЕЗЕРВНАЯ КОПИЯ',
  help: 'СПРАВКА',
  exportBackup: 'Экспорт',
  importBackup: 'Импорт',
  noAccountsWhitelisted: 'Нет разрешённых аккаунтов — приложение работает без общего доступа',
  waitingApproval: 'Ожидание одобрения',
  sharesWith: 'Делится данными с',
  accountsWhitelisted: (n) =>
    n === 1 ? '1 аккаунт в списке' : `${n} аккаунтов в списке`,
};

const PT: ProfileSettingsStripCopy = {
  myProfile: 'PERFIL',
  language: 'IDIOMA',
  units: 'UNIDADES',
  gear: 'EQUIPAMENTO',
  myTargets: 'METAS',
  myMentors: 'MENTORES',
  myRules: 'REGRAS',
  myMacros: 'MACROS',
  account: 'CONTA',
  dataSharing: 'COMPARTILHAMENTO',
  reports: 'RELATÓRIOS',
  appBackup: 'BACKUP DO APP',
  help: 'AJUDA',
  exportBackup: 'Exportar',
  importBackup: 'Importar',
  noAccountsWhitelisted: 'Nenhuma conta autorizada — o app funciona sem compartilhar',
  waitingApproval: 'Aguardando aprovação',
  sharesWith: 'Compartilha dados com',
  accountsWhitelisted: (n) =>
    n === 1 ? '1 conta autorizada' : `${n} contas autorizadas`,
};

const IT: ProfileSettingsStripCopy = {
  myProfile: 'PROFILO',
  language: 'LINGUA',
  units: 'UNITÀ',
  gear: 'DISPOSITIVI',
  myTargets: 'OBIETTIVI',
  myMentors: 'MENTOR',
  myRules: 'REGOLE',
  myMacros: 'MACRO',
  account: 'ACCOUNT',
  dataSharing: 'CONDIVISIONE DATI',
  reports: 'REPORT',
  appBackup: 'BACKUP APP',
  help: 'AIUTO',
  exportBackup: 'Esporta',
  importBackup: 'Importa',
  noAccountsWhitelisted: 'Nessun account autorizzato — l’app funziona senza condivisione',
  waitingApproval: 'In attesa di approvazione',
  sharesWith: 'Condivide i dati con',
  accountsWhitelisted: (n) =>
    n === 1 ? '1 account autorizzato' : `${n} account autorizzati`,
};

const TR: ProfileSettingsStripCopy = {
  myProfile: 'PROFİL',
  language: 'DİL',
  units: 'BİRİMLER',
  gear: 'CİHAZLAR',
  myTargets: 'HEDEFLER',
  myMentors: 'MENTORLAR',
  myRules: 'KURALLAR',
  myMacros: 'MAKROLAR',
  account: 'HESAP',
  dataSharing: 'VERİ PAYLAŞIMI',
  reports: 'RAPORLAR',
  appBackup: 'UYGULAMA YEDEĞİ',
  help: 'YARDIM',
  exportBackup: 'Dışa aktar',
  importBackup: 'İçe aktar',
  noAccountsWhitelisted: 'Yetkili hesap yok — uygulama paylaşım olmadan tam çalışır',
  waitingApproval: 'Onay bekleniyor',
  sharesWith: 'Verileri paylaşıyor:',
  accountsWhitelisted: (n) =>
    n === 1 ? '1 yetkili hesap' : `${n} yetkili hesap`,
};

export function getProfileSettingsStripCopy(
  langCode?: string | null,
): ProfileSettingsStripCopy {
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
