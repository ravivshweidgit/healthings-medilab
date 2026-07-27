/**
 * Clinic + account Appearance preference (be-31).
 * Pref: system | light | dark → html class theme-pref-*.
 * Independent of landing page `.theme-auto` cool dark.
 */
(function (global) {
  const STORE_KEY = 'healthings_theme_pref';
  const PREFS = ['system', 'light', 'dark'];
  const CLASS_PREFIX = 'theme-pref-';

  function normalize(raw) {
    const v = String(raw || '').trim().toLowerCase();
    return PREFS.includes(v) ? v : 'system';
  }

  function getThemePref() {
    try {
      return normalize(localStorage.getItem(STORE_KEY));
    } catch {
      return 'system';
    }
  }

  function setThemePref(pref) {
    const next = normalize(pref);
    try {
      localStorage.setItem(STORE_KEY, next);
    } catch { /* private mode */ }
    applyThemePref(next);
    return next;
  }

  function applyThemePref(pref) {
    const next = normalize(pref ?? getThemePref());
    const root = document.documentElement;
    PREFS.forEach((p) => root.classList.remove(CLASS_PREFIX + p));
    root.classList.remove('theme-auto');
    root.classList.add(CLASS_PREFIX + next);
    return next;
  }

  function bindThemePickers() {
    const i18n = global.ClinicI18n;
    const t = (k) => (i18n?.t ? i18n.t(k) : k);
    const labels = {
      system: t('themeSystem'),
      light: t('themeLight'),
      dark: t('themeDark'),
    };
    // Fallbacks if i18n not loaded (account gate)
    if (labels.system === 'themeSystem') {
      labels.system = 'System';
      labels.light = 'Light';
      labels.dark = 'Dark';
    }

    document.querySelectorAll('[data-theme-picker]').forEach((sel) => {
      const current = getThemePref();
      sel.replaceChildren();
      PREFS.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = labels[p];
        if (p === current) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = () => {
        setThemePref(sel.value);
        document.querySelectorAll('[data-theme-picker]').forEach((other) => {
          if (other !== sel) other.value = sel.value;
        });
        global.dispatchEvent(new CustomEvent('healthings-theme-change', { detail: { pref: sel.value } }));
      };
    });
  }

  // Re-apply when OS scheme flips and pref is system
  try {
    const mq = global.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getThemePref() === 'system') applyThemePref('system');
      global.dispatchEvent(new CustomEvent('healthings-theme-change', { detail: { pref: 'system' } }));
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  } catch { /* */ }

  // Boot immediately so first paint is correct when this script is in <head>
  applyThemePref();

  global.ClinicTheme = {
    STORE_KEY,
    PREFS,
    getThemePref,
    setThemePref,
    applyThemePref,
    bindThemePickers,
  };
})(window);
