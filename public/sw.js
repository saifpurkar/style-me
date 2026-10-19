// Minimal service worker so browsers treat Style Me as an installable app.
// It deliberately caches nothing: every page and photo is always fetched fresh,
// so an update to the site shows up immediately and nothing goes stale.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Pass-through: let the network handle every request as usual.
});
