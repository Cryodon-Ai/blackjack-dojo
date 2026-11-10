// Sanity checks for engine/indices.js against the exact solver: at every index rule, basic strategy
// (what the solver says with no count information) must be one of the rule's two actions.
import { decide } from '../engine/strategy.js';
import { DEFAULT_RULES } from '../engine/rules.js';
import { INDEX_RULES, activeRules, indexPlay, idxOf } from '../engine/indices.js';

let bad = 0, n = 0;
const comp = (r) => {
  if (r.kind === 'tt') return [10, 10];
  const t = r.total;
  // a non-pair two-card hard hand
  for (let a = 2; a <= 10; a++) { const b = t - a; if (b > a && b <= 10) return [a, b]; }
  return null;
};
for (const [name, rules] of [
  ['6D S17 DAS', { ...DEFAULT_RULES, decks: 6 }],
  ['6D H17 DAS', { ...DEFAULT_RULES, decks: 6, dealerHitsSoft17: true }],
  ['6D S17 DAS LS', { ...DEFAULT_RULES, decks: 6, surrender: 'late' }],
  ['6D H17 DAS LS', { ...DEFAULT_RULES, decks: 6, dealerHitsSoft17: true, surrender: 'late' }],
  ['8D S17', { ...DEFAULT_RULES, decks: 8 }],
]) {
  for (const r of activeRules(rules)) {
    const cards = comp(r);
    const d = decide(rules, cards, r.up);
    n++;
    const ok = d.action === r.play || d.action === r.below;
    // Fab-4 rows: surrender above, hit below — basic may be R (15v10) or H.
    if (!ok) { bad++; console.log(`MISMATCH ${name} ${r.label}: basic=${d.action}, rule ${r.play}/${r.below}`); }
    // And the function must flip across the index
    const hi = indexPlay(rules, cards, r.up, idxOf(r, rules), d.action, { H: true, S: true, D: true, P: true, R: true });
    const lo = indexPlay(rules, cards, r.up, idxOf(r, rules) - 1, d.action, { H: true, S: true, D: true, P: true, R: true });
    if (hi.action !== r.play || lo.action !== r.below) { bad++; console.log(`FLIP FAIL ${name} ${r.label}`, hi.action, lo.action); }
  }
}
console.log(`${n} checks, ${bad} problems`);
process.exit(bad ? 1 : 0);
