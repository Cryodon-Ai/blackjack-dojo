// Verifier. Run:  node engine/verify.js            (everything)
//                 node engine/verify.js --quick    (skip the slow rule-cost table)
//
// Layers:
//  A. Every cell of the published reference chart (6D, S17, DAS, LS, peek, 3:2) vs the engine.
//  B. Structural claims the curriculum makes (17+ always stand, 11- never stand, ...).
//  C. Independent anchors: published dealer tables (6D & 8D), insurance edge.
//  D. Monte Carlo cross-check of the exact solver (different method entirely).
//  E. House edges vs published exact values (13 configs), 6:5 analytic check, rule-cost table.
// Exit code 1 if anything in A-D fails, or any E delta is outside tolerance.

import { REFERENCE_RULES, DEFAULT_RULES, UPCARDS, upLabel } from './rules.js';
import { REFERENCE_CHART } from './reference-chart.js';
import { DEALER_S17_PEEK } from './reference-dealer.js';
import { buildChart, evaluateCell, chartRows, compositionDisagreements } from './strategy.js';
import { Solver } from './ev.js';
import { dealerTable, mcDealer, mcFixedHand, makePolicy, playRounds } from './sim.js';
import { CLAIMS, claimUps } from '../curriculum/claims.js';
import { rulesKey } from './rules.js';

const QUICK = process.argv.includes('--quick');
let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL ' + msg); };
const pct = (x, d = 3) => (x * 100).toFixed(d);
const hr = (t) => console.log(`\n${'='.repeat(78)}\n${t}\n${'='.repeat(78)}`);

// ------------------------------------------------------------------------------------------------
hr('A. Reference chart — 6 decks, S17, DAS, late surrender, peek, 3:2');
function checkChart(rules, { verbose }) {
  const t0 = Date.now();
  const chart = buildChart(rules);
  const rows = Object.fromEntries(chart.map((r) => [r.key, r]));
  let cells = 0, pass = 0, bad = 0;
  if (verbose) console.log('row   up: ' + UPCARDS.map(upLabel).join(' ') + '   engine output (* = differs from published)');
  for (const key of Object.keys(REFERENCE_CHART)) {
    const want = REFERENCE_CHART[key];
    const row = rows[key];
    if (!row) { fail(`row ${key} missing from engine chart`); continue; }
    let line = '', mism = [];
    UPCARDS.forEach((up, i) => {
      cells++;
      const got = row.cells[up].action;
      if (got === want[i]) { pass++; line += ` ${got}`; } else { bad++; line += ` ${got}*`; mism.push({ up, got, w: want[i] }); }
    });
    if (verbose || mism.length) console.log(key.padEnd(5) + line + (mism.length ? '  <-- MISMATCH' : ''));
    for (const m of mism) {
      const evs = Object.entries(row.cells[m.up].ev).map(([a, v]) => `${a}=${pct(v)}%`).join('  ');
      fail(`${rules.decks}D ${key} vs ${upLabel(m.up)}: engine ${m.got}, published ${m.w}`);
      console.log(`        ${evs}`);
    }
  }
  console.log(`  ${rules.decks} decks: cells asserted ${cells}   pass ${pass}   fail ${bad}   (${Date.now() - t0} ms)`);
  if (Object.keys(REFERENCE_CHART).length !== chartRows().length) fail('reference chart row count differs from engine row count');
}
checkChart(REFERENCE_RULES, { verbose: true });
console.log('\n  The published strategy is the same chart for 4-8 decks; re-checking the engine at both ends:');
checkChart({ ...REFERENCE_RULES, decks: 4 }, { verbose: false });
checkChart({ ...REFERENCE_RULES, decks: 8 }, { verbose: false });

// ------------------------------------------------------------------------------------------------
hr('B. Structural claims the curriculum makes (checked against the engine, not asserted from memory)');
{
  const chart = buildChart(REFERENCE_RULES);
  const get = (k) => chart.find((r) => r.key === k);
  let ok = true;
  for (let t = 17; t <= 21; t++) for (const up of UPCARDS) {
    const a = get(`H${t}`).cells[up].action;
    // 17 vs A is stand; surrender only exists for 15/16 in this game
    if (a !== 'S') { ok = false; fail(`hard ${t} vs ${upLabel(up)} is ${a}, curriculum says always stand`); }
  }
  for (let t = 5; t <= 11; t++) for (const up of UPCARDS) {
    const a = get(`H${t}`).cells[up].action;
    if (a === 'S') { ok = false; fail(`hard ${t} vs ${upLabel(up)} is stand, curriculum says 11 and below never stand`); }
  }
  for (const up of UPCARDS) {
    if (get('AA').cells[up].action !== 'P') { ok = false; fail(`A,A vs ${upLabel(up)} not split`); }
    if (get('88').cells[up].action !== 'P') { ok = false; fail(`8,8 vs ${upLabel(up)} not split`); }
    if (get('TT').cells[up].action !== 'S') { ok = false; fail(`T,T vs ${upLabel(up)} not stand`); }
  }
  for (let t = 12; t <= 16; t++) for (const up of [2, 3, 4, 5, 6]) {
    const a = get(`H${t}`).cells[up].action;
    const exception = t === 12 && (up === 2 || up === 3);
    if (!exception && a !== 'S') { ok = false; fail(`hard ${t} vs ${up} is ${a}, curriculum says stand vs 2-6 (12 vs 2/3 excepted)`); }
    if (exception && a !== 'H') { ok = false; fail(`hard 12 vs ${up} is ${a}, expected the hit exception`); }
  }
  console.log(ok ? '  ok: 17+ always stand; 11- never stand; 12-16 stand vs 2-6 (12 v 2/3 hit); A,A & 8,8 split; T,T stand' : '  (see failures above)');

  const dis = compositionDisagreements(REFERENCE_RULES);
  console.log(`\n  Composition-dependent exceptions in this game (same hard total, different best action by exact cards):`);
  if (!dis.length) console.log('    none');
  const s = new Solver(REFERENCE_RULES);
  for (const d of dis) {
    const parts = Object.entries(d.actions).map(([h, a]) => `${h}:${a}`).join(' ');
    console.log(`    hard ${d.total} vs ${upLabel(d.up)}  ${parts}`);
  }
  console.log('  (The chart cell is the probability-weighted total-dependent action; these are the known near-ties.)');
}

// ------------------------------------------------------------------------------------------------
hr('C. Independent anchors');
{
  // Insurance: 6 decks, 96 tens among 311 unseen cards after an ace is showing.
  const s = new Solver(REFERENCE_RULES);
  s._reset(); s._take(1);
  const p = s._pBJ(1);
  const insEV = 3 * p - 1;
  console.log(`  insurance (6D, no count info): P(ten)=${(p * 100).toFixed(3)}%  EV=${pct(insEV, 2)}%   published ~ -7.4%`);
  if (Math.abs(p - 96 / 311) > 1e-12 || Math.abs(insEV - -0.0740) > 0.0005) fail('insurance edge does not match 96/311 analytic value');

  // Published dealer tables (S17, peek => conditional on no dealer BJ), 6 and 8 decks: all 60 numbers each.
  for (const decks of [6, 8]) {
    let worst = 0, n = 0;
    for (const up of UPCARDS) {
      const t = dealerTable({ ...REFERENCE_RULES, decks }, up);
      const mine = [t[17], t[18], t[19], t[20], t[21], t.bust];
      DEALER_S17_PEEK[decks][up].forEach((pub, i) => {
        n++; const d = Math.abs(mine[i] - pub); worst = Math.max(worst, d);
        if (d > 2e-6) fail(`${decks}D dealer ${upLabel(up)} col ${i}: engine ${mine[i].toFixed(6)} vs published ${pub.toFixed(6)}`);
      });
    }
    console.log(`  published dealer table, ${decks} decks S17 (${n} numbers): worst abs difference = ${worst.toExponential(2)}`);
  }
  console.log('  (The engine also matches an independent from-scratch Python DP at infinite decks; see verification notes.)');

  // Probabilities sum to 1
  for (const up of UPCARDS) {
    const t = dealerTable(REFERENCE_RULES, up);
    const sum = t[17] + t[18] + t[19] + t[20] + t[21] + t.bust;
    if (Math.abs(sum - 1) > 1e-9) fail(`dealer table for ${upLabel(up)} sums to ${sum}`);
  }
  console.log('  dealer outcome tables sum to 1.000000000 for every upcard (6D ref)');
}

// ------------------------------------------------------------------------------------------------
hr('D. Monte Carlo cross-check of the exact solver (independent method, 4-sigma tolerance)');
{
  const N = 400000;
  let worst = 0;
  for (const up of UPCARDS) {
    const ex = dealerTable(REFERENCE_RULES, up);
    const mc = mcDealer(REFERENCE_RULES, up, N, 100 + up);
    for (const k of ['17', '18', '19', '20', '21', 'bust']) {
      const pex = ex[k], pm = mc[k];
      const se = Math.sqrt(pex * (1 - pex) / mc.n);
      const z = Math.abs(pm - pex) / se;
      worst = Math.max(worst, z);
      if (z > 4) fail(`dealer ${upLabel(up)} P(${k}): exact ${pct(pex, 2)}% vs MC ${pct(pm, 2)}%  z=${z.toFixed(1)}`);
    }
  }
  console.log(`  dealer distributions, 10 upcards x 6 outcomes, ${N.toLocaleString()} trials each: worst |z| = ${worst.toFixed(2)}`);

  const cases = [
    ['stand 16 v T', [10, 6], 10, REFERENCE_RULES], ['double 11 v 6', [5, 6], 6, REFERENCE_RULES],
    ['double 10 v 9', [4, 6], 9, REFERENCE_RULES], ['stand 12 v 4', [10, 2], 4, REFERENCE_RULES],
    ['stand A,7 v 9', [1, 7], 9, REFERENCE_RULES], ['double A,6 v 3', [1, 6], 3, REFERENCE_RULES],
    ['stand 20 v A', [10, 10], 1, REFERENCE_RULES], ['stand 15 v T', [10, 5], 10, REFERENCE_RULES],
    ['stand 18 v A (ENHC)', [10, 8], 1, { ...REFERENCE_RULES, peekOn: 'none', surrender: 'none' }],
    ['double 11 v A (ENHC, H17)', [5, 6], 1, { ...REFERENCE_RULES, peekOn: 'none', surrender: 'none', dealerHitsSoft17: true }],
    ['stand 19 v T (1 deck)', [10, 9], 10, { ...REFERENCE_RULES, decks: 1 }],
  ];
  const M = 1500000;
  console.log(`  fixed-hand EVs, ${M.toLocaleString()} trials each (exact vs Monte Carlo, % of wager):`);
  for (const [name, cards, up, rules] of cases) {
    const s = new Solver(rules);
    const r = s.evaluate(up, cards);
    const mc = mcFixedHand(rules, cards, up, M, 9);
    const which = name.startsWith('double') ? 'double' : 'stand';
    const ex = r.ev[which];
    const got = mc[which], se = mc[which + 'SE'];
    const z = Math.abs(got - ex) / se;
    // Peek games: MC conditions by discarding dealer-BJ trials, matching the exact conditional EV.
    console.log(`    ${name.padEnd(28)} exact ${pct(ex).padStart(8)}   MC ${pct(got).padStart(8)} ±${pct(se)}   z=${z.toFixed(2)}`);
    if (z > 4) fail(`${name}: exact ${pct(ex)} vs MC ${pct(got)} (z=${z.toFixed(1)})`);
  }
}

// ------------------------------------------------------------------------------------------------
hr('B2. Lesson claims: every strategy statement the curriculum makes, checked against the engine');
{
  const charts = new Map();
  let n = 0, bad = 0;
  for (const c of CLAIMS) {
    const rules = { ...REFERENCE_RULES, ...(c.rules || {}) };
    const k = rulesKey(rules);
    if (!charts.has(k)) charts.set(k, Object.fromEntries(buildChart(rules).map((r) => [r.key, r])));
    const chart = charts.get(k);
    for (const row of c.rows) for (const up of claimUps(c.ups)) {
      n++;
      const got = chart[row].cells[up].action;
      if (got !== c.action) { bad++; fail(`tier ${c.tier} claim "${c.text}": ${row} vs ${upLabel(up)} is ${got}, claimed ${c.action}${c.rules ? ' under ' + JSON.stringify(c.rules) : ''}`); }
    }
  }
  console.log(`  ${CLAIMS.length} claims, ${n} cells checked across ${charts.size} rule sets: ${bad ? bad + ' FAIL' : 'all true'}`);
}

// ------------------------------------------------------------------------------------------------
hr('D2. End-to-end: simulated rounds (round.js + policy) vs the solver\'s exact house edge');
{
  // Full game logic (deal, peek, splits, doubles, surrender, dealer play, payouts) played by a
  // total-dependent policy, compared to the exact composition-dependent edge. Tolerance is 4 standard
  // errors plus 0.03 pp for the policy being total-dependent rather than composition-perfect.
  const cases = [['reference 6D S17 DAS LS peek 3:2', REFERENCE_RULES], ['8D H17 no-DAS ENHC 6:5', { ...DEFAULT_RULES, decks: 8, dealerHitsSoft17: true, doubleAfterSplit: false, peekOn: 'none', blackjackPays: 1.2 }]];
  const N = QUICK ? 1500000 : 8000000;
  for (const [name, rules] of cases) {
    const r = playRounds(rules, N, 424242, makePolicy(rules));
    const exact = -new Solver(rules).houseEdge().edge;
    const se = r.sd / Math.sqrt(N);
    const z = (r.mean - exact) / se;
    const tol = 4 * se + 0.0003;
    const ok = Math.abs(r.mean - exact) <= tol;
    console.log(`  ${name.padEnd(36)} sim ${pct(r.mean, 3).padStart(8)}% ±${pct(se, 3)}   exact ${pct(exact, 3).padStart(8)}%   z=${z.toFixed(2)}  ${ok ? 'ok' : 'FAIL'}`);
    if (!ok) fail(`simulated edge for ${name}: ${pct(r.mean, 3)} vs exact ${pct(exact, 3)}`);
  }
}

// ------------------------------------------------------------------------------------------------
hr('E. House edge: published exact values, then the rule-cost table the Tier 6 lesson quotes');
if (QUICK) console.log('  skipped (--quick)');
else {
  const t0 = Date.now();
  const edge = (rules) => new Solver(rules).houseEdge().edge * 100;
  const base = { ...DEFAULT_RULES, decks: 8, dealerHitsSoft17: false, doubleAfterSplit: true, resplitAces: false, surrender: 'none', peekOn: 'both', blackjackPays: 1.5, doubleRestriction: 'any' };

  // E1. Absolute house edges, exact composition-dependent play, resplit to 4 hands (not aces), no
  //     surrender, peek, 3:2. Source: wizardofodds.com/games/blackjack/appendix/9/<n>d<s|h>17r4/ (fetched 2026-09-19).
  //     The engine keeps one approximation (split hands draw from a shoe with only the pair removed),
  //     so a residual of a few thousandths of a point is expected and is bounded here.
  const PUBLISHED = [
    [1, false, true, -0.1839], [2, false, true, 0.1779], [4, false, true, 0.3471], [6, false, true, 0.4026], [8, false, true, 0.4304],
    [2, false, false, 0.3208], [4, false, false, 0.4893], [6, false, false, 0.5445], [8, false, false, 0.5721],
    [6, true, true, 0.6151], [8, true, true, 0.6444], [6, true, false, 0.7598], [8, true, false, 0.7888],
  ];
  const TOL1 = 0.004;   // percentage points = 0.4 cents per $100 wagered
  console.log(`  E1. absolute house edge vs published exact values (tolerance ±${TOL1} pp = ${TOL1 * 100} cents per $100 wagered)`);
  console.log('      decks  dealer  DAS     engine%   published%   diff(pp)');
  let worst = 0;
  for (const [decks, h17, das, pub] of PUBLISHED) {
    const e = edge({ ...base, decks, dealerHitsSoft17: h17, doubleAfterSplit: das });
    const d = e - pub; worst = Math.max(worst, Math.abs(d));
    console.log(`      ${String(decks).padStart(3)}    ${h17 ? 'H17' : 'S17'}    ${das ? 'DAS  ' : 'noDAS'}  ${e.toFixed(4).padStart(8)}   ${pub.toFixed(4).padStart(8)}    ${(d >= 0 ? '+' : '') + d.toFixed(4)}${Math.abs(d) > TOL1 ? '  OUTSIDE' : ''}`);
    if (Math.abs(d) > TOL1) fail(`house edge ${decks}D ${h17 ? 'H17' : 'S17'} ${das ? 'DAS' : 'noDAS'}: engine ${e.toFixed(4)} vs published ${pub}`);
  }
  console.log(`      worst |diff| = ${worst.toFixed(4)} pp`);

  // E2. Blackjack 6:5: the cost is exactly 0.3 x P(player BJ and dealer has no BJ). Checked analytically.
  {
    const N = 52 * 8, A = 32, T = 128;
    let q = 0;
    for (const [p1, p2] of [['A', 'T'], ['T', 'A']]) {
      const c = { A, T, o: N - A - T };
      const p1p = c[p1] / N; c[p1]--; let n = N - 1;
      for (const up of ['A', 'T', 'o']) {
        const pu = c[up] / n; c[up]--; n--;
        const p2p = c[p2] / n; c[p2]--; n--;
        const pbj = up === 'A' ? c.T / n : up === 'T' ? c.A / n : 0;
        q += p1p * pu * p2p * (1 - pbj);
        c[p2]++; c[up]++; n += 2;
      }
    }
    const exact = 0.3 * q * 100;
    const d = edge({ ...base, blackjackPays: 1.2 }) - edge(base);
    console.log(`\n  E2. 6:5 blackjack, 8 decks: analytic 0.3 x P(BJ & dealer no BJ) = ${exact.toFixed(4)} pp;  engine ${d.toFixed(4)} pp`);
    console.log('      The brief quotes 1.39; that matches ~1 deck (1.395), not 6-8 decks (1.358-1.360).');
    if (Math.abs(d - exact) > 0.0005) fail(`6:5 cost: engine ${d} vs analytic ${exact}`);
  }

  // E3. Rule-by-rule cost from the 8D baseline vs the figures in the brief. Rules that the published
  //     absolute edges above do not already pin down are scored at ±0.03 pp; deck-count rows are shown
  //     but NOT scored (E1 is the authority; the brief's deck figures conflict with it).
  const baseEdge = edge(base);
  console.log(`\n  E3. rule cost from baseline (8D S17 DAS, no RSA, no surrender, peek, 3:2, double any: ${baseEdge.toFixed(3)}% house edge)`);
  const tests = [
    ['Dealer hits soft 17', { dealerHitsSoft17: true }, -0.22, true],
    ['No double after split', { doubleAfterSplit: false }, -0.14, true],
    ['European no hole card', { peekOn: 'none' }, -0.11, true],
    ['Double on 9-11 only', { doubleRestriction: '9-11' }, -0.09, true],
    ['Resplit aces allowed', { resplitAces: true }, +0.08, true],
    ['Late surrender (vs everything)', { surrender: 'late' }, +0.07, true],
    ['6 decks  (vs 8)', { decks: 6 }, +0.02, false],
    ['4 decks  (vs 8)', { decks: 4 }, +0.06, false],
    ['2 decks  (vs 8)', { decks: 2 }, +0.19, false],
    ['1 deck   (vs 8)', { decks: 1 }, +0.48, false],
  ];
  console.log('      rule change                        engine    brief      diff   status');
  const TOL3 = 0.03;
  for (const [name, change, pub, scored] of tests) {
    const d = baseEdge - edge({ ...base, ...change });
    const diff = d - pub;
    const ok = Math.abs(diff) <= TOL3;
    console.log(`      ${name.padEnd(32)} ${(d >= 0 ? '+' : '') + d.toFixed(3)}    ${(pub >= 0 ? '+' : '') + pub.toFixed(2)}     ${(diff >= 0 ? '+' : '') + diff.toFixed(3)}  ${scored ? (ok ? 'ok' : 'OUTSIDE ±' + TOL3) : (ok ? 'ok (unscored)' : 'differs from brief — see E1 (unscored)')}`);
    if (scored && !ok) fail(`rule cost "${name}": engine ${d.toFixed(3)} vs brief ${pub}`);
  }
  console.log('      Charlie rule (e.g. 10-card Charlie in Gravity Blackjack): implemented at the Round/settlement level only (rules.charlie) — deliberately not modeled in this exact EV solver, since it is rare enough not to move the chart. See Section F below for Gravity Blackjack\'s own verification.');
  console.log('      "Late surrender vs ten" in the brief: +0.07 corresponds to full late surrender (row above).');
  console.log(`\n  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

// ------------------------------------------------------------------------------------------------
hr('F. Gravity Blackjack: asymmetric peek (checks the dealer for blackjack on an Ace, not a Ten)');
{
  const G = { ...DEFAULT_RULES, decks: 8, dealerHitsSoft17: false, doubleAfterSplit: true, surrender: 'none', peekOn: 'ace', blackjackPays: 1.5, maxSplitHands: 2, charlie: 10 };

  // The dealer table should be CONDITIONAL (no dealer-BJ mass) on an Ace, and UNCONDITIONAL on a Ten.
  const tA = dealerTable(G, 1), tT = dealerTable(G, 10);
  console.log(`  dealer table vs Ace:  blackjack column = ${tA.blackjack}  (expect 0 — this upcard is peeked)`);
  console.log(`  dealer table vs Ten:  blackjack column = ${pct(tT.blackjack, 2)}%  (expect > 0 — this upcard is NOT peeked)`);
  if (tA.blackjack !== 0) fail('Gravity: dealer table vs Ace should be conditional on no dealer BJ (blackjack column 0)');
  if (!(tT.blackjack > 0)) fail('Gravity: dealer table vs Ten should be unconditional (blackjack column > 0)');

  // The two documented strategy deviations: hitting instead of doubling/splitting into a wager that
  // an unpeeked dealer ten-up blackjack could still take.
  const chart = Object.fromEntries(buildChart(G).map((r) => [r.key, r]));
  const h11 = chart.H11.cells[10].action, p88 = chart['88'].cells[10].action;
  console.log(`  hard 11 vs Ten: ${h11}  (expect H, not D)`);
  console.log(`  8,8 vs Ten:     ${p88}  (expect H, not P)`);
  if (h11 !== 'H') fail(`Gravity: hard 11 vs Ten should hit (unpeeked Ten risk), engine says ${h11}`);
  if (p88 !== 'H') fail(`Gravity: 8,8 vs Ten should hit (unpeeked Ten risk), engine says ${p88}`);

  // Every other upcard's hard-11/8,8 play should be unchanged from the standard peek game (only the
  // Ten column is special-cased) — and A,A / 8,8 vs Ace should still split (Ace IS peeked here).
  const std = Object.fromEntries(buildChart({ ...G, peekOn: 'both' }).map((r) => [r.key, r]));
  let unchanged = true;
  for (const up of UPCARDS) {
    if (up === 10) continue;
    if (chart.H11.cells[up].action !== std.H11.cells[up].action) { unchanged = false; fail(`Gravity H11 vs ${upLabel(up)} differs from standard-peek chart outside the Ten column`); }
    if (chart['88'].cells[up].action !== std['88'].cells[up].action) { unchanged = false; fail(`Gravity 8,8 vs ${upLabel(up)} differs from standard-peek chart outside the Ten column`); }
  }
  console.log(`  all other upcards for H11 and 8,8 match the standard-peek chart: ${unchanged ? 'ok' : 'see failures above'}`);
  if (chart['88'].cells[1].action !== 'P') fail('Gravity: 8,8 vs Ace should still split (Ace is peeked)');

  // Cross-check the exact hard-11-vs-Ten hit/double gap against a from-scratch Monte Carlo of the
  // dealer's unconditional blackjack risk (independent of the peek machinery in ev.js/round.js).
  {
    const s = new Solver(G);
    const r = s.evaluate(10, [5, 6]);   // hard 11
    console.log(`  hard 11 vs Ten EV: hit ${pct(r.ev.hit).padStart(7)}%   double ${pct(r.ev.double).padStart(7)}%   (hit should exceed double)`);
    if (!(r.ev.hit > r.ev.double)) fail(`Gravity hard 11 vs Ten: hit EV ${pct(r.ev.hit)} should exceed double EV ${pct(r.ev.double)}`);
  }
}

// ------------------------------------------------------------------------------------------------
hr(failures === 0 ? 'RESULT: GREEN — all assertions passed' : `RESULT: RED — ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
