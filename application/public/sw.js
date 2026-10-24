const CACHE_NAME = "project-command-center-v7";
const STATIC_ASSETS = [
  "/offline.html",
  "/offline-app.js",
  "/manifest.webmanifest",
  "/brand/pcc-logo-transparent.svg",
  "/brand/pcc-logo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function cacheSuccessful(request, response) {
  if (!response || !response.ok) return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/client-diagnostic/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const offline = await caches.match("/offline.html");
        return offline || Response.error();
      }),
    );
    return;
  }

  const cacheFirst =
    STATIC_ASSETS.includes(url.pathname) ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/");

  if (cacheFirst) {
    event.respondWith(
      caches.match(event.request).then(async (cached) => {
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          return cacheSuccessful(event.request, response);
        } catch {
          return Response.error();
        }
      }),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => cacheSuccessful(event.request, response))
      .catch(() => caches.match(event.request)),
  );
});
