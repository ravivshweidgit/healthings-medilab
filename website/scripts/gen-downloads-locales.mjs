/**
 * Generate /{lang}/downloads/index.html for all HELP_LOCALES.
 * Run from repo root: node website/scripts/gen-downloads-locales.mjs
 *
 * Both platform lists ship in the HTML and a class on <body> hides one of them.
 * Detection picks the class, but nothing is fetched or built per platform: a
 * shared link opens correctly for whoever receives it, a desktop reader sees both
 * lists, and with scripting off the page degrades to the full truth rather than
 * to an empty page.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELP_LOCALES, UI as HELP_UI } from './help-locale-content.mjs';
import { THE_CLINIC_UI } from './the-clinic-locale-content.mjs';
import { CSS_VER } from './css-version.mjs';
import {
  APPS,
  ANDROID_ORDER,
  IOS_ORDER,
  DOWNLOADS_UI,
  ltrPlus,
} from './downloads-locale-content.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB = join(__dirname, '..');

function escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function metaDescription(lead) {
  const plain = String(lead)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length <= 155 ? plain : `${plain.slice(0, 152).trimEnd()}…`;
}

function pageUrl(code) {
  return `https://healthings.ai/${code}/downloads/index.html`;
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
    return `<option value="/${l.code}/downloads/index.html" lang="${l.code}"${selected}>${l.name}</option>`;
  }).join('\n          ');
  const noscript = HELP_LOCALES.map(
    (l) => `<a href="/${l.code}/downloads/index.html" hreflang="${l.code}">${l.name}</a>`,
  ).join(' · ');
  return `<form class="help-lang" action="#" method="get" onsubmit="return false;">
        <label for="help-lang-select">${langLabel}</label>
        <select id="help-lang-select" name="lang" onchange="if(this.value)location.href=this.value;">
          ${options}
        </select>
      </form>
      <noscript class="help-lang-noscript"><p>${noscript}</p></noscript>`;
}

/** Which "why" line a card uses — CareSens is the one app whose story differs. */
function whyKey(key, platform) {
  if (key !== 'caresens') return key;
  return platform === 'ios' ? 'caresensIos' : 'caresensAndroid';
}

function actionHtml(key, app, platform, ui) {
  const target = app[platform];
  if (!target) return '';
  if (target.kind === 'builtin') {
    return `<p class="dl-act"><span class="dl-builtin">${ui.builtIn}</span></p>`;
  }
  // Health Connect is the one row where the store button would mislead most
  // readers: from Android 14 it is a framework module, so the Play listing simply
  // refuses to install on the phones most people are holding. Lead with where it
  // already is, and keep Play as the small print for older Androids.
  if (key === 'healthConnect') {
    return `<p class="dl-act"><span class="dl-builtin">${ui.builtInSettings}</span></p>
            <p class="dl-alt"><a href="${target.url}" target="_blank" rel="noopener noreferrer">${ui.hcOlder}</a></p>`;
  }
  const label =
    target.kind === 'play'
      ? ui.getPlay
      : target.kind === 'appstore'
        ? ui.getAppStore
        : target.kind === 'testflight'
          ? ui.getTestFlight
          : ui.getApk;
  // The APK is ours to serve, so it gets `download` and no new tab. Store links
  // leave the site and open in one.
  const attrs =
    target.kind === 'apk'
      ? ' download'
      : ' target="_blank" rel="noopener noreferrer"';
  // Only Healthings gets the filled button. Every card carrying one made the page
  // read as six things to install, when five of them depend on owning a device.
  const btnClass = app.need === 'required' ? 'dl-btn dl-btn-primary' : 'dl-btn';
  return `<p class="dl-act"><a class="${btnClass}" href="${target.url}"${attrs}>${label}</a></p>`;
}

function cardHtml(key, platform, ui, rtl) {
  const app = APPS[key];
  const tag =
    app.need === 'required'
      ? ui.tagRequired
      : app.need === 'usually'
        ? ui.tagUsually
        : app.need === 'bridge'
          ? ui.tagBridge
          : ui.tagDevice;
  const tagClass = app.need === 'required' ? ' dl-tag-start' : '';
  const why = ui.why[whyKey(key, platform)];
  const arrow = rtl ? '←' : '→';
  const fix = rtl ? ltrPlus : (s) => s;
  // alt="" — the heading beside it is the app's name, so the icon adds nothing
  // for a screen reader beyond a second copy of the word.
  const mark = app.icon
    ? `<img class="dl-icon" src="${app.icon}" width="40" height="40" loading="lazy" alt="" />`
    : '';
  return `<article class="dl-card${app.icon ? ' dl-card-marked' : ''}">
            <div class="dl-head">
              ${mark}<h3 class="dl-name">${fix(app.name)}</h3>
              <span class="dl-tag${tagClass}">${tag}</span>
            </div>
            <p class="dl-why">${fix(why)}</p>
            ${actionHtml(key, app, platform, ui)}
            <p class="dl-more"><a href="../help/${app.help}.html">${ui.howTo} ${arrow}</a></p>
          </article>`;
}

function panelHtml(platform, ui, rtl) {
  const order = platform === 'ios' ? IOS_ORDER : ANDROID_ORDER;
  const cards = order.map((key) => cardHtml(key, platform, ui, rtl)).join('\n\n          ');
  const fix = rtl ? ltrPlus : (s) => s;
  const aside =
    platform === 'ios'
      ? `\n        <aside class="dl-aside">
          <p class="dl-aside-title">${fix(ui.asideTitle)}</p>
          <p>${fix(ui.asideBody)}</p>
        </aside>`
      : '';
  return `<section class="dl-panel" data-platform="${platform}" aria-labelledby="dl-h-${platform}">
        <h2 class="dl-panel-title" id="dl-h-${platform}">${platform === 'ios' ? ui.ios : ui.android}</h2>
        <div class="dl-list">
          ${cards}
        </div>${aside}
      </section>`;
}

const DETECT_SCRIPT = `      (function () {
        var body = document.body;
        var ua = navigator.userAgent || '';
        // iPadOS reports itself as a Mac; the touch check is what separates a
        // tablet from a desktop that would rather see both lists.
        var isIos =
          /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
        var isAndroid = /Android/.test(ua);
        var tabs = document.querySelectorAll('.dl-tab');

        function show(platform) {
          body.classList.toggle('dl-only-android', platform === 'android');
          body.classList.toggle('dl-only-ios', platform === 'ios');
          for (var i = 0; i < tabs.length; i++) {
            var mine = tabs[i].getAttribute('data-target') === platform;
            tabs[i].setAttribute('aria-pressed', mine ? 'true' : 'false');
          }
        }

        if (isAndroid) show('android');
        else if (isIos) show('ios');

        for (var i = 0; i < tabs.length; i++) {
          tabs[i].addEventListener('click', function () {
            show(this.getAttribute('data-target'));
          });
        }
      })();`;

function pageHtml(langMeta) {
  const code = langMeta.code;
  const ui = DOWNLOADS_UI[code] || DOWNLOADS_UI.en;
  const helpUi = HELP_UI[code] || HELP_UI.en;
  const rtl = langMeta.dir === 'rtl';
  const fix = rtl ? ltrPlus : (s) => s;
  const bodyClass = rtl ? ' class="help-rtl"' : '';
  return `<!DOCTYPE html>
<html lang="${code}" dir="${langMeta.dir}" class="theme-auto">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escAttr(metaDescription(ui.lead))}" />
    <title>${ui.title} — Healthings</title>
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
        <a href="index.html" aria-current="page">${ui.nav}</a>
        <a href="../help/index.html">${helpUi.help}</a>
        <a href="../the-clinic/">${(THE_CLINIC_UI[code] || THE_CLINIC_UI.en).nav}</a>
        <a href="../../index.html">${helpUi.home}</a>
      </nav>
      ${langSwitcher(code, helpUi.langLabel)}
      <section class="hero">
        <h1>${ui.title}</h1>
        <p class="lead">${fix(ui.lead)}</p>
      </section>

      <div class="dl-switch" role="group" aria-label="${escAttr(ui.pick)}">
        <button type="button" class="dl-tab" data-target="android" aria-pressed="false">${ui.android}</button>
        <button type="button" class="dl-tab" data-target="ios" aria-pressed="false">${ui.ios}</button>
      </div>
      <p class="dl-detected">${ui.detected}</p>

      ${panelHtml('android', ui, rtl)}

      ${panelHtml('ios', ui, rtl)}

      <p class="dl-foot">${fix(ui.foot)}</p>
      <p class="help-back"><a href="../help/index.html">${rtl ? '→' : '←'} ${helpUi.allTopics}</a></p>
    </main>

    <script>
${DETECT_SCRIPT}
    </script>
  </body>
</html>
`;
}

let wrote = 0;
for (const lang of HELP_LOCALES) {
  if (!DOWNLOADS_UI[lang.code]) {
    console.error('Missing downloads copy for', lang.code);
    process.exit(1);
  }
  const dir = join(WEB, lang.code, 'downloads');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), pageHtml(lang), 'utf8');
  wrote++;
}
console.log('Wrote', wrote, 'downloads pages under /{lang}/downloads');
