/**
 * Generate /{lang}/the-clinic/index.html for all HELP_LOCALES.
 * Run from repo root: node website/scripts/gen-the-clinic-locales.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELP_LOCALES, UI as HELP_UI } from './help-locale-content.mjs';
import { CSS_VER } from './css-version.mjs';
import { THE_CLINIC_UI } from './the-clinic-locale-content.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB = join(__dirname, '..');

function escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function pageUrl(code) {
  return `https://healthings.ai/${code}/the-clinic/`;
}

function hreflangLinks() {
  const lines = HELP_LOCALES.map(
    (l) => `<link rel="alternate" hreflang="${l.code}" href="${pageUrl(l.code)}" />`,
  );
  lines.push(`<link rel="alternate" hreflang="x-default" href="${pageUrl('en')}" />`);
  return lines.join('\n    ');
}

function langSwitcher(current, langLabel) {
  const options = HELP_LOCALES.map((l) => {
    const selected = l.code === current ? ' selected' : '';
    return `<option value="/${l.code}/the-clinic/" lang="${l.code}"${selected}>${l.name}</option>`;
  }).join('\n          ');
  const noscript = HELP_LOCALES.map(
    (l) => `<a href="/${l.code}/the-clinic/" hreflang="${l.code}">${l.name}</a>`,
  ).join(' · ');
  return `<form class="help-lang" action="#" method="get" onsubmit="return false;">
        <label for="help-lang-select">${langLabel}</label>
        <select id="help-lang-select" name="lang" onchange="if(this.value)location.href=this.value;">
          ${options}
        </select>
      </form>
      <noscript class="help-lang-noscript"><p>${noscript}</p></noscript>`;
}

function pageHtml(lang) {
  const { code, dir } = lang;
  const ui = THE_CLINIC_UI[code];
  const helpUi = HELP_UI[code];
  const rtl = dir === 'rtl';
  const bodyClass = rtl ? ' class="help-rtl"' : '';

  return `<!DOCTYPE html>
<html lang="${code}" dir="${dir}" class="theme-auto">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escAttr(ui.description)}" />
    <title>${escAttr(ui.title)}</title>
    <link rel="canonical" href="${pageUrl(code)}" />
    <link rel="icon" href="../../assets/icon.png" type="image/png" />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../../tokens.css?v=${CSS_VER}" />
    <link rel="stylesheet" href="../../styles.css?v=${CSS_VER}" />
    ${hreflangLinks()}
  </head>
  <body${bodyClass}>
    <main class="wrap">
      <nav class="help-nav">
        <a href="../the-clinic/" aria-current="page">${ui.nav}</a>
        <a href="../help/">${helpUi.help}</a>
        <a href="../downloads/">${ui.downloads}</a>
        <a href="../../index.html">${helpUi.home}</a>
      </nav>
      ${langSwitcher(code, helpUi.langLabel)}
      <section class="hero">
        <h1>${ui.h1}</h1>
      </section>
      <section class="card prose">
        <h2>${ui.managerHeading}</h2>
        <p><strong>${ui.name}</strong></p>
        <p>${ui.credentials}</p>
        <p>${ui.education}</p>
      </section>
    </main>
  </body>
</html>
`;
}

let wrote = 0;
for (const lang of HELP_LOCALES) {
  if (!THE_CLINIC_UI[lang.code]) {
    console.error('Missing the-clinic copy for', lang.code);
    process.exit(1);
  }
  const dir = join(WEB, lang.code, 'the-clinic');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), pageHtml(lang), 'utf8');
  wrote++;
}
console.log('Wrote', wrote, 'clinic pages under /{lang}/the-clinic/');
