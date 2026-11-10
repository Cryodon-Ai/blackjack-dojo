// Generic spaced-attention tracker for every game that is not blackjack basic strategy (which has its own SRS).
// profile.weak = { 'poker:preflop': { 'A5s|BTN': { n, c, t } } }  (n tries, c correct, t last time)
const MAXKEYS = 500;
export function rec(ctx, game, key, ok) {
  const w = ((ctx.profile.weak ||= {})[game] ||= {});
  const e = (w[key] ||= { n: 0, c: 0, t: 0 });
  e.n++; if (ok) e.c++; e.t = Date.now();
  const keys = Object.keys(w);
  if (keys.length > MAXKEYS) { keys.sort((a, b) => w[a].t - w[b].t).slice(0, keys.length - MAXKEYS).forEach((k) => delete w[k]); }
}
// Weakest items: at least `min` tries, lowest accuracy first, recent misses weigh more.
export function worst(ctx, { game = null, n = 10, min = 2 } = {}) {
  const out = [];
  for (const [g, items] of Object.entries(ctx.profile.weak || {})) {
    if (game && !g.startsWith(game)) continue;
    for (const [k, e] of Object.entries(items)) if (e.n >= min && e.c < e.n) out.push({ game: g, key: k, n: e.n, c: e.c, rate: e.c / e.n, t: e.t });
  }
  return out.sort((a, b) => a.rate - b.rate || b.n - a.n || b.t - a.t).slice(0, n);
}
export const acc = (ctx, game) => {
  let n = 0, c = 0;
  for (const [g, items] of Object.entries(ctx.profile.weak || {})) if (g.startsWith(game)) for (const e of Object.values(items)) { n += e.n; c += e.c; }
  return { n, c, rate: n ? c / n : null };
};
// Items to put in front of someone (weighted toward misses): returns keys.
export function pickWeighted(ctx, game, candidates) {
  const w = (ctx.profile.weak || {})[game] || {};
  const ws = candidates.map((k) => { const e = w[k]; return e && e.n ? 1 + 3 * (1 - e.c / e.n) : 1.5; });
  let r = Math.random() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidates.length; i++) { r -= ws[i]; if (r < 0) return candidates[i]; }
  return candidates[0];
}
