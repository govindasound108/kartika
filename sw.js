/* Kārtika — service worker: tutto in cache al primo avvio, poi funziona senza rete.
   Per pubblicare un aggiornamento, cambia il numero di VERSION. */
const VERSION = "kartika-v204";
const CORE = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];
const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600&family=Noto+Serif:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Noto+Serif+Devanagari:wght@400;600&display=swap";

/* Salva i font in cache; se mancano (o ne mancano dei pezzi) ci riprova a ogni apertura, in background. */
let fontsBusy = false;
async function cacheFonts() {
  if (fontsBusy) return;
  fontsBusy = true;
  try {
    const c = await caches.open(VERSION);
    let css;
    const have = await c.match(FONTS_CSS);
    if (have) css = await have.clone().text();
    else {
      const r = await fetch(FONTS_CSS);
      if (!r.ok) return;
      css = await r.clone().text();
      await c.put(FONTS_CSS, r);
    }
    const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
    await Promise.all(urls.map(async (u) => {
      if (await c.match(u)) return;
      try { const x = await fetch(u); if (x.ok) await c.put(u, x); } catch (_) {}
    }));
  } catch (_) {} finally { fontsBusy = false; }
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await Promise.all(CORE.map(async (u) => { const r = await fetch(new Request(u, { cache: "reload" })); if (!r.ok) throw new Error(u); await c.put(u, r); }));
    /* i font non devono mai bloccare l'installazione: massimo 8 secondi, poi si riprova alle aperture successive */
    await Promise.race([cacheFonts(), new Promise((res) => setTimeout(res, 8000))]);
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
    const uu = new URL(e.request.url);
    /* il controllo del tasto "aggiorna" (index.html?u=...) deve sempre chiedere alla rete, mai alla copia salvata */
    if (uu.origin === location.origin && uu.searchParams.has("u")) return fetch(new Request(e.request.url, { cache: "no-store" }));
    const isPage = e.request.mode === "navigate" || (uu.origin === location.origin && (uu.pathname.endsWith("/") || uu.pathname.endsWith("index.html") || uu.pathname.endsWith("sw.js") === false && uu.pathname.endsWith(".html")));
    if (isPage) {
      /* Apertura istantanea: si mostra subito la copia salvata e, in background, si scarica
         la versione nuova (visibile alla prossima apertura). Così il segnale debole non blocca mai l'avvio. */
      const old = await caches.match(e.request, { ignoreSearch: true }) || await caches.match("index.html");
      const refresh = fetch(new Request(e.request.url, { cache: "no-store" }))
        .then(async (r) => { if (r.ok) await (await caches.open(VERSION)).put(e.request, r.clone()); return r; })
        .catch(() => null);
      e.waitUntil(refresh);
      e.waitUntil(cacheFonts());
      if (old) return old;
      const fresh = await refresh;
      if (fresh && fresh.ok) return fresh;
    }
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
