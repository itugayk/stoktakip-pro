// StokTakip Pro — Service Worker (PWA Offline Support)
// Strategy:
//   - Static assets (`/_next/static/*`, icons, css, js) → CacheFirst
//   - Navigation (HTML)                                 → StaleWhileRevalidate
//   - Server actions / API POSTs                        → NetworkFirst, fail → background-sync
//   - GET API                                            → NetworkFirst, fail → cached
//
// The offline write-queue lives in IndexedDB; pages call window.bgSync.queue(...)
// directly. The SW only signals connectivity; the page-side replay happens
// when `online` event fires.

const STATIC_CACHE = "stoktakip-static-v3";
const RUNTIME_CACHE = "stoktakip-runtime-v3";
const OFFLINE_URL = "/offline";

const PRECACHE_ASSETS = [
  "/",
  "/dashboard",
  "/offline",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_ASSETS).catch(() => {
        /* some routes need auth; ignore failures */
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ---- Fetch handlers ----

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't intercept anything off-origin.
  if (url.origin !== self.location.origin) return;

  // 1) Static assets: cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(css|js|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|avif|ico)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 2) Navigation (HTML page loads): network-first. The app shell is auth-gated
  //    and changes on every deploy, so always prefer fresh HTML when online and
  //    fall back to cache (then the offline page) only when the network fails.
  //    Serving stale HTML here would pin the user to an old build's JS chunks.
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  // 3) API GET: network-first, cached fallback.
  if (request.method === "GET" && (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_actions/"))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 4) Everything else (POST mutations, etc.): pass through; the page layer
  //    handles the queue on failure via window.bgSync.
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || new Response("", { status: 504, statusText: "offline" });
  }
}

async function navigationNetworkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return caches.match(OFFLINE_URL).then((o) => o ?? new Response("Offline", { status: 503 }));
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ ok: false, error: "offline" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
}

// Optional: respond to a client message to skip waiting on a new SW.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
