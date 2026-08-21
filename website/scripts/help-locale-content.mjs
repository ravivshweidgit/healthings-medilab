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
  { code: 'pt', dir: 'ltr', label: 'PT', name: 'Português', flag: '🇧🇷' },
  { code: 'it', dir: 'ltr', label: 'IT', name: 'Italiano', flag: '🇮🇹' },
  { code: 'tr', dir: 'ltr', label: 'TR', name: 'Türkçe', flag: '🇹🇷' },
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
  'xdrip-caresens',
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
    langLabel: 'Language',
    langGo: 'Go',
    home: 'Home',
    help: 'Help',
    allTopics: 'All help topics',
    badge: 'Quick Start',
    nextTopic: 'Next topic',
    glossary:
      'Clinical terms like <strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong>, and brands like <strong>Withings</strong> stay in English.',
  },
  he: {
    langLabel: 'שפה',
    langGo: 'עבור',
    home: 'דף הבית',
    help: 'עזרה',
    allTopics: 'כל נושאי העזרה',
    badge: 'התחלה מהירה',
    nextTopic: 'הנושא הבא',
    glossary:
      'מונחים כמו <strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong> ומותגים כמו <strong>Withings</strong> נשארים באנגלית.',
  },
  es: {
    langLabel: 'Idioma',
    langGo: 'Ir',
    home: 'Inicio',
    help: 'Ayuda',
    allTopics: 'Todos los temas',
    badge: 'Inicio rápido',
    nextTopic: 'Siguiente tema',
    glossary:
      'Términos como <strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong> y marcas como <strong>Withings</strong> se quedan en inglés.',
  },
  fr: {
    langLabel: 'Langue',
    langGo: 'Aller',
    home: 'Accueil',
    help: 'Aide',
    allTopics: 'Tous les sujets',
    badge: 'Démarrage rapide',
    nextTopic: 'Sujet suivant',
    glossary:
      'Les termes <strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong> et les marques comme <strong>Withings</strong> restent en anglais.',
  },
  de: {
    langLabel: 'Sprache',
    langGo: 'Wechseln',
    home: 'Start',
    help: 'Hilfe',
    allTopics: 'Alle Themen',
    badge: 'Schnellstart',
    nextTopic: 'Nächstes Thema',
    glossary:
      'Begriffe wie <strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong> und Marken wie <strong>Withings</strong> bleiben auf Englisch.',
  },
  ar: {
    langLabel: 'اللغة',
    langGo: 'انتقل',
    home: 'الرئيسية',
    help: 'مساعدة',
    allTopics: 'كل المواضيع',
    badge: 'بداية سريعة',
    nextTopic: 'الموضوع التالي',
    glossary:
      'مصطلحات مثل <strong>kcal</strong> و <strong>BMR</strong> و <strong>CGM</strong> وعلامات مثل <strong>Withings</strong> تبقى بالإنجليزية.',
  },
  ru: {
    langLabel: 'Язык',
    langGo: 'Перейти',
    home: 'Главная',
    help: 'Справка',
    allTopics: 'Все темы',
    badge: 'Быстрый старт',
    nextTopic: 'Следующая тема',
    glossary:
      'Термины вроде <strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong> и бренды вроде <strong>Withings</strong> остаются на английском.',
  },
  pt: {
    langLabel: 'Idioma',
    langGo: 'Ir',
    home: 'Início',
    help: 'Ajuda',
    allTopics: 'Todos os tópicos',
    badge: 'Início rápido',
    nextTopic: 'Próximo tópico',
    glossary:
      'Termos como <strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong> e marcas como <strong>Withings</strong> ficam em inglês.',
  },
  it: {
    langLabel: 'Lingua',
    langGo: 'Vai',
    home: 'Home',
    help: 'Aiuto',
    allTopics: 'Tutti gli argomenti',
    badge: 'Avvio rapido',
    nextTopic: 'Argomento successivo',
    glossary:
      'Termini come <strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong> e marchi come <strong>Withings</strong> restano in inglese.',
  },
  tr: {
    langLabel: 'Dil',
    langGo: 'Git',
    home: 'Ana sayfa',
    help: 'Yardım',
    allTopics: 'Tüm konular',
    badge: 'Hızlı başlangıç',
    nextTopic: 'Sonraki konu',
    glossary:
      '<strong>kcal</strong>, <strong>BMR</strong>, <strong>CGM</strong> gibi terimler ve <strong>Withings</strong> gibi markalar İngilizce kalır.',
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
  'לומדת את הגוף, מסבירה מה קורה עכשיו, ומעבירה משוב ברור לתזונאי — כדי שהדרך ליעדים תתחדד מיום ליום.',
  `<p>גרפים חיים של משקל, הרכב גוף, פעילות וגלוקוז כשמחוברים. המודל מסביר מה זז — לפי <strong>My Rules</strong>.</p>
<p>רוב האפליקציות עוצרות במעקב. כאן המעגל נסגר: כוונה → חיים → למידה → שיתוף → חידוד.</p>
<p><strong>לא טיפול רפואי.</strong> בלי אבחון ובלי מרשמים. חירום — אצל אנשי מקצוע מורשים.</p>`,
);
set(
  'quick-start-welcome',
  'es',
  'Bienvenido/a a Healthings',
  'Aprende su cuerpo, explica lo que ocurre ahora y da feedback claro a su nutricionista — para que el camino a sus objetivos se afine cada día.',
  `<p>Gráficos en vivo de peso, composición, actividad y glucosa si está conectada. El modelo explica qué cambió — bajo <strong>My Rules</strong>.</p>
<p>La mayoría de apps solo miden. Aquí se cierra el círculo: intención → vida → aprendizaje → compartir → afinar.</p>
<p><strong>No es atención médica.</strong> Sin diagnóstico ni recetas. Urgencias: con profesionales licenciados.</p>`,
);
set(
  'quick-start-welcome',
  'fr',
  'Bienvenue sur Healthings',
  'Apprend votre corps, explique ce qui se passe maintenant, et donne un feedback clair à votre nutritionniste — pour que le chemin vers vos objectifs se précise chaque jour.',
  `<p>Graphiques en direct : poids, composition, activité, glucose si connecté. Le modèle explique ce qui a bougé — sous <strong>My Rules</strong>.</p>
<p>La plupart des apps s’arrêtent au suivi. Ici la boucle se ferme : intention → vie → apprentissage → partage → raffinage.</p>
<p><strong>Ce n’est pas un soin médical.</strong> Pas de diagnostic ni d’ordonnance. Urgences : professionnels habilités.</p>`,
);
set(
  'quick-start-welcome',
  'de',
  'Willkommen bei Healthings',
  'Lernt Ihren Körper, erklärt, was gerade passiert, und gibt Ihrer Ernährungsfachkraft klares Feedback — damit der Weg zu Ihren Zielen Tag für Tag schärfer wird.',
  `<p>Live-Charts zu Gewicht, Körperzusammensetzung, Aktivität und Glukose — wenn verbunden. Das Modell erklärt, was sich bewegt hat — unter <strong>My Rules</strong>.</p>
<p>Die meisten Apps bleiben beim Tracking stehen. Hier schließt sich der Kreis: Absicht → Alltag → Lernen → Teilen → Nachschärfen.</p>
<p><strong>Keine medizinische Behandlung.</strong> Keine Diagnose, keine Rezepte. Notfälle bleiben bei zugelassenen Fachleuten.</p>`,
);
set(
  'quick-start-welcome',
  'ar',
  'مرحباً بكم في Healthings',
  'يتعلّم الجسم، ويشرح ما يحدث الآن، وينقل تغذية راجعة واضحة لأخصائي التغذية — حتى يصبح الطريق إلى أهدافكم أدق يوماً بعد يوم.',
  `<p>رسوم حية للوزن وتركيب الجسم والنشاط والجلوكوز عند الاتصال. النموذج يشرح ما تغيّر — وفق <strong>My Rules</strong>.</p>
<p>معظم التطبيقات تتوقف عند التتبع. هنا تُغلق الحلقة: نيّة → حياة → تعلّم → مشاركة → ضبط.</p>
<p><strong>ليس رعاية طبية.</strong> بلا تشخيص ولا وصفات. الطوارئ تبقى لدى المهنيين المرخّصين.</p>`,
);
set(
  'quick-start-welcome',
  'ru',
  'Добро пожаловать в Healthings',
  'Учится вашему телу, объясняет, что происходит сейчас, и даёт ясный фидбек нутрициологу — чтобы путь к целям становился точнее с каждым днём.',
  `<p>Живые графики веса, состава тела, активности и глюкозы при подключении. Модель объясняет, что изменилось — по <strong>My Rules</strong>.</p>
<p>Большинство приложений останавливаются на трекинге. Здесь круг замыкается: замысел → жизнь → обучение → обмен → уточнение.</p>
<p><strong>Это не медицина.</strong> Без диагнозов и рецептов. Экстренное — у лицензированных специалистов.</p>`,
);
set(
  'quick-start-welcome',
  'pt',
  'Bem-vindo(a) ao Healthings',
  'Aprende o seu corpo, explica o que acontece agora e dá feedback claro ao nutricionista — para o caminho aos objetivos ficar mais preciso a cada dia.',
  `<p>Gráficos ao vivo de peso, composição, atividade e glicose quando ligado. O modelo explica o que mudou — sob <strong>My Rules</strong>.</p>
<p>A maioria das apps para no tracking. Aqui o ciclo fecha: intenção → vida → aprender → partilhar → afinar.</p>
<p><strong>Não é cuidados médicos.</strong> Sem diagnóstico nem receitas. Emergências ficam com profissionais licenciados.</p>`,
);
set(
  'quick-start-welcome',
  'it',
  'Benvenuto/a in Healthings',
  'Impara il tuo corpo, spiega cosa succede ora e dà un feedback chiaro al nutrizionista — così il percorso verso gli obiettivi si affina ogni giorno.',
  `<p>Grafici live di peso, composizione, attività e glucosio se collegati. Il modello spiega cosa è cambiato — sotto <strong>My Rules</strong>.</p>
<p>La maggior parte delle app si ferma al tracking. Qui il cerchio si chiude: intento → vita → apprendimento → condivisione → raffinamento.</p>
<p><strong>Non è assistenza medica.</strong> Nessuna diagnosi né ricette. Le emergenze restano ai professionisti abilitati.</p>`,
);
set(
  'quick-start-welcome',
  'tr',
  'Healthings’e hoş geldiniz',
  'Bedeninizi öğrenir, şu an ne olduğunu açıklar ve diyetisyeninize net geri bildirim verir — böylece hedeflere giden yol her gün netleşir.',
  `<p>Bağlıysa kilo, kompozisyon, aktivite ve glikoz için canlı grafikler. Model ne değiştiğini açıklar — <strong>My Rules</strong> altında.</p>
<p>Çoğu uygulama yalnızca takipte kalır. Burada döngü kapanır: niyet → yaşam → öğrenme → paylaşma → iyileştirme.</p>
<p><strong>Tıbbi bakım değildir.</strong> Teşhis veya reçete yok. Aciller lisanslı klinisyenlerde kalır.</p>`,
);

// ── quick-start-units ────────────────────────────────────────────
set(
  'quick-start-units',
  'en',
  'Units & measurements',
  'Choose how weight, height, energy, water, and glucose appear. Storage stays in standard clinical units.',
  `<p>Pick what you already use at home or with your clinic. Change anytime in <strong>Profile</strong>.</p>
<p>Symbols like <strong>kg</strong>, <strong>kcal</strong>, and <strong>mg/dL</strong> stay as international abbreviations.</p>`,
);
set(
  'quick-start-units',
  'he',
  'יחידות מידה',
  'איך יוצגו משקל, גובה, אנרגיה, מים וגלוקוז. מאחורי הקלעים נשמרים ביחידות קליניות סטנדרטיות.',
  `<p>בוחרים מה שכבר רגילים בבית או בקליניקה. אפשר לשנות בכל רגע ב־<strong>פרופיל</strong>.</p>
<p>סימולים כמו <strong>kg</strong>, <strong>kcal</strong> ו־<strong>mg/dL</strong> נשארים באנגלית — זה התקן.</p>`,
);
set(
  'quick-start-units',
  'es',
  'Unidades de medida',
  'Así se muestran peso, altura, energía, agua y glucosa. Se guarda en unidades clínicas estándar.',
  `<p>Use lo que ya usa en casa o en la clínica. Se puede cambiar en cualquier momento en <strong>Perfil</strong>.</p>
<p>Símbolos como <strong>kg</strong>, <strong>kcal</strong> y <strong>mg/dL</strong> se quedan en inglés — es el estándar.</p>`,
);
set(
  'quick-start-units',
  'fr',
  'Unités de mesure',
  'Ainsi s’affichent poids, taille, énergie, eau et glucose. Stockage en unités cliniques standard.',
  `<p>Prenez ce que vous utilisez déjà. Modifiable à tout moment dans <strong>Profil</strong>.</p>
<p>Les symboles <strong>kg</strong>, <strong>kcal</strong> et <strong>mg/dL</strong> restent en anglais — c’est le standard.</p>`,
);
set(
  'quick-start-units',
  'de',
  'Maßeinheiten',
  'So erscheinen Gewicht, Größe, Energie, Wasser und Glukose. Gespeichert wird in klinischen Standard-Einheiten.',
  `<p>Nehmen Sie, was Sie schon kennen. Später jederzeit änderbar unter <strong>Profil</strong>.</p>
<p>Kürzel wie <strong>kg</strong>, <strong>kcal</strong> und <strong>mg/dL</strong> bleiben Englisch — das ist der Standard.</p>`,
);
set(
  'quick-start-units',
  'ar',
  'وحدات القياس',
  'كيف يظهر الوزن والطول والطاقة والماء والجلوكوز. التخزين بوحدات سريرية قياسية.',
  `<p>اختاروا ما تستخدمونه أصلاً. يمكن التغيير في أي وقت من <strong>الملف</strong>.</p>
<p>رموز مثل <strong>kg</strong> و <strong>kcal</strong> و <strong>mg/dL</strong> تبقى بالإنجليزية — هذا المعيار.</p>`,
);
set(
  'quick-start-units',
  'ru',
  'Единицы измерения',
  'Как показывать вес, рост, энергию, воду и глюкозу. Хранение — в стандартных клинических единицах.',
  `<p>Берите привычные единицы. Позже можно сменить в любой момент в разделе <strong>Профиль</strong>.</p>
<p>Обозначения <strong>kg</strong>, <strong>kcal</strong> и <strong>mg/dL</strong> остаются на английском — это стандарт.</p>`,
);
set(
  'quick-start-units',
  'pt',
  'Unidades e medidas',
  'Como peso, altura, energia, água e glicose aparecem. O armazenamento fica em unidades clínicas padrão.',
  `<p>Escolha o que já usa em casa ou na clínica. Pode mudar a qualquer momento em <strong>Perfil</strong>.</p>
<p>Símbolos como <strong>kg</strong>, <strong>kcal</strong> e <strong>mg/dL</strong> ficam em inglês — é o padrão.</p>`,
);
set(
  'quick-start-units',
  'it',
  'Unità di misura',
  'Come appaiono peso, altezza, energia, acqua e glucosio. Lo storage resta in unità cliniche standard.',
  `<p>Scegli ciò che già usi a casa o in clinica. Modificabile in qualsiasi momento in <strong>Profilo</strong>.</p>
<p>Simboli come <strong>kg</strong>, <strong>kcal</strong> e <strong>mg/dL</strong> restano in inglese — è lo standard.</p>`,
);
set(
  'quick-start-units',
  'tr',
  'Birimler ve ölçüler',
  'Kilo, boy, enerji, su ve glikozun nasıl göründüğü. Depolama standart klinik birimlerde kalır.',
  `<p>Evde veya klinikte zaten kullandığınızı seçin. İstediğiniz zaman <strong>Profil</strong> içinden değiştirebilirsiniz.</p>
<p><strong>kg</strong>, <strong>kcal</strong> ve <strong>mg/dL</strong> gibi semboller İngilizce kalır — bu standarttır.</p>`,
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
  ['pt', 'Sobre você', 'Género, altura e data de nascimento alimentam BMR, BMI e metas de energia.', `<p>Responda uma vez aqui — pode afinar depois no perfil.</p>`],
  ['it', 'Su di te', 'Genere, altezza e data di nascita alimentano BMR, BMI e obiettivi energetici.', `<p>Rispondi una volta qui — puoi rifinire dopo nel profilo.</p>`],
  ['tr', 'Hakkınızda', 'Cinsiyet, boy ve doğum tarihi BMR, BMI ve enerji hedeflerini besler.', `<p>Burada bir kez yanıtlayın — sonra profilde düzeltebilirsiniz.</p>`],
]);

bulk('quick-start-language', [
  ['en', 'App & coach language', 'One language for Quick Start, coach chat, meal names, reports, and help links.', `<p>You can change it later in <strong>Profile</strong>. Help opens in the same language.</p>`],
  ['he', 'שפת האפליקציה והמאמן', 'בשפה הזו עוברים את ההתחלה, מדברים עם המאמן, רואים שמות ארוחות ודוחות. גם דפי העזרה נפתחים בה.', `<p>אפשר לשנות אחר כך ב־<strong>פרופיל</strong>.</p>`],
  ['es', 'Idioma de la app y el coach', 'Un idioma para el inicio, el chat, las comidas, los informes y la ayuda.', `<p>Se puede cambiar después en <strong>Perfil</strong>. La ayuda abre en el mismo idioma.</p>`],
  ['fr', 'Langue de l’app et du coach', 'Une langue pour le démarrage, le chat, les repas, les rapports et l’aide.', `<p>Modifiable plus tard dans <strong>Profil</strong>. L’aide s’ouvre dans la même langue.</p>`],
  ['de', 'App- & Coach-Sprache', 'Eine Sprache für Schnellstart, Chat, Mahlzeiten, Berichte und Hilfe.', `<p>Später änderbar unter <strong>Profil</strong>. Hilfe öffnet in derselben Sprache.</p>`],
  ['ar', 'لغة التطبيق والمدرب', 'لغة واحدة للبداية والدردشة وأسماء الوجبات والتقارير وصفحات المساعدة.', `<p>يمكن التغيير لاحقاً من <strong>الملف</strong>. المساعدة تُفتح بنفس اللغة.</p>`],
  ['ru', 'Язык приложения и коуча', 'Один язык для старта, чата, названий еды, отчётов и справки.', `<p>Позже можно сменить в разделе <strong>Профиль</strong>. Справка открывается на том же языке.</p>`],
  ['pt', 'Idioma da app e do coach', 'Um idioma para o início rápido, chat, nomes das refeições, relatórios e ajuda.', `<p>Pode mudar depois em <strong>Perfil</strong>. A ajuda abre no mesmo idioma.</p>`],
  ['it', 'Lingua app e coach', 'Una lingua per avvio rapido, chat, nomi pasti, report e aiuto.', `<p>Puoi cambiarla dopo in <strong>Profilo</strong>. L’aiuto si apre nella stessa lingua.</p>`],
  ['tr', 'Uygulama ve koç dili', 'Hızlı başlangıç, sohbet, yemek adları, raporlar ve yardım için tek dil.', `<p>Sonra <strong>Profil</strong> içinden değiştirebilirsiniz. Yardım aynı dilde açılır.</p>`],
]);

bulk('mentor-voice-gender', [
  ['en', 'App mentor', 'Man or woman — how your AI mentor speaks to you. Not your profile gender.', `<p>Shown only in Hebrew and Arabic, where titles and grammar change by gender. You can change this later under Mentors.</p>`],
  ['he', 'המאמן באפליקציה', 'גבר או אישה — כך ידבר אליכם המאמן. לא המגדר שלכם בפרופיל.', `<p>מופיע רק בעברית ובערבית — שם התארים והדקדוק משתנים לפי מגדר. אפשר לשנות גם אחר כך תחת המנטורים.</p>`],
  ['es', 'Mentor de la app', 'Hombre o mujer — así te habla el mentor AI. No es el género del perfil.', `<p>Solo en hebreo y árabe, donde títulos y gramática cambian por género. Luego puedes cambiarlo en Mentores.</p>`],
  ['fr', 'Mentor de l’app', 'Homme ou femme — ainsi vous parle le mentor IA. Pas le genre du profil.', `<p>Affiché seulement en hébreu et en arabe, où titres et grammaire changent selon le genre. Modifiable plus tard sous Mentors.</p>`],
  ['de', 'App-Mentor', 'Mann oder Frau — so spricht Ihr KI-Mentor. Nicht Ihr Profil-Geschlecht.', `<p>Nur bei Hebräisch und Arabisch, wo Titel und Grammatik vom Geschlecht abhängen. Später änderbar unter Mentoren.</p>`],
  ['ar', 'المرشد في التطبيق', 'رجل أو امرأة — هكذا يخاطبكم المرشد. ليس جنس ملفكم الشخصي.', `<p>يظهر فقط بالعبرية والعربية حيث تتغير الألقاب والقواعد حسب الجنس. يمكن التغيير لاحقاً من <strong>المرشدين</strong>.</p>`],
  ['ru', 'Наставник в приложении', 'Мужчина или женщина — так говорит ИИ-наставник. Не пол в профиле.', `<p>Только для иврита и арабского, где обращения зависят от пола. Позже можно сменить в разделе «Наставники».</p>`],
  ['pt', 'Mentor da app', 'Homem ou mulher — como o mentor de IA fala consigo. Não é o género do perfil.', `<p>Só em hebraico e árabe, onde títulos e gramática mudam por género. Pode mudar depois em Mentores.</p>`],
  ['it', 'Mentor dell’app', 'Uomo o donna — come ti parla il mentor IA. Non è il genere del profilo.', `<p>Solo in ebraico e arabo, dove titoli e grammatica cambiano per genere. Modificabile dopo in Mentor.</p>`],
  ['tr', 'Uygulama mentoru', 'Erkek veya kadın — yapay zeka mentorunun size nasıl hitap ettiği. Profil cinsiyetiniz değil.', `<p>Yalnızca unvan ve dilbilgisinin cinsiyete göre değiştiği İbranice ve Arapçada gösterilir. Sonra Mentorlar altında değiştirebilirsiniz.</p>`],
]);

bulk('withings-scale', [
  ['en', 'Withings body scale', 'Any Withings scale on your account works. Healthings reads the cloud after you link — not Bluetooth.', `<p>Body, Body Scan, and similar models are fine.</p>`],
  ['he', 'משקל Withings', 'כל משקל Withings בחשבון מתאים — Body, Body Scan ודומיהם. אחרי החיבור קוראים מהענן, לא מ־Bluetooth.', `<p>חיבור אחד מכסה גם שעון, אם יש.</p>`],
  ['es', 'Báscula Withings', 'Cualquier báscula Withings de tu cuenta sirve. Tras vincular, se lee la nube — no Bluetooth.', `<p>Body, Body Scan y similares están bien.</p>`],
  ['fr', 'Balance Withings', 'Toute balance Withings du compte convient. Après liaison, lecture cloud — pas Bluetooth.', `<p>Body, Body Scan, etc. sont OK.</p>`],
  ['de', 'Withings-Körperwaage', 'Jede Withings-Waage im Konto passt. Nach dem Link liest die App die Cloud — nicht Bluetooth.', `<p>Body, Body Scan und ähnliche Modelle sind OK.</p>`],
  ['ar', 'ميزان Withings', 'أي ميزان Withings في حسابك يناسب. بعد الربط نقرأ من السحابة — وليس Bluetooth.', `<p>Body و Body Scan وما شابه مناسب.</p>`],
  ['ru', 'Весы Withings', 'Подойдут любые весы Withings в аккаунте. После связи данные из облака — не Bluetooth.', `<p>Body, Body Scan и похожие модели — ок.</p>`],
  ['pt', 'Balança Withings', 'Qualquer balança Withings na conta serve. Após ligar, lê-se a nuvem — não Bluetooth.', `<p>Body, Body Scan e modelos semelhantes estão ok.</p>`],
  ['it', 'Bilancia Withings', 'Qualsiasi bilancia Withings sull’account va bene. Dopo il link legge il cloud — non Bluetooth.', `<p>Body, Body Scan e modelli simili vanno bene.</p>`],
  ['tr', 'Withings tartı', 'Hesabınızdaki herhangi bir Withings tartı çalışır. Bağladıktan sonra buluttan okur — Bluetooth değil.', `<p>Body, Body Scan ve benzer modeller uygundur.</p>`],
]);

bulk('quick-start-watch', [
  ['en', 'Withings watch or band', 'Yes → activity and heart rate from Withings cloud. No → from Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung and others can write to the phone health store.</p>`],
  ['he', 'שעון או צמיד Withings', 'כן → פעילות ודופק מענן Withings. לא → מ־Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung ואחרים יכולים לכתוב לחנות הבריאות בטלפון.</p>`],
  ['es', 'Reloj o pulsera Withings', 'Sí → actividad y pulso desde la nube Withings. No → Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung y otros pueden escribir en la salud del teléfono.</p>`],
  ['fr', 'Montre ou bracelet Withings', 'Oui → activité et pouls depuis le cloud Withings. Non → Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung… peuvent écrire vers la santé du téléphone.</p>`],
  ['de', 'Withings-Uhr oder Band', 'Ja → Aktivität und Puls aus der Withings-Cloud. Nein → Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung u. a. können in den Telefon-Health-Store schreiben.</p>`],
  ['ar', 'ساعة أو سوار Withings', 'نعم → نشاط ونبض من سحابة Withings. لا → من Health Connect / Apple Health.', `<p>Garmin و Apple Watch و Samsung وغيرها يمكنها الكتابة إلى صحة الهاتف.</p>`],
  ['ru', 'Часы или браслет Withings', 'Да → активность и пульс из облака Withings. Нет → Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung и другие могут писать в здоровье телефона.</p>`],
  ['pt', 'Relógio ou pulseira Withings', 'Sim → atividade e pulso da nuvem Withings. Não → Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung e outros podem escrever na saúde do telemóvel.</p>`],
  ['it', 'Orologio o cinturino Withings', 'Sì → attività e battito dal cloud Withings. No → Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung e altri possono scrivere nella salute del telefono.</p>`],
  ['tr', 'Withings saat veya bileklik', 'Evet → aktivite ve nabız Withings bulutundan. Hayır → Health Connect / Apple Health.', `<p>Garmin, Apple Watch, Samsung ve diğerleri telefon sağlık deposuna yazabilir.</p>`],
]);

bulk('cgm', [
  ['en', 'CGM glucose', 'Continuous glucose via Health Connect (Android) or Apple Health (iPhone). Lab PDFs can be imported later.', `<p>Share your CGM app with the phone health store, then allow Blood Glucose.</p>`],
  ['he', 'CGM לגלוקוז', 'גלוקוז רציף דרך Health Connect (Android) או Apple Health (iPhone). אפשר גם לייבא PDF מעבדה אחר כך.', `<p>משתפים את אפליקציית ה־CGM עם חנות הבריאות בטלפון ומאשרים Blood Glucose.</p>`],
  ['es', 'Glucosa CGM', 'Glucosa continua vía Health Connect (Android) o Apple Health (iPhone). Luego puedes importar PDFs de lab.', `<p>Comparte la app CGM con la salud del teléfono y permite Blood Glucose.</p>`],
  ['fr', 'Glucose CGM', 'Glucose continu via Health Connect (Android) ou Apple Health (iPhone). PDFs labo plus tard si besoin.', `<p>Partagez l’app CGM avec la santé du téléphone et autorisez Blood Glucose.</p>`],
  ['de', 'CGM-Glukose', 'Kontinuierliche Glukose über Health Connect (Android) oder Apple Health (iPhone). Lab-PDFs später möglich.', `<p>CGM-App mit Telefon-Health teilen und Blood Glucose erlauben.</p>`],
  ['ar', 'جلوكوز CGM', 'جلوكوز مستمر عبر Health Connect (Android) أو Apple Health (iPhone). يمكن استيراد PDF مختبر لاحقاً.', `<p>شارك تطبيق CGM مع صحة الهاتف واسمح بـ Blood Glucose.</p>`],
  ['ru', 'Глюкоза CGM', 'Непрерывная глюкоза через Health Connect (Android) или Apple Health (iPhone). PDF анализов — позже.', `<p>Дайте CGM-приложению доступ к здоровью телефона и Blood Glucose.</p>`],
  ['pt', 'Glicose CGM', 'Glicose contínua via Health Connect (Android) ou Apple Health (iPhone). PDFs de lab depois.', `<p>Partilhe a app CGM com a saúde do telemóvel e permita Blood Glucose.</p>`],
  ['it', 'Glucosio CGM', 'Glucosio continuo via Health Connect (Android) o Apple Health (iPhone). PDF lab più tardi.', `<p>Condividi l’app CGM con la salute del telefono e consenti Blood Glucose.</p>`],
  ['tr', 'CGM glikoz', 'Sürekli glikoz Health Connect (Android) veya Apple Health (iPhone) üzerinden. Lab PDF’leri sonra.', `<p>CGM uygulamasını telefon sağlığıyla paylaşın, sonra Blood Glucose’a izin verin.</p>`],
]);

/**
 * Phone captures for the xDrip+ walkthrough. Bumped like CSS_VER when a shot is
 * re-taken — nginx caches images for 30 days, so a same-named replacement would
 * otherwise keep showing the old screen for a month.
 */
const SHOT_VER = '20260821a';

function shot(img, alt, caption) {
  return `<figure class="help-shot"><img src="../../images/help/${img.file}?v=${SHOT_VER}" width="${img.w}" height="${img.h}" loading="lazy" alt="${alt}" /><figcaption>${caption}</figcaption></figure>`;
}

/**
 * Real dimensions travel with each capture so the browser reserves the right box
 * and the steps below a figure do not jump once the image loads. Two of these are
 * cropped short — a full 460×1024 frame of a four-row settings screen is mostly
 * empty wallpaper, which pushes the next step off the phone screen.
 */
const CARESENS_SHOT = { file: 'xdrip-caresens-share.png', w: 460, h: 500 };
const SETTINGS_SHOT = { file: 'xdrip-settings-inter-app.png', w: 460, h: 1024 };
const INTERAPP_SHOT = { file: 'xdrip-inter-app-health-connect.png', w: 460, h: 1024 };
const HC_SHOT = { file: 'xdrip-health-connect-toggles.png', w: 460, h: 470 };

/** Mirrored on healthings.ai — see website/downloads/README.md. */
const XDRIP_APK = '/downloads/xdrip-plus.apk';
const XDRIP_SOURCE = 'https://github.com/NightscoutFoundation/xDrip';
/**
 * Written by fetch-xdrip: upstream URL, release tag, sha256, mirror date. Linked
 * from the phrase that claims the build is unchanged, because that claim is the
 * one thing a mirror cannot ask to be taken on trust — and a mirror going stale
 * is invisible until someone can read which release is actually being served.
 */
const XDRIP_NOTE = '/downloads/xdrip-plus-version.txt';

/**
 * The app's own mark, above the download button. Not decoration: the reader is
 * about to sideload an APK from outside the Play Store, and the icon is how they
 * confirm afterwards that the thing now on their home screen is the thing this
 * page told them to install.
 *
 * `alt=""` on purpose — the button underneath already names the app, so a second
 * announcement would only make the page longer to listen to.
 */
const XDRIP_MARK = `<p class="help-mark"><img src="../../images/apps/xdrip-plus-icon.png?v=${SHOT_VER}" width="76" height="76" alt="" /></p>`;

/**
 * Hebrew and Arabic only. "+" is bidi-neutral, so at the end of a Latin run
 * inside RTL prose it resolves with the paragraph and the app name paints as
 * "+xDrip" — the heading looked like a typo. A LEFT-TO-RIGHT MARK after the sign
 * keeps it attached to the Latin word. Wrap the whole string, including the
 * captions and alt text that come back from shot().
 */
function ltrPlus(s) {
  return s.replace(/xDrip\+/g, 'xDrip+\u200e');
}

bulk('xdrip-caresens', [
  [
    'en',
    'xDrip+ for CareSens Air (Android)',
    'xDrip+ is the CareSens integration Healthings uses on Android. Download it here and connect once: CareSens Air → xDrip+ → Health Connect → Healthings.',
    `<p class="tip"><strong>Android only.</strong> There is no xDrip+ on iPhone — there, CareSens Air shares straight to Apple Health. See <a href="cgm.html">CGM glucose</a>.</p>
<p>CareSens Air keeps the readings inside its own app. xDrip+ is the CareSens integration on Android — it lines CareSens up with Healthings. You connect once, and after that glucose lands on your dashboard by itself.</p>
<p>xDrip+ is in English on every phone, so the labels below are quoted exactly as you will see them.</p>
${XDRIP_MARK}
<p class="help-download"><a href="${XDRIP_APK}" download>Download xDrip+ for Android</a></p>
<p class="help-download-note">About 16 MB. The CareSens integration Healthings uses on Android — <a href="${XDRIP_NOTE}">this build</a>, <a href="${XDRIP_SOURCE}" rel="noopener">source on GitHub</a>.</p>
<h2>1. Install xDrip+</h2>
<ol><li>Tap the button above on the phone itself. Your browser will warn you about an APK — that is normal outside the Play Store.</li>
<li>Open the downloaded file. If Android refuses, allow <strong>Install unknown apps</strong> for your browser, then open it again.</li>
<li>Open xDrip+ once. You can skip its sensor wizard — CareSens Air will do the feeding.</li></ol>
<h2>2. Let CareSens Air talk to xDrip+</h2>
<ol><li>In the <strong>CareSens Air</strong> app, open <strong>Manage Data &amp; Connections</strong>.</li>
<li>Switch <strong>xDrip+</strong> on.</li></ol>
${shot(CARESENS_SHOT, 'CareSens Air, Manage Data and Connections, with the xDrip+ switch on', 'CareSens Air — the xDrip+ switch is on.')}
<p>Leave CareSens Air installed and running. It stays the app that talks to your sensor; xDrip+ only listens.</p>
<h2>3. Point xDrip+ at the companion app</h2>
<p>In xDrip+, open <strong>Settings</strong> → <strong>Hardware Data Source</strong> and choose <strong>Companion App</strong> (older builds call it <strong>640G / Eversense</strong>). Within a few minutes a glucose number should appear on the xDrip+ home screen.</p>
<h2>4. Send the readings to Health Connect</h2>
<ol><li>xDrip+ → <strong>Settings</strong> → <strong>Inter-app settings</strong>.</li>
<li>Scroll to the bottom → <strong>Google Health Connect</strong>.</li>
<li><strong>Use Health Connect</strong> ON, <strong>Send data to Health Connect</strong> ON, <strong>Get data from Health Connect</strong> OFF.</li>
<li>Tap <strong>Manage permissions</strong> and let xDrip+ write Blood Glucose.</li></ol>
${shot(SETTINGS_SHOT, 'xDrip+ Settings list with Inter-app settings near the top', 'xDrip+ Settings — Inter-app settings sits near the top.')}
${shot(INTERAPP_SHOT, 'xDrip+ Inter-app settings with Google Health Connect at the bottom', 'Inter-app settings — Google Health Connect is at the bottom.')}
${shot(HC_SHOT, 'xDrip+ Google Health Connect screen: Use Health Connect on, Get data off, Send data on', 'Use Health Connect ON, Send data ON, Get data OFF.')}
<p class="tip">Leave <strong>Get data from Health Connect</strong> off. xDrip+ only needs to write here, and with reading on, some phones nag you every few minutes.</p>
<h2>5. Let Healthings read the glucose</h2>
<ol><li>In Healthings: <strong>Profile &amp; Settings</strong> → <strong>GEAR</strong> → <strong>CGM</strong> = <strong>Yes</strong>.</li>
<li>Allow <strong>Blood Glucose</strong> when the phone asks (<strong>Allow access</strong>).</li>
<li>Tap the refresh icon in the header. The chart strip turns into <strong>GLUCOSE</strong> and fills as readings arrive.</li></ol>
<p>Already been wearing the sensor for a while? <strong>GEAR</strong> → <strong>Import</strong> loads CareSens CSV history, so the earlier days are not empty.</p>
<h2>Nothing shows up?</h2>
<ul><li>Give it about 15 minutes — a reading travels three apps. A fresh sensor is also in warm-up for its first hours.</li>
<li>Check that CareSens Air is still installed and the <strong>xDrip+</strong> switch is still on.</li>
<li>Phone <strong>Settings</strong> → <strong>Health Connect</strong> → <strong>App permissions</strong>: xDrip+ may write Blood Glucose, Healthings may read it.</li>
<li>Battery saver: let xDrip+ and Healthings run in the background. Android stops the quiet apps first.</li></ul>`,
  ],
  [
    'he',
    ltrPlus('xDrip+ ל־CareSens Air (Android)'),
    ltrPlus(
      'xDrip+ היא החיבור של CareSens ל־Healthings באנדרואיד. מורידים כאן ומחברים פעם אחת: CareSens Air → xDrip+ → Health Connect → Healthings.',
    ),
    ltrPlus(`<p class="tip"><strong>אנדרואיד בלבד.</strong> ל־iPhone אין xDrip+ — שם CareSens Air משתפת ישר ל־Apple Health. ראו <a href="cgm.html">CGM לגלוקוז</a>.</p>
<p>CareSens Air שומרת את המדידות אצלה. xDrip+ היא החיבור של CareSens באנדרואיד — ככה CareSens ו־Healthings עובדות יחד. מחברים פעם אחת, ומשם הגלוקוז מגיע לדשבורד לבד.</p>
<p>המסכים של xDrip+ באנגלית בכל טלפון, ולכן השמות למטה מובאים בדיוק כפי שתראו אותם.</p>
${XDRIP_MARK}
<p class="help-download"><a href="${XDRIP_APK}" download>הורדת xDrip+ לאנדרואיד</a></p>
<p class="help-download-note">כ־16MB. החיבור של CareSens ל־Healthings באנדרואיד — <a href="${XDRIP_NOTE}">הגרסה כאן</a>, <a href="${XDRIP_SOURCE}" rel="noopener">הקוד ב־GitHub</a>.</p>
<h2>1. מתקינים את xDrip+</h2>
<ol><li>לוחצים על הכפתור למעלה מהטלפון עצמו. הדפדפן יזהיר שזה קובץ APK — זה נורמלי מחוץ ל־Play Store.</li>
<li>פותחים את הקובץ שהורד. אם אנדרואיד חוסם, מאשרים לדפדפן <strong>Install unknown apps</strong> ופותחים שוב.</li>
<li>פותחים את xDrip+ פעם אחת. אפשר לדלג על אשף החיישן — CareSens Air היא זו שתזין אותה.</li></ol>
<h2>2. מרשים ל־CareSens Air לדבר עם xDrip+</h2>
<ol><li>באפליקציית <strong>CareSens Air</strong> נכנסים ל־<strong>Manage Data &amp; Connections</strong>.</li>
<li>מדליקים את <strong>xDrip+</strong>.</li></ol>
${shot(CARESENS_SHOT, 'מסך Manage Data and Connections באפליקציית CareSens Air, המפסק של xDrip+ דלוק', 'CareSens Air — המפסק של xDrip+ דלוק.')}
<p>משאירים את CareSens Air מותקנת ופעילה. היא נשארת זו שמדברת עם החיישן; xDrip+ רק מקשיבה.</p>
<h2>3. מכוונים את xDrip+ לאפליקציית הליווי</h2>
<p>ב־xDrip+ נכנסים ל־<strong>Settings</strong> → <strong>Hardware Data Source</strong> ובוחרים <strong>Companion App</strong> (בגרסאות ותיקות זה נקרא <strong>640G / Eversense</strong>). תוך כמה דקות אמור להופיע מספר במסך הבית של xDrip+.</p>
<h2>4. שולחים את המדידות ל־Health Connect</h2>
<ol><li>ב־xDrip+: <strong>Settings</strong> → <strong>Inter-app settings</strong>.</li>
<li>גוללים למטה עד <strong>Google Health Connect</strong>.</li>
<li><strong>Use Health Connect</strong> ON, <strong>Send data to Health Connect</strong> ON, <strong>Get data from Health Connect</strong> OFF.</li>
<li>לוחצים <strong>Manage permissions</strong> ומאשרים ל־xDrip+ לכתוב Blood Glucose.</li></ol>
${shot(SETTINGS_SHOT, 'רשימת ההגדרות של xDrip+ עם Inter-app settings בראש הרשימה', 'ההגדרות של xDrip+ — ‏Inter-app settings בראש הרשימה.')}
${shot(INTERAPP_SHOT, 'מסך Inter-app settings ב־xDrip+ עם Google Health Connect בתחתית', 'Inter-app settings — ‏Google Health Connect בתחתית.')}
${shot(HC_SHOT, 'מסך Google Health Connect ב־xDrip+: ‏Use Health Connect דלוק, Get data כבוי, Send data דלוק', 'Use Health Connect דלוק, Send data דלוק, Get data כבוי.')}
<p class="tip">משאירים את <strong>Get data from Health Connect</strong> כבוי. xDrip+ צריכה רק לכתוב לכאן, וכשהקריאה דלוקה יש טלפונים שמציקים בהתראה כל כמה דקות.</p>
<h2>5. מרשים ל־Healthings לקרוא את הגלוקוז</h2>
<ol><li>ב־Healthings: <strong>פרופיל והגדרות</strong> → <strong>GEAR</strong> → <strong>CGM</strong> = <strong>כן</strong>.</li>
<li>מאשרים <strong>Blood Glucose</strong> כשהטלפון מבקש (<strong>Allow access</strong>).</li>
<li>לוחצים על אייקון הרענון למעלה. רצועת הגרף הופכת ל־<strong>GLUCOSE</strong> ומתמלאת כשהמדידות נכנסות.</li></ol>
<p>כבר עם חיישן על הזרוע כמה ימים? <strong>GEAR</strong> → <strong>Import</strong> טוען היסטוריית CSV מ־CareSens, כדי שהימים שקדמו לא יישארו ריקים.</p>
<h2>לא מופיע כלום?</h2>
<ul><li>תנו לזה כרבע שעה — המדידה עוברת שלוש אפליקציות. חיישן חדש גם בחימום בשעות הראשונות.</li>
<li>בודקים ש־CareSens Air עדיין מותקנת ושהמפסק <strong>xDrip+</strong> עדיין דלוק.</li>
<li>ב<strong>הגדרות</strong> הטלפון → <strong>Health Connect</strong> → <strong>App permissions</strong>: ל־xDrip+ מותר לכתוב Blood Glucose, ול־Healthings מותר לקרוא.</li>
<li>חוסך סוללה: מרשים ל־xDrip+ ול־Healthings לעבוד ברקע. אנדרואיד עוצר קודם את האפליקציות השקטות.</li></ul>`),
  ],
  [
    'es',
    'xDrip+ para CareSens Air (Android)',
    'xDrip+ es la integración de CareSens que Healthings usa en Android. Descárgalo aquí y conéctalo una vez: CareSens Air → xDrip+ → Health Connect → Healthings.',
    `<p class="tip"><strong>Solo Android.</strong> En iPhone no existe xDrip+ — allí CareSens Air comparte directamente con Apple Health. Mira <a href="cgm.html">Glucosa CGM</a>.</p>
<p>CareSens Air se guarda las lecturas para sí. xDrip+ es la integración de CareSens en Android: alinea CareSens con Healthings. Se conecta una vez y desde ahí la glucosa llega sola a tu panel.</p>
<p>xDrip+ está en inglés en todos los teléfonos, así que las etiquetas de abajo van tal como las verás.</p>
${XDRIP_MARK}
<p class="help-download"><a href="${XDRIP_APK}" download>Descargar xDrip+ para Android</a></p>
<p class="help-download-note">Unos 16 MB. La integración de CareSens que Healthings usa en Android — <a href="${XDRIP_NOTE}">esta versión</a>, <a href="${XDRIP_SOURCE}" rel="noopener">código en GitHub</a>.</p>
<h2>1. Instala xDrip+</h2>
<ol><li>Toca el botón de arriba desde el propio teléfono. El navegador avisará de un APK: es normal fuera de Play Store.</li>
<li>Abre el archivo descargado. Si Android lo bloquea, permite <strong>Install unknown apps</strong> a tu navegador y ábrelo otra vez.</li>
<li>Abre xDrip+ una vez. Puedes saltarte su asistente de sensor — quien alimenta es CareSens Air.</li></ol>
<h2>2. Deja que CareSens Air hable con xDrip+</h2>
<ol><li>En la app <strong>CareSens Air</strong>, abre <strong>Manage Data &amp; Connections</strong>.</li>
<li>Activa <strong>xDrip+</strong>.</li></ol>
${shot(CARESENS_SHOT, 'CareSens Air, Manage Data and Connections, con el interruptor de xDrip+ activado', 'CareSens Air — el interruptor de xDrip+ activado.')}
<p>Deja CareSens Air instalada y funcionando. Sigue siendo la app que habla con el sensor; xDrip+ solo escucha.</p>
<h2>3. Apunta xDrip+ a la app compañera</h2>
<p>En xDrip+ abre <strong>Settings</strong> → <strong>Hardware Data Source</strong> y elige <strong>Companion App</strong> (en versiones antiguas se llama <strong>640G / Eversense</strong>). En unos minutos debería aparecer un número en la pantalla de inicio de xDrip+.</p>
<h2>4. Envía las lecturas a Health Connect</h2>
<ol><li>xDrip+ → <strong>Settings</strong> → <strong>Inter-app settings</strong>.</li>
<li>Baja hasta <strong>Google Health Connect</strong>.</li>
<li><strong>Use Health Connect</strong> ON, <strong>Send data to Health Connect</strong> ON, <strong>Get data from Health Connect</strong> OFF.</li>
<li>Toca <strong>Manage permissions</strong> y deja que xDrip+ escriba Blood Glucose.</li></ol>
${shot(SETTINGS_SHOT, 'Lista de ajustes de xDrip+ con Inter-app settings arriba', 'Ajustes de xDrip+ — Inter-app settings está arriba.')}
${shot(INTERAPP_SHOT, 'Inter-app settings de xDrip+ con Google Health Connect al final', 'Inter-app settings — Google Health Connect al final.')}
${shot(HC_SHOT, 'Pantalla Google Health Connect de xDrip+: Use Health Connect activado, Get data desactivado, Send data activado', 'Use Health Connect ON, Send data ON, Get data OFF.')}
<p class="tip">Deja <strong>Get data from Health Connect</strong> apagado. xDrip+ solo necesita escribir aquí, y con la lectura activada algunos teléfonos avisan cada pocos minutos.</p>
<h2>5. Deja que Healthings lea la glucosa</h2>
<ol><li>En Healthings: <strong>Perfil y ajustes</strong> → <strong>GEAR</strong> → <strong>CGM</strong> = <strong>Sí</strong>.</li>
<li>Permite <strong>Blood Glucose</strong> cuando el teléfono lo pida (<strong>Allow access</strong>).</li>
<li>Toca el icono de recarga arriba. La franja del gráfico pasa a <strong>GLUCOSE</strong> y se va llenando.</li></ol>
<p>¿Llevas ya días con el sensor? <strong>GEAR</strong> → <strong>Import</strong> carga el historial CSV de CareSens para que los días anteriores no queden vacíos.</p>
<h2>¿No aparece nada?</h2>
<ul><li>Dale unos 15 minutos: la lectura pasa por tres apps. Un sensor nuevo también está en calentamiento las primeras horas.</li>
<li>Comprueba que CareSens Air sigue instalada y el interruptor <strong>xDrip+</strong> sigue activado.</li>
<li><strong>Ajustes</strong> del teléfono → <strong>Health Connect</strong> → <strong>App permissions</strong>: xDrip+ puede escribir Blood Glucose y Healthings puede leerlo.</li>
<li>Ahorro de batería: deja a xDrip+ y a Healthings funcionar en segundo plano. Android detiene primero las apps calladas.</li></ul>`,
  ],
  [
    'fr',
    'xDrip+ pour CareSens Air (Android)',
    'xDrip+ est l’intégration CareSens que Healthings utilise sur Android. Téléchargez-le ici et branchez une fois : CareSens Air → xDrip+ → Health Connect → Healthings.',
    `<p class="tip"><strong>Android seulement.</strong> Sur iPhone, xDrip+ n’existe pas — CareSens Air partage directement avec Apple Health. Voir <a href="cgm.html">Glucose CGM</a>.</p>
<p>CareSens Air garde les mesures pour elle. xDrip+ est l’intégration CareSens sur Android : elle aligne CareSens avec Healthings. On branche une fois, ensuite le glucose arrive tout seul sur le tableau de bord.</p>
<p>xDrip+ est en anglais sur tous les téléphones : les libellés ci-dessous sont cités tels que vous les verrez.</p>
${XDRIP_MARK}
<p class="help-download"><a href="${XDRIP_APK}" download>Télécharger xDrip+ pour Android</a></p>
<p class="help-download-note">Environ 16 Mo. L’intégration CareSens que Healthings utilise sur Android — <a href="${XDRIP_NOTE}">cette version</a>, <a href="${XDRIP_SOURCE}" rel="noopener">code sur GitHub</a>.</p>
<h2>1. Installez xDrip+</h2>
<ol><li>Touchez le bouton ci-dessus depuis le téléphone. Le navigateur alerte sur un APK — normal hors Play Store.</li>
<li>Ouvrez le fichier téléchargé. Si Android refuse, autorisez <strong>Install unknown apps</strong> pour votre navigateur, puis rouvrez-le.</li>
<li>Ouvrez xDrip+ une fois. Vous pouvez passer son assistant capteur — c’est CareSens Air qui alimente.</li></ol>
<h2>2. Laissez CareSens Air parler à xDrip+</h2>
<ol><li>Dans l’app <strong>CareSens Air</strong>, ouvrez <strong>Manage Data &amp; Connections</strong>.</li>
<li>Activez <strong>xDrip+</strong>.</li></ol>
${shot(CARESENS_SHOT, 'CareSens Air, Manage Data and Connections, interrupteur xDrip+ activé', 'CareSens Air — l’interrupteur xDrip+ est activé.')}
<p>Laissez CareSens Air installée et active. Elle reste l’app qui parle au capteur ; xDrip+ ne fait qu’écouter.</p>
<h2>3. Pointez xDrip+ vers l’app compagnon</h2>
<p>Dans xDrip+ : <strong>Settings</strong> → <strong>Hardware Data Source</strong> → choisissez <strong>Companion App</strong> (les anciennes versions l’appellent <strong>640G / Eversense</strong>). En quelques minutes, un chiffre doit apparaître sur l’écran d’accueil de xDrip+.</p>
<h2>4. Envoyez les mesures vers Health Connect</h2>
<ol><li>xDrip+ → <strong>Settings</strong> → <strong>Inter-app settings</strong>.</li>
<li>Descendez jusqu’à <strong>Google Health Connect</strong>.</li>
<li><strong>Use Health Connect</strong> ON, <strong>Send data to Health Connect</strong> ON, <strong>Get data from Health Connect</strong> OFF.</li>
<li>Touchez <strong>Manage permissions</strong> et laissez xDrip+ écrire Blood Glucose.</li></ol>
${shot(SETTINGS_SHOT, 'Liste des réglages xDrip+ avec Inter-app settings en haut', 'Réglages xDrip+ — Inter-app settings est en haut.')}
${shot(INTERAPP_SHOT, 'Inter-app settings de xDrip+ avec Google Health Connect en bas', 'Inter-app settings — Google Health Connect est en bas.')}
${shot(HC_SHOT, 'Écran Google Health Connect de xDrip+ : Use Health Connect activé, Get data désactivé, Send data activé', 'Use Health Connect ON, Send data ON, Get data OFF.')}
<p class="tip">Laissez <strong>Get data from Health Connect</strong> désactivé. xDrip+ n’a qu’à écrire ici, et avec la lecture activée certains téléphones vous alertent toutes les quelques minutes.</p>
<h2>5. Laissez Healthings lire le glucose</h2>
<ol><li>Dans Healthings : <strong>Profil et réglages</strong> → <strong>GEAR</strong> → <strong>CGM</strong> = <strong>Oui</strong>.</li>
<li>Autorisez <strong>Blood Glucose</strong> quand le téléphone le demande (<strong>Allow access</strong>).</li>
<li>Touchez l’icône d’actualisation en haut. La bande du graphique devient <strong>GLUCOSE</strong> et se remplit.</li></ol>
<p>Vous portez le capteur depuis quelques jours ? <strong>GEAR</strong> → <strong>Import</strong> charge l’historique CSV CareSens, pour que les jours passés ne soient pas vides.</p>
<h2>Rien n’arrive ?</h2>
<ul><li>Laissez environ 15 minutes : la mesure traverse trois apps. Un capteur neuf est aussi en préchauffage les premières heures.</li>
<li>Vérifiez que CareSens Air est toujours installée et l’interrupteur <strong>xDrip+</strong> toujours actif.</li>
<li><strong>Réglages</strong> du téléphone → <strong>Health Connect</strong> → <strong>App permissions</strong> : xDrip+ peut écrire Blood Glucose, Healthings peut le lire.</li>
<li>Économiseur de batterie : laissez xDrip+ et Healthings tourner en arrière-plan. Android arrête d’abord les apps silencieuses.</li></ul>`,
  ],
  [
    'de',
    'xDrip+ für CareSens Air (Android)',
    'xDrip+ ist die CareSens-Anbindung, die Healthings auf Android nutzt. Laden Sie sie hier und verbinden Sie einmal: CareSens Air → xDrip+ → Health Connect → Healthings.',
    `<p class="tip"><strong>Nur Android.</strong> Auf dem iPhone gibt es xDrip+ nicht — dort teilt CareSens Air direkt mit Apple Health. Siehe <a href="cgm.html">CGM-Glukose</a>.</p>
<p>CareSens Air behält die Messwerte in der eigenen App. xDrip+ ist die CareSens-Anbindung auf Android — sie bringt CareSens und Healthings zusammen. Einmal verbinden — danach landet Glukose von selbst auf Ihrem Dashboard.</p>
<p>xDrip+ ist auf jedem Telefon englisch, deshalb stehen die Beschriftungen unten genau so, wie Sie sie sehen werden.</p>
${XDRIP_MARK}
<p class="help-download"><a href="${XDRIP_APK}" download>xDrip+ für Android herunterladen</a></p>
<p class="help-download-note">Rund 16 MB. Die CareSens-Anbindung, die Healthings auf Android nutzt — <a href="${XDRIP_NOTE}">diese Version</a>, <a href="${XDRIP_SOURCE}" rel="noopener">Quellcode auf GitHub</a>.</p>
<h2>1. xDrip+ installieren</h2>
<ol><li>Tippen Sie den Button oben direkt auf dem Telefon. Der Browser warnt vor einer APK — außerhalb des Play Store normal.</li>
<li>Öffnen Sie die geladene Datei. Blockt Android, erlauben Sie Ihrem Browser <strong>Install unknown apps</strong> und öffnen sie erneut.</li>
<li>Öffnen Sie xDrip+ einmal. Den Sensor-Assistenten können Sie überspringen — gefüttert wird von CareSens Air.</li></ol>
<h2>2. CareSens Air mit xDrip+ sprechen lassen</h2>
<ol><li>In der <strong>CareSens Air</strong>-App <strong>Manage Data &amp; Connections</strong> öffnen.</li>
<li><strong>xDrip+</strong> einschalten.</li></ol>
${shot(CARESENS_SHOT, 'CareSens Air, Manage Data and Connections, Schalter für xDrip+ ist an', 'CareSens Air — der xDrip+-Schalter ist an.')}
<p>Lassen Sie CareSens Air installiert und laufen. Sie bleibt die App, die mit dem Sensor spricht; xDrip+ hört nur zu.</p>
<h2>3. xDrip+ auf die Companion-App zeigen</h2>
<p>In xDrip+: <strong>Settings</strong> → <strong>Hardware Data Source</strong> → <strong>Companion App</strong> wählen (ältere Builds nennen es <strong>640G / Eversense</strong>). Nach wenigen Minuten sollte auf dem xDrip+-Startbildschirm eine Zahl stehen.</p>
<h2>4. Messwerte an Health Connect senden</h2>
<ol><li>xDrip+ → <strong>Settings</strong> → <strong>Inter-app settings</strong>.</li>
<li>Nach unten bis <strong>Google Health Connect</strong> scrollen.</li>
<li><strong>Use Health Connect</strong> ON, <strong>Send data to Health Connect</strong> ON, <strong>Get data from Health Connect</strong> OFF.</li>
<li><strong>Manage permissions</strong> antippen und xDrip+ das Schreiben von Blood Glucose erlauben.</li></ol>
${shot(SETTINGS_SHOT, 'xDrip+ Einstellungsliste, Inter-app settings oben', 'xDrip+ Settings — Inter-app settings steht oben.')}
${shot(INTERAPP_SHOT, 'xDrip+ Inter-app settings mit Google Health Connect unten', 'Inter-app settings — Google Health Connect unten.')}
${shot(HC_SHOT, 'xDrip+ Google Health Connect: Use Health Connect an, Get data aus, Send data an', 'Use Health Connect ON, Send data ON, Get data OFF.')}
<p class="tip">Lassen Sie <strong>Get data from Health Connect</strong> aus. xDrip+ muss hier nur schreiben — mit aktivem Lesen melden manche Telefone alle paar Minuten eine Warnung.</p>
<h2>5. Healthings die Glukose lesen lassen</h2>
<ol><li>In Healthings: <strong>Profil &amp; Einstellungen</strong> → <strong>GEAR</strong> → <strong>CGM</strong> = <strong>Ja</strong>.</li>
<li><strong>Blood Glucose</strong> erlauben, wenn das Telefon fragt (<strong>Allow access</strong>).</li>
<li>Auf das Aktualisieren-Symbol oben tippen. Der Chart-Streifen wird zu <strong>GLUCOSE</strong> und füllt sich.</li></ol>
<p>Sensor schon länger am Arm? <strong>GEAR</strong> → <strong>Import</strong> lädt die CareSens-CSV-Historie, damit die früheren Tage nicht leer bleiben.</p>
<h2>Es kommt nichts an?</h2>
<ul><li>Geben Sie ihm rund 15 Minuten — ein Messwert läuft durch drei Apps. Ein frischer Sensor ist in den ersten Stunden im Warm-up.</li>
<li>Prüfen: CareSens Air noch installiert, Schalter <strong>xDrip+</strong> noch an?</li>
<li>Telefon-<strong>Einstellungen</strong> → <strong>Health Connect</strong> → <strong>App permissions</strong>: xDrip+ darf Blood Glucose schreiben, Healthings darf es lesen.</li>
<li>Energiesparmodus: xDrip+ und Healthings im Hintergrund laufen lassen. Android stoppt zuerst die stillen Apps.</li></ul>`,
  ],
  [
    'ar',
    ltrPlus('xDrip+ مع CareSens Air (Android)'),
    ltrPlus(
      'xDrip+ هو ربط CareSens الذي تستخدمه Healthings على أندرويد. حمّله من هنا وصِل مرة واحدة: CareSens Air → xDrip+ → Health Connect → Healthings.',
    ),
    ltrPlus(`<p class="tip"><strong>Android فقط.</strong> لا يوجد xDrip+ على iPhone — هناك تشارك CareSens Air مباشرة مع Apple Health. انظر <a href="cgm.html">جلوكوز CGM</a>.</p>
<p>تحتفظ CareSens Air بالقراءات داخل تطبيقها. أما xDrip+ فهو ربط CareSens على أندرويد — هكذا تلتقي CareSens وHealthings. تربط مرة واحدة، وبعدها يصل الجلوكوز إلى لوحتك من تلقاء نفسه.</p>
<p>شاشات xDrip+ بالإنجليزية على كل هاتف، فالأسماء أدناه مكتوبة كما ستراها تماماً.</p>
${XDRIP_MARK}
<p class="help-download"><a href="${XDRIP_APK}" download>تحميل xDrip+ لأندرويد</a></p>
<p class="help-download-note">نحو 16MB. ربط CareSens الذي تستخدمه Healthings على أندرويد — <a href="${XDRIP_NOTE}">هذه النسخة</a>، <a href="${XDRIP_SOURCE}" rel="noopener">الكود على GitHub</a>.</p>
<h2>1. ثبّت xDrip+</h2>
<ol><li>اضغط الزر أعلاه من الهاتف نفسه. سيحذّرك المتصفح من ملف APK — هذا طبيعي خارج Play Store.</li>
<li>افتح الملف بعد التحميل. إن رفض Android، اسمح لمتصفحك بـ <strong>Install unknown apps</strong> ثم افتحه مرة أخرى.</li>
<li>افتح xDrip+ مرة واحدة. يمكنك تخطي معالج الحسّاس — فالتغذية تأتي من CareSens Air.</li></ol>
<h2>2. اسمح لـ CareSens Air بمخاطبة xDrip+</h2>
<ol><li>في تطبيق <strong>CareSens Air</strong> افتح <strong>Manage Data &amp; Connections</strong>.</li>
<li>شغّل <strong>xDrip+</strong>.</li></ol>
${shot(CARESENS_SHOT, 'شاشة Manage Data and Connections في CareSens Air ومفتاح xDrip+ مشغّل', 'CareSens Air — مفتاح xDrip+ مشغّل.')}
<p>اترك CareSens Air مثبتاً وعاملاً. فهو يبقى التطبيق الذي يخاطب الحسّاس، أما xDrip+ فيستمع فقط.</p>
<h2>3. وجّه xDrip+ إلى تطبيق الرفيق</h2>
<p>في xDrip+: <strong>Settings</strong> → <strong>Hardware Data Source</strong> ثم اختر <strong>Companion App</strong> (النسخ القديمة تسميه <strong>640G / Eversense</strong>). خلال دقائق يجب أن يظهر رقم على شاشة xDrip+ الرئيسية.</p>
<h2>4. أرسل القراءات إلى Health Connect</h2>
<ol><li>xDrip+ → <strong>Settings</strong> → <strong>Inter-app settings</strong>.</li>
<li>انزل إلى <strong>Google Health Connect</strong>.</li>
<li><strong>Use Health Connect</strong> ON و<strong>Send data to Health Connect</strong> ON و<strong>Get data from Health Connect</strong> OFF.</li>
<li>اضغط <strong>Manage permissions</strong> واسمح لـ xDrip+ بكتابة Blood Glucose.</li></ol>
${shot(SETTINGS_SHOT, 'قائمة إعدادات xDrip+ وفيها Inter-app settings في الأعلى', 'إعدادات xDrip+ — ‏Inter-app settings في الأعلى.')}
${shot(INTERAPP_SHOT, 'شاشة Inter-app settings في xDrip+ وفي أسفلها Google Health Connect', 'Inter-app settings — ‏Google Health Connect في الأسفل.')}
${shot(HC_SHOT, 'شاشة Google Health Connect في xDrip+: ‏Use Health Connect مشغّل، Get data مطفأ، Send data مشغّل', 'Use Health Connect مشغّل، Send data مشغّل، Get data مطفأ.')}
<p class="tip">اترك <strong>Get data from Health Connect</strong> مطفأً. فـ xDrip+ يحتاج الكتابة هنا فقط، ومع تشغيل القراءة تُزعجك بعض الهواتف بتنبيه كل دقائق.</p>
<h2>5. اسمح لـ Healthings بقراءة الجلوكوز</h2>
<ol><li>في Healthings: <strong>الملف والإعدادات</strong> → <strong>GEAR</strong> → <strong>CGM</strong> = <strong>نعم</strong>.</li>
<li>اسمح بـ <strong>Blood Glucose</strong> عندما يسأل الهاتف (<strong>Allow access</strong>).</li>
<li>اضغط أيقونة التحديث في الأعلى. يتحول شريط الرسم إلى <strong>GLUCOSE</strong> ويمتلئ مع وصول القراءات.</li></ol>
<p>تلبس الحسّاس من أيام؟ <strong>GEAR</strong> → <strong>Import</strong> يحمّل سجل CSV من CareSens حتى لا تبقى الأيام السابقة فارغة.</p>
<h2>لا يظهر شيء؟</h2>
<ul><li>امنحه نحو 15 دقيقة — فالقراءة تمر بثلاثة تطبيقات. والحسّاس الجديد في فترة تسخين أول ساعاته.</li>
<li>تأكد أن CareSens Air ما زال مثبتاً وأن مفتاح <strong>xDrip+</strong> ما زال مشغّلاً.</li>
<li><strong>إعدادات</strong> الهاتف → <strong>Health Connect</strong> → <strong>App permissions</strong>: يُسمح لـ xDrip+ بكتابة Blood Glucose ولـ Healthings بقراءته.</li>
<li>موفّر الطاقة: اسمح لـ xDrip+ و Healthings بالعمل في الخلفية. فأندرويد يوقف التطبيقات الهادئة أولاً.</li></ul>`),
  ],
  [
    'ru',
    'xDrip+ для CareSens Air (Android)',
    'xDrip+ — это подключение CareSens, которым Healthings пользуется на Android. Скачайте здесь и соедините один раз: CareSens Air → xDrip+ → Health Connect → Healthings.',
    `<p class="tip"><strong>Только Android.</strong> На iPhone xDrip+ не существует — там CareSens Air делится напрямую с Apple Health. См. <a href="cgm.html">Глюкоза CGM</a>.</p>
<p>CareSens Air держит показания внутри своего приложения. xDrip+ — это подключение CareSens на Android: оно стыкует CareSens с Healthings. Соединяете один раз — дальше глюкоза приходит на дашборд сама.</p>
<p>xDrip+ на всех телефонах на английском, поэтому названия ниже приведены точно так, как вы их увидите.</p>
${XDRIP_MARK}
<p class="help-download"><a href="${XDRIP_APK}" download>Скачать xDrip+ для Android</a></p>
<p class="help-download-note">Около 16 МБ. Подключение CareSens, которым Healthings пользуется на Android — <a href="${XDRIP_NOTE}">эта сборка</a>, <a href="${XDRIP_SOURCE}" rel="noopener">код на GitHub</a>.</p>
<h2>1. Установите xDrip+</h2>
<ol><li>Нажмите кнопку выше с самого телефона. Браузер предупредит об APK — вне Play Store это нормально.</li>
<li>Откройте скачанный файл. Если Android не пускает, разрешите браузеру <strong>Install unknown apps</strong> и откройте снова.</li>
<li>Откройте xDrip+ один раз. Мастер сенсора можно пропустить — кормить будет CareSens Air.</li></ol>
<h2>2. Разрешите CareSens Air говорить с xDrip+</h2>
<ol><li>В приложении <strong>CareSens Air</strong> откройте <strong>Manage Data &amp; Connections</strong>.</li>
<li>Включите <strong>xDrip+</strong>.</li></ol>
${shot(CARESENS_SHOT, 'CareSens Air, экран Manage Data and Connections, переключатель xDrip+ включён', 'CareSens Air — переключатель xDrip+ включён.')}
<p>Оставьте CareSens Air установленным и работающим. Он остаётся тем, кто говорит с сенсором; xDrip+ только слушает.</p>
<h2>3. Укажите xDrip+ на приложение-компаньон</h2>
<p>В xDrip+ откройте <strong>Settings</strong> → <strong>Hardware Data Source</strong> и выберите <strong>Companion App</strong> (в старых сборках это <strong>640G / Eversense</strong>). Через несколько минут на главном экране xDrip+ должно появиться число.</p>
<h2>4. Отправьте показания в Health Connect</h2>
<ol><li>xDrip+ → <strong>Settings</strong> → <strong>Inter-app settings</strong>.</li>
<li>Прокрутите вниз до <strong>Google Health Connect</strong>.</li>
<li><strong>Use Health Connect</strong> ON, <strong>Send data to Health Connect</strong> ON, <strong>Get data from Health Connect</strong> OFF.</li>
<li>Нажмите <strong>Manage permissions</strong> и разрешите xDrip+ записывать Blood Glucose.</li></ol>
${shot(SETTINGS_SHOT, 'Список настроек xDrip+, Inter-app settings сверху', 'Настройки xDrip+ — Inter-app settings сверху.')}
${shot(INTERAPP_SHOT, 'Inter-app settings в xDrip+, Google Health Connect внизу', 'Inter-app settings — Google Health Connect внизу.')}
${shot(HC_SHOT, 'Экран Google Health Connect в xDrip+: Use Health Connect включено, Get data выключено, Send data включено', 'Use Health Connect ON, Send data ON, Get data OFF.')}
<p class="tip">Оставьте <strong>Get data from Health Connect</strong> выключенным. xDrip+ нужно только писать сюда, а с включённым чтением некоторые телефоны напоминают о себе каждые несколько минут.</p>
<h2>5. Разрешите Healthings читать глюкозу</h2>
<ol><li>В Healthings: <strong>Профиль и настройки</strong> → <strong>GEAR</strong> → <strong>CGM</strong> = <strong>Да</strong>.</li>
<li>Разрешите <strong>Blood Glucose</strong>, когда телефон спросит (<strong>Allow access</strong>).</li>
<li>Нажмите значок обновления сверху. Полоса графика станет <strong>GLUCOSE</strong> и заполнится по мере поступления данных.</li></ol>
<p>Носите сенсор уже несколько дней? <strong>GEAR</strong> → <strong>Import</strong> загрузит историю CSV из CareSens, чтобы прошлые дни не пустовали.</p>
<h2>Ничего не приходит?</h2>
<ul><li>Дайте минут 15 — показание идёт через три приложения. Новый сенсор первые часы ещё прогревается.</li>
<li>Проверьте, что CareSens Air на месте и переключатель <strong>xDrip+</strong> всё ещё включён.</li>
<li><strong>Настройки</strong> телефона → <strong>Health Connect</strong> → <strong>App permissions</strong>: xDrip+ может писать Blood Glucose, Healthings — читать.</li>
<li>Экономия батареи: разрешите xDrip+ и Healthings работать в фоне. Android первым останавливает тихие приложения.</li></ul>`,
  ],
  [
    'pt',
    'xDrip+ para CareSens Air (Android)',
    'O xDrip+ é a integração da CareSens que a Healthings usa no Android. Descarregue aqui e ligue uma vez: CareSens Air → xDrip+ → Health Connect → Healthings.',
    `<p class="tip"><strong>Só Android.</strong> No iPhone não existe xDrip+ — aí o CareSens Air partilha direto com o Apple Health. Veja <a href="cgm.html">Glicose CGM</a>.</p>
<p>O CareSens Air guarda as leituras dentro da própria app. O xDrip+ é a integração da CareSens no Android — alinha a CareSens com a Healthings. Liga-se uma vez e depois a glicose chega ao painel sozinha.</p>
<p>O xDrip+ está em inglês em todos os telemóveis, por isso os nomes abaixo estão como os vai ver.</p>
${XDRIP_MARK}
<p class="help-download"><a href="${XDRIP_APK}" download>Descarregar xDrip+ para Android</a></p>
<p class="help-download-note">Cerca de 16 MB. A integração da CareSens que a Healthings usa no Android — <a href="${XDRIP_NOTE}">esta versão</a>, <a href="${XDRIP_SOURCE}" rel="noopener">código no GitHub</a>.</p>
<h2>1. Instale o xDrip+</h2>
<ol><li>Toque no botão acima no próprio telemóvel. O navegador avisa que é um APK — normal fora da Play Store.</li>
<li>Abra o ficheiro descarregado. Se o Android bloquear, permita <strong>Install unknown apps</strong> ao navegador e abra outra vez.</li>
<li>Abra o xDrip+ uma vez. Pode saltar o assistente de sensor — quem alimenta é o CareSens Air.</li></ol>
<h2>2. Deixe o CareSens Air falar com o xDrip+</h2>
<ol><li>Na app <strong>CareSens Air</strong>, abra <strong>Manage Data &amp; Connections</strong>.</li>
<li>Ligue o <strong>xDrip+</strong>.</li></ol>
${shot(CARESENS_SHOT, 'CareSens Air, Manage Data and Connections, interruptor do xDrip+ ligado', 'CareSens Air — o interruptor do xDrip+ está ligado.')}
<p>Deixe o CareSens Air instalado e a funcionar. Continua a ser a app que fala com o sensor; o xDrip+ só ouve.</p>
<h2>3. Aponte o xDrip+ à app companheira</h2>
<p>No xDrip+: <strong>Settings</strong> → <strong>Hardware Data Source</strong> → escolha <strong>Companion App</strong> (versões antigas chamam-lhe <strong>640G / Eversense</strong>). Em poucos minutos deve aparecer um número no ecrã inicial do xDrip+.</p>
<h2>4. Envie as leituras para o Health Connect</h2>
<ol><li>xDrip+ → <strong>Settings</strong> → <strong>Inter-app settings</strong>.</li>
<li>Desça até <strong>Google Health Connect</strong>.</li>
<li><strong>Use Health Connect</strong> ON, <strong>Send data to Health Connect</strong> ON, <strong>Get data from Health Connect</strong> OFF.</li>
<li>Toque em <strong>Manage permissions</strong> e deixe o xDrip+ escrever Blood Glucose.</li></ol>
${shot(SETTINGS_SHOT, 'Lista de definições do xDrip+ com Inter-app settings no topo', 'Definições do xDrip+ — Inter-app settings fica no topo.')}
${shot(INTERAPP_SHOT, 'Inter-app settings do xDrip+ com Google Health Connect no fim', 'Inter-app settings — Google Health Connect no fim.')}
${shot(HC_SHOT, 'Ecrã Google Health Connect do xDrip+: Use Health Connect ligado, Get data desligado, Send data ligado', 'Use Health Connect ON, Send data ON, Get data OFF.')}
<p class="tip">Deixe <strong>Get data from Health Connect</strong> desligado. O xDrip+ só precisa de escrever aqui e, com a leitura ligada, alguns telemóveis avisam a cada poucos minutos.</p>
<h2>5. Deixe o Healthings ler a glicose</h2>
<ol><li>No Healthings: <strong>Perfil e definições</strong> → <strong>GEAR</strong> → <strong>CGM</strong> = <strong>Sim</strong>.</li>
<li>Permita <strong>Blood Glucose</strong> quando o telemóvel pedir (<strong>Allow access</strong>).</li>
<li>Toque no ícone de atualizar no topo. A faixa do gráfico passa a <strong>GLUCOSE</strong> e enche-se com as leituras.</li></ol>
<p>Já usa o sensor há dias? <strong>GEAR</strong> → <strong>Import</strong> carrega o histórico CSV do CareSens, para os dias anteriores não ficarem vazios.</p>
<h2>Não aparece nada?</h2>
<ul><li>Dê cerca de 15 minutos — a leitura atravessa três apps. Um sensor novo também está em aquecimento nas primeiras horas.</li>
<li>Confirme que o CareSens Air continua instalado e o interruptor <strong>xDrip+</strong> ligado.</li>
<li><strong>Definições</strong> do telemóvel → <strong>Health Connect</strong> → <strong>App permissions</strong>: o xDrip+ pode escrever Blood Glucose e o Healthings pode ler.</li>
<li>Poupança de bateria: deixe o xDrip+ e o Healthings correr em segundo plano. O Android para primeiro as apps caladas.</li></ul>`,
  ],
  [
    'it',
    'xDrip+ per CareSens Air (Android)',
    'xDrip+ è l’integrazione CareSens che Healthings usa su Android. Scaricalo qui e collega una volta: CareSens Air → xDrip+ → Health Connect → Healthings.',
    `<p class="tip"><strong>Solo Android.</strong> Su iPhone xDrip+ non esiste — lì CareSens Air condivide direttamente con Apple Health. Vedi <a href="cgm.html">Glucosio CGM</a>.</p>
<p>CareSens Air tiene le letture dentro la propria app. xDrip+ è l’integrazione CareSens su Android: allinea CareSens con Healthings. Si collega una volta e poi il glucosio arriva sulla dashboard da solo.</p>
<p>xDrip+ è in inglese su ogni telefono, quindi le voci qui sotto sono citate come le vedrai.</p>
${XDRIP_MARK}
<p class="help-download"><a href="${XDRIP_APK}" download>Scarica xDrip+ per Android</a></p>
<p class="help-download-note">Circa 16 MB. L’integrazione CareSens che Healthings usa su Android — <a href="${XDRIP_NOTE}">questa versione</a>, <a href="${XDRIP_SOURCE}" rel="noopener">codice su GitHub</a>.</p>
<h2>1. Installa xDrip+</h2>
<ol><li>Tocca il pulsante qui sopra dal telefono. Il browser avvisa che è un APK — normale fuori dal Play Store.</li>
<li>Apri il file scaricato. Se Android blocca, consenti al browser <strong>Install unknown apps</strong> e riaprilo.</li>
<li>Apri xDrip+ una volta. Puoi saltare la procedura del sensore — chi alimenta è CareSens Air.</li></ol>
<h2>2. Fai parlare CareSens Air con xDrip+</h2>
<ol><li>Nell’app <strong>CareSens Air</strong> apri <strong>Manage Data &amp; Connections</strong>.</li>
<li>Attiva <strong>xDrip+</strong>.</li></ol>
${shot(CARESENS_SHOT, 'CareSens Air, Manage Data and Connections, interruttore xDrip+ attivo', 'CareSens Air — l’interruttore xDrip+ è attivo.')}
<p>Lascia CareSens Air installata e attiva. Resta l’app che parla col sensore; xDrip+ si limita ad ascoltare.</p>
<h2>3. Punta xDrip+ sull’app compagna</h2>
<p>In xDrip+: <strong>Settings</strong> → <strong>Hardware Data Source</strong> e scegli <strong>Companion App</strong> (nelle build vecchie si chiama <strong>640G / Eversense</strong>). In pochi minuti sulla home di xDrip+ dovrebbe apparire un numero.</p>
<h2>4. Manda le letture a Health Connect</h2>
<ol><li>xDrip+ → <strong>Settings</strong> → <strong>Inter-app settings</strong>.</li>
<li>Scendi fino a <strong>Google Health Connect</strong>.</li>
<li><strong>Use Health Connect</strong> ON, <strong>Send data to Health Connect</strong> ON, <strong>Get data from Health Connect</strong> OFF.</li>
<li>Tocca <strong>Manage permissions</strong> e consenti a xDrip+ di scrivere Blood Glucose.</li></ol>
${shot(SETTINGS_SHOT, 'Elenco impostazioni di xDrip+ con Inter-app settings in alto', 'Impostazioni xDrip+ — Inter-app settings è in alto.')}
${shot(INTERAPP_SHOT, 'Inter-app settings di xDrip+ con Google Health Connect in fondo', 'Inter-app settings — Google Health Connect in fondo.')}
${shot(HC_SHOT, 'Schermata Google Health Connect di xDrip+: Use Health Connect attivo, Get data disattivo, Send data attivo', 'Use Health Connect ON, Send data ON, Get data OFF.')}
<p class="tip">Lascia <strong>Get data from Health Connect</strong> disattivo. xDrip+ qui deve solo scrivere e, con la lettura attiva, alcuni telefoni avvisano ogni pochi minuti.</p>
<h2>5. Fai leggere il glucosio a Healthings</h2>
<ol><li>In Healthings: <strong>Profilo e impostazioni</strong> → <strong>GEAR</strong> → <strong>CGM</strong> = <strong>Sì</strong>.</li>
<li>Consenti <strong>Blood Glucose</strong> quando il telefono lo chiede (<strong>Allow access</strong>).</li>
<li>Tocca l’icona di aggiornamento in alto. La striscia del grafico diventa <strong>GLUCOSE</strong> e si riempie.</li></ol>
<p>Porti il sensore già da giorni? <strong>GEAR</strong> → <strong>Import</strong> carica lo storico CSV di CareSens, così i giorni precedenti non restano vuoti.</p>
<h2>Non arriva niente?</h2>
<ul><li>Dagli una quindicina di minuti: la lettura attraversa tre app. Un sensore nuovo è anche in warm-up nelle prime ore.</li>
<li>Controlla che CareSens Air sia ancora installata e l’interruttore <strong>xDrip+</strong> ancora attivo.</li>
<li><strong>Impostazioni</strong> del telefono → <strong>Health Connect</strong> → <strong>App permissions</strong>: xDrip+ può scrivere Blood Glucose, Healthings può leggerlo.</li>
<li>Risparmio energetico: lascia xDrip+ e Healthings girare in background. Android ferma prima le app silenziose.</li></ul>`,
  ],
  [
    'tr',
    'CareSens Air için xDrip+ (Android)',
    'xDrip+, Healthings’in Android’de kullandığı CareSens entegrasyonudur. Buradan indirin ve bir kez bağlayın: CareSens Air → xDrip+ → Health Connect → Healthings.',
    `<p class="tip"><strong>Yalnızca Android.</strong> iPhone’da xDrip+ yok — orada CareSens Air doğrudan Apple Health ile paylaşır. Bkz. <a href="cgm.html">CGM glikoz</a>.</p>
<p>CareSens Air ölçümleri kendi uygulamasında tutar. xDrip+ ise Android’deki CareSens entegrasyonu — CareSens ile Healthings’i hizalar. Bir kez bağlarsınız; sonrasında glikoz panonuza kendiliğinden düşer.</p>
<p>xDrip+ her telefonda İngilizcedir, bu yüzden aşağıdaki etiketler göreceğiniz gibi yazılmıştır.</p>
${XDRIP_MARK}
<p class="help-download"><a href="${XDRIP_APK}" download>Android için xDrip+ indir</a></p>
<p class="help-download-note">Yaklaşık 16 MB. Healthings’in Android’de kullandığı CareSens entegrasyonu — <a href="${XDRIP_NOTE}">bu sürüm</a>, <a href="${XDRIP_SOURCE}" rel="noopener">kaynak GitHub’da</a>.</p>
<h2>1. xDrip+’ı kurun</h2>
<ol><li>Yukarıdaki düğmeye telefonun kendisinden dokunun. Tarayıcı APK için uyarır — Play Store dışında normaldir.</li>
<li>İnen dosyayı açın. Android engellerse tarayıcınıza <strong>Install unknown apps</strong> izni verip yeniden açın.</li>
<li>xDrip+’ı bir kez açın. Sensör sihirbazını atlayabilirsiniz — besleyen CareSens Air olacak.</li></ol>
<h2>2. CareSens Air’in xDrip+ ile konuşmasına izin verin</h2>
<ol><li><strong>CareSens Air</strong> uygulamasında <strong>Manage Data &amp; Connections</strong>’ı açın.</li>
<li><strong>xDrip+</strong>’ı açın.</li></ol>
${shot(CARESENS_SHOT, 'CareSens Air, Manage Data and Connections ekranı, xDrip+ anahtarı açık', 'CareSens Air — xDrip+ anahtarı açık.')}
<p>CareSens Air’i kurulu ve çalışır bırakın. Sensörle konuşan uygulama o kalır; xDrip+ yalnızca dinler.</p>
<h2>3. xDrip+’ı eşlik eden uygulamaya yönlendirin</h2>
<p>xDrip+’ta <strong>Settings</strong> → <strong>Hardware Data Source</strong> → <strong>Companion App</strong>’i seçin (eski sürümlerde <strong>640G / Eversense</strong> adıyla geçer). Birkaç dakika içinde xDrip+ ana ekranında bir sayı görünmeli.</p>
<h2>4. Ölçümleri Health Connect’e gönderin</h2>
<ol><li>xDrip+ → <strong>Settings</strong> → <strong>Inter-app settings</strong>.</li>
<li>Aşağıda <strong>Google Health Connect</strong>’e inin.</li>
<li><strong>Use Health Connect</strong> ON, <strong>Send data to Health Connect</strong> ON, <strong>Get data from Health Connect</strong> OFF.</li>
<li><strong>Manage permissions</strong>’a dokunup xDrip+’a Blood Glucose yazma izni verin.</li></ol>
${shot(SETTINGS_SHOT, 'xDrip+ ayarlar listesi, Inter-app settings üstte', 'xDrip+ Settings — Inter-app settings üstte.')}
${shot(INTERAPP_SHOT, 'xDrip+ Inter-app settings ekranı, Google Health Connect en altta', 'Inter-app settings — Google Health Connect en altta.')}
${shot(HC_SHOT, 'xDrip+ Google Health Connect ekranı: Use Health Connect açık, Get data kapalı, Send data açık', 'Use Health Connect ON, Send data ON, Get data OFF.')}
<p class="tip"><strong>Get data from Health Connect</strong>’i kapalı bırakın. xDrip+’ın buraya yalnızca yazması gerekir; okuma açıkken bazı telefonlar birkaç dakikada bir uyarı gösterir.</p>
<h2>5. Healthings’in glikozu okumasına izin verin</h2>
<ol><li>Healthings’te: <strong>Profil ve ayarlar</strong> → <strong>GEAR</strong> → <strong>CGM</strong> = <strong>Evet</strong>.</li>
<li>Telefon sorduğunda <strong>Blood Glucose</strong>’a izin verin (<strong>Allow access</strong>).</li>
<li>Üstteki yenile simgesine dokunun. Grafik şeridi <strong>GLUCOSE</strong>’a döner ve ölçümler geldikçe dolar.</li></ol>
<p>Sensörü günlerdir takıyorsanız: <strong>GEAR</strong> → <strong>Import</strong> CareSens CSV geçmişini yükler, böylece önceki günler boş kalmaz.</p>
<h2>Hiçbir şey gelmiyor mu?</h2>
<ul><li>15 dakika kadar verin — ölçüm üç uygulamadan geçiyor. Yeni sensör ilk saatlerde ısınma modundadır.</li>
<li>CareSens Air’in kurulu ve <strong>xDrip+</strong> anahtarının açık olduğunu kontrol edin.</li>
<li>Telefon <strong>Ayarlar</strong> → <strong>Health Connect</strong> → <strong>App permissions</strong>: xDrip+ Blood Glucose yazabilsin, Healthings okuyabilsin.</li>
<li>Pil tasarrufu: xDrip+ ve Healthings’in arka planda çalışmasına izin verin. Android önce sessiz uygulamaları durdurur.</li></ul>`,
  ],
]);

bulk('withings-link', [
  ['en', 'Link Withings', 'Sign in with the same account as the Withings app. One link covers scale and watch.', `<p>You can skip and link later in <strong>Profile</strong>.</p>`],
  ['he', 'חיבור Withings', 'אותו חשבון כמו באפליקציית Withings. חיבור אחד — למשקל ולשעון.', `<p>אפשר לדלג ולחבר אחר כך ב־<strong>פרופיל</strong>.</p>`],
  ['es', 'Vincular Withings', 'La misma cuenta que en la app Withings. Un vínculo cubre báscula y reloj.', `<p>Puedes saltarlo y vincular después en <strong>Perfil</strong>.</p>`],
  ['fr', 'Lier Withings', 'Le même compte que l’app Withings. Une liaison pour balance et montre.', `<p>Vous pouvez passer et lier plus tard dans <strong>Profil</strong>.</p>`],
  ['de', 'Withings verbinden', 'Dasselbe Konto wie in der Withings-App. Ein Link für Waage und Uhr.', `<p>Sie können überspringen und später unter <strong>Profil</strong> verbinden.</p>`],
  ['ar', 'ربط Withings', 'نفس حساب تطبيق Withings. ربط واحد للميزان والساعة.', `<p>يمكن التخطي والربط لاحقاً من <strong>الملف</strong>.</p>`],
  ['ru', 'Связь Withings', 'Тот же аккаунт, что в приложении Withings. Одна связь — весы и часы.', `<p>Можно пропустить и связать позже в разделе <strong>Профиль</strong>.</p>`],
  ['pt', 'Ligar Withings', 'A mesma conta da app Withings. Uma ligação cobre balança e relógio.', `<p>Pode saltar e ligar depois em <strong>Perfil</strong>.</p>`],
  ['it', 'Collega Withings', 'Lo stesso account dell’app Withings. Un link copre bilancia e orologio.', `<p>Puoi saltare e collegare dopo in <strong>Profilo</strong>.</p>`],
  ['tr', 'Withings bağla', 'Withings uygulamasıyla aynı hesap. Tek bağlantı tartı ve saati kapsar.', `<p>Atlayıp sonra <strong>Profil</strong> içinden bağlayabilirsiniz.</p>`],
]);

bulk('starting-weight', [
  ['en', 'Starting weight', 'Needed for targets and energy balance. Enter now or wait for Withings cloud sync.', `<p>If linked but not synced yet, type a weight or tap Next.</p>`],
  ['he', 'משקל התחלתי', 'נחוץ ליעדים ולמאזן אנרגיה. מזינים עכשיו או מחכים לסנכרון Withings.', `<p>מחוברים ועדיין אין סנכרון — מזינים ידנית או ממשיכים.</p>`],
  ['es', 'Peso inicial', 'Hace falta para objetivos y balance de energía. Ahora o cuando sincronice Withings.', `<p>Si ya vinculaste y aún no hay sync, escribe el peso o sigue.</p>`],
  ['fr', 'Poids de départ', 'Nécessaire pour les objectifs et le bilan énergétique. Maintenant ou après sync Withings.', `<p>Si lié mais pas encore synchronisé — saisissez ou continuez.</p>`],
  ['de', 'Startgewicht', 'Für Ziele und Energiebilanz. Jetzt eingeben oder auf Withings-Sync warten.', `<p>Verknüpft, aber noch kein Sync — Gewicht tippen oder weiter.</p>`],
  ['ar', 'الوزن الابتدائي', 'مطلوب للأهداف وتوازن الطاقة. أدخله الآن أو انتظر مزامنة Withings.', `<p>إن رُبط دون مزامنة بعد — أدخل الوزن أو تابع.</p>`],
  ['ru', 'Стартовый вес', 'Нужен для целей и энергобаланса. Сейчас или после синхронизации Withings.', `<p>Если связь есть, а синка ещё нет — введите вес или идите дальше.</p>`],
  ['pt', 'Peso inicial', 'Preciso para metas e balanço energético. Agora ou após sync Withings.', `<p>Se ligado mas ainda sem sync — escreva o peso ou continue.</p>`],
  ['it', 'Peso iniziale', 'Serve per obiettivi e bilancio energetico. Ora o dopo sync Withings.', `<p>Se collegato ma non ancora sincronizzato — digita il peso o continua.</p>`],
  ['tr', 'Başlangıç kilosu', 'Hedefler ve enerji dengesi için gerekir. Şimdi girin veya Withings senkronunu bekleyin.', `<p>Bağlı ama henüz senkron yoksa — kilo yazın veya devam edin.</p>`],
]);

bulk('phone-health-activity', [
  ['en', 'Phone health', 'Allow Health Connect or Apple Health for steps and heart rate when a Withings watch is off.', `<p>Tap Next — the system may ask once. Use Allow access when shown.</p>`],
  ['he', 'בריאות מהטלפון', 'אישור Health Connect או Apple Health לצעידים ודופק כששעון Withings לא פעיל.', `<p>לוחצים המשך — המערכת עלולה לבקש פעם אחת. Allow access כשמופיע.</p>`],
  ['es', 'Salud del teléfono', 'Permite Health Connect o Apple Health para pasos y pulso si el reloj Withings está apagado.', `<p>Pulsa Continuar — el sistema puede pedir permiso una vez.</p>`],
  ['fr', 'Santé du téléphone', 'Autorisez Health Connect ou Apple Health pour pas et pouls si la montre Withings est off.', `<p>Appuyez sur Continuer — une demande système peut apparaître une fois.</p>`],
  ['de', 'Telefon-Gesundheit', 'Health Connect oder Apple Health für Schritte und Puls, wenn die Withings-Uhr aus ist.', `<p>Weiter tippen — das System fragt ggf. einmal nach.</p>`],
  ['ar', 'صحة الهاتف', 'اسمح لـ Health Connect أو Apple Health بالخطوات والنبض عند إيقاف ساعة Withings.', `<p>اضغط متابعة — قد يطلب النظام الإذن مرة واحدة.</p>`],
  ['ru', 'Здоровье телефона', 'Разрешите Health Connect или Apple Health для шагов и пульса, если часы Withings выключены.', `<p>Нажмите Далее — система может спросить один раз.</p>`],
  ['pt', 'Saúde do telemóvel', 'Permita Health Connect ou Apple Health para passos e pulso se o relógio Withings estiver off.', `<p>Toque Continuar — o sistema pode pedir permissão uma vez.</p>`],
  ['it', 'Salute del telefono', 'Consenti Health Connect o Apple Health per passi e battito se l’orologio Withings è off.', `<p>Tocca Continua — il sistema può chiedere il permesso una volta.</p>`],
  ['tr', 'Telefon sağlığı', 'Withings saat kapalıyken adım ve nabız için Health Connect veya Apple Health’e izin verin.', `<p>Devam’a dokunun — sistem bir kez izin isteyebilir.</p>`],
]);

bulk('reports-import', [
  ['en', 'Optional reports', 'Import a lab PDF or nutritionist session summary — or skip and do it later in the app.', `<p>Labs help macro targets. Session text feeds the coaches under My Rules.</p>`],
  ['he', 'דוחות — לא חובה', 'ייבוא PDF מעבדה או סיכום מול תזונאי — או דילוג ועשייה אחר כך באפליקציה.', `<p>מעבדה עוזרת ליעדי מאקרו. סיכום ביקור תומך במאמנים לפי My Rules.</p>`],
  ['es', 'Informes opcionales', 'Importa un PDF de lab o un resumen con el nutricionista — o hazlo después en la app.', `<p>El lab afina macros. El resumen de visita alimenta a los coaches bajo My Rules.</p>`],
  ['fr', 'Rapports optionnels', 'Importez un PDF labo ou un compte-rendu nutritionniste — ou plus tard dans l’app.', `<p>Le labo affine les macros. Le compte-rendu nourrit les coaches sous My Rules.</p>`],
  ['de', 'Optionale Berichte', 'Lab-PDF oder Ernährungs-Zusammenfassung importieren — oder später in der App.', `<p>Lab hilft bei Makros. Besuchstext stützt die Coaches unter My Rules.</p>`],
  ['ar', 'تقارير اختيارية', 'استورد PDF مختبر أو ملخص جلسة تغذية — أو افعل ذلك لاحقاً في التطبيق.', `<p>المختبر يساعد أهداف الماكرو. ملخص الزيارة يغذي المدربين وفق My Rules.</p>`],
  ['ru', 'Отчёты по желанию', 'Импорт PDF анализов или саммари с нутрициологом — или позже в приложении.', `<p>Анализы помогают макросам. Текст визита кормит коучей по My Rules.</p>`],
  ['pt', 'Relatórios opcionais', 'Importe um PDF de lab ou um resumo com o nutricionista — ou faça depois na app.', `<p>O lab ajuda macros. O texto da sessão alimenta os coaches sob My Rules.</p>`],
  ['it', 'Report opzionali', 'Importa un PDF lab o un riepilogo con il nutrizionista — o fallo dopo nell’app.', `<p>Il lab aiuta i macro. Il testo della sessione alimenta i coach sotto My Rules.</p>`],
  ['tr', 'İsteğe bağlı raporlar', 'Lab PDF’si veya diyetisyen oturum özeti içe aktarın — veya sonra uygulamada yapın.', `<p>Lab makrolara yardımcı olur. Oturum metni My Rules altındaki koçları besler.</p>`],
]);

bulk('targets-help', [
  ['en', 'Your targets', 'AI suggests body and macro targets from your profile. Saved targets keep My Rules.', `<p>Regenerate only if you want fresh AI numbers.</p>`],
  ['he', 'היעדים שלכם', 'ה־AI מציע יעדי גוף ומאקרו לפי הפרופיל. יעדים שמורים שומרים על My Rules.', `<p>«יצירה מחדש» — רק אם רוצים מספרים חדשים מה־AI.</p>`],
  ['es', 'Tus objetivos', 'La IA propone cuerpo y macros según tu perfil. Los guardados conservan My Rules.', `<p>Regenera solo si quieres números nuevos de la IA.</p>`],
  ['fr', 'Vos objectifs', 'L’IA propose corps et macros selon le profil. Les objectifs sauvés gardent My Rules.', `<p>Régénérez seulement pour de nouveaux chiffres IA.</p>`],
  ['de', 'Ihre Ziele', 'Die KI schlägt Körper- und Makroziele aus dem Profil vor. Gespeicherte behalten My Rules.', `<p>Neu erzeugen nur, wenn Sie frische KI-Zahlen wollen.</p>`],
  ['ar', 'أهدافك', 'يقترح الذكاء أهداف الجسم والماكرو من ملفك. المحفوظة تبقي My Rules.', `<p>أعد التوليد فقط إذا أردت أرقاماً جديدة من الذكاء.</p>`],
  ['ru', 'Ваши цели', 'ИИ предлагает цели по телу и макросам из профиля. Сохранённые держат My Rules.', `<p>Пересчёт — только если нужны новые цифры от ИИ.</p>`],
  ['pt', 'As suas metas', 'A IA sugere corpo e macros a partir do perfil. Metas guardadas mantêm My Rules.', `<p>Regenere só se quiser números novos da IA.</p>`],
  ['it', 'I tuoi obiettivi', 'L’IA suggerisce corpo e macro dal profilo. Gli obiettivi salvati tengono My Rules.', `<p>Rigenera solo se vuoi numeri freschi dall’IA.</p>`],
  ['tr', 'Hedefleriniz', 'YZ profilinizden beden ve makro hedefleri önerir. Kayıtlı hedefler My Rules’u korur.', `<p>Yalnızca yeni YZ sayıları istiyorsanız yeniden oluşturun.</p>`],
]);

bulk('meal-logging', [
  ['en', 'How to log meals', 'Log what you eat. The coach checks the meal against My Rules and your daily targets, and flags conflicts before it is saved.', `<ol><li>In <strong>FOOD LOG</strong>, tap <strong>Meal</strong>.</li><li><strong>Photo</strong> — snap the plate; approve AI items.</li><li><strong>Text</strong> — describe the meal; AI parses macros.</li><li>Coach chat can suggest logs — save via the food log.</li></ol>`],
  ['he', 'איך רושמים ארוחה', 'רושמים מה אוכלים. המאמן בודק את הארוחה מול My Rules והיעדים היומיים, ומסמן התנגשויות לפני השמירה.', `<ol><li>ב<strong>יומן ארוחות</strong> לוחצים <strong>ארוחה</strong>.</li><li><strong>תמונה</strong> — מצלמים את הצלחת ומאשרים.</li><li><strong>טקסט</strong> — כותבים מה אכלתם; ה־AI מפרק למקרו.</li><li>אפשר גם מהצ׳אט — השמירה ביומן האוכל.</li></ol>`],
  ['es', 'Cómo registrar comidas', 'Registra lo que comes. El coach revisa la comida frente a My Rules y tus objetivos diarios, y marca los conflictos antes de guardar.', `<ol><li>En <strong>DIARIO DE COMIDAS</strong>, toca <strong>Comida</strong>.</li><li><strong>Foto</strong> — captura el plato y aprueba.</li><li><strong>Texto</strong> — describe; la IA calcula macros.</li><li>El chat puede sugerir — se guarda en el food log.</li></ol>`],
  ['fr', 'Comment logger les repas', 'Enregistrez ce que vous mangez. Le coach compare le repas à My Rules et à vos objectifs du jour, et signale les conflits avant l’enregistrement.', `<ol><li>Dans <strong>JOURNAL DES REPAS</strong>, touchez <strong>Repas</strong>.</li><li><strong>Photo</strong> — plate, puis validation.</li><li><strong>Texte</strong> — description ; l’IA sort les macros.</li><li>Le chat peut proposer — sauvegarde via le food log.</li></ol>`],
  ['de', 'Mahlzeiten erfassen', 'Erfassen, was Sie essen. Der Coach prüft die Mahlzeit gegen My Rules und Ihre Tagesziele und markiert Konflikte vor dem Speichern.', `<ol><li>Im <strong>ESSENSTAGEBUCH</strong> auf <strong>Mahlzeit</strong> tippen.</li><li><strong>Foto</strong> — Teller aufnehmen und bestätigen.</li><li><strong>Text</strong> — beschreiben; KI zerlegt Makros.</li><li>Chat kann vorschlagen — Speichern im Food-Log.</li></ol>`],
  ['ar', 'كيف تسجّل الوجبات', 'سجّل ما تأكله. يفحص المدرب الوجبة مقابل My Rules وأهدافك اليومية، ويشير إلى التعارضات قبل الحفظ.', `<ol><li>في <strong>سجل الوجبات</strong> اضغط <strong>وجبة</strong>.</li><li><strong>صورة</strong> — صوّر الطبق ووافق.</li><li><strong>نص</strong> — صف الوجبة؛ الذكاء يفك الماكرو.</li><li>الدردشة قد تقترح — الحفظ عبر سجل الطعام.</li></ol>`],
  ['ru', 'Как логировать еду', 'Записывайте, что едите. Коуч сверяет приём пищи с My Rules и дневными целями и помечает конфликты до сохранения.', `<ol><li>В <strong>ДНЕВНИКЕ ПИТАНИЯ</strong> нажмите <strong>Приём пищи</strong>.</li><li><strong>Фото</strong> — снимите тарелку и подтвердите.</li><li><strong>Текст</strong> — опишите; ИИ разберёт макросы.</li><li>Чат может предложить — сохранение в food log.</li></ol>`],
  ['pt', 'Como registar refeições', 'Registe o que come. O coach compara a refeição com My Rules e as suas metas diárias e sinaliza conflitos antes de guardar.', `<ol><li>No <strong>DIÁRIO ALIMENTAR</strong>, toque em <strong>Refeição</strong>.</li><li><strong>Foto</strong> — tire a foto do prato e aprove.</li><li><strong>Texto</strong> — descreva; a IA calcula macros.</li><li>O chat pode sugerir — grava no food log.</li></ol>`],
  ['it', 'Come registrare i pasti', 'Registra ciò che mangi. Il coach confronta il pasto con My Rules e i tuoi obiettivi giornalieri e segnala i conflitti prima del salvataggio.', `<ol><li>In <strong>DIARIO PASTI</strong>, tocca <strong>Pasto</strong>.</li><li><strong>Foto</strong> — scatta il piatto e approva.</li><li><strong>Testo</strong> — descrivi; l’IA calcola i macro.</li><li>La chat può suggerire — salvataggio nel food log.</li></ol>`],
  ['tr', 'Öğün nasıl kaydedilir', 'Ne yediğinizi kaydedin. Koç öğünü My Rules ve günlük hedeflerinizle karşılaştırır ve kaydetmeden önce çakışmaları işaretler.', `<ol><li><strong>YEMEK GÜNLÜĞÜ</strong>’nde <strong>Öğün</strong>’e dokunun.</li><li><strong>Fotoğraf</strong> — tabağı çekin ve onaylayın.</li><li><strong>Metin</strong> — tarif edin; YZ makroları çıkarır.</li><li>Sohbet önerebilir — kayıt food log üzerinden.</li></ol>`],
]);

bulk('manual-body', [
  ['en', 'Manual body entry', 'Enter weight (and optional composition) when the scale has not synced yet.', `<p>Estimates can fill gaps until Withings or a later weigh-in arrives.</p>`],
  ['he', 'הזנת גוף ידנית', 'מזינים משקל (והרכב אם יש) כשהמשקל עדיין לא הסתנכרן.', `<p>אפשר להשלים באומדן עד שיגיע Withings או שקילה הבאה.</p>`],
  ['es', 'Cuerpo manual', 'Introduce peso (y composición si tienes) si la báscula aún no sincronizó.', `<p>Una estimación cubre el hueco hasta Withings o el próximo pesaje.</p>`],
  ['fr', 'Saisie manuelle du corps', 'Saisissez le poids (et la composition si dispo) si la balance n’a pas encore sync.', `<p>Une estimation comble le trou jusqu’à Withings ou la prochaine pesée.</p>`],
  ['de', 'Körper manuell', 'Gewicht (und optional Zusammensetzung) eingeben, wenn die Waage noch nicht synced.', `<p>Schätzwerte füllen die Lücke bis Withings oder der nächste Wiegevorgang.</p>`],
  ['ar', 'إدخال الجسم يدوياً', 'أدخل الوزن (والتركيب إن وُجد) إن لم يزامن الميزان بعد.', `<p>تقدير يمكنه سد الفجوة حتى Withings أو الوزن التالي.</p>`],
  ['ru', 'Ручной ввод тела', 'Введите вес (и состав, если есть), если весы ещё не синхронизировались.', `<p>Оценка закрывает пробел до Withings или следующего взвешивания.</p>`],
  ['pt', 'Corpo manual', 'Introduza o peso (e composição se tiver) se a balança ainda não sincronizou.', `<p>Uma estimativa preenche o intervalo até Withings ou a próxima pesagem.</p>`],
  ['it', 'Corpo manuale', 'Inserisci il peso (e la composizione se ce l’hai) se la bilancia non ha ancora sincronizzato.', `<p>Una stima copre il vuoto fino a Withings o alla prossima pesata.</p>`],
  ['tr', 'Manuel beden girişi', 'Tartı henüz senkron olmadıysa kilo (ve varsa kompozisyon) girin.', `<p>Tahminler Withings veya bir sonraki tartıma kadar boşluğu doldurabilir.</p>`],
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
  pt: {
    title: 'Ajuda',
    lead: 'Tópicos do início rápido. Abreviaturas clínicas ficam em inglês.',
  },
  it: {
    title: 'Aiuto',
    lead: 'Argomenti dell’avvio rapido. Abbreviazioni cliniche restano in inglese.',
  },
  tr: {
    title: 'Yardım',
    lead: 'Hızlı başlangıç konuları. Klinik kısaltmalar İngilizce kalır.',
  },
};

/**
 * Privacy policy summary, localized (be-13 Phase B).
 *
 * Only the summary is translated. The nine sections below it stay in English
 * because a privacy policy is legally operative and no lawyer is reviewing ten
 * machine translations — but the substance a person consents to (local-first,
 * nothing uploaded without approval, revoke any time) lives entirely here.
 *
 * `lead` and `summary` are the exact counterparts of the English copy in
 * privacy.html. Keep them literal. If the English changes, change these too, or
 * the page promises different things in different languages.
 *
 * Consumed by gen-privacy-summary.mjs, which injects it as a JSON island.
 */
export const PRIVACY_SUMMARY = {
  he: {
    heading: 'תקציר',
    lead: 'HEALTHINGS.AI היא <strong>מקומית תחילה</strong>: נתוני הבריאות שלך נשארים בטלפון. <strong>שום דבר לא מגיע לשרת שלנו אלא אם בחרת בכך</strong> — בשיתוף עם מרפאה מקושרת או בהפעלת גיבוי בענן — ואפשר <strong>להפסיק כל אחד מהם בכל רגע</strong>. השליטה תמיד אצלך.',
    summary:
      'Healthings היא אפליקציית בריאות בגרסת אלפא — מאמן מטבולי אישי לארוחות, לגלוקוז ולהתקדמות. היא <strong>אינה מכשיר רפואי</strong> ואינה מאבחנת או מטפלת במצבים רפואיים. אין להשתמש בה להחלטות רפואיות דחופות. <strong>נתוני הבריאות שלך נשארים במכשיר כברירת מחדל.</strong> הם מגיעים לשרת שלנו רק דרך בחירות ש<strong>את/ה</strong> עושה: אישור מרפאה ושיתוף איתה, או הפעלת גיבוי בענן. אף אחד מהם אינו פעיל אלא אם הפעלת אותו, ואפשר להפסיק כל אחד מהם בכל רגע.',
    note: 'המדיניות המלאה מופיעה באנגלית מטה.',
  },
  es: {
    heading: 'Resumen',
    lead: 'HEALTHINGS.AI es <strong>local primero</strong>: tus datos de salud se quedan en tu teléfono. <strong>Nada llega a nuestro servidor salvo que tú lo elijas</strong>: al compartir con una clínica vinculada o al activar la copia de seguridad en la nube. Puedes <strong>detener cualquiera de las dos en cualquier momento</strong>. Siempre tienes el control.',
    summary:
      'Healthings es una app de bienestar en alfa: un entrenador metabólico personal para comidas, glucosa y progreso. <strong>No es un producto sanitario</strong> y no diagnostica ni trata enfermedades. No la uses para decisiones médicas de urgencia. <strong>Tus datos de salud permanecen en tu dispositivo de forma predeterminada.</strong> Llegan a nuestro servidor solo por decisiones que tomas <strong>tú</strong>: aprobar una clínica y compartir con ella, o activar la copia de seguridad en la nube. Ninguna de las dos está activa salvo que tú la actives, y puedes detener cualquiera de ellas en cualquier momento.',
    note: 'La política completa está disponible en inglés más abajo.',
  },
  fr: {
    heading: 'Résumé',
    lead: 'HEALTHINGS.AI est <strong>local d’abord</strong> : vos données de santé restent sur votre téléphone. <strong>Rien n’arrive sur notre serveur sans que vous le choisissiez</strong> — en partageant avec une clinique liée ou en activant la sauvegarde dans le cloud — et vous pouvez <strong>arrêter l’une ou l’autre à tout moment</strong>. Vous gardez toujours le contrôle.',
    summary:
      'Healthings est une application de bien-être en alpha : un coach métabolique personnel pour les repas, la glycémie et les progrès. Ce <strong>n’est pas un dispositif médical</strong> ; elle ne diagnostique ni ne traite aucune affection. Ne l’utilisez pas pour des décisions médicales urgentes. <strong>Vos données de santé restent sur votre appareil par défaut.</strong> Elles n’arrivent sur notre serveur qu’à la suite de choix que <strong>vous</strong> faites : approuver une clinique et partager avec elle, ou activer la sauvegarde dans le cloud. Aucune des deux n’est active tant que vous ne l’activez pas, et vous pouvez arrêter l’une ou l’autre à tout moment.',
    note: 'La politique complète est disponible en anglais ci-dessous.',
  },
  de: {
    heading: 'Zusammenfassung',
    lead: 'HEALTHINGS.AI ist <strong>local-first</strong>: Ihre Gesundheitsdaten bleiben auf Ihrem Telefon. <strong>Nichts gelangt auf unseren Server, sofern Sie es nicht selbst wählen</strong> — durch das Teilen mit einer verknüpften Klinik oder durch das Aktivieren der Cloud-Sicherung — und Sie können <strong>beides jederzeit beenden</strong>. Sie behalten stets die Kontrolle.',
    summary:
      'Healthings ist eine Wellness-App in der Alpha: ein persönlicher Stoffwechsel-Coach für Mahlzeiten, Glukose und Fortschritt. Sie ist <strong>kein Medizinprodukt</strong>, stellt keine Diagnosen und behandelt keine Erkrankungen. Nutzen Sie sie nicht für medizinische Notfallentscheidungen. <strong>Ihre Gesundheitsdaten bleiben standardmäßig auf Ihrem Gerät.</strong> Sie gelangen nur durch Entscheidungen auf unseren Server, die <strong>Sie</strong> treffen: eine Klinik genehmigen und mit ihr teilen oder die Cloud-Sicherung aktivieren. Beides ist nur aktiv, wenn Sie es einschalten, und Sie können beides jederzeit beenden.',
    note: 'Die vollständige Richtlinie finden Sie unten auf Englisch.',
  },
  ar: {
    heading: 'ملخص',
    lead: 'يعمل HEALTHINGS.AI <strong>محليًا أولًا</strong>: بياناتك الصحية تبقى على هاتفك. <strong>لا يصل أي شيء إلى خادمنا إلا إذا اخترت ذلك</strong> — بالمشاركة مع عيادة مرتبطة أو بتفعيل النسخ الاحتياطي السحابي — ويمكنك <strong>إيقاف أيٍّ منهما في أي وقت</strong>. التحكم دائمًا بيدك.',
    summary:
      'Healthings تطبيق عافية في مرحلة ألفا: مدرّب أيضي شخصي للوجبات والغلوكوز والتقدّم. وهو <strong>ليس جهازًا طبيًا</strong> ولا يشخّص الحالات ولا يعالجها. لا تستخدمه في القرارات الطبية الطارئة. <strong>بياناتك الصحية تبقى على جهازك افتراضيًا.</strong> ولا تصل إلى خادمنا إلا عبر خيارات <strong>تتخذها أنت</strong>: الموافقة على عيادة والمشاركة معها، أو تفعيل النسخ الاحتياطي السحابي. ولا يكون أيٌّ منهما مفعّلًا ما لم تفعّله بنفسك، ويمكنك إيقاف أيٍّ منهما في أي وقت.',
    note: 'السياسة الكاملة متاحة بالإنجليزية أدناه.',
  },
  ru: {
    heading: 'Кратко',
    lead: 'HEALTHINGS.AI работает <strong>локально в первую очередь</strong>: ваши данные о здоровье остаются на телефоне. <strong>Ничего не попадает на наш сервер, если вы сами этого не выберете</strong> — поделившись с привязанной клиникой или включив облачную резервную копию, — и вы можете <strong>прекратить любое из этого в любой момент</strong>. Контроль всегда за вами.',
    summary:
      'Healthings — велнес-приложение в альфа-версии: персональный метаболический коуч для питания, глюкозы и прогресса. Это <strong>не медицинское изделие</strong>, оно не ставит диагнозы и не лечит. Не используйте его для экстренных медицинских решений. <strong>По умолчанию данные о здоровье остаются на вашем устройстве.</strong> Они попадают на наш сервер только в результате решений, которые принимаете <strong>вы</strong>: одобрить клинику и поделиться с ней или включить облачную резервную копию. Ни то ни другое не работает, пока вы это не включите, и вы можете прекратить любое из этого в любой момент.',
    note: 'Полная политика приведена ниже на английском языке.',
  },
  pt: {
    heading: 'Resumo',
    lead: 'O HEALTHINGS.AI é <strong>local-first</strong>: seus dados de saúde ficam no seu celular. <strong>Nada chega ao nosso servidor a menos que você escolha</strong> — ao compartilhar com uma clínica vinculada ou ao ativar o backup na nuvem — e você pode <strong>encerrar qualquer um dos dois a qualquer momento</strong>. Você está sempre no controle.',
    summary:
      'O Healthings é um app de bem-estar em alfa: um coach metabólico pessoal para refeições, glicose e progresso. <strong>Não é um dispositivo médico</strong> e não diagnostica nem trata condições. Não o use para decisões médicas de emergência. <strong>Seus dados de saúde ficam no seu dispositivo por padrão.</strong> Eles chegam ao nosso servidor apenas por escolhas que <strong>você</strong> faz: aprovar uma clínica e compartilhar com ela, ou ativar o backup na nuvem. Nenhum dos dois fica ativo a menos que você ative, e você pode encerrar qualquer um deles a qualquer momento.',
    note: 'A política completa está disponível em inglês abaixo.',
  },
  it: {
    heading: 'Riepilogo',
    lead: 'HEALTHINGS.AI è <strong>local-first</strong>: i tuoi dati sanitari restano sul telefono. <strong>Nulla raggiunge il nostro server se non lo scegli tu</strong> — condividendo con una clinica collegata o attivando il backup nel cloud — e puoi <strong>interrompere l’uno o l’altro in qualsiasi momento</strong>. Il controllo è sempre tuo.',
    summary:
      'Healthings è un’app di benessere in alfa: un coach metabolico personale per pasti, glucosio e progressi. <strong>Non è un dispositivo medico</strong> e non diagnostica né cura patologie. Non usarla per decisioni mediche d’emergenza. <strong>Per impostazione predefinita i tuoi dati sanitari restano sul tuo dispositivo.</strong> Raggiungono il nostro server solo per scelte che fai <strong>tu</strong>: approvare una clinica e condividere con essa, oppure attivare il backup nel cloud. Nessuno dei due è attivo se non lo attivi tu, e puoi interrompere l’uno o l’altro in qualsiasi momento.',
    note: 'L’informativa completa è disponibile in inglese qui sotto.',
  },
  tr: {
    heading: 'Özet',
    lead: 'HEALTHINGS.AI <strong>önce yerel</strong> çalışır: sağlık verileriniz telefonunuzda kalır. <strong>Siz seçmediğiniz sürece hiçbir şey sunucumuza ulaşmaz</strong> — bağlı bir klinikle paylaşarak ya da bulut yedeklemesini açarak — ve <strong>ikisini de istediğiniz zaman durdurabilirsiniz</strong>. Kontrol her zaman sizde.',
    summary:
      'Healthings, alfa aşamasındaki bir sağlıklı yaşam uygulamasıdır: öğünler, glukoz ve ilerleme için kişisel bir metabolik koç. <strong>Tıbbi cihaz değildir</strong>; teşhis koymaz, tedavi etmez. Acil tıbbi kararlar için kullanmayın. <strong>Sağlık verileriniz varsayılan olarak cihazınızda kalır.</strong> Sunucumuza yalnızca <strong>sizin</strong> verdiğiniz kararlarla ulaşır: bir kliniği onaylayıp onunla paylaşmak ya da bulut yedeklemesini açmak. İkisi de siz açmadıkça etkin değildir ve ikisini de istediğiniz zaman durdurabilirsiniz.',
    note: 'Politikanın tamamı aşağıda İngilizce olarak yer almaktadır.',
  },
};
