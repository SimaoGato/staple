// Blocking, runs before first paint (CSP forbids inline). Keep in sync with src/theme.ts.
(function () {
  var t;
  try {
    t = localStorage.getItem('staple-theme');
  } catch (e) {}
  if (t !== 'light' && t !== 'dark')
    t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
})();
