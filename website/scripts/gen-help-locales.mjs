/**
 * Generate /{lang}/help/*.html for all HELP_LOCALES (prompt81).
 * Run from repo root: node website/scripts/gen-help-locales.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HELP_LOCALES,
  HELP_SLUGS,
  UI,
  ARTICLES,
  INDEX,
} from './help-locale-content.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB = join(__dirname, '..');
/**
 * Keep in sync with hand-written pages (be-13). Do not invent a parallel token.
 *
 * Never re-emit a token that has already been deployed. `20260726be11` and
 * `20260726be16` are burned: browsers hold different stylesheet states under
 * those two keys, so reusing either would serve stale CSS. Batch names also do
 * not sort — be-16 shipped before be-13 — so prefer a date plus a letter for
 * the next one rather than another batch number.
 */
const CSS_VER = '20260726be13';

function escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function metaDescription(lead) {
  const plain = String(lead)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= 155) return plain;
  return `${plain.slice(0, 152).trimEnd()}…`;
}

function pageUrl(langCode, slug) {
  return slug === 'index'
    ? `https://healthings.ai/${langCode}/help/index.html`
    : `https://healthings.ai/${langCode}/help/${slug}.html`;
}

function hreflangLinks(slug) {
  const lines = HELP_LOCALES.map(
    (l) =>
      `<link rel="alternate" hreflang="${l.code}" href="${pageUrl(l.code, slug)}" />`,
  );
  lines.push(
    `<link rel="alternate" hreflang="x-default" href="${pageUrl('en', slug)}" />`,
  );
  return lines.join('\n    ');
}

function langSwitcher(currentLang, slug, ui) {
  const options = HELP_LOCALES.map((l) => {
    const href =
      slug === 'index'
        ? `/${l.code}/help/index.html`
        : `/${l.code}/help/${slug}.html`;
    const selected = l.code === currentLang ? ' selected' : '';
    return `<option value="${href}" lang="${l.code}"${selected}>${l.name}</option>`;
  }).join('\n          ');

  const noscriptLinks = HELP_LOCALES.map((l) => {
    const href =
      slug === 'index'
        ? `/${l.code}/help/index.html`
        : `/${l.code}/help/${slug}.html`;
    return `<a href="${href}" hreflang="${l.code}">${l.name}</a>`;
  }).join(' · ');

  // Navigation happens on submit only. An onchange handler would move the page as soon as
  // a keyboard user pressed an arrow key, putting every distant option out of reach.
  return `<form class="help-lang" action="#" method="get" onsubmit="var s=this.elements.namedItem('lang'); if(s&amp;&amp;s.value){location.href=s.value;} return false;">
        <label for="help-lang-select">${ui.langLabel}</label>
        <select id="help-lang-select" name="lang">
          ${options}
        </select>
        <button type="submit" class="help-lang-go">${ui.langGo}</button>
      </form>
      <noscript class="help-lang-noscript"><p>${noscriptLinks}</p></noscript>`;
}

function nextTopicHtml(langMeta, slug, ui) {
  const i = HELP_SLUGS.indexOf(slug);
  if (i < 0 || i >= HELP_SLUGS.length - 1) return '';
  const nextSlug = HELP_SLUGS[i + 1];
  const next = ARTICLES[nextSlug]?.[langMeta.code];
  if (!next) return '';
  const arrow = langMeta.dir === 'rtl' ? '←' : '→';
  return `<p class="help-next"><a href="${nextSlug}.html">${ui.nextTopic}: ${next.title} ${arrow}</a></p>`;
}

function pageHtml(langMeta, slug, article) {
  const ui = UI[langMeta.code];
  const rtl = langMeta.dir === 'rtl';
  const title = article.title;
  const canonical = pageUrl(langMeta.code, slug);
  const desc = escAttr(metaDescription(article.lead));
  return `<!DOCTYPE html>
<html lang="${langMeta.code}" dir="${langMeta.dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${desc}" />
    <title>${title} — Healthings Help</title>
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" href="../../assets/icon.png" type="image/png" />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../../tokens.css?v=${CSS_VER}" />
    <link rel="stylesheet" href="../../styles.css?v=${CSS_VER}" />
    ${hreflangLinks(slug)}
  </head>
  <body${rtl ? ' class="help-rtl"' : ''}>
    <main class="wrap">
      <nav class="help-nav">
        <a href="index.html">${ui.help}</a>
        <a href="../../index.html">${ui.home}</a>
      </nav>
      ${langSwitcher(langMeta.code, slug, ui)}
      <section class="hero">
        <p class="badge">${ui.badge}</p>
        <h1>${title}</h1>
        <p class="lead">${article.lead}</p>
        <p class="help-glossary">${ui.glossary}</p>
      </section>
      <section class="card prose">
        ${article.body}
        ${nextTopicHtml(langMeta, slug, ui)}
        <p class="help-back"><a href="index.html">${rtl ? '→' : '←'} ${ui.allTopics}</a></p>
      </section>
    </main>
  </body>
</html>
`;
}

function indexHtml(langMeta) {
  const ui = UI[langMeta.code];
  const idx = INDEX[langMeta.code];
  const rtl = langMeta.dir === 'rtl';
  const canonical = pageUrl(langMeta.code, 'index');
  const desc = escAttr(metaDescription(idx.lead));
  const items = HELP_SLUGS.map((slug) => {
    const a = ARTICLES[slug]?.[langMeta.code];
    if (!a) return '';
    return `          <li><a href="${slug}.html">${a.title}</a></li>`;
  }).filter(Boolean);

  return `<!DOCTYPE html>
<html lang="${langMeta.code}" dir="${langMeta.dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${desc}" />
    <title>${idx.title} — Healthings</title>
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" href="../../assets/icon.png" type="image/png" />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../../tokens.css?v=${CSS_VER}" />
    <link rel="stylesheet" href="../../styles.css?v=${CSS_VER}" />
    ${hreflangLinks('index')}
  </head>
  <body${rtl ? ' class="help-rtl"' : ''}>
    <main class="wrap">
      <nav class="help-nav">
        <a href="index.html"><strong>${ui.help}</strong></a>
        <a href="../../index.html">${ui.home}</a>
      </nav>
      ${langSwitcher(langMeta.code, 'index', ui)}
      <section class="hero">
        <h1>${idx.title}</h1>
        <p class="lead">${idx.lead}</p>
      </section>
      <section class="card prose help-index">
        <ul>
${items.join('\n')}
        </ul>
      </section>
    </main>
  </body>
</html>
`;
}

function legacyRedirect(slug) {
  const target =
    slug === 'index'
      ? '/en/help/index.html'
      : `/en/help/${slug}.html`;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0;url=${target}" />
    <link rel="canonical" href="https://healthings.ai${target}" />
    <title>Redirecting…</title>
    <script>location.replace(${JSON.stringify(target)});</script>
  </head>
  <body>
    <p><a href="${target}">Continue to English help</a></p>
  </body>
</html>
`;
}

let wrote = 0;
for (const lang of HELP_LOCALES) {
  const dir = join(WEB, lang.code, 'help');
  mkdirSync(dir, { recursive: true });
  for (const slug of HELP_SLUGS) {
    const article = ARTICLES[slug]?.[lang.code];
    if (!article) {
      console.warn('missing', lang.code, slug);
      continue;
    }
    writeFileSync(join(dir, `${slug}.html`), pageHtml(lang, slug, article), 'utf8');
    wrote++;
  }
  writeFileSync(join(dir, 'index.html'), indexHtml(lang), 'utf8');
  wrote++;
}

// Legacy /help/* → /en/help/*
const legacyDir = join(WEB, 'help');
mkdirSync(legacyDir, { recursive: true });
const legacySlugs = new Set([
  ...HELP_SLUGS,
  'index',
  'alpha-setup',
  'devices',
  'withings-devices',
  'withings-watch',
]);
for (const slug of legacySlugs) {
  const targetSlug = HELP_SLUGS.includes(slug) || slug === 'index' ? slug : 'index';
  writeFileSync(join(legacyDir, `${slug}.html`), legacyRedirect(targetSlug), 'utf8');
  wrote++;
}

console.log('Wrote', wrote, 'help HTML files under /{lang}/help + legacy redirects');
