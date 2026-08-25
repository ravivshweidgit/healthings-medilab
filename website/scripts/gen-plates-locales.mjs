/**
 * Generate /{lang}/plates/index.html + one page per collection for all HELP_LOCALES.
 * Run: node website/scripts/gen-plates-locales.mjs
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELP_LOCALES, UI as HELP_UI } from './help-locale-content.mjs';
import {
  CSS_VER,
  AMOUNT_DEFS,
  formatAmount,
  PLATES_UI,
  PLATE_COPY,
} from './plates-locale-content.mjs';
import { registerMoreLocales } from './plates-locale-more.mjs';
import { DOWNLOADS_UI } from './downloads-locale-content.mjs';
import {
  PLATE_COLLECTION_SLUGS,
  LEGACY_LIPID_SLUG,
  collectionFile,
} from './plates-collections-registry.mjs';
import {
  bundledPageUi,
  bundledIndexCard,
  bundledPlates,
} from './plates-collections-bundled.mjs';

registerMoreLocales(
  (code, o) => {
    PLATES_UI[code] = o;
  },
  (code, list) => {
    PLATE_COPY[code] = list;
  },
);

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB = join(__dirname, '..');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pageUrl(lang, file) {
  return `https://healthings.ai/${lang}/plates/${file}`;
}

function downloadsLabel(lang) {
  return (DOWNLOADS_UI[lang] || DOWNLOADS_UI.en).nav;
}

function hreflang(file) {
  const lines = HELP_LOCALES.map(
    (l) =>
      `<link rel="alternate" hreflang="${l.code}" href="${pageUrl(l.code, file)}" />`,
  );
  lines.push(
    `<link rel="alternate" hreflang="x-default" href="${pageUrl('en', file)}" />`,
  );
  return lines.join('\n    ');
}

function langSwitcher(current, file, langLabel) {
  const options = HELP_LOCALES.map((l) => {
    const href = `/${l.code}/plates/${file}`;
    const selected = l.code === current ? ' selected' : '';
    return `<option value="${href}" lang="${l.code}"${selected}>${l.name}</option>`;
  }).join('\n          ');
  const noscript = HELP_LOCALES.map(
    (l) =>
      `<a href="/${l.code}/plates/${file}" hreflang="${l.code}">${l.name}</a>`,
  ).join(' · ');
  return `<form class="help-lang" action="#" method="get" onsubmit="return false;">
        <label for="help-lang-select">${esc(langLabel)}</label>
        <select id="help-lang-select" name="lang" onchange="if(this.value)location.href=this.value;">
          ${options}
        </select>
      </form>
      <noscript class="help-lang-noscript"><p>${noscript}</p></noscript>`;
}

function plateCards(lang, ui, list) {
  return list
    .map((p, i) => {
      const items = p.items
        .map(([name, key]) => {
          const amount = formatAmount(ui, key);
          const grams = amount ? `<span class="grams">${esc(amount)}</span>` : '';
          return `<li><span>${esc(name)}</span>${grams}</li>`;
        })
        .join('\n              ');
      const hint = p.hint.replace(
        '{log}',
        `<a href="../help/meal-logging.html">${esc(ui.logMeal)}</a>`,
      );
      const loading = i === 0 ? 'eager' : 'lazy';
      return `<article class="plate-card" id="${p.id}" data-plate-id="${p.id}">
          <div class="plate-visual">
            <img
              src="../../images/plates/${p.img}"
              width="1200"
              height="800"
              alt="${esc(p.alt)}"
              loading="${loading}"
              decoding="async"
            />
            <div class="plate-visual-fade" aria-hidden="true"></div>
          </div>
          <div class="plate-body">
            <p class="plate-slot">${esc(p.slot)}</p>
            <h2>${esc(p.title)}</h2>
            <p class="plate-why">${esc(p.why)}</p>
            <ul class="plate-items">
              ${items}
            </ul>
            <p class="plate-hint">${hint}</p>
          </div>
        </article>`;
    })
    .join('\n\n        ');
}

function platesJson(slug, lang, list) {
  const ui = PLATES_UI[lang] || PLATES_UI.en;
  const enList =
    slug === LEGACY_LIPID_SLUG
      ? PLATE_COPY.en
      : bundledPlates(slug, 'en') || list;
  const plates = list.map((p, idx) => {
    const en = enList[idx];
    return {
      id: p.id,
      slot: p.id.includes('breakfast')
        ? 'breakfast'
        : p.id.includes('lunch')
          ? 'lunch'
          : p.id.includes('dinner') || p.id.includes('sashimi') || p.id.includes('steak')
            ? 'dinner'
            : p.id.includes('snack') || p.id.includes('evening') || p.id.includes('yogurt')
              ? 'after_dinner'
              : 'snack',
      name_en: en?.title || p.title,
      name: p.title,
      items: p.items.map(([name, key], j) => {
        const enItem = en?.items?.[j];
        const row = {
          name_en: enItem?.[0] || name,
          name,
        };
        if (key === 'fresh') row.amount = 'fresh';
        else if (key && AMOUNT_DEFS[key]) {
          const formatted = formatAmount(ui, key);
          const def = AMOUNT_DEFS[key];
          if (formatted) row.amount = formatted;
          if (def?.text) {
            const g = parseFloat(String(def.text).replace(/[^0-9.]/g, ''));
            if (!Number.isNaN(g) && /g|ml/i.test(def.text)) row.grams = Math.round(g);
          } else if (def?.approx) {
            const g = parseFloat(String(def.approx).replace(/[^0-9.]/g, ''));
            if (!Number.isNaN(g)) row.grams = Math.round(g);
          }
        }
        return row;
      }),
    };
  });
  return JSON.stringify(
    { collection: slug, version: 2, locale: lang, plates },
    null,
    2,
  );
}

function collectionPlates(slug, lang) {
  if (slug === LEGACY_LIPID_SLUG) {
    return PLATE_COPY[lang] || PLATE_COPY.en;
  }
  return bundledPlates(slug, lang);
}

function collectionPageUi(slug, lang) {
  const base = PLATES_UI[lang] || PLATES_UI.en;
  if (slug === LEGACY_LIPID_SLUG) {
    return {
      pageTitle: base.pageTitle,
      h1: base.h1,
      lead: base.lead,
      disclaimer: base.disclaimer,
      moreTitle: base.moreTitle,
      moreBody: base.moreBody,
    };
  }
  const bundled = bundledPageUi(slug, lang);
  return {
    pageTitle: bundled.pageTitle,
    h1: bundled.h1,
    lead: bundled.lead,
    disclaimer: bundled.disclaimer,
    moreTitle: base.moreTitle,
    moreBody: base.moreBody,
  };
}

function collectionIndexCard(slug, lang) {
  if (slug === LEGACY_LIPID_SLUG) {
    const ui = PLATES_UI[lang] || PLATES_UI.en;
    return {
      slot: ui.indexCardSlot,
      title: ui.indexCardTitle,
      why: ui.indexCardWhy,
      img: 'yogurt-breakfast.jpg?v=20260816a',
    };
  }
  return bundledIndexCard(slug, lang);
}

function indexCardsHtml(lang) {
  return PLATE_COLLECTION_SLUGS.map((slug, i) => {
    const card = collectionIndexCard(slug, lang);
    const href = collectionFile(slug);
    const loading = i === 0 ? 'eager' : 'lazy';
    return `<a class="plate-card plate-card-link" href="${href}">
          <div class="plate-visual">
            <img
              src="../../images/plates/${card.img}"
              width="1200"
              height="800"
              alt=""
              loading="${loading}"
              decoding="async"
            />
            <div class="plate-visual-fade" aria-hidden="true"></div>
          </div>
          <div class="plate-body">
            <p class="plate-slot">${esc(card.slot)}</p>
            <h2>${esc(card.title)}</h2>
            <p class="plate-why">${esc(card.why)}</p>
          </div>
        </a>`;
  }).join('\n\n        ');
}

function protocolHtml(langMeta, slug) {
  const code = langMeta.code;
  const ui = PLATES_UI[code] || PLATES_UI.en;
  const page = collectionPageUi(slug, code);
  const list = collectionPlates(slug, code);
  const helpUi = HELP_UI[code] || HELP_UI.en;
  const rtl = langMeta.dir === 'rtl';
  const bodyClass = rtl ? 'help-rtl plates-page' : 'plates-page';
  const file = collectionFile(slug);
  const desc = esc(
    `${page.h1}. ${ui.indexLead}`.replace(/<[^>]+>/g, '').slice(0, 160),
  );
  return `<!DOCTYPE html>
<html lang="${code}" dir="${langMeta.dir}" class="theme-auto">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${desc}" />
    <title>${esc(page.pageTitle)} — Healthings</title>
    <link rel="canonical" href="${pageUrl(code, file)}" />
    <link rel="icon" href="../../assets/icon.png" type="image/png" />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../../tokens.css?v=${CSS_VER}" />
    <link rel="stylesheet" href="../../styles.css?v=${CSS_VER}" />
    ${hreflang(file)}
  </head>
  <body class="${bodyClass}">
    <main class="wrap">
      <nav class="help-nav">
        <a href="index.html">${esc(ui.navPlates)}</a>
        <a href="../help/index.html">${esc(helpUi.help)}</a>
        <a href="../downloads/index.html">${esc(downloadsLabel(code))}</a>
        <a href="../../index.html">${esc(helpUi.home)}</a>
      </nav>
      ${langSwitcher(code, file, helpUi.langLabel)}

      <section class="hero">
        <p class="badge">${esc(ui.badge)}</p>
        <h1>${esc(page.h1)}</h1>
        <p class="lead">${page.lead}</p>
      </section>

      <p class="plates-disclaimer">${page.disclaimer}</p>

      <div class="plates-grid">
        ${plateCards(code, ui, list)}
      </div>

      <section class="card prose">
        <h2>${esc(page.moreTitle)}</h2>
        <p>${esc(page.moreBody)}</p>
        <p class="help-next"><a href="../help/meal-logging.html">${esc(ui.howToLog)}</a></p>
        <p class="help-back"><a href="index.html">${esc(ui.allPlates)}</a></p>
      </section>
    </main>

    <script type="application/json" id="plates-data">
${platesJson(slug, code, list)}
    </script>
  </body>
</html>
`;
}

function indexHtml(langMeta) {
  const code = langMeta.code;
  const ui = PLATES_UI[code] || PLATES_UI.en;
  const helpUi = HELP_UI[code] || HELP_UI.en;
  const rtl = langMeta.dir === 'rtl';
  const bodyClass = rtl ? 'help-rtl plates-page' : 'plates-page';
  return `<!DOCTYPE html>
<html lang="${code}" dir="${langMeta.dir}" class="theme-auto">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${esc(ui.indexLead)}" />
    <title>${esc(ui.indexTitle)} — Healthings</title>
    <link rel="canonical" href="${pageUrl(code, '')}" />
    <link rel="icon" href="../../assets/icon.png" type="image/png" />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../../tokens.css?v=${CSS_VER}" />
    <link rel="stylesheet" href="../../styles.css?v=${CSS_VER}" />
    ${hreflang('')}
  </head>
  <body class="${bodyClass}">
    <main class="wrap">
      <nav class="help-nav">
        <a href="index.html" aria-current="page">${esc(ui.navPlates)}</a>
        <a href="../help/index.html">${esc(helpUi.help)}</a>
        <a href="../downloads/index.html">${esc(downloadsLabel(code))}</a>
        <a href="../../index.html">${esc(helpUi.home)}</a>
      </nav>
      ${langSwitcher(code, 'index.html', helpUi.langLabel)}
      <section class="hero">
        <h1>${esc(ui.indexTitle)}</h1>
        <p class="lead">${esc(ui.indexLead)}</p>
      </section>
      <div class="plates-grid">
        ${indexCardsHtml(code)}
      </div>
      <p class="plates-disclaimer">${ui.indexDisclaimer}</p>
    </main>
  </body>
</html>
`;
}

function patchHelpIndex(lang) {
  const ui = PLATES_UI[lang] || PLATES_UI.en;
  const file = join(WEB, lang, 'help', 'index.html');
  if (!existsSync(file)) return;
  let html = readFileSync(file, 'utf8');
  const link = `<li><a href="../plates/index.html">${esc(ui.helpIndexLink)}</a></li>`;
  if (html.includes('../plates/index.html') || html.includes('../plates/lipid-protocol.html')) {
    html = html.replace(
      /<li><a href="\.\.\/plates\/(?:index|lipid-protocol)\.html">[^<]*<\/a><\/li>/,
      link,
    );
  } else {
    const afterMealLogging = /(<li><a href="meal-logging\.html">[^<]*<\/a><\/li>\n)/;
    html = afterMealLogging.test(html)
      ? html.replace(afterMealLogging, `$1          ${link}\n`)
      : html.replace(/(<ul>\n)/, `$1          ${link}\n`);
  }
  writeFileSync(file, html);
}

function patchMealLogging(lang) {
  const ui = PLATES_UI[lang] || PLATES_UI.en;
  const file = join(WEB, lang, 'help', 'meal-logging.html');
  if (!existsSync(file)) return;
  let html = readFileSync(file, 'utf8');
  const blurb = ui.mealLoggingBlurb.replace(
    '../plates/lipid-protocol.html',
    '../plates/index.html',
  );
  if (html.includes('../plates/')) {
    html = html.replace(
      /<p><a href="\.\.\/plates\/[^"]+\.html">[\s\S]*?<\/p>/,
      blurb,
    );
  } else {
    html = html.replace(/(<ol>[\s\S]*?<\/ol>\n)/, `$1        ${blurb}\n`);
  }
  writeFileSync(file, html);
}

let n = 0;
for (const lang of HELP_LOCALES) {
  if (!PLATES_UI[lang.code] || !PLATE_COPY[lang.code]) {
    console.error('Missing plates copy for', lang.code);
    process.exit(1);
  }
  const dir = join(WEB, lang.code, 'plates');
  mkdirSync(dir, { recursive: true });
  for (const slug of PLATE_COLLECTION_SLUGS) {
    writeFileSync(join(dir, collectionFile(slug)), protocolHtml(lang, slug));
  }
  writeFileSync(join(dir, 'index.html'), indexHtml(lang));
  patchHelpIndex(lang.code);
  patchMealLogging(lang.code);
  n++;
  console.log('wrote', lang.code, '/plates', `(${PLATE_COLLECTION_SLUGS.length} collections)`);
}
console.log('done', n, 'locales');
