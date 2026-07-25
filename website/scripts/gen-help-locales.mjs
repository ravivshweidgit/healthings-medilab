/**
 * Generate /{lang}/help/*.html for all HELP_LOCALES (prompt81).
 * Run from repo root: node website/scripts/gen-help-locales.mjs
 */
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
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
const CSS_VER = '20260726be11';

function langSwitcher(currentLang, slug) {
  const links = HELP_LOCALES.map((l) => {
    const href =
      slug === 'index'
        ? `/${l.code}/help/index.html`
        : `/${l.code}/help/${slug}.html`;
    const on = l.code === currentLang ? ' class="on"' : '';
    return `<a href="${href}"${on} hreflang="${l.code}" title="${l.name}">${l.flag} ${l.label}</a>`;
  }).join('\n          ');
  return `<nav class="help-lang" aria-label="Language">${links}</nav>`;
}

function pageHtml(langMeta, slug, article) {
  const ui = UI[langMeta.code];
  const rtl = langMeta.dir === 'rtl';
  const title = article.title;
  return `<!DOCTYPE html>
<html lang="${langMeta.code}" dir="${langMeta.dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} — Healthings Help</title>
    <link rel="icon" href="../../assets/icon.png" type="image/png" />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../../tokens.css?v=${CSS_VER}" />
    <link rel="stylesheet" href="../../styles.css?v=${CSS_VER}" />
    ${HELP_LOCALES.map(
      (l) =>
        `<link rel="alternate" hreflang="${l.code}" href="https://healthings.ai/${l.code}/help/${slug}.html" />`,
    ).join('\n    ')}
  </head>
  <body class="${rtl ? 'help-rtl' : ''}">
    <main class="wrap">
      ${langSwitcher(langMeta.code, slug)}
      <nav class="help-nav">
        <a href="../../index.html">${ui.home}</a>
        <a href="index.html">${ui.help}</a>
      </nav>
      <section class="hero">
        <p class="badge">${ui.badge}</p>
        <h1>${title}</h1>
        <p class="lead">${article.lead}</p>
        <p class="help-glossary">${ui.glossary}</p>
      </section>
      <section class="card prose">
        <h2>${ui.know}</h2>
        ${article.body}
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
    <title>${idx.title} — Healthings</title>
    <link rel="icon" href="../../assets/icon.png" type="image/png" />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../../tokens.css?v=${CSS_VER}" />
    <link rel="stylesheet" href="../../styles.css?v=${CSS_VER}" />
  </head>
  <body class="${rtl ? 'help-rtl' : ''}">
    <main class="wrap">
      ${langSwitcher(langMeta.code, 'index')}
      <nav class="help-nav">
        <a href="../../index.html">${ui.home}</a>
        <a href="index.html"><strong>${ui.help}</strong></a>
      </nav>
      <section class="hero">
        <h1>${idx.title}</h1>
        <p class="lead">${idx.lead}</p>
      </section>
      <section class="card prose">
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
