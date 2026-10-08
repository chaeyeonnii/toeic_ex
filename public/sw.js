const CACHE = "toeic-quiz-next-v4";
const SHELL = ["/offline.html", "/static/style.css", "/static/app.js", "/static/icon.svg", "/manifest.json", "/api/bank"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("toeic-quiz-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Keep framework assets and React Server Component requests out of the quiz cache.
  const navigation = request.mode === "navigate" && (url.pathname === "/" || url.pathname === "/offline.html");
  if (!navigation && !SHELL.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!navigation) await cache.put(request, response.clone());
      return response;
    } catch {
      return (await cache.match(navigation ? "/offline.html" : request)) ?? Response.error();
    }
  })());
});
