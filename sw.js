// ==================== MGTI Service Worker ====================
// 提供基础离线访问能力。该文件放在项目根目录，使 index.html 与 catalog.html 都能注册。
const MGTI_CACHE_VERSION = "mgti-cache-v5-answer-state-fix";
const MGTI_APP_SHELL = [
  "./",
  "./index.html",
  "./catalog.html",
  "./manifest.json",
  "./frontend/css/style.css",
  "./frontend/js/config.js",
  "./frontend/js/data.js",
  "./frontend/js/test.js",
  "./frontend/js/catalog.js",
  "./data/dimensions.json",
  "./data/questions.json",
  "./data/result_templates.json",
  "./data/heroes_profile.json",
  "./data/champions.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/og/mgti-og.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(MGTI_CACHE_VERSION);
    await Promise.allSettled(MGTI_APP_SHELL.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith("mgti-cache-") && key !== MGTI_CACHE_VERSION)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(MGTI_CACHE_VERSION);
        cache.put(request, networkResponse.clone());
        return networkResponse;
      } catch (error) {
        return (await caches.match(request)) || (await caches.match("./index.html"));
      }
    })());
    return;
  }

  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith((async () => {
      const cache = await caches.open(MGTI_CACHE_VERSION);
      try {
        const networkResponse = await fetch(request);
        cache.put(request, networkResponse.clone());
        return networkResponse;
      } catch (error) {
        return (await cache.match(request)) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.endsWith(".json")) {
    event.respondWith((async () => {
      const cache = await caches.open(MGTI_CACHE_VERSION);
      try {
        const networkResponse = await fetch(request);
        cache.put(request, networkResponse.clone());
        return networkResponse;
      } catch (error) {
        return (await cache.match(request)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    const networkResponse = await fetch(request);
    const cache = await caches.open(MGTI_CACHE_VERSION);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  })());
});
