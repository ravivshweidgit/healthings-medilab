/**
 * Shared chrome for multi-locale help (prompt81).
 * Canonical URLs: /{lang}/help/{slug}.html
 */
export const HELP_LOCALES = [
  { code: 'en', dir: 'ltr', label: 'EN', name: 'English', flag: '🇬🇧' },
  { code: 'he', dir: 'rtl', label: 'HE', name: 'עברית', flag: '🇮🇱' },
  { code: 'es', dir: 'ltr', label: 'ES', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', dir: 'ltr', label: 'FR', name: 'Français', flag: '🇫🇷' },
  { code: 'de', dir: 'ltr', label: 'DE', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', dir: 'rtl', label: 'AR', name: 'العربية', flag: '🇸🇦' },
  { code: 'ru', dir: 'ltr', label: 'RU', name: 'Русский', flag: '🇷🇺' },
];

/** Wizard-linked slugs (must match app HelpSlug). */
export const HELP_SLUGS = [
  'quick-start-welcome',
  'quick-start-units',
  'quick-start-profile',
  'quick-start-language',
  'mentor-voice-gender',
  'withings-scale',
  'quick-start-watch',
  'cgm',
  'withings-link',
  'starting-weight',
  'phone-health-activity',
  'reports-import',
  'targets-help',
  'meal-logging',
  'manual-body',
];

export const UI = {
  en: {
    home: 'Home',
    help: 'Help',
    allTopics: 'All help topics',
    badge: 'Quick Start',
    know: 'What to know',
    glossary:
      'Clinical terms like <strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong>, and brands like <strong>Withings</strong> stay in English.',
  },
  he: {
    home: 'דף הבית',
    help: 'עזרה',
    allTopics: 'כל נושאי העזרה',
    badge: 'התחלה מהירה',
    know: 'מה חשוב לדעת',
    glossary:
      'מונחים כמו <strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong> ומותגים כמו <strong>Withings</strong> נשארים באנגלית.',
  },
  es: {
    home: 'Inicio',
    help: 'Ayuda',
    allTopics: 'Todos los temas',
    badge: 'Inicio rápido',
    know: 'Lo esencial',
    glossary:
      'Términos como <strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong> y marcas como <strong>Withings</strong> se quedan en inglés.',
  },
  fr: {
    home: 'Accueil',
    help: 'Aide',
    allTopics: 'Tous les sujets',
    badge: 'Démarrage rapide',
    know: 'À retenir',
    glossary:
      'Les termes <strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong> et les marques comme <strong>Withings</strong> restent en anglais.',
  },
  de: {
    home: 'Start',
    help: 'Hilfe',
    allTopics: 'Alle Themen',
    badge: 'Schnellstart',
    know: 'Das Wichtigste',
    glossary:
      'Begriffe wie <strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong> und Marken wie <strong>Withings</strong> bleiben auf Englisch.',
  },
  ar: {
    home: 'الرئيسية',
    help: 'مساعدة',
    allTopics: 'كل المواضيع',
    badge: 'بداية سريعة',
    know: 'الأهم',
    glossary:
      'مصطلحات مثل <strong>kcal</strong> و <strong>BMR</strong> و <strong>CGM</strong> وعلامات مثل <strong>Withings</strong> تبقى بالإنجليزية.',
  },
  ru: {
    home: 'Главная',
    help: 'Справка',
    allTopics: 'Все темы',
    badge: 'Быстрый старт',
    know: 'Главное',
    glossary:
      'Термины вроде <strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong> и бренды вроде <strong>Withings</strong> остаются на английском.',
  },
};

/**
 * ARTICLES[slug][lang] = { title, lead, body }
 * body = HTML fragments (paragraphs / lists). Mother-tongue voice.
 */
export const ARTICLES = {};

function set(slug, lang, title, lead, body) {
  if (!ARTICLES[slug]) ARTICLES[slug] = {};
  ARTICLES[slug][lang] = { title, lead, body };
}

// ── quick-start-welcome ──────────────────────────────────────────
set(
  'quick-start-welcome',
  'en',
  'Welcome to Healthings',
  'A wellness app with a professional method: learn your body, coach in the moment, clear feedback for your nutritionist.',
  `<p>Live charts for weight, composition, activity, and glucose when connected. The model explains what moved — under <strong>My Rules</strong>.</p>
<p>Most tools stop at tracking. Healthings closes the loop: intent → life → learn → share → refine.</p>
<p><strong>Not medical care.</strong> No diagnosis or prescribing. Emergencies stay with licensed clinicians.</p>`,
);
set(
  'quick-start-welcome',
  'he',
  'ברוכים הבאים ל־Healthings',
  'אפליקציית wellness בשיטה מקצועית: לומדת את הגוף, מאמנת בזמן אמת, ומעבירה משוב ברור לתזונאי.',
  `<p>גרפים חיים של משקל, הרכב גוף, פעילות וגלוקוז כשמחוברים. המודל מסביר מה זז — לפי <strong>My Rules</strong>.</p>
<p>רוב הכלים עוצרים במעקב. כאן המעגל נסגר: כוונה → חיים → למידה → שיתוף → חידוד.</p>
<p><strong>לא טיפול רפואי.</strong> בלי אבחון ובלי מרשמים. חירום — אצל אנשי מקצוע מורשים.</p>`,
);
set(
  'quick-start-welcome',
  'es',
  'Bienvenido a Healthings',
  'Una app de wellness con método profesional: aprende tu cuerpo, te guía al momento y da feedback claro a tu nutricionista.',
  `<p>Gráficos en vivo de peso, composición, actividad y glucosa si está conectada. El modelo explica qué cambió — bajo <strong>My Rules</strong>.</p>
<p>La mayoría de apps solo miden. Healthings cierra el círculo: intención → vida → aprendizaje → compartir → afinar.</p>
<p><strong>No es atención médica.</strong> Sin diagnóstico ni recetas. Urgencias: con profesionales licenciados.</p>`,
);
set(
  'quick-start-welcome',
  'fr',
  'Bienvenue sur Healthings',
  'Une app wellness avec une méthode pro : apprendre votre corps, coacher en direct, feedback clair pour votre nutritionniste.',
  `<p>Graphiques live : poids, composition, activité, glucose si connecté. Le modèle explique ce qui a bougé — sous <strong>My Rules</strong>.</p>
<p>La plupart des outils s’arrêtent au suivi. Ici la boucle se ferme : intention → vie → apprentissage → partage → raffinage.</p>
<p><strong>Pas des soins médicaux.</strong> Pas de diagnostic ni d’ordonnance. Urgences : professionnels habilités.</p>`,
);
set(
  'quick-start-welcome',
  'de',
  'Willkommen bei Healthings',
  'Wellness-App mit Profi-Methode: Körper verstehen, live coachen, klares Feedback für Ihre Ernährungsfachkraft.',
  `<p>Live-Charts zu Gewicht, Zusammensetzung, Aktivität und Glukose — wenn verbunden. Das Modell erklärt, was sich bewegt hat — unter <strong>My Rules</strong>.</p>
<p>Die meisten Tools stoppen beim Tracken. Healthings schließt den Kreis: Absicht → Alltag → Lernen → Teilen → Nachschärfen.</p>
<p><strong>Keine medizinische Behandlung.</strong> Keine Diagnose, keine Rezepte. Notfälle bleiben bei zugelassenen Fachleuten.</p>`,
);
set(
  'quick-start-welcome',
  'ar',
  'مرحباً بك في Healthings',
  'تطبيق wellness بمنهج احترافي: يتعلّم جسمك، يدرّبك لحظياً، ويعطي تغذية راجعة واضحة لأخصائي التغذية.',
  `<p>رسوم حية للوزن وتركيب الجسم والنشاط والجلوكوز عند الاتصال. النموذج يشرح ما تغيّر — وفق <strong>My Rules</strong>.</p>
<p>معظم الأدوات تتوقف عند التتبع. هنا تُغلق الحلقة: نيّة → حياة → تعلّم → مشاركة → ضبط.</p>
<p><strong>ليس رعاية طبية.</strong> بلا تشخيص ولا وصفات. الطوارئ تبقى لدى المهنيين المرخّصين.</p>`,
);
set(
  'quick-start-welcome',
  'ru',
  'Добро пожаловать в Healthings',
  'Wellness‑приложение с профессиональным методом: учится вашему телу, ведёт в моменте, даёт ясный фидбек нутрициологу.',
  `<p>Живые графики веса, состава тела, активности и глюкозы при подключении. Модель объясняет, что изменилось — по <strong>My Rules</strong>.</p>
<p>Большинство приложений только трекают. Здесь цикл замыкается: замысел → жизнь → обучение → обмен → уточнение.</p>
<p><strong>Не медицина.</strong> Без диагнозов и рецептов. Экстренное — у лицензированных специалистов.</p>`,
);

// ── quick-start-units ────────────────────────────────────────────
set(
  'quick-start-units',
  'en',
  'Units & measurements',
  'Choose how weight, height, energy, water, and glucose appear. Storage stays in standard clinical units.',
  `<p>Pick what you already use at home or with your clinic. Change anytime in <strong>My Profile</strong>.</p>
<p>Symbols like <strong>kg</strong>, <strong>kcal</strong>, and <strong>mg/dL</strong> stay as international abbreviations.</p>`,
);
set(
  'quick-start-units',
  'he',
  'יחידות מידה',
  'בחרו איך יוצגו משקל, גובה, אנרגיה, מים וגלוקוז. מאחורי הקלעים נשמרים ביחידות קליניות סטנדרטיות.',
  `<p>בחרו מה שכבר רגילים בבית או בקליניקה. אפשר לשנות בכל רגע ב־<strong>My Profile</strong>.</p>
<p>סימולים כמו <strong>kg</strong>, <strong>kcal</strong> ו־<strong>mg/dL</strong> נשארים באנגלית — זה התקן.</p>`,
);
set(
  'quick-start-units',
  'es',
  'Unidades de medida',
  'Elige cómo se muestran peso, altura, energía, agua y glucosa. Por dentro todo sigue en unidades clínicas estándar.',
  `<p>Usa lo que ya usas en casa o en la clínica. Se puede cambiar después en <strong>My Profile</strong>.</p>
<p>Símbolos como <strong>kg</strong>, <strong>kcal</strong> y <strong>mg/dL</strong> se quedan en inglés.</p>`,
);
set(
  'quick-start-units',
  'fr',
  'Unités de mesure',
  'Choisissez l’affichage du poids, de la taille, de l’énergie, de l’eau et du glucose. En coulisse, unités cliniques standard.',
  `<p>Prenez ce que vous utilisez déjà. Modifiable plus tard dans <strong>My Profile</strong>.</p>
<p>Les symboles <strong>kg</strong>, <strong>kcal</strong>, <strong>mg/dL</strong> restent en anglais.</p>`,
);
set(
  'quick-start-units',
  'de',
  'Maßeinheiten',
  'So erscheinen Gewicht, Größe, Energie, Wasser und Glukose. Intern bleiben klinische Standard-Einheiten.',
  `<p>Nehmen Sie, was Sie schon kennen. Später änderbar unter <strong>My Profile</strong>.</p>
<p>Kürzel wie <strong>kg</strong>, <strong>kcal</strong>, <strong>mg/dL</strong> bleiben Englisch.</p>`,
);
set(
  'quick-start-units',
  'ar',
  'وحدات القياس',
  'اختر كيف يظهر الوزن والطول والطاقة والماء والجلوكوز. التخزين يبقى بوحدات سريرية قياسية.',
  `<p>اختر ما تستخدمه أصلاً. يمكن التغيير لاحقاً من <strong>My Profile</strong>.</p>
<p>رموز مثل <strong>kg</strong> و <strong>kcal</strong> و <strong>mg/dL</strong> تبقى بالإنجليزية.</p>`,
);
set(
  'quick-start-units',
  'ru',
  'Единицы измерения',
  'Как показывать вес, рост, энергию, воду и глюкозу. Внутри — стандартные клинические единицы.',
  `<p>Берите привычные единицы. Позже можно сменить в <strong>My Profile</strong>.</p>
<p>Обозначения <strong>kg</strong>, <strong>kcal</strong>, <strong>mg/dL</strong> остаются на английском.</p>`,
);

// Helper to bulk-add remaining slugs with compact native copy
function bulk(slug, rows) {
  for (const [lang, title, lead, body] of rows) {
    set(slug, lang, title, lead, body);
  }
}

bulk('quick-start-profile', [
  ['en', 'About you', 'Gender, height, and birth date feed BMR, BMI, and energy targets.', `<p>Answer once here — you can refine later in profile.</p>`],
  ['he', 'קצת עליכם', 'מגדר, גובה ותאריך לידה — לחישוב BMR, BMI ויעדי אנרגיה.', `<p>עונים כאן פעם אחת. אפשר לדייק אחר כך בפרופיל.</p>`],
  ['es', 'Sobre ti', 'Género, altura y fecha de nacimiento para BMR, BMI y objetivos de energía.', `<p>Una vez aquí; se puede ajustar después en el perfil.</p>`],
  ['fr', 'À propos de vous', 'Genre, taille et date de naissance pour BMR, BMI et objectifs énergétiques.', `<p>Une fois ici — ajustable plus tard dans le profil.</p>`],
  ['de', 'Über Sie', 'Geschlecht, Größe und Geburtsdatum für BMR, BMI und Energieziele.', `<p>Einmal hier ausfüllen — später im Profil änderbar.</p>`],
  ['ar', 'عنك', 'الجنس والطول وتاريخ الميلاد لحساب BMR و BMI وأهداف الطاقة.', `<p>مرة واحدة هنا — يمكن التعديل لاحقاً في الملف.</p>`],
  ['ru', 'О вас', 'Пол, рост и дата рождения для BMR, BMI и целей по энергии.', `<p>Один раз здесь — потом можно уточнить в профиле.</p>`],
]);

bulk('quick-start-language', [
  ['en', 'App & coach language', 'One language for Quick Start, coach chat, meal names, reports, and help links.', `<p>You can change it later in <strong>My Profile</strong>. Help opens in the same language.</p>`],
  ['he', 'שפת האפליקציה והמאמן', 'שפה אחת להתחלה המהירה, הצ׳אט, שמות הארוחות, הדוחות ודפי העזרה.', `<p>אפשר לשנות אחר כך ב־<strong>My Profile</strong>. העזרה נפתחת באותה שפה.</p>`],
  ['es', 'Idioma de la app y el coach', 'Un idioma para el inicio, el chat, las comidas, los informes y la ayuda.', `<p>Se puede cambiar después en <strong>My Profile</strong>. La ayuda abre en el mismo idioma.</p>`],
  ['fr', 'Langue de l’app et du coach', 'Une langue pour le démarrage, le chat, les repas, les rapports et l’aide.', `<p>Modifiable plus tard dans <strong>My Profile</strong>. L’aide s’ouvre dans la même langue.</p>`],
  ['de', 'App- & Coach-Sprache', 'Eine Sprache für Schnellstart, Chat, Mahlzeiten, Berichte und Hilfe.', `<p>Später änderbar unter <strong>My Profile</strong>. Hilfe öffnet in derselben Sprache.</p>`],
  ['ar', 'لغة التطبيق والمدرب', 'لغة واحدة للبداية والدردشة وأسماء الوجبات والتقارير وصفحات المساعدة.', `<p>يمكن التغيير لاحقاً من <strong>My Profile</strong>. المساعدة تُفتح بنفس اللغة.</p>`],
  ['ru', 'Язык приложения и коуча', 'Один язык для старта, чата, названий еды, отчётов и справки.', `<p>Позже можно сменить в <strong>My Profile</strong>. Справка открывается на том же языке.</p>`],
]);

bulk('mentor-voice-gender', [
  ['en', 'Mentor voice gender', 'How the coach addresses you in Hebrew or Arabic — not your profile gender.', `<p>Only matters for gendered grammar in those languages.</p>`],
  ['he', 'פניית המאמן', 'איך המאמן פונה אליכם בעברית או בערבית — לא המגדר שבפרופיל.', `<p>רלוונטי לדקדוק מגדרי בשפות האלה בלבד.</p>`],
  ['es', 'Voz del mentor', 'Cómo te habla el coach en hebreo o árabe — no es el género del perfil.', `<p>Solo importa la gramática de género en esos idiomas.</p>`],
  ['fr', 'Voix du mentor', 'Comment le coach vous parle en hébreu ou en arabe — pas le genre du profil.', `<p>Utile seulement pour la grammaire genrée de ces langues.</p>`],
  ['de', 'Anrede des Mentors', 'Wie der Coach Sie auf Hebräisch oder Arabisch anspricht — nicht Ihr Profil-Geschlecht.', `<p>Nur für die Grammatik dieser Sprachen relevant.</p>`],
  ['ar', 'صوت المرشد', 'كيف يخاطبك المدرب بالعبرية أو العربية — وليس جنس الملف الشخصي.', `<p>مهم فقط لقواعد الجنس في هاتين اللغتين.</p>`],
  ['ru', 'Обращение наставника', 'Как коуч обращается к вам на иврите или арабском — не пол в профиле.', `<p>Нужно только для грамматики этих языков.</p>`],
]);

bulk('withings-scale', [
  ['en', 'Withings body scale', 'Any Withings scale on your account works. Healthings reads the cloud after you link — not Bluetooth.', `<p>Body, Body Scan, and similar models are fine.</p>`],
  ['he', 'משקל Withings', 'כל משקל Withings בחשבון מתאים. אחרי החיבור קוראים מהענן — לא מ־Bluetooth.', `<p>Body, Body Scan ודומיהם — בסדר.</p>`],
  ['es', 'Báscula Withings', 'Cualquier báscula Withings de tu cuenta sirve. Tras vincular, se lee la nube — no Bluetooth.', `<p>Body, Body Scan y similares están bien.</p>`],
  ['fr', 'Balance Withings', 'Toute balance Withings du compte convient. Après liaison, lecture cloud — pas Bluetooth.', `<p>Body, Body Scan, etc. sont OK.</p>`],
  ['de', 'Withings-Körperwaage', 'Jede Withings-Waage im Konto passt. Nach dem Link liest die App die Cloud — nicht Bluetooth.', `<p>Body, Body Scan und ähnliche Modelle sind OK.</p>`],
  ['ar', 'ميزان Withings', 'أي ميزان Withings في حسابك يناسب. بعد الربط نقرأ من السحابة — وليس Bluetooth.', `<p>Body و Body Scan وما شابه مناسب.</p>`],
  ['ru', 'Весы Withings', 'Подойдут любые весы Withings в аккаунте. После связи данные из облака — не Bluetooth.', `<p>Body, Body Scan и похожие модели — ок.</p>`],
]);

bulk('quick-start-watch', [
  ['en', 'Withings watch or band', 'Yes → activity and heart rate from Withings cloud. No → from Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung and others can write to the phone health store.</p>`],
  ['he', 'שעון או צמיד Withings', 'כן → פעילות ודופק מענן Withings. לא → מ־Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung ואחרים יכולים לכתוב לחנות הבריאות בטלפון.</p>`],
  ['es', 'Reloj o pulsera Withings', 'Sí → actividad y pulso desde la nube Withings. No → Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung y otros pueden escribir en la salud del teléfono.</p>`],
  ['fr', 'Montre ou bracelet Withings', 'Oui → activité et pouls depuis le cloud Withings. Non → Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung… peuvent écrire vers la santé du téléphone.</p>`],
  ['de', 'Withings-Uhr oder Band', 'Ja → Aktivität und Puls aus der Withings-Cloud. Nein → Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung u. a. können in den Telefon-Health-Store schreiben.</p>`],
  ['ar', 'ساعة أو سوار Withings', 'نعم → نشاط ونبض من سحابة Withings. لا → من Health Connect / Apple Health.', `<p>Garmin و Apple Watch و Samsung وغيرها يمكنها الكتابة إلى صحة الهاتف.</p>`],
  ['ru', 'Часы или браслет Withings', 'Да → активность и пульс из облака Withings. Нет → Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung и другие могут писать в здоровье телефона.</p>`],
]);

bulk('cgm', [
  ['en', 'CGM glucose', 'Continuous glucose via Health Connect (Android) or Apple Health (iPhone). Lab PDFs can be imported later.', `<p>Share your CGM app with the phone health store, then allow Blood Glucose.</p>`],
  ['he', 'CGM לגלוקוז', 'גלוקוז רציף דרך Health Connect (Android) או Apple Health (iPhone). אפשר גם לייבא PDF מעבדה אחר כך.', `<p>שתפו את אפליקציית ה־CGM עם חנות הבריאות בטלפון ואשרו Blood Glucose.</p>`],
  ['es', 'Glucosa CGM', 'Glucosa continua vía Health Connect (Android) o Apple Health (iPhone). Luego puedes importar PDFs de lab.', `<p>Comparte la app CGM con la salud del teléfono y permite Blood Glucose.</p>`],
  ['fr', 'Glucose CGM', 'Glucose continu via Health Connect (Android) ou Apple Health (iPhone). PDFs labo plus tard si besoin.', `<p>Partagez l’app CGM avec la santé du téléphone et autorisez Blood Glucose.</p>`],
  ['de', 'CGM-Glukose', 'Kontinuierliche Glukose über Health Connect (Android) oder Apple Health (iPhone). Lab-PDFs später möglich.', `<p>CGM-App mit Telefon-Health teilen und Blood Glucose erlauben.</p>`],
  ['ar', 'جلوكوز CGM', 'جلوكوز مستمر عبر Health Connect (Android) أو Apple Health (iPhone). يمكن استيراد PDF مختبر لاحقاً.', `<p>شارك تطبيق CGM مع صحة الهاتف واسمح بـ Blood Glucose.</p>`],
  ['ru', 'Глюкоза CGM', 'Непрерывная глюкоза через Health Connect (Android) или Apple Health (iPhone). PDF анализов — позже.', `<p>Дайте CGM-приложению доступ к здоровью телефона и Blood Glucose.</p>`],
]);

bulk('withings-link', [
  ['en', 'Link Withings', 'Sign in with the same account as the Withings app. One link covers scale and watch.', `<p>You can skip and link later in <strong>My Profile</strong>.</p>`],
  ['he', 'חיבור Withings', 'אותו חשבון כמו באפליקציית Withings. חיבור אחד — למשקל ולשעון.', `<p>אפשר לדלג ולחבר אחר כך ב־<strong>My Profile</strong>.</p>`],
  ['es', 'Vincular Withings', 'La misma cuenta que en la app Withings. Un vínculo cubre báscula y reloj.', `<p>Puedes saltarlo y vincular después en <strong>My Profile</strong>.</p>`],
  ['fr', 'Lier Withings', 'Le même compte que l’app Withings. Une liaison pour balance et montre.', `<p>Vous pouvez passer et lier plus tard dans <strong>My Profile</strong>.</p>`],
  ['de', 'Withings verbinden', 'Dasselbe Konto wie in der Withings-App. Ein Link für Waage und Uhr.', `<p>Sie können überspringen und später unter <strong>My Profile</strong> verbinden.</p>`],
  ['ar', 'ربط Withings', 'نفس حساب تطبيق Withings. ربط واحد للميزان والساعة.', `<p>يمكن التخطي والربط لاحقاً من <strong>My Profile</strong>.</p>`],
  ['ru', 'Связь Withings', 'Тот же аккаунт, что в приложении Withings. Одна связь — весы и часы.', `<p>Можно пропустить и связать позже в <strong>My Profile</strong>.</p>`],
]);

bulk('starting-weight', [
  ['en', 'Starting weight', 'Needed for targets and energy balance. Enter now or wait for Withings cloud sync.', `<p>If linked but not synced yet, type a weight or tap Next.</p>`],
  ['he', 'משקל התחלתי', 'צריך ליעדים ולמאזן אנרגיה. מזינים עכשיו או מחכים לסנכרון Withings.', `<p>אם מחוברים ועדיין אין סנכרון — מזינים ידנית או ממשיכים.</p>`],
  ['es', 'Peso inicial', 'Hace falta para objetivos y balance de energía. Ahora o cuando sincronice Withings.', `<p>Si ya vinculaste y aún no hay sync, escribe el peso o sigue.</p>`],
  ['fr', 'Poids de départ', 'Nécessaire pour les objectifs et le bilan énergétique. Maintenant ou après sync Withings.', `<p>Si lié mais pas encore synchronisé — saisissez ou continuez.</p>`],
  ['de', 'Startgewicht', 'Für Ziele und Energiebilanz. Jetzt eingeben oder auf Withings-Sync warten.', `<p>Verknüpft, aber noch kein Sync — Gewicht tippen oder weiter.</p>`],
  ['ar', 'الوزن الابتدائي', 'مطلوب للأهداف وتوازن الطاقة. أدخله الآن أو انتظر مزامنة Withings.', `<p>إن رُبط دون مزامنة بعد — أدخل الوزن أو تابع.</p>`],
  ['ru', 'Стартовый вес', 'Нужен для целей и энергобаланса. Сейчас или после синхронизации Withings.', `<p>Если связь есть, а синка ещё нет — введите вес или идите дальше.</p>`],
]);

bulk('phone-health-activity', [
  ['en', 'Phone health', 'Allow Health Connect or Apple Health for steps and heart rate when a Withings watch is off.', `<p>Tap Next — the system may ask once. Use Allow access when shown.</p>`],
  ['he', 'בריאות מהטלפון', 'אישור Health Connect או Apple Health לצעידים ודופק כששעון Withings לא פעיל.', `<p>לחצו המשך — המערכת עלולה לבקש פעם אחת. Allow access כשמופיע.</p>`],
  ['es', 'Salud del teléfono', 'Permite Health Connect o Apple Health para pasos y pulso si el reloj Withings está apagado.', `<p>Pulsa Next — el sistema puede pedir permiso una vez.</p>`],
  ['fr', 'Santé du téléphone', 'Autorisez Health Connect ou Apple Health pour pas et pouls si la montre Withings est off.', `<p>Appuyez sur Next — une demande système peut apparaître une fois.</p>`],
  ['de', 'Telefon-Gesundheit', 'Health Connect oder Apple Health für Schritte und Puls, wenn die Withings-Uhr aus ist.', `<p>Next tippen — das System fragt ggf. einmal nach.</p>`],
  ['ar', 'صحة الهاتف', 'اسمح لـ Health Connect أو Apple Health بالخطوات والنبض عند إيقاف ساعة Withings.', `<p>اضغط Next — قد يطلب النظام الإذن مرة واحدة.</p>`],
  ['ru', 'Здоровье телефона', 'Разрешите Health Connect или Apple Health для шагов и пульса, если часы Withings выключены.', `<p>Нажмите Next — система может спросить один раз.</p>`],
]);

bulk('reports-import', [
  ['en', 'Optional reports', 'Import a lab PDF or nutritionist session summary — or skip and do it later in the app.', `<p>Labs help macro targets. Session text feeds the coaches under My Rules.</p>`],
  ['he', 'דוחות — לא חובה', 'ייבוא PDF מעבדה או סיכום מול תזונאי — או דילוג ועשייה אחר כך באפליקציה.', `<p>מעבדה עוזרת ליעדי מאקרו. סיכום ביקור תומך במאמנים לפי My Rules.</p>`],
  ['es', 'Informes opcionales', 'Importa un PDF de lab o un resumen con el nutricionista — o hazlo después en la app.', `<p>El lab afina macros. El resumen de visita alimenta a los coaches bajo My Rules.</p>`],
  ['fr', 'Rapports optionnels', 'Importez un PDF labo ou un compte-rendu nutritionniste — ou plus tard dans l’app.', `<p>Le labo affine les macros. Le compte-rendu nourrit les coaches sous My Rules.</p>`],
  ['de', 'Optionale Berichte', 'Lab-PDF oder Ernährungs-Zusammenfassung importieren — oder später in der App.', `<p>Lab hilft bei Makros. Besuchstext stützt die Coaches unter My Rules.</p>`],
  ['ar', 'تقارير اختيارية', 'استورد PDF مختبر أو ملخص جلسة تغذية — أو افعل ذلك لاحقاً في التطبيق.', `<p>المختبر يساعد أهداف الماكرو. ملخص الزيارة يغذي المدربين وفق My Rules.</p>`],
  ['ru', 'Отчёты по желанию', 'Импорт PDF анализов или саммари с нутрициологом — или позже в приложении.', `<p>Анализы помогают макросам. Текст визита кормит коучей по My Rules.</p>`],
]);

bulk('targets-help', [
  ['en', 'Your targets', 'AI suggests body and macro targets from your profile. Saved targets keep My Rules.', `<p>Regenerate only if you want fresh AI numbers.</p>`],
  ['he', 'היעדים שלכם', 'ה־AI מציע יעדי גוף ומאקרו לפי הפרופיל. יעדים שמורים שומרים על My Rules.', `<p>יצירה מחדש — רק אם רוצים מספרים חדשים מה־AI.</p>`],
  ['es', 'Tus objetivos', 'La IA propone cuerpo y macros según tu perfil. Los guardados conservan My Rules.', `<p>Regenera solo si quieres números nuevos de la IA.</p>`],
  ['fr', 'Vos objectifs', 'L’IA propose corps et macros selon le profil. Les objectifs sauvés gardent My Rules.', `<p>Régénérez seulement pour de nouveaux chiffres IA.</p>`],
  ['de', 'Ihre Ziele', 'Die KI schlägt Körper- und Makroziele aus dem Profil vor. Gespeicherte behalten My Rules.', `<p>Neu erzeugen nur, wenn Sie frische KI-Zahlen wollen.</p>`],
  ['ar', 'أهدافك', 'يقترح الذكاء أهداف الجسم والماكرو من ملفك. المحفوظة تبقي My Rules.', `<p>أعد التوليد فقط إذا أردت أرقاماً جديدة من الذكاء.</p>`],
  ['ru', 'Ваши цели', 'ИИ предлагает цели по телу и макросам из профиля. Сохранённые держат My Rules.', `<p>Пересчёт — только если нужны новые цифры от ИИ.</p>`],
]);

bulk('meal-logging', [
  ['en', 'How to log meals', 'Log food so coaching under My Rules can show live impact on charts.', `<ol><li>Tap <strong>+</strong> on the metabolic chart.</li><li><strong>Photo</strong> — snap the plate; approve AI items.</li><li><strong>Text</strong> — describe the meal; AI parses macros.</li><li>Coach chat can suggest logs — save via the food log.</li></ol>`],
  ['he', 'איך רושמים ארוחה', 'רושמים אוכל — והמאמן לפי My Rules מראה השפעה חיה בגרפים.', `<ol><li>לחצו <strong>+</strong> בגרף המטבולי.</li><li><strong>תמונה</strong> — מצלמים את הצלחת ומאשרים.</li><li><strong>טקסט</strong> — מתארים; ה־AI מפרק למקרו.</li><li>אפשר גם מהצ׳אט — השמירה ביומן האוכל.</li></ol>`],
  ['es', 'Cómo registrar comidas', 'Registra la comida para que el coach bajo My Rules muestre impacto en vivo.', `<ol><li>Toca <strong>+</strong> en el gráfico metabólico.</li><li><strong>Foto</strong> — captura el plato y aprueba.</li><li><strong>Texto</strong> — describe; la IA calcula macros.</li><li>El chat puede sugerir — se guarda en el food log.</li></ol>`],
  ['fr', 'Comment logger les repas', 'Loggez pour que le coach sous My Rules montre l’impact live sur les graphiques.', `<ol><li>Touchez <strong>+</strong> sur le graphique métabolique.</li><li><strong>Photo</strong> — plate, puis validation.</li><li><strong>Texte</strong> — description ; l’IA sort les macros.</li><li>Le chat peut proposer — sauvegarde via le food log.</li></ol>`],
  ['de', 'Mahlzeiten erfassen', 'Essen loggen, damit Coaching unter My Rules Live-Wirkung in Charts zeigt.', `<ol><li><strong>+</strong> im Stoffwechsel-Chart tippen.</li><li><strong>Foto</strong> — Teller aufnehmen und bestätigen.</li><li><strong>Text</strong> — beschreiben; KI zerlegt Makros.</li><li>Chat kann vorschlagen — Speichern im Food-Log.</li></ol>`],
  ['ar', 'كيف تسجّل الوجبات', 'سجّل الطعام ليرى المدرب وفق My Rules أثراً حياً على الرسوم.', `<ol><li>اضغط <strong>+</strong> على الرسم الأيضي.</li><li><strong>صورة</strong> — صوّر الطبق ووافق.</li><li><strong>نص</strong> — صف الوجبة؛ الذكاء يفك الماكرو.</li><li>الدردشة قد تقترح — الحفظ عبر سجل الطعام.</li></ol>`],
  ['ru', 'Как логировать еду', 'Логируйте еду, чтобы коучинг по My Rules показывал живое влияние на графиках.', `<ol><li>Нажмите <strong>+</strong> на метаболическом графике.</li><li><strong>Фото</strong> — снимите тарелку и подтвердите.</li><li><strong>Текст</strong> — опишите; ИИ разберёт макросы.</li><li>Чат может предложить — сохранение в food log.</li></ol>`],
]);

bulk('manual-body', [
  ['en', 'Manual body entry', 'Enter weight (and optional composition) when the scale has not synced yet.', `<p>Estimates can fill gaps until Withings or a later weigh-in arrives.</p>`],
  ['he', 'הזנת גוף ידנית', 'מזינים משקל (והרכב אם יש) כשהמשקל עדיין לא הסתנכרן.', `<p>אפשר להשלים באומדן עד שיגיע Withings או שקילה הבאה.</p>`],
  ['es', 'Cuerpo manual', 'Introduce peso (y composición si tienes) si la báscula aún no sincronizó.', `<p>Una estimación cubre el hueco hasta Withings o el próximo pesaje.</p>`],
  ['fr', 'Saisie manuelle du corps', 'Saisissez le poids (et la composition si dispo) si la balance n’a pas encore sync.', `<p>Une estimation comble le trou jusqu’à Withings ou la prochaine pesée.</p>`],
  ['de', 'Körper manuell', 'Gewicht (und optional Zusammensetzung) eingeben, wenn die Waage noch nicht synced.', `<p>Schätzwerte füllen die Lücke bis Withings oder der nächste Wiegevorgang.</p>`],
  ['ar', 'إدخال الجسم يدوياً', 'أدخل الوزن (والتركيب إن وُجد) إن لم يزامن الميزان بعد.', `<p>تقدير يمكنه سد الفجوة حتى Withings أو الوزن التالي.</p>`],
  ['ru', 'Ручной ввод тела', 'Введите вес (и состав, если есть), если весы ещё не синхронизировались.', `<p>Оценка закрывает пробел до Withings или следующего взвешивания.</p>`],
]);

export const INDEX = {
  en: {
    title: 'Help',
    lead: 'Quick Start topics. Clinical abbreviations stay in English.',
  },
  he: {
    title: 'עזרה',
    lead: 'נושאים להתחלה המהירה. קיצורים קליניים נשארים באנגלית.',
  },
  es: {
    title: 'Ayuda',
    lead: 'Temas del inicio rápido. Abreviaciones clínicas en inglés.',
  },
  fr: {
    title: 'Aide',
    lead: 'Sujets du démarrage rapide. Abréviations cliniques en anglais.',
  },
  de: {
    title: 'Hilfe',
    lead: 'Themen zum Schnellstart. Klinische Kürzel bleiben Englisch.',
  },
  ar: {
    title: 'مساعدة',
    lead: 'مواضيع البداية السريعة. الاختصارات السريرية بالإنجليزية.',
  },
  ru: {
    title: 'Справка',
    lead: 'Темы быстрого старта. Клинические сокращения на английском.',
  },
};
