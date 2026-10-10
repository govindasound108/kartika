/* Kārtika — service worker: tutto in cache al primo avvio, poi funziona senza rete.
   Per pubblicare un aggiornamento, cambia il numero di VERSION. */
const VERSION = "kartika-v5";
const CORE = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];
const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600&family=Noto+Serif:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Noto+Serif+Devanagari:wght@400;600&display=swap";

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    try {
      const r = await fetch(FONTS_CSS);
      const css = await r.clone().text();
      await c.put(FONTS_CSS, r);
      const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
      await Promise.all(urls.map((u) => fetch(u).then((x) => c.put(u, x)).catch(() => {})));
    } catch (_) {}
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith((async () => {
    const hit = await caches.match(e.request);
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      const u = new URL(e.request.url);
      if (res.ok && (u.origin === location.origin || u.hostname.endsWith("gstatic.com") || u.hostname.endsWith("googleapis.com"))) {
        (await caches.open(VERSION)).put(e.request, res.clone());
      }
      return res;
    } catch (_) {
      if (e.request.mode === "navigate") return caches.match("index.html");
      throw _;
    }
  })());
});
