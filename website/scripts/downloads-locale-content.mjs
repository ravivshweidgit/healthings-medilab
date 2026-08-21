/**
 * Copy + app catalog for /{lang}/downloads/ — "the apps for your phone".
 *
 * The page exists because the answer genuinely differs by platform: Android needs
 * Health Connect as the hub and xDrip+ as a bridge, iPhone needs neither, and
 * Samsung Health is only ever a step source. Sending everyone to one list means
 * half the readers install something they cannot use.
 */

/**
 * App marks live in website/images/apps/. Exactly one card has one, and the
 * asymmetry is the point: xDrip+ is the only app here that is not a store link,
 * so the icon is the reader's way to check that what lands on their home screen
 * after an APK install is what this page sent them. A store page shows its own
 * icon before you tap install; a sideload shows nothing.
 *
 * It stayed the only one for two reasons. Apple's, Google's, Samsung's and
 * i-SENS' icons are their brand assets under their own guidelines — not ours to
 * mirror as decoration. And our own icon, tried at this size, is a tiny heart
 * inside a near-white plate: next to a solid red drop it read as a smudge, and a
 * faint mark on one card is worse than no mark.
 */
const ICON_VER = '20260821a';
const asset = (path) => `../../${path}?v=${ICON_VER}`;

/** Store links verified 2026-08-21 against the live listings. */
export const APPS = {
  healthings: {
    name: 'Healthings',
    // Internal-test track and TestFlight, same links the landing page uses.
    android: { kind: 'play', url: 'https://play.google.com/apps/internaltest/4701238109724209688' },
    ios: { kind: 'testflight', url: 'https://testflight.apple.com/join/Qt5spFMt' },
    help: 'quick-start-welcome',
    need: 'required',
  },
  healthConnect: {
    name: 'Health Connect',
    // Android 13 and lower only. On 14+ it is a framework module that cannot be
    // installed or uninstalled, so the card leads with the Settings path.
    android: {
      kind: 'play',
      url: 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata',
    },
    help: 'phone-health-activity',
    need: 'usually',
  },
  withings: {
    name: 'Withings',
    // Listed as "Withings" now; older docs and our help pages say Health Mate.
    android: { kind: 'play', url: 'https://play.google.com/store/apps/details?id=com.withings.wiscale2' },
    ios: { kind: 'appstore', url: 'https://apps.apple.com/app/id542701020' },
    help: 'withings-link',
    need: 'device',
  },
  caresens: {
    name: 'CareSens Air',
    android: { kind: 'play', url: 'https://play.google.com/store/apps/details?id=com.isens.csair' },
    ios: { kind: 'appstore', url: 'https://apps.apple.com/app/id1605701892' },
    help: 'cgm',
    need: 'device',
  },
  xdrip: {
    name: 'xDrip+',
    icon: asset('images/apps/xdrip-plus-icon.png'),
    android: { kind: 'apk', url: '/downloads/xdrip-plus.apk' },
    help: 'xdrip-caresens',
    // Not "only if you have one" — nobody owns a bridge. It is needed only if the
    // sensor is a CareSens, and only on Android.
    need: 'bridge',
  },
  samsung: {
    name: 'Samsung Health',
    android: {
      kind: 'play',
      url: 'https://play.google.com/store/apps/details?id=com.sec.android.app.shealth',
    },
    help: 'phone-health-activity',
    need: 'device',
  },
  appleHealth: {
    name: 'Apple Health',
    ios: { kind: 'builtin' },
    help: 'phone-health-activity',
    need: 'usually',
  },
};

/** Card order per platform. Healthings first, then the hub, then devices. */
export const ANDROID_ORDER = ['healthings', 'healthConnect', 'withings', 'caresens', 'xdrip', 'samsung'];
export const IOS_ORDER = ['healthings', 'appleHealth', 'withings', 'caresens'];

/** RTL keeps the plus glued to the Latin run — see help-locale-content.mjs. */
export function ltrPlus(s) {
  return String(s).replace(/xDrip\+/g, 'xDrip+\u200e');
}

export const DOWNLOADS_UI = {
  en: {
    nav: 'Downloads',
    title: 'The apps for your phone',
    lead: 'Healthings works on its own. Everything else here is for a device you actually own — and the list is not the same on Android and iPhone.',
    android: 'Android',
    ios: 'iPhone',
    pick: 'Your phone',
    detected: 'Showing the list for the phone you are reading this on. On a computer you see both.',
    tagRequired: 'Start here',
    tagUsually: 'Usually needed',
    tagDevice: 'Only if you have one',
    tagBridge: 'CareSens integration',
    getPlay: 'Get it on Google Play',
    getAppStore: 'Get it on the App Store',
    getTestFlight: 'Install with TestFlight',
    getApk: 'Download the APK',
    builtIn: 'Already on your phone',
    builtInSettings: 'Already in Settings (Android 14+)',
    hcOlder: 'Android 13 or older: get it on Google Play',
    howTo: 'How to set it up',
    why: {
      healthings: 'The app itself. Labs, meals, targets and trends — it runs with nothing but manual weigh-ins.',
      healthConnect:
        'Android’s own health store, and the only door Healthings uses for steps and glucose. On Android 14 and up it is already there: Settings → Security &amp; privacy → Privacy → Health Connect. Older phones install it.',
      withings: 'Scale and watch in one app. Weight, fat, muscle and BMR from the scale; steps, heart rate and workouts from the watch. Install it once, then link your Withings account in Healthings.',
      caresensAndroid:
        'Talks to your CareSens Air sensor. On Android it keeps the readings to itself, so it needs xDrip+ below to pass them on.',
      caresensIos:
        'Talks to your CareSens Air sensor and shares glucose straight to Apple Health, where Healthings reads it. No bridge app on iPhone.',
      xdrip:
        'The CareSens integration Healthings uses on Android. It hands CareSens Air readings to Health Connect, where Healthings reads them.',
      samsung:
        'Only matters as a step source. It writes steps into Health Connect and Healthings reads them there — but you have to switch that on: Samsung Health → Settings → Health Connect. Otherwise the steps never leave Samsung.',
      appleHealth:
        'Nothing to install. It is where CareSens Air glucose and your phone’s step count meet Healthings — you grant permission the first time and that is it.',
    },
    asideTitle: 'Less to install on iPhone',
    asideBody:
      'No xDrip+ and no Samsung Health here — CareSens Air talks to Apple Health by itself, and the phone counts your steps.',
    foot: 'Not sure? Install Healthings and nothing else. Add a device app the day you own the device.',
  },

  he: {
    nav: 'הורדות',
    title: 'האפליקציות לטלפון שלכם',
    lead: 'Healthings עובדת גם לבד. כל השאר כאן זה למי שיש לו את המכשיר — והרשימה שונה באנדרואיד ובאייפון.',
    android: 'Android',
    ios: 'iPhone',
    pick: 'הטלפון שלכם',
    detected: 'מוצגת הרשימה של הטלפון שממנו אתם קוראים. במחשב רואים את שתיהן.',
    tagRequired: 'מתחילים כאן',
    tagUsually: 'בדרך כלל צריך',
    tagDevice: 'רק אם יש לכם',
    tagBridge: 'חיבור CareSens',
    getPlay: 'הורדה מ־Google Play',
    getAppStore: 'הורדה מ־App Store',
    getTestFlight: 'התקנה עם TestFlight',
    getApk: 'הורדת קובץ APK',
    builtIn: 'כבר בטלפון שלכם',
    builtInSettings: 'כבר בהגדרות (אנדרואיד 14 ומעלה)',
    hcOlder: 'אנדרואיד 13 ומטה: הורדה מ־Google Play',
    howTo: 'איך מחברים',
    why: {
      healthings: 'האפליקציה עצמה. בדיקות, ארוחות, יעדים ומגמות — עובדת גם עם שקילה שמזינים ביד.',
      healthConnect:
        'מחסן הבריאות של אנדרואיד, והדלת היחידה שדרכה Healthings לוקחת צעדים וגלוקוז. באנדרואיד 14 ומעלה הוא כבר שם: Settings → Security &amp; privacy → Privacy → Health Connect. בטלפונים ותיקים מתקינים אותו.',
      withings: 'המשקל והשעון באפליקציה אחת. משקל, שומן, שריר ו־BMR מהמשקל; צעדים, דופק ואימונים מהשעון. מתקינים פעם אחת, ואז מחברים את חשבון Withings בתוך Healthings.',
      caresensAndroid:
        'מדברת עם חיישן CareSens Air. באנדרואיד היא שומרת את המדידות אצלה, ולכן צריך את xDrip+ למטה כדי להעביר אותן.',
      caresensIos:
        'מדברת עם חיישן CareSens Air ומשתפת את הגלוקוז ישר ל־Apple Health, ומשם Healthings קוראת. באייפון לא צריך אפליקציית גשר.',
      xdrip:
        'חיבור CareSens ל־Healthings באנדרואיד. מעבירה את המדידות מ־CareSens Air ל־Health Connect, ומשם Healthings קוראת.',
      samsung:
        'רלוונטית רק כמקור צעדים. היא כותבת צעדים ל־Health Connect ומשם Healthings קוראת — אבל צריך להדליק את זה: Samsung Health → Settings → Health Connect. אחרת הצעדים נשארים אצל סמסונג.',
      appleHealth:
        'אין מה להתקין. זה המקום שבו הגלוקוז מ־CareSens Air והצעדים של הטלפון פוגשים את Healthings — מאשרים הרשאה פעם אחת וזה הכל.',
    },
    asideTitle: 'באייפון צריך פחות',
    asideBody:
      'אין כאן xDrip+ ואין Samsung Health — CareSens Air מדברת עם Apple Health לבד, והטלפון סופר את הצעדים.',
    foot: 'לא בטוחים? התקינו רק את Healthings. אפליקציית מכשיר מוסיפים ביום שיש מכשיר.',
  },

  es: {
    nav: 'Descargas',
    title: 'Las apps para tu teléfono',
    lead: 'Healthings funciona sola. Lo demás es para un dispositivo que ya tengas — y la lista no es la misma en Android que en iPhone.',
    android: 'Android',
    ios: 'iPhone',
    pick: 'Tu teléfono',
    detected: 'Se muestra la lista del teléfono desde el que lees. En un ordenador verás las dos.',
    tagRequired: 'Empieza aquí',
    tagUsually: 'Casi siempre hace falta',
    tagDevice: 'Solo si lo tienes',
    tagBridge: 'Integración CareSens',
    getPlay: 'Descargar en Google Play',
    getAppStore: 'Descargar en el App Store',
    getTestFlight: 'Instalar con TestFlight',
    getApk: 'Descargar el APK',
    builtIn: 'Ya está en tu teléfono',
    builtInSettings: 'Ya está en Ajustes (Android 14+)',
    hcOlder: 'Android 13 o anterior: descárgalo en Google Play',
    howTo: 'Cómo configurarlo',
    why: {
      healthings: 'La app en sí. Analíticas, comidas, objetivos y tendencias — funciona incluso pesándote a mano.',
      healthConnect:
        'El almacén de salud de Android, y la única puerta por la que Healthings toma pasos y glucosa. En Android 14 y superior ya está ahí: Settings → Security &amp; privacy → Privacy → Health Connect. En teléfonos antiguos se instala.',
      withings: 'La báscula y el reloj en una sola app. Peso, grasa, músculo y BMR de la báscula; pasos, frecuencia cardíaca y entrenos del reloj. Instálala una vez y luego vincula tu cuenta Withings en Healthings.',
      caresensAndroid:
        'Habla con tu sensor CareSens Air. En Android se guarda las lecturas, así que necesita xDrip+ para pasarlas.',
      caresensIos:
        'Habla con tu sensor CareSens Air y comparte la glucosa directamente con Apple Health, de donde la lee Healthings. En iPhone no hace falta puente.',
      xdrip:
        'La integración de CareSens que Healthings usa en Android. Pasa las lecturas de CareSens Air a Health Connect, y Healthings las lee ahí.',
      samsung:
        'Solo cuenta como fuente de pasos. Escribe los pasos en Health Connect y Healthings los lee allí, pero hay que activarlo: Samsung Health → Settings → Health Connect. Si no, los pasos no salen de Samsung.',
      appleHealth:
        'Nada que instalar. Es donde la glucosa de CareSens Air y los pasos del teléfono se encuentran con Healthings — das permiso la primera vez y ya está.',
    },
    asideTitle: 'En iPhone hay menos que instalar',
    asideBody:
      'Aquí no hay xDrip+ ni Samsung Health — CareSens Air habla con Apple Health por su cuenta y el teléfono cuenta los pasos.',
    foot: '¿Dudas? Instala solo Healthings. La app del dispositivo, el día que tengas el dispositivo.',
  },

  fr: {
    nav: 'Téléchargements',
    title: 'Les applications pour votre téléphone',
    lead: 'Healthings fonctionne seule. Le reste ne sert que si vous avez l’appareil — et la liste n’est pas la même sur Android et sur iPhone.',
    android: 'Android',
    ios: 'iPhone',
    pick: 'Votre téléphone',
    detected: 'Voici la liste du téléphone depuis lequel vous lisez. Sur un ordinateur, les deux s’affichent.',
    tagRequired: 'Commencez ici',
    tagUsually: 'En général nécessaire',
    tagDevice: 'Seulement si vous en avez',
    tagBridge: 'Intégration CareSens',
    getPlay: 'Télécharger sur Google Play',
    getAppStore: 'Télécharger sur l’App Store',
    getTestFlight: 'Installer via TestFlight',
    getApk: 'Télécharger l’APK',
    builtIn: 'Déjà sur votre téléphone',
    builtInSettings: 'Déjà dans les Réglages (Android 14+)',
    hcOlder: 'Android 13 ou antérieur : à télécharger sur Google Play',
    howTo: 'Comment la configurer',
    why: {
      healthings: 'L’application elle-même. Analyses, repas, objectifs et tendances — elle tourne même avec des pesées saisies à la main.',
      healthConnect:
        'Le magasin de santé d’Android, et la seule porte par laquelle Healthings prend les pas et la glycémie. Sur Android 14 et plus, il est déjà là : Settings → Security &amp; privacy → Privacy → Health Connect. Sur les téléphones plus anciens, on l’installe.',
      withings: 'La balance et la montre dans une seule application. Poids, masse grasse, muscle et BMR côté balance ; pas, fréquence cardiaque et séances côté montre. Installez-la une fois, puis liez votre compte Withings dans Healthings.',
      caresensAndroid:
        'Parle à votre capteur CareSens Air. Sur Android, elle garde les mesures pour elle : il faut xDrip+ ci-dessous pour les transmettre.',
      caresensIos:
        'Parle à votre capteur CareSens Air et partage la glycémie directement avec Apple Health, où Healthings la lit. Aucune application pont sur iPhone.',
      xdrip:
        'L’intégration CareSens que Healthings utilise sur Android. Elle transmet les mesures de CareSens Air à Health Connect, où Healthings les lit.',
      samsung:
        'Utile uniquement comme source de pas. Elle écrit les pas dans Health Connect et Healthings les y lit — mais il faut l’activer : Samsung Health → Settings → Health Connect. Sinon les pas restent chez Samsung.',
      appleHealth:
        'Rien à installer. C’est là que la glycémie de CareSens Air et les pas du téléphone rejoignent Healthings — vous donnez l’autorisation une fois, et c’est tout.',
    },
    asideTitle: 'Moins à installer sur iPhone',
    asideBody:
      'Ni xDrip+ ni Samsung Health ici — CareSens Air parle à Apple Health toute seule, et le téléphone compte vos pas.',
    foot: 'Un doute ? Installez Healthings et rien d’autre. L’application d’un appareil attend que vous ayez l’appareil.',
  },

  de: {
    nav: 'Downloads',
    title: 'Die Apps für dein Handy',
    lead: 'Healthings läuft auch allein. Alles andere hier gehört zu einem Gerät, das du wirklich hast — und die Liste ist auf Android und iPhone nicht dieselbe.',
    android: 'Android',
    ios: 'iPhone',
    pick: 'Dein Handy',
    detected: 'Du siehst die Liste für das Handy, auf dem du liest. Am Computer erscheinen beide.',
    tagRequired: 'Hier anfangen',
    tagUsually: 'Meist nötig',
    tagDevice: 'Nur wenn du es hast',
    tagBridge: 'CareSens-Anbindung',
    getPlay: 'Bei Google Play laden',
    getAppStore: 'Im App Store laden',
    getTestFlight: 'Mit TestFlight installieren',
    getApk: 'APK herunterladen',
    builtIn: 'Schon auf deinem Handy',
    builtInSettings: 'Schon in den Einstellungen (Android 14+)',
    hcOlder: 'Android 13 oder älter: bei Google Play laden',
    howTo: 'So richtest du es ein',
    why: {
      healthings: 'Die App selbst. Laborwerte, Mahlzeiten, Ziele und Trends — sie läuft schon mit von Hand eingetragenem Gewicht.',
      healthConnect:
        'Androids eigener Gesundheitsspeicher und die einzige Tür, durch die Healthings Schritte und Glukose holt. Ab Android 14 ist er schon da: Settings → Security &amp; privacy → Privacy → Health Connect. Ältere Handys installieren ihn.',
      withings: 'Waage und Uhr in einer App. Gewicht, Fett, Muskeln und BMR von der Waage; Schritte, Herzfrequenz und Workouts von der Uhr. Einmal installieren, dann das Withings-Konto in Healthings verknüpfen.',
      caresensAndroid:
        'Spricht mit deinem CareSens Air Sensor. Auf Android behält sie die Werte für sich — dafür gibt es xDrip+ weiter unten.',
      caresensIos:
        'Spricht mit deinem CareSens Air Sensor und teilt die Glukose direkt an Apple Health, wo Healthings sie liest. Auf dem iPhone braucht es keine Brücken-App.',
      xdrip:
        'Die CareSens-Anbindung, die Healthings auf Android nutzt. Sie gibt CareSens-Air-Werte an Health Connect weiter, dort liest Healthings sie.',
      samsung:
        'Zählt nur als Schrittquelle. Sie schreibt Schritte nach Health Connect, dort liest Healthings sie — aber du musst es einschalten: Samsung Health → Settings → Health Connect. Sonst bleiben die Schritte bei Samsung.',
      appleHealth:
        'Nichts zu installieren. Hier treffen die Glukose von CareSens Air und die Schritte des Handys auf Healthings — du gibst einmal die Erlaubnis, das war es.',
    },
    asideTitle: 'Auf dem iPhone ist weniger zu tun',
    asideBody:
      'Kein xDrip+ und kein Samsung Health — CareSens Air spricht selbst mit Apple Health, und das Handy zählt die Schritte.',
    foot: 'Unsicher? Installiere nur Healthings. Die Geräte-App kommt an dem Tag dazu, an dem das Gerät kommt.',
  },

  ar: {
    nav: 'التنزيلات',
    title: 'التطبيقات المناسبة لهاتفك',
    lead: 'تعمل Healthings وحدها. وما تبقّى هنا يخص جهازاً تملكه فعلاً — والقائمة ليست واحدة على Android و iPhone.',
    android: 'Android',
    ios: 'iPhone',
    pick: 'هاتفك',
    detected: 'تظهر قائمة الهاتف الذي تقرأ منه. أما على الحاسوب فتظهر القائمتان.',
    tagRequired: 'ابدأ من هنا',
    tagUsually: 'مطلوب في الغالب',
    tagDevice: 'فقط إن كان لديك',
    tagBridge: 'ربط CareSens',
    getPlay: 'التحميل من Google Play',
    getAppStore: 'التحميل من App Store',
    getTestFlight: 'التثبيت عبر TestFlight',
    getApk: 'تحميل ملف APK',
    builtIn: 'موجود في هاتفك أصلاً',
    builtInSettings: 'موجود في الإعدادات (Android 14 وما بعده)',
    hcOlder: 'أندرويد 13 أو أقدم: التحميل من Google Play',
    howTo: 'طريقة الإعداد',
    why: {
      healthings: 'التطبيق نفسه. التحاليل والوجبات والأهداف والاتجاهات — ويعمل حتى بوزن تُدخله بيدك.',
      healthConnect:
        'مخزن الصحة في Android، وهو الباب الوحيد الذي تأخذ منه Healthings الخطوات والجلوكوز. من Android 14 وما بعده هو موجود أصلاً: Settings → Security &amp; privacy → Privacy → Health Connect. أما الهواتف الأقدم فتثبّته.',
      withings: 'الميزان والساعة في تطبيق واحد. الوزن والدهون والعضلات و BMR من الميزان؛ والخطوات ونبض القلب والتمارين من الساعة. ثبّته مرة واحدة، ثم اربط حساب Withings من داخل Healthings.',
      caresensAndroid:
        'يخاطب حسّاس CareSens Air. وعلى Android يحتفظ بالقراءات لنفسه، فيحتاج إلى xDrip+ أدناه لنقلها.',
      caresensIos:
        'يخاطب حسّاس CareSens Air ويشارك الجلوكوز مباشرة مع Apple Health، ومنه تقرأ Healthings. لا حاجة لتطبيق جسر على iPhone.',
      xdrip:
        'ربط CareSens الذي تستخدمه Healthings على أندرويد. ينقل قراءات CareSens Air إلى Health Connect، ومنها تقرأها Healthings.',
      samsung:
        'لا يفيد إلا كمصدر للخطوات. يكتب الخطوات في Health Connect وتقرأها Healthings من هناك، لكن عليك تشغيل ذلك: Samsung Health → Settings → Health Connect. وإلا بقيت الخطوات عند Samsung.',
      appleHealth:
        'لا شيء لتثبيته. هنا يلتقي جلوكوز CareSens Air وخطوات هاتفك مع Healthings — تمنح الإذن مرة واحدة وينتهي الأمر.',
    },
    asideTitle: 'على iPhone الأمر أخف',
    asideBody:
      'لا xDrip+ هنا ولا Samsung Health — فـ CareSens Air يخاطب Apple Health وحده، والهاتف يحسب خطواتك.',
    foot: 'غير متأكد؟ ثبّت Healthings فقط. وتطبيق الجهاز يأتي يوم يصل الجهاز.',
  },

  ru: {
    nav: 'Загрузки',
    title: 'Приложения для вашего телефона',
    lead: 'Healthings работает сама по себе. Всё остальное здесь нужно только под ваше устройство — и список на Android и iPhone разный.',
    android: 'Android',
    ios: 'iPhone',
    pick: 'Ваш телефон',
    detected: 'Показан список для телефона, с которого вы читаете. На компьютере видны оба.',
    tagRequired: 'Начните отсюда',
    tagUsually: 'Обычно нужно',
    tagDevice: 'Только если есть',
    tagBridge: 'Подключение CareSens',
    getPlay: 'Скачать в Google Play',
    getAppStore: 'Скачать в App Store',
    getTestFlight: 'Установить через TestFlight',
    getApk: 'Скачать APK',
    builtIn: 'Уже есть в телефоне',
    builtInSettings: 'Уже в настройках (Android 14+)',
    hcOlder: 'Android 13 и старше: скачать в Google Play',
    howTo: 'Как настроить',
    why: {
      healthings: 'Само приложение. Анализы, еда, цели и тренды — работает даже с весом, введённым руками.',
      healthConnect:
        'Хранилище здоровья Android и единственная дверь, через которую Healthings берёт шаги и глюкозу. В Android 14 и выше он уже есть: Settings → Security &amp; privacy → Privacy → Health Connect. На старых телефонах его ставят.',
      withings: 'Весы и часы в одном приложении. Вес, жир, мышцы и BMR — с весов; шаги, пульс и тренировки — с часов. Поставьте один раз, потом привяжите аккаунт Withings внутри Healthings.',
      caresensAndroid:
        'Говорит с сенсором CareSens Air. На Android он держит показания при себе, поэтому нужен xDrip+ ниже.',
      caresensIos:
        'Говорит с сенсором CareSens Air и отдаёт глюкозу прямо в Apple Health, откуда её читает Healthings. На iPhone мост не нужен.',
      xdrip:
        'Подключение CareSens, которым Healthings пользуется на Android. Приложение передаёт показания CareSens Air в Health Connect, откуда их читает Healthings.',
      samsung:
        'Нужна только как источник шагов. Пишет шаги в Health Connect, оттуда их читает Healthings, — но это надо включить: Samsung Health → Settings → Health Connect. Иначе шаги останутся внутри Samsung.',
      appleHealth:
        'Ставить нечего. Именно здесь глюкоза CareSens Air и шаги телефона встречаются с Healthings — один раз дадите разрешение, и всё.',
    },
    asideTitle: 'На iPhone ставить меньше',
    asideBody:
      'Тут нет ни xDrip+, ни Samsung Health — CareSens Air сам говорит с Apple Health, а шаги считает телефон.',
    foot: 'Сомневаетесь? Поставьте только Healthings. Приложение устройства — в день, когда появится устройство.',
  },

  pt: {
    nav: 'Downloads',
    title: 'As apps para o seu telemóvel',
    lead: 'A Healthings funciona sozinha. O resto aqui é para um dispositivo que você tenha mesmo — e a lista não é igual no Android e no iPhone.',
    android: 'Android',
    ios: 'iPhone',
    pick: 'O seu telemóvel',
    detected: 'Mostramos a lista do telemóvel em que está a ler. No computador aparecem as duas.',
    tagRequired: 'Comece aqui',
    tagUsually: 'Quase sempre preciso',
    tagDevice: 'Só se tiver',
    tagBridge: 'Integração CareSens',
    getPlay: 'Instalar no Google Play',
    getAppStore: 'Instalar na App Store',
    getTestFlight: 'Instalar com TestFlight',
    getApk: 'Descarregar o APK',
    builtIn: 'Já está no seu telemóvel',
    builtInSettings: 'Já está nas Definições (Android 14+)',
    hcOlder: 'Android 13 ou anterior: instalar no Google Play',
    howTo: 'Como configurar',
    why: {
      healthings: 'A app em si. Análises, refeições, metas e tendências — funciona só com pesagens escritas à mão.',
      healthConnect:
        'O armazém de saúde do Android e a única porta por onde a Healthings tira passos e glicose. No Android 14 ou superior já está lá: Settings → Security &amp; privacy → Privacy → Health Connect. Telemóveis mais antigos instalam-no.',
      withings: 'A balança e o relógio numa app. Peso, gordura, músculo e BMR da balança; passos, frequência cardíaca e treinos do relógio. Instale uma vez e depois ligue a conta Withings dentro da Healthings.',
      caresensAndroid:
        'Fala com o seu sensor CareSens Air. No Android guarda as leituras para si, por isso precisa do xDrip+ abaixo.',
      caresensIos:
        'Fala com o seu sensor CareSens Air e partilha a glicose diretamente com a Apple Health, onde a Healthings a lê. No iPhone não há app de ponte.',
      xdrip:
        'A integração da CareSens que a Healthings usa no Android. Passa as leituras da CareSens Air para a Health Connect, e é lá que a Healthings as lê.',
      samsung:
        'Só conta como fonte de passos. Escreve os passos na Health Connect e a Healthings lê-os lá — mas tem de ligar isso: Samsung Health → Settings → Health Connect. Caso contrário os passos ficam na Samsung.',
      appleHealth:
        'Nada para instalar. É onde a glicose da CareSens Air e os passos do telemóvel encontram a Healthings — dá permissão uma vez e pronto.',
    },
    asideTitle: 'No iPhone há menos para instalar',
    asideBody:
      'Aqui não há xDrip+ nem Samsung Health — a CareSens Air fala com a Apple Health por si e o telemóvel conta os passos.',
    foot: 'Na dúvida? Instale só a Healthings. A app do dispositivo entra no dia em que o dispositivo entrar.',
  },

  it: {
    nav: 'Download',
    title: 'Le app per il tuo telefono',
    lead: 'Healthings funziona da sola. Tutto il resto qui serve solo se hai davvero quel dispositivo — e la lista non è la stessa su Android e iPhone.',
    android: 'Android',
    ios: 'iPhone',
    pick: 'Il tuo telefono',
    detected: 'Vedi la lista del telefono da cui stai leggendo. Da computer compaiono entrambe.',
    tagRequired: 'Parti da qui',
    tagUsually: 'Di solito serve',
    tagDevice: 'Solo se ce l’hai',
    tagBridge: 'Integrazione CareSens',
    getPlay: 'Scarica su Google Play',
    getAppStore: 'Scarica sull’App Store',
    getTestFlight: 'Installa con TestFlight',
    getApk: 'Scarica l’APK',
    builtIn: 'Già sul tuo telefono',
    builtInSettings: 'Già nelle Impostazioni (Android 14+)',
    hcOlder: 'Android 13 o precedente: scarica su Google Play',
    howTo: 'Come si configura',
    why: {
      healthings: 'L’app vera e propria. Esami, pasti, obiettivi e andamenti — funziona anche con il peso scritto a mano.',
      healthConnect:
        'Il magazzino salute di Android, e l’unica porta da cui Healthings prende passi e glucosio. Da Android 14 in su c’è già: Settings → Security &amp; privacy → Privacy → Health Connect. Sui telefoni più vecchi si installa.',
      withings: 'Bilancia e orologio in un’app sola. Peso, grasso, muscolo e BMR dalla bilancia; passi, battito e allenamenti dall’orologio. Installala una volta, poi collega l’account Withings dentro Healthings.',
      caresensAndroid:
        'Parla con il tuo sensore CareSens Air. Su Android tiene le letture per sé, quindi serve xDrip+ qui sotto.',
      caresensIos:
        'Parla con il tuo sensore CareSens Air e passa il glucosio direttamente ad Apple Health, dove Healthings lo legge. Su iPhone nessuna app ponte.',
      xdrip:
        'L’integrazione CareSens che Healthings usa su Android. Porta le letture di CareSens Air in Health Connect, dove Healthings le legge.',
      samsung:
        'Conta solo come sorgente di passi. Scrive i passi in Health Connect e Healthings li legge lì — ma va acceso: Samsung Health → Settings → Health Connect. Altrimenti i passi restano dentro Samsung.',
      appleHealth:
        'Niente da installare. È dove il glucosio di CareSens Air e i passi del telefono incontrano Healthings — dai il permesso una volta e basta.',
    },
    asideTitle: 'Su iPhone c’è meno da installare',
    asideBody:
      'Qui non ci sono xDrip+ né Samsung Health — CareSens Air parla da sola con Apple Health e il telefono conta i passi.',
    foot: 'In dubbio? Installa solo Healthings. L’app del dispositivo arriva il giorno del dispositivo.',
  },

  tr: {
    nav: 'İndirmeler',
    title: 'Telefonunuza uygun uygulamalar',
    lead: 'Healthings kendi başına çalışır. Buradaki geri kalanı, gerçekten sahip olduğunuz cihaz için — ve liste Android ile iPhone’da aynı değil.',
    android: 'Android',
    ios: 'iPhone',
    pick: 'Telefonunuz',
    detected: 'Okuduğunuz telefonun listesi gösteriliyor. Bilgisayarda ikisi birden görünür.',
    tagRequired: 'Buradan başlayın',
    tagUsually: 'Genelde gerekir',
    tagDevice: 'Yalnızca varsa',
    tagBridge: 'CareSens entegrasyonu',
    getPlay: 'Google Play’den indir',
    getAppStore: 'App Store’dan indir',
    getTestFlight: 'TestFlight ile kur',
    getApk: 'APK dosyasını indir',
    builtIn: 'Telefonunuzda hazır',
    builtInSettings: 'Ayarlar’da hazır (Android 14+)',
    hcOlder: 'Android 13 ve öncesi: Google Play’den indir',
    howTo: 'Nasıl kurulur',
    why: {
      healthings: 'Uygulamanın kendisi. Tahliller, öğünler, hedefler ve eğilimler — elle girilen kiloyla bile çalışır.',
      healthConnect:
        'Android’in sağlık deposu ve Healthings’in adım ile glikozu aldığı tek kapı. Android 14 ve üstünde hazır geliyor: Settings → Security &amp; privacy → Privacy → Health Connect. Daha eski telefonlar kurar.',
      withings: 'Tartı ve saat tek uygulamada. Tartıdan kilo, yağ, kas ve BMR; saatten adım, nabız ve antrenmanlar. Bir kez kurun, sonra Withings hesabınızı Healthings içinden bağlayın.',
      caresensAndroid:
        'CareSens Air sensörünüzle konuşur. Android’de ölçümleri kendinde tutar, bu yüzden aşağıdaki xDrip+ gerekir.',
      caresensIos:
        'CareSens Air sensörünüzle konuşur ve glikozu doğrudan Apple Health’e verir; Healthings oradan okur. iPhone’da köprü uygulama gerekmez.',
      xdrip:
        'Healthings’in Android’de kullandığı CareSens entegrasyonu. CareSens Air ölçümlerini Health Connect’e taşır, Healthings de oradan okur.',
      samsung:
        'Yalnızca adım kaynağı olarak işe yarar. Adımları Health Connect’e yazar, Healthings de oradan okur — ama bunu açmanız gerekir: Samsung Health → Settings → Health Connect. Yoksa adımlar Samsung’da kalır.',
      appleHealth:
        'Kuracak bir şey yok. CareSens Air glikozu ile telefonun adımları Healthings ile burada buluşur — ilk seferinde izin verirsiniz, o kadar.',
    },
    asideTitle: 'iPhone’da kurulacak daha az şey var',
    asideBody:
      'Burada ne xDrip+ var ne Samsung Health — CareSens Air Apple Health ile kendi konuşur, adımları da telefon sayar.',
    foot: 'Emin değil misiniz? Sadece Healthings’i kurun. Cihaz uygulaması, cihazın geldiği gün gelir.',
  },
};
