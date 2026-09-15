const CACHE_NAME = "md-editor-v4";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/editor.js",
  "./js/formatting.js",
  "./js/recent.js",
  "./js/linter.js",
  "./js/preview.js",
  "./js/fileio.js",
  "./manifest.json",
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for our own files, so edits show up on next reload instead of
// being masked by a stale cache; the cache is only a fallback for offline use.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // let the browser handle CDN modules

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
