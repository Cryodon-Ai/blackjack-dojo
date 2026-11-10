// Derive Hi-Lo index numbers for ANY table rules from the exact solver, by evaluating each decision on shoes
// whose composition matches a given true count. The shoe is scaled to `depth` decks remaining, then low cards
// (2-6) or high cards (10, A) are removed in proportion until the running count is TC x decks-left.
import { Solver } from './ev.js';
import { normalizeRules } from './rules.js';
import { INDEX_RULES, activeRules } from './indices.js';

const LOW = [2, 3, 4, 5, 6], HIGH = [1, 10];

export function compositionFor(rules, tc, decksLeft) {
  const d = rules.decks, c = new Float64Array(11);
  for (let r = 1; r <= 9; r++) c[r] = 4 * d * decksLeft / d;
  c[10] = 16 * d * decksLeft / d;
  const k = tc * decksLeft;                    // running count to build
  if (k > 0) { const per = k / LOW.length; for (const r of LOW) c[r] = Math.max(0, c[r] - per); }
  else if (k < 0) { const w = { 1: 4, 10: 16 }, tot = 20, m = -k; for (const r of HIGH) c[r] = Math.max(0, c[r] - m * w[r] / tot); }
  // removed low cards lower the deck size; removed high raise nothing. n = sum
  let n = 0; for (let r = 1; r <= 10; r++) n += c[r];
  return { c, n };
}

function evAt(solver, comp, up, cards, act) {
  solver.base = Float64Array.from(comp.c); solver.baseN = comp.n;
  const res = solver.evaluate(up, cards);
  const key = { S: 'stand', H: 'hit', D: 'double', P: 'split', R: 'surrender' }[act];
  return res.ev[key];
}

const handFor = (r) => {
  if (r.kind === 'tt') return [10, 10];
  for (let a = 2; a <= 10; a++) { const b = r.total - a; if (b > a && b <= 10) return [a, b]; }
  return null;
};

// Returns { id -> index } for the active rules (null when no crossing found in -8..+12).
export function solveIndices(rulesIn, { depth, tiers } = {}) {
  const rules = normalizeRules(rulesIn);
  if (!Number.isFinite(rules.decks)) return {};
  const dl = depth ?? Math.max(1, rules.decks / 2);
  const solver = new Solver(rules), out = {};
  for (const r of activeRules(rules, { tiers })) {
    const cards = handFor(r);
    const a = r.play, b = r.below;
    // advantage of the "play" action over the "below" action as a function of TC
    const diff = (tc) => evAt(solver, compositionFor(rules, tc, dl), r.up, cards, a) - evAt(solver, compositionFor(rules, tc, dl), r.up, cards, b);
    let found = null, prev = null;
    for (let tc = -8; tc <= 12; tc++) {
      const d = diff(tc);
      if (prev !== null && ((prev < 0 && d >= 0) || (prev >= 0 && d < 0))) { found = d >= 0 ? tc : tc + 1; break; }
      prev = d;
    }
    out[r.id] = found;
  }
  return out;
}
