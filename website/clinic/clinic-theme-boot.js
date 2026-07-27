/**
 * FOUC boot — apply theme-pref-* before paint (be-31).
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
  root.classList.remove('theme-auto', 'theme-clinic');
  root.classList.add('theme-pref-' + pref);
})();
