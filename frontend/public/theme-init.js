/*
 * Applies the saved colour theme before the first paint (no light/dark flash).
 * Loaded as an external file so it also works under a strict Content-Security-Policy.
 * Mirrors src/features/theme/ThemeProvider.tsx.
 */
(function () {
  var pref = 'system';
  try {
    pref = localStorage.getItem('alf-theme') || 'system';
  } catch (e) {
    /* storage unavailable: follow the system */
  }
  var dark =
    pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
