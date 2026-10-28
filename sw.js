// Service worker: precache the whole app, serve cache-first, work fully offline.
// The two marked blocks are rewritten by `node tools/stamp.js` (run before every deploy).
/* STAMP:BUILD */ const BUILD = '11618dac1deb';
/* STAMP:PRECACHE */ const PRECACHE = ["./","./app/ctx.js","./app/edges.js","./app/engine-client.js","./app/feedback.js","./app/feel.js","./app/journal.js","./app/labcore.js","./app/look.js","./app/main.js","./app/presets.js","./app/shoe.js","./app/srs.js","./app/store.js","./app/why.js","./css/app.css","./curriculum/cells.js","./curriculum/claims.js","./curriculum/quizgen.js","./curriculum/tiers.js","./curriculum/tokens.js","./curriculum/traps.js","./data/edges.json","./engine/ev.js","./engine/round.js","./engine/rules.js","./engine/sidebets.js","./engine/sim.js","./engine/strategy.js","./engine/worker.js","./games/blackout.js","./games/count.js","./games/gravity.js","./games/live.js","./games/practice.js","./games/quiz.js","./games/runner.js","./icons/icon-180.png","./icons/icon-192.png","./icons/icon-512.png","./index.html","./manifest.webmanifest","./money/tools.js","./screens/cert.js","./screens/drill.js","./screens/guide.js","./screens/lab.js","./screens/learn.js","./screens/play.js","./screens/stats.js","./ui/cardart.js","./ui/cards.js","./ui/dealer.js","./ui/hand.js","./ui/rules-editor.js","./ui/sheet.js","./ui/shoe-settings.js","./ui/table.js"];
const CACHE = 'dojo-' + BUILD;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // addAll is atomic: if any file fails the install fails and the old version keeps running.
    await c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('dojo-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); }
    catch (err) {
      if (req.mode === 'navigate') { const idx = await c.match('./index.html'); if (idx) return idx; }
      throw err;
    }
  })());
});
