// Module worker: runs the exact solver off the main thread. UI requests outrank background prefill.
import { cellResult, decideResult, chartRows } from './strategy.js';
import { dealerTable } from './sim.js';
import { Solver } from './ev.js';
import { UPCARDS } from './rules.js';

const HIGH = [], LOW = [];
let running = false;

function handle(m) {
  switch (m.op) {
    case 'cell': return cellResult(m.rules, m.rowKey, m.up);
    case 'decide': return decideResult(m.rules, m.cards, m.up);
    case 'dealer': return dealerTable(m.rules, m.up);
    case 'edge': return new Solver(m.rules).houseEdge();
    default: throw new Error('unknown op ' + m.op);
  }
}

async function pump() {
  if (running) return;
  running = true;
  for (;;) {
    const job = HIGH.shift() || LOW.shift();
    if (!job) break;
    try {
      if (job.prefill) {
        const r = cellResult(job.rules, job.rowKey, job.up);
        self.postMessage({ type: 'prefill', rulesKey: job.rulesKey, rowKey: job.rowKey, up: job.up, result: r, remaining: LOW.length });
      } else {
        self.postMessage({ id: job.id, ok: true, result: handle(job) });
      }
    } catch (err) {
      if (!job.prefill) self.postMessage({ id: job.id, ok: false, error: String(err && err.message || err) });
    }
    await new Promise((r) => setTimeout(r, 0));   // let new requests interleave
  }
  running = false;
}

self.onmessage = (e) => {
  const m = e.data;
  if (m.op === 'prefill') {
    LOW.length = 0;
    for (const row of chartRows()) for (const up of UPCARDS) LOW.push({ prefill: true, rules: m.rules, rulesKey: m.rulesKey, rowKey: row.key, up });
  } else if (m.op === 'cancel-prefill') LOW.length = 0;
  else HIGH.push(m);
  pump();
};
self.postMessage({ type: 'ready' });
