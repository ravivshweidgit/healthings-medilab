/** FOUC: mark clinic/account pages before paint (be-31). */
(function () {
  var root = document.documentElement;
  root.classList.remove('theme-auto', 'theme-pref-system', 'theme-pref-light', 'theme-pref-dark');
  root.classList.add('theme-clinic');
})();
