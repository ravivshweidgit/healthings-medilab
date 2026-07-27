/**
 * Clinic + account Appearance (be-31 restore).
 * Pref: system | light | dark → html class theme-pref-*.
 * App darkColors; landing keeps cool .theme-auto.
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
    root.classList.remove('theme-auto', 'theme-clinic');
    root.classList.add(CLASS_PREFIX + next);
    return next;
  }

  function bindThemePickers() {
    const i18n = global.ClinicI18n;
    const t = (k, fallback) => {
      if (!i18n?.t) return fallback;
      const v = i18n.t(k);
      return !v || v === k ? fallback : v;
    };
    const labels = {
      system: t('themeSystem', 'System'),
      light: t('themeLight', 'Light'),
      dark: t('themeDark', 'Dark'),
    };

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
        global.dispatchEvent(
          new CustomEvent('healthings-theme-change', { detail: { pref: sel.value } }),
        );
      };
    });
  }

  try {
    const mq = global.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getThemePref() === 'system') {
        applyThemePref('system');
        global.dispatchEvent(
          new CustomEvent('healthings-theme-change', { detail: { pref: 'system' } }),
        );
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  } catch { /* */ }

  applyThemePref();

  global.ClinicTheme = {
    STORE_KEY,
    PREFS,
    getThemePref,
    setThemePref,
    applyThemePref,
    bindThemePickers,
    /** @deprecated use applyThemePref — kept for older boot snippets */
    ensureClinicThemeClass: () => applyThemePref(),
  };
})(window);
