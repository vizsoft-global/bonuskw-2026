const STATIC = "ba-static-v4";
const IMAGES = "ba-images-v1";
const IMAGE_HOSTS = ["imagedelivery.net", "firebasestorage.googleapis.com", "storage.googleapis.com"];
const IMAGE_LIMIT = 400;
const IMAGE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const AGES = "ba-images-ages";
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
      await Promise.all(
        keys.filter((key) => key !== STATIC && !key.startsWith("ba-images")).map((key) => caches.delete(key)),
      );
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
  // Only this origin is cached. Firestore, Identity Toolkit and everything
  // else cross-origin must reach the network untouched: the cache-first branch
  // below used to swallow Firestore's long-polling webchannel, which made a
  // read hang instead of resolve — a student would sit on a loader until they
  // reloaded the page. Cross-origin images are handled by the branch below.
  if (url.origin !== self.location.origin && !IMAGE_HOSTS.includes(url.hostname)) return;
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
  if (IMAGE_HOSTS.includes(url.hostname)) {
    event.respondWith(imageFromCache(event.request));
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

/** Cache-first for images, including opaque cross-origin responses. */
async function imageFromCache(request) {
  const cache = await caches.open(IMAGES);
  const hit = await cache.match(request);
  if (hit && !(await imageExpired(request))) return hit;
  const res = await fetch(request);
  if (res && (res.ok || res.type === "opaque")) {
    await cache.put(request, res.clone());
    await rememberImage(request);
    trimImages(cache);
  }
  return res;
}

async function readAges() {
  const cache = await caches.open(AGES);
  const hit = await cache.match("/__ba_image_ages");
  if (!hit) return {};
  try {
    return await hit.json();
  } catch {
    return {};
  }
}

async function writeAges(ages) {
  const cache = await caches.open(AGES);
  await cache.put("/__ba_image_ages", new Response(JSON.stringify(ages)));
}

async function imageExpired(request) {
  const ages = await readAges();
  const at = ages[request.url];
  return typeof at === "number" && Date.now() - at > IMAGE_MAX_AGE;
}

async function rememberImage(request) {
  const ages = await readAges();
  ages[request.url] = Date.now();
  const cache = await caches.open(IMAGES);
  const keys = await cache.keys();
  const live = new Set(keys.map((key) => key.url));
  for (const url of Object.keys(ages)) {
    if (!live.has(url)) delete ages[url];
  }
  await writeAges(ages);
}

async function trimImages(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMAGE_LIMIT) return;
  await Promise.all(keys.slice(0, keys.length - IMAGE_LIMIT).map((key) => cache.delete(key)));
}
