/**
 * Sync FOUC boot — keep tiny; full ClinicTheme loads after.
 * Inline duplicate of apply so class exists before CSS paint when placed in <head>.
 */
(function () {
  var KEY = 'healthings_theme_pref';
  var PREFS = ['system', 'light', 'dark'];
  var pref = 'system';
  try {
    var raw = String(localStorage.getItem(KEY) || '').trim().toLowerCase();
    if (PREFS.indexOf(raw) >= 0) pref = raw;
  } catch (e) { /* */ }
  var root = document.documentElement;
  for (var i = 0; i < PREFS.length; i++) root.classList.remove('theme-pref-' + PREFS[i]);
  root.classList.remove('theme-auto');
  root.classList.add('theme-pref-' + pref);
})();
