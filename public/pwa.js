// Registers the service worker (public/sw.js). Kept out of print renders' way: it does nothing
// to the page itself.
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
