/**
 * Clinic + account theme (be-31) — OS dark only, no Appearance picker.
 * Ensures `theme-clinic` on <html> and repaints charts when OS scheme flips.
 */
(function (global) {
  function ensureClinicThemeClass() {
    const root = document.documentElement;
    root.classList.remove('theme-auto', 'theme-pref-system', 'theme-pref-light', 'theme-pref-dark');
    root.classList.add('theme-clinic');
  }

  ensureClinicThemeClass();

  try {
    const mq = global.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      ensureClinicThemeClass();
      global.dispatchEvent(new CustomEvent('healthings-theme-change', { detail: { source: 'os' } }));
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  } catch { /* */ }

  global.ClinicTheme = { ensureClinicThemeClass };
})(window);
