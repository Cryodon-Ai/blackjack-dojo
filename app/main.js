import { store } from './store.js';
import { ctx } from './ctx.js';
import { srs } from './srs.js';
import { engine } from './engine-client.js';

const screen = () => document.getElementById('screen');
let cleanup = null, token = 0;

const ROUTES = {
  learn: () => import('../screens/learn.js'),
  drill: () => import('../screens/drill.js'),
  play: () => import('../screens/play.js'),
  stats: () => import('../screens/stats.js'),
  cert: () => import('../screens/cert.js'),
};

function parse() {
  const h = location.hash.replace(/^#\/?/, '') || 'learn';
  const [name, ...rest] = h.split('/');
  return { name: ROUTES[name] ? name : 'learn', parts: rest };
}

async function route() {
  const my = ++token;
  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* ignore */ } }
  cleanup = null;
  document.getElementById('app').classList.remove('focus');
  const { name, parts } = parse();
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (name === 'cert' ? 'learn' : name)));
  const el = screen();
  el.scrollTop = 0;
  el.innerHTML = '<div class="dim" style="padding:40px 0;text-align:center">Loading…</div>';
  try {
    const mod = await ROUTES[name]();
    if (my !== token) return;
    el.innerHTML = '';
    const c = await mod.default(el, parts, ctx);
    if (my === token) cleanup = c; else if (typeof c === 'function') c();
  } catch (err) {
    console.error(err);
    el.innerHTML = `<h1>Something broke</h1><p class="dim">${ctx.esc(err.message || err)}</p><a class="btn block" href="#/learn">Back to Learn</a>`;
  }
}

async function boot() {
  await store.init();
  await ctx.load();
  await srs.load();
  window.addEventListener('hashchange', route);
  await route();
  // Fill the whole chart for the active rules in the background (lowest priority in the worker).
  setTimeout(() => engine.prefill(ctx.rules, () => {}), 1200);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    try { await navigator.serviceWorker.register('sw.js'); } catch { /* offline install unavailable */ }
  }
}
boot();
