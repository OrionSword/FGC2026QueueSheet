// Offline cache: serve from cache immediately, refresh in the background.
// Bump CACHE when shipping a new data.js so phones pick it up promptly.
importScripts("data.js");
const CACHE = "fgcq-v8";
const FLAGS = Object.values((self.FGC_DATA && self.FGC_DATA.teams) || {}).map(t => t.flag).filter(Boolean);
const CORE = ["./", "index.html", "data.js", "pronounce.js", "manifest.webmanifest", "icon.svg", "apple-touch-icon.png", ...new Set(FLAGS)];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  // "Check for schedule update" asks for data.js?fresh=…: straight from the network, and the
  // answer replaces the cached copy so the next load uses it.
  const u = new URL(e.request.url);
  if (u.searchParams.has("fresh")) {
    u.search = "";
    e.respondWith(fetch(e.request, { cache: "no-store" }).then(async r => {
      if (r.ok) await (await caches.open(CACHE)).put(u.href, r.clone());
      return r;
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
