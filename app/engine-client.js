// Promise API over the engine worker, with a memory + IndexedDB result cache.
// Falls back to running the engine on the main thread if module workers are unavailable.

import { store } from './store.js';
import { rulesKey, normalizeRules } from '../engine/rules.js';
import { ENGINE_VERSION } from '../engine/strategy.js';

let worker = null, workerFailed = false, direct = null, nextId = 1;
const pending = new Map();
const mem = new Map();
let prefillHandlers = new Set();

function startWorker() {
  if (worker || workerFailed) return;
  try {
    worker = new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'prefill') {
        const k = `${m.rulesKey}|${m.rowKey}|${m.up}`;
        mem.set(k, m.result);
        store.cacheSet(`${ENGINE_VERSION}|${k}`, m.result);
        for (const h of prefillHandlers) h(m);
        return;
      }
      if (m.type === 'ready') return;
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      m.ok ? p.resolve(m.result) : p.reject(new Error(m.error));
    };
    worker.onerror = () => { workerFailed = true; worker = null; for (const [, p] of pending) p.reject(new Error('worker failed')); pending.clear(); };
  } catch { workerFailed = true; worker = null; }
}

async function directEngine() {
  if (!direct) direct = { s: await import('../engine/strategy.js'), m: await import('../engine/sim.js'), e: await import('../engine/ev.js') };
  return direct;
}

async function call(op, payload) {
  startWorker();
  if (worker) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, op, ...payload });
    });
  }
  const d = await directEngine();
  await new Promise((r) => setTimeout(r, 0));
  if (op === 'cell') return d.s.cellResult(payload.rules, payload.rowKey, payload.up);
  if (op === 'decide') return d.s.decideResult(payload.rules, payload.cards, payload.up);
  if (op === 'dealer') return d.m.dealerTable(payload.rules, payload.up);
  if (op === 'edge') return new d.e.Solver(payload.rules).houseEdge();
  throw new Error('unknown op');
}

export const engine = {
  key: (rules) => rulesKey(rules),

  // One chart cell (total-dependent for hard totals). Cached forever per (engine version, rules, cell).
  async cell(rules, rowKey, up) {
    const rk = rulesKey(rules);
    const k = `${rk}|${rowKey}|${up}`;
    if (mem.has(k)) return mem.get(k);
    const cached = await store.cacheGet(`${ENGINE_VERSION}|${k}`);
    if (cached) { mem.set(k, cached); return cached; }
    const r = await call('cell', { rules: normalizeRules(rules), rowKey, up });
    mem.set(k, r);
    store.cacheSet(`${ENGINE_VERSION}|${k}`, r);
    return r;
  },

  // Exact decision for a specific hand (composition-dependent), any number of cards.
  async decide(rules, cards, up) {
    const k = `d|${rulesKey(rules)}|${[...cards].sort((a, b) => a - b).join(',')}|${up}`;
    if (mem.has(k)) return mem.get(k);
    const r = await call('decide', { rules: normalizeRules(rules), cards, up });
    mem.set(k, r);
    return r;
  },

  async dealer(rules, up) {
    const k = `t|${rulesKey(rules)}|${up}`;
    if (mem.has(k)) return mem.get(k);
    const cached = await store.cacheGet(`${ENGINE_VERSION}|${k}`);
    if (cached) { mem.set(k, cached); return cached; }
    const r = await call('dealer', { rules: normalizeRules(rules), up });
    mem.set(k, r);
    store.cacheSet(`${ENGINE_VERSION}|${k}`, r);
    return r;
  },

  async edgeExact(rules) { return call('edge', { rules: normalizeRules(rules) }); },

  // Fill the whole chart in the background (lowest priority). onProgress({done,total}).
  prefill(rules, onProgress) {
    startWorker();
    const rk = rulesKey(rules);
    const total = 350;
    if (!worker) { onProgress && onProgress({ done: 0, total, unsupported: true }); return () => {}; }
    let done = 0;
    const seen = new Set();
    const h = (m) => {
      if (m.rulesKey !== rk) return;
      seen.add(`${m.rowKey}|${m.up}`);
      done = seen.size;
      onProgress && onProgress({ done, total });
    };
    prefillHandlers.add(h);
    worker.postMessage({ op: 'prefill', rules: normalizeRules(rules), rulesKey: rk });
    return () => { prefillHandlers.delete(h); if (worker) worker.postMessage({ op: 'cancel-prefill' }); };
  },

  cachedCount(rules) {
    const rk = rulesKey(rules);
    let n = 0;
    for (const k of mem.keys()) if (k.startsWith(rk + '|') && !k.startsWith('d|') && !k.startsWith('t|')) n++;
    return n;
  },
  peek(rules, rowKey, up) { return mem.get(`${rulesKey(rules)}|${rowKey}|${up}`); },
};
