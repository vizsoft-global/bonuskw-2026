const STATIC = "ba-static-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
  if (url.pathname.startsWith("/api/") || event.request.mode === "navigate") {
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
