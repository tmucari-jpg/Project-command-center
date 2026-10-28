const CACHE_NAME = "project-command-center-v11";
const STATIC_ASSETS = [
  "/offline.html",
  "/offline-app.js",
  "/manifest.webmanifest",
  "/brand/pcc-logo-transparent.svg",
  "/brand/pcc-logo.png",
  "/brand/pcc-logo-official.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => { for (const asset of STATIC_ASSETS) { try { const response = await fetch(asset, { credentials: "same-origin", redirect: "manual" }); if (response.ok && !response.redirected && response.type !== "opaqueredirect") await cache.put(asset, response); } catch { /* Optional offline assets must not prevent installation. */ } } }));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("project-command-center-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
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
  if (url.pathname === "/gie360" || url.pathname.startsWith("/gie360/")) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/client-diagnostic/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const offline = await caches.match("/offline.html");
        return offline || new Response("Sem ligação. Volte a tentar quando a rede estiver disponível.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
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
          return new Response("Recurso indisponível", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        }
      }),
    );
    return;
  }

  // Only explicitly static resources belong in the shared cache.
});
