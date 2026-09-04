const CACHE = "aliremind-v3";
const ASSETS = ["/", "/index.html", "/styles.css?v=3", "/app.js?v=3", "/manifest.json?v=3", "/icon.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener("fetch", event => { if (event.request.method === "GET" && new URL(event.request.url).origin === location.origin) event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))); });
