// The kitchen app shares the site-wide service worker (scope covers /kitchen/).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {}));
}
