const CACHE = "gie360-static-v1";
const STATIC = ["/gie360/offline.html", "/gie360/logo.png", "/gie360/icon-192.png", "/gie360/icon-512.png", "/gie360/icon-maskable-512.png", "/gie360/apple-touch-icon.png", "/gie360/manifest.webmanifest"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("gie360-static-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (STATIC.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  } else if (event.request.mode === "navigate" && url.pathname.startsWith("/gie360")) {
    // No authenticated HTML, questionnaire, import or AI answer is cached.
    event.respondWith(fetch(event.request).catch(async () => await caches.match("/gie360/offline.html") || Response.error()));
  }
});
