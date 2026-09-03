/*
 * Applied before first paint, so an explicit appearance choice never flashes
 * the system one first. The app re-applies it on mount; this only matters for
 * the first frame.
 *
 * A separate file rather than an inline script on purpose: the deployed
 * Content-Security-Policy is `script-src 'self'`, and an inline script would
 * either be blocked or force a hash into the policy that has to be kept in step
 * with this code by hand.
 */
(function () {
  try {
    var theme = localStorage.getItem('liha.theme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch {
    // Storage blocked: fall through to the system appearance.
  }
})();
