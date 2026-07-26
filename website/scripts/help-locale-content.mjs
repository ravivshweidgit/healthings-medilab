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
    lead: 'HEALTHINGS.AI היא <strong>מקומית תחילה</strong>: נתוני הבריאות שלך נשארים בטלפון. <strong>איננו מעלים את נתוני הבריאות שלך</strong> אלא אם בחרת לשתף עם מרפאה מקושרת — ואפשר <strong>לבטל</strong> את השיתוף בכל רגע. השליטה תמיד אצלך.',
    summary:
      'Healthings היא אפליקציית בריאות בגרסת אלפא — מאמן מטבולי אישי לארוחות, לגלוקוז ולהתקדמות. היא <strong>אינה מכשיר רפואי</strong> ואינה מאבחנת או מטפלת במצבים רפואיים. אין להשתמש בה להחלטות רפואיות דחופות. <strong>נתוני הבריאות שלך נשארים במכשיר כברירת מחדל.</strong> העלאה לשרת שלנו מתרחשת רק כאשר <strong>את/ה</strong> מאשר/ת שיתוף עם מרפאה ובוחר/ת לשתף — לעולם לא אוטומטית, בלי הקישור שלך ובלי הפעולה שלך.',
    note: 'המדיניות המלאה מופיעה באנגלית מטה.',
  },
  es: {
    heading: 'Resumen',
    lead: 'HEALTHINGS.AI es <strong>local primero</strong>: tus datos de salud se quedan en tu teléfono. <strong>No subimos tus datos de salud</strong> salvo que elijas compartirlos con una clínica vinculada, y puedes <strong>revocarlo</strong> en cualquier momento. Siempre tienes el control.',
    summary:
      'Healthings es una app de bienestar en alfa: un entrenador metabólico personal para comidas, glucosa y progreso. <strong>No es un producto sanitario</strong> y no diagnostica ni trata enfermedades. No la uses para decisiones médicas de urgencia. <strong>Tus datos de salud permanecen en tu dispositivo de forma predeterminada.</strong> La subida a nuestro servidor ocurre solo cuando <strong>tú</strong> apruebas compartir con una clínica y eliges compartir, nunca de forma automática sin tu vínculo y tu acción.',
    note: 'La política completa está disponible en inglés más abajo.',
  },
  fr: {
    heading: 'Résumé',
    lead: 'HEALTHINGS.AI est <strong>local d’abord</strong> : vos données de santé restent sur votre téléphone. <strong>Nous ne téléversons pas vos données de santé</strong>, sauf si vous choisissez de les partager avec une clinique liée — et vous pouvez <strong>révoquer</strong> ce partage à tout moment. Vous gardez toujours le contrôle.',
    summary:
      'Healthings est une application de bien-être en alpha : un coach métabolique personnel pour les repas, la glycémie et les progrès. Ce <strong>n’est pas un dispositif médical</strong> ; elle ne diagnostique ni ne traite aucune affection. Ne l’utilisez pas pour des décisions médicales urgentes. <strong>Vos données de santé restent sur votre appareil par défaut.</strong> Le téléversement vers notre serveur n’a lieu que lorsque <strong>vous</strong> approuvez le partage avec une clinique et choisissez de partager — jamais automatiquement, sans votre lien et sans votre action.',
    note: 'La politique complète est disponible en anglais ci-dessous.',
  },
  de: {
    heading: 'Zusammenfassung',
    lead: 'HEALTHINGS.AI ist <strong>local-first</strong>: Ihre Gesundheitsdaten bleiben auf Ihrem Telefon. <strong>Wir laden Ihre Gesundheitsdaten nicht hoch</strong>, außer Sie entscheiden sich, mit einer verknüpften Klinik zu teilen — und Sie können das jederzeit <strong>widerrufen</strong>. Sie behalten stets die Kontrolle.',
    summary:
      'Healthings ist eine Wellness-App in der Alpha: ein persönlicher Stoffwechsel-Coach für Mahlzeiten, Glukose und Fortschritt. Sie ist <strong>kein Medizinprodukt</strong>, stellt keine Diagnosen und behandelt keine Erkrankungen. Nutzen Sie sie nicht für medizinische Notfallentscheidungen. <strong>Ihre Gesundheitsdaten bleiben standardmäßig auf Ihrem Gerät.</strong> Ein Upload auf unseren Server erfolgt nur, wenn <strong>Sie</strong> die Klinikfreigabe genehmigen und das Teilen auswählen — niemals automatisch, ohne Ihre Verknüpfung und Ihre Aktion.',
    note: 'Die vollständige Richtlinie finden Sie unten auf Englisch.',
  },
  ar: {
    heading: 'ملخص',
    lead: 'يعمل HEALTHINGS.AI <strong>محليًا أولًا</strong>: بياناتك الصحية تبقى على هاتفك. <strong>لا نرفع بياناتك الصحية</strong> إلا إذا اخترت مشاركتها مع عيادة مرتبطة — ويمكنك <strong>إلغاء</strong> ذلك في أي وقت. التحكم دائمًا بيدك.',
    summary:
      'Healthings تطبيق عافية في مرحلة ألفا: مدرّب أيضي شخصي للوجبات والغلوكوز والتقدّم. وهو <strong>ليس جهازًا طبيًا</strong> ولا يشخّص الحالات ولا يعالجها. لا تستخدمه في القرارات الطبية الطارئة. <strong>بياناتك الصحية تبقى على جهازك افتراضيًا.</strong> لا يتم الرفع إلى خادمنا إلا عندما <strong>توافق</strong> على المشاركة مع عيادة وتختار المشاركة — ولا يحدث ذلك تلقائيًا أبدًا، دون ربطك ودون إجرائك.',
    note: 'السياسة الكاملة متاحة بالإنجليزية أدناه.',
  },
  ru: {
    heading: 'Кратко',
    lead: 'HEALTHINGS.AI работает <strong>локально в первую очередь</strong>: ваши данные о здоровье остаются на телефоне. <strong>Мы не загружаем ваши данные о здоровье</strong>, если вы сами не решите поделиться ими с привязанной клиникой, — и вы можете <strong>отозвать</strong> доступ в любой момент. Контроль всегда за вами.',
    summary:
      'Healthings — велнес-приложение в альфа-версии: персональный метаболический коуч для питания, глюкозы и прогресса. Это <strong>не медицинское изделие</strong>, оно не ставит диагнозы и не лечит. Не используйте его для экстренных медицинских решений. <strong>По умолчанию данные о здоровье остаются на вашем устройстве.</strong> Загрузка на наш сервер происходит только тогда, когда <strong>вы</strong> одобряете передачу клинике и выбираете поделиться, — никогда автоматически, без вашей привязки и вашего действия.',
    note: 'Полная политика приведена ниже на английском языке.',
  },
  pt: {
    heading: 'Resumo',
    lead: 'O HEALTHINGS.AI é <strong>local-first</strong>: seus dados de saúde ficam no seu celular. <strong>Não enviamos seus dados de saúde</strong> a menos que você escolha compartilhar com uma clínica vinculada — e você pode <strong>revogar</strong> isso a qualquer momento. Você está sempre no controle.',
    summary:
      'O Healthings é um app de bem-estar em alfa: um coach metabólico pessoal para refeições, glicose e progresso. <strong>Não é um dispositivo médico</strong> e não diagnostica nem trata condições. Não o use para decisões médicas de emergência. <strong>Seus dados de saúde ficam no seu dispositivo por padrão.</strong> O envio para o nosso servidor acontece apenas quando <strong>você</strong> aprova o compartilhamento com uma clínica e escolhe compartilhar — nunca automaticamente, sem o seu vínculo e a sua ação.',
    note: 'A política completa está disponível em inglês abaixo.',
  },
  it: {
    heading: 'Riepilogo',
    lead: 'HEALTHINGS.AI è <strong>local-first</strong>: i tuoi dati sanitari restano sul telefono. <strong>Non carichiamo i tuoi dati sanitari</strong> a meno che tu non scelga di condividerli con una clinica collegata — e puoi <strong>revocare</strong> la condivisione in qualsiasi momento. Il controllo è sempre tuo.',
    summary:
      'Healthings è un’app di benessere in alfa: un coach metabolico personale per pasti, glucosio e progressi. <strong>Non è un dispositivo medico</strong> e non diagnostica né cura patologie. Non usarla per decisioni mediche d’emergenza. <strong>Per impostazione predefinita i tuoi dati sanitari restano sul tuo dispositivo.</strong> Il caricamento sul nostro server avviene solo quando <strong>tu</strong> approvi la condivisione con una clinica e scegli di condividere — mai automaticamente, senza il tuo collegamento e la tua azione.',
    note: 'L’informativa completa è disponibile in inglese qui sotto.',
  },
  tr: {
    heading: 'Özet',
    lead: 'HEALTHINGS.AI <strong>önce yerel</strong> çalışır: sağlık verileriniz telefonunuzda kalır. Bağlı bir kliniğe paylaşmayı siz seçmediğiniz sürece <strong>sağlık verilerinizi yüklemeyiz</strong> — ve bunu istediğiniz zaman <strong>geri alabilirsiniz</strong>. Kontrol her zaman sizde.',
    summary:
      'Healthings, alfa aşamasındaki bir sağlıklı yaşam uygulamasıdır: öğünler, glukoz ve ilerleme için kişisel bir metabolik koç. <strong>Tıbbi cihaz değildir</strong>; teşhis koymaz, tedavi etmez. Acil tıbbi kararlar için kullanmayın. <strong>Sağlık verileriniz varsayılan olarak cihazınızda kalır.</strong> Sunucumuza yükleme yalnızca <strong>siz</strong> klinik paylaşımını onayladığınızda ve paylaşmayı seçtiğinizde gerçekleşir — bağlantınız ve eyleminiz olmadan asla otomatik olarak yapılmaz.',
    note: 'Politikanın tamamı aşağıda İngilizce olarak yer almaktadır.',
  },
};
