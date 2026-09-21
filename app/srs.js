// Spaced repetition: every (hand, upcard, ruleset) cell is a flashcard.
// Misses resurface inside the same session, then at 1 / 3 / 7 / 21 days (SM-2-style ease afterwards).
// Queue order: session misses -> due cells -> weakest zone -> new/random.

import { store } from './store.js';
import { cellKey, ROW } from '../curriculum/cells.js';

const DAY = 86400000;
const LADDER = [1, 3, 7, 21];

const blank = (rowKey, up, rules, key) => ({
  key, rowKey, up, ruleSetKey: key.split('|')[2], attempts: 0, correct: 0, lastSeen: 0,
  interval: 0, ease: 2.5, level: 0, evLostTotal: 0, due: 0, lastCorrect: null,
});

export const srs = {
  cache: new Map(),          // key -> cell (write-through)
  loaded: false,

  async load() {
    if (this.loaded) return;
    for (const c of await store.allCells()) this.cache.set(c.key, c);
    this.loaded = true;
  },

  get(rowKey, up, rules) {
    const key = cellKey(rowKey, up, rules);
    return this.cache.get(key) || null;
  },

  // Record one answer. evLoss = fraction of a bet lost by the choice (0 when correct).
  async record(rowKey, up, rules, correct, evLoss = 0) {
    const key = cellKey(rowKey, up, rules);
    const c = this.cache.get(key) || blank(rowKey, up, rules, key);
    const now = Date.now();
    c.attempts++; c.lastSeen = now; c.evLostTotal += evLoss || 0; c.lastCorrect = correct;
    if (correct) {
      c.correct++;
      c.level = Math.min(c.level + 1, 12);
      c.interval = c.level <= LADDER.length ? LADDER[c.level - 1] : Math.min(180, Math.round(c.interval * c.ease));
      c.ease = Math.min(3.0, c.ease + 0.05);
    } else {
      c.level = 0; c.interval = 0;
      c.ease = Math.max(1.3, c.ease - 0.2);
    }
    c.due = now + c.interval * DAY;
    this.cache.set(key, c);
    await store.putCell(c);
    return c;
  },

  accuracy(c) { return c && c.attempts ? c.correct / c.attempts : null; },

  dueCells(rules, pool, now = Date.now()) {
    const out = [];
    for (const p of pool) {
      const c = this.get(p.rowKey, p.up, rules);
      if (c && c.attempts && c.due <= now) out.push({ ...p, overdue: now - c.due });
    }
    return out.sort((a, b) => b.overdue - a.overdue);
  },

  dueCount(rules, pool) { return this.dueCells(rules, pool).length; },
};

// Session queue: missed cells return after a few other cards.
export class DrillQueue {
  constructor(pool, rules, { weakBias = 0.35, newBias = 0.25 } = {}) {
    this.pool = pool; this.rules = rules; this.weakBias = weakBias; this.newBias = newBias;
    this.misses = [];           // { item, wait }
    this.recent = [];
  }
  notifyMiss(item) { this.misses.push({ item, wait: 3 + Math.floor(Math.random() * 3) }); }
  next() {
    for (const m of this.misses) m.wait--;
    const ready = this.misses.findIndex((m) => m.wait <= 0);
    if (ready >= 0) return this._take(this.misses.splice(ready, 1)[0].item);
    const due = srs.dueCells(this.rules, this.pool).filter((c) => !this._recently(c));
    if (due.length) return this._take(due[0]);
    const r = Math.random();
    const seen = this.pool.filter((p) => srs.get(p.rowKey, p.up, this.rules)?.attempts);
    if (r < this.weakBias && seen.length) {
      const weak = seen.map((p) => ({ p, a: srs.accuracy(srs.get(p.rowKey, p.up, this.rules)) }))
        .filter((x) => x.a < 0.9 && !this._recently(x.p)).sort((a, b) => a.a - b.a).slice(0, 8);
      if (weak.length) return this._take(weak[Math.floor(Math.random() * weak.length)].p);
    }
    const unseen = this.pool.filter((p) => !srs.get(p.rowKey, p.up, this.rules) && !this._recently(p));
    if (unseen.length && Math.random() < this.newBias + (seen.length ? 0 : 1)) return this._take(unseen[Math.floor(Math.random() * unseen.length)]);
    const cand = this.pool.filter((p) => !this._recently(p));
    const arr = cand.length ? cand : this.pool;
    return this._take(arr[Math.floor(Math.random() * arr.length)]);
  }
  _recently(p) { return this.recent.some((q) => q.rowKey === p.rowKey && q.up === p.up); }
  _take(p) { const item = { rowKey: p.rowKey, up: p.up }; this.recent.push(item); if (this.recent.length > 6) this.recent.shift(); return item; }
}

// ---- mastery gates: >=95% over 50 consecutive decisions -------------------------------------
export const GATE = { window: 50, needed: 48 };      // 48/50 = 96%; 47/50 = 94% is below 95%

export function gateState(progress) {
  const w = (progress && progress.window) || [];
  const correct = w.reduce((a, b) => a + b, 0);
  return { n: w.length, correct, passed: w.length >= GATE.window && correct >= GATE.needed, remainingErrors: Math.max(0, w.length - GATE.needed) };
}
export function pushGate(progress, ok) {
  const p = progress || { window: [], best: 0, passed: false, attempts: 0 };
  p.window = [...(p.window || []), ok ? 1 : 0].slice(-GATE.window);
  p.attempts = (p.attempts || 0) + 1;
  // best run of consecutive correct answers
  let run = 0, best = p.best || 0;
  for (const v of p.window) { run = v ? run + 1 : 0; best = Math.max(best, run); }
  p.best = best;
  const g = gateState(p);
  if (g.passed) p.passed = true;
  return p;
}
