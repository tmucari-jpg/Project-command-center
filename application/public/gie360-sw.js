// GIE360° independent service worker: intentionally does not cache business
// data, sessions, PCC resources or AI replies. Network remains authoritative.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
