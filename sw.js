const CACHE_NAME = "bem2027-studio-shell-v1.2.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js?v=1.2.0",
  "./ai-bridge.js?v=1.2.0",
  "./media-library.js?v=1.0.2",
  "./renderer.js?v=1.0.2",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./vendor/ffmpeg/worker.js",
  "./vendor/ffmpeg/const.js",
  "./vendor/ffmpeg/errors.js"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("bem2027-studio-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok && request.url.startsWith(self.location.origin)) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request).then(cached => cached || caches.match("./index.html"))));
});
