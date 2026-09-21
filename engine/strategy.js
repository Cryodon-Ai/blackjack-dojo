// Parameterised basic-strategy engine. Everything the UI shows about "the right play" comes from here.
//
//   decide(rules, cards, up) -> { action, ev, legal, margin, ... }
//   buildChart(rules)        -> every chart cell, generated live from the solver
//
// Actions: 'H' hit, 'S' stand, 'D' double, 'P' split, 'R' surrender.

import { Solver } from './ev.js';
import { normalizeRules, rulesKey, UPCARDS } from './rules.js';

// Bump when ev.js / strategy.js results can change: invalidates every cached engine result in the app.
export const ENGINE_VERSION = 'e2';

const solvers = new Map();
export function getSolver(rules) {
  const norm = normalizeRules(rules);
  const key = rulesKey(norm);
  let s = solvers.get(key);
  if (!s) { s = new Solver(norm); solvers.set(key, s); }
  return s;
}

const ACTION_OF = { stand: 'S', hit: 'H', double: 'D', split: 'P', surrender: 'R' };
// Preference when two actions have (numerically) identical EV.
const TIE_ORDER = ['stand', 'hit', 'double', 'split', 'surrender'];

export function pickBest(res) {
  if (res.blackjack) return { action: 'S', margin: 0, ranked: [['stand', res.ev.stand]] };
  const ranked = TIE_ORDER
    .filter((a) => res.legal[a] && res.ev[a] !== undefined)
    .map((a) => [a, res.ev[a]])
    .sort((x, y) => (Math.abs(y[1] - x[1]) < 1e-12 ? 0 : y[1] - x[1]));
  const margin = ranked.length > 1 ? ranked[0][1] - ranked[1][1] : Infinity;
  return { action: ACTION_OF[ranked[0][0]], margin, ranked };
}

export function decide(rules, cards, up) {
  const res = getSolver(rules).evaluate(up, cards);
  const best = pickBest(res);
  return { ...res, action: best.action, margin: best.margin, ranked: best.ranked };
}

// ---- chart definition -------------------------------------------------------------------
// Representative two-card hands (chosen to avoid pairs where a non-pair hand exists).
const HARD_REPS = {
  5: [2, 3], 6: [2, 4], 7: [3, 4], 8: [3, 5], 9: [4, 5], 10: [4, 6], 11: [5, 6],
  12: [10, 2], 13: [10, 3], 14: [10, 4], 15: [10, 5], 16: [10, 6],
  17: [10, 7], 18: [10, 8], 19: [10, 9], 20: [10, 10],
  21: [10, 6, 5],   // no two-card hard 21 exists; three-card hand
};

export function chartRows() {
  const rows = [];
  for (let t = 5; t <= 21; t++) rows.push({ key: `H${t}`, kind: 'hard', total: t, label: `Hard ${t}`, cards: HARD_REPS[t] });
  for (let k = 2; k <= 9; k++) rows.push({ key: `A${k}`, kind: 'soft', label: `A,${k}`, cards: [1, k] });
  for (let k = 2; k <= 10; k++) rows.push({ key: `${k === 10 ? 'TT' : `${k}${k}`}`, kind: 'pair', label: k === 10 ? 'T,T' : `${k},${k}`, cards: [k, k] });
  rows.push({ key: 'AA', kind: 'pair', label: 'A,A', cards: [1, 1] });
  return rows;
}

// All two-card hard-total compositions (no aces) for hard 5..20, used for total-dependent cells.
function hardCompositions(total) {
  const hands = [];
  for (let a = 2; a <= 10; a++) { const b = total - a; if (b >= a && b <= 10) hands.push([a, b]); }
  return hands;
}

// One chart cell. Hard 5..20 are total-dependent averages over every non-ace composition;
// soft, pair and hard-21 cells are a single specific hand.
export function evaluateCell(rules, row, up) {
  const solver = getSolver(rules);
  if (row.kind === 'hard' && row.total <= 20) return solver.evaluateTotal(up, hardCompositions(row.total));
  return solver.evaluate(up, row.cards);
}

export function buildChart(rules, { onRow } = {}) {
  const out = [];
  for (const row of chartRows()) {
    const cells = {};
    for (const up of UPCARDS) {
      const res = evaluateCell(rules, row, up);
      const best = pickBest(res);
      cells[up] = { action: best.action, margin: best.margin, ev: res.ev, legal: res.legal };
    }
    out.push({ ...row, cells });
    if (onRow) onRow(row);
  }
  return out;
}

// For each hard two-card total, do all compositions agree on the action? (informational)
export function compositionDisagreements(rules) {
  const solver = getSolver(rules);
  const found = [];
  for (let total = 5; total <= 20; total++) {
    for (const up of UPCARDS) {
      const seen = new Map();
      for (let a = 1; a <= 10; a++) {
        const b = total - a;
        if (b < a || b > 10 || a === 1 || b === 1 || a === b) continue; // hard, non-pair
        const res = solver.evaluate(up, [a, b]);
        seen.set(`${a},${b}`, pickBest(res).action);
      }
      if (new Set(seen.values()).size > 1) found.push({ total, up, actions: Object.fromEntries(seen) });
    }
  }
  return found;
}

// One chart cell by row key + upcard, in a plain serialisable shape (used by the worker/UI).
export function cellResult(rules, rowKey, up) {
  const row = chartRows().find((r) => r.key === rowKey);
  if (!row) throw new Error('unknown chart row ' + rowKey);
  const res = evaluateCell(rules, row, up);
  const best = pickBest(res);
  return { rowKey, up, action: best.action, margin: best.margin === Infinity ? null : best.margin, ev: res.ev, legal: res.legal };
}

// Serialisable decision for one specific hand (any number of cards).
export function decideResult(rules, cards, up) {
  const r = decide(rules, cards, up);
  return { up, cards, hard: r.hard, soft: r.soft, total: r.total, blackjack: r.blackjack, action: r.action,
    margin: r.margin === Infinity ? null : r.margin, ev: r.ev, legal: r.legal, pBJ: r.pBJ };
}
