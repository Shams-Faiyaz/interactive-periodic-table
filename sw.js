/* Periodic Table PWA service worker */
const CACHE = "periodic-3d-v12";

// App shell served from our own origin (relative to the SW scope)
const CORE = [
  "./",
  "./index.html",
  "./css/index.css",
  "./js/index.js",
  "./table.html",
  "./css/table.css",
  "./js/icons.js",
  "./js/core.js",
  "./js/perf.js",
  "./js/tiles-gl.js",
  "./js/scene.js",
  "./js/controls.js",
  "./js/atoms.js",
  "./js/detail.js",
  "./js/starfield.js",
  "./js/sfx.js",
  "./js/main.js",
  "./js/elements-data.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.png",
  "./icons/favicon.ico"
];

// Precache the app shell so it opens offline and qualifies for install.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

// Drop old caches on activate so a new version fully replaces the old one.
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isHTML(req, url) {
  return req.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith(".html");
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // HTML / navigations: NETWORK-FIRST so the newest page always loads when online,
  // and fall back to the cached copy only when offline. This is what makes updates
  // show up immediately instead of being stuck on an old cached page.
  if (sameOrigin && isHTML(req, url)) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // Other same-origin assets (css, js, icons, manifest): stale-while-revalidate.
  // Serve the cached copy at once if there is one, and refresh the cache in the background.
  if (sameOrigin) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        });
        if (hit) {
          e.waitUntil(net.catch(() => {}));
          return hit;
        }
        return net;
      })
    );
    return;
  }

  // Cross-origin (three.js CDN, fonts): URLs are version-pinned, so cache-first,
  // network fallback that also stores the response for offline.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
