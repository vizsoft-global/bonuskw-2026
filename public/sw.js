const STATIC = "ba-static-v2";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Keep an offline page so a home-screen launch without network is not a blank error.
      try {
        const cache = await caches.open(STATIC);
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch {
        /* offline page is best effort */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== STATIC).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (
    url.pathname.startsWith("/api/video") ||
    url.pathname.startsWith("/api/checkout") ||
    url.pathname.startsWith("/api/auth")
  ) {
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(STATIC);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }),
    );
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.open(STATIC).then(async (cache) => {
      const cached = await cache.match(event.request);
      const fresh = fetch(event.request)
        .then((res) => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});
