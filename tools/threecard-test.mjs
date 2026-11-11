// Three Card Poker: ranking order, exact house edges by full enumeration, and the Q-6-4 rule against the exact EV of every hand.
import { evaluate3, dealerQualifies, playEV, shouldPlay, PAY_TABLES, pairPlus } from '../engine/threecard.js';
import { parseCards } from '../engine/poker.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } };
const E = (s) => evaluate3(parseCards(s));
ok(E('As Ks Qs').cat === 5 && E('2h 3h Ah').cat === 5, 'straight flush incl. A-2-3');
ok(E('9s 9h 9d').cat === 4, 'trips');
ok(E('9s 8h 7d').score > E('As Ks 2s').score, 'straight beats flush');
ok(E('As 2h 3d').cat === 3, 'A-2-3 is a straight');
ok(E('As 2h 3d').score < E('4s 3h 2d').score, 'A-2-3 below 2-3-4');
ok(E('Qs Kh Ad').score > E('2s 3h 4d').score && E('Ks Kh 2d').score > E('As Kh 9d').score, 'ordering');
ok(!dealerQualifies(E('Js 9h 4d')) && dealerQualifies(E('Qs 3h 2d')) && dealerQualifies(E('2s 2h 5d')), 'dealer qualifier');
// distribution of 22100 hands
const cats = [0, 0, 0, 0, 0, 0]; const all = [];
for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) for (let c = b + 1; c < 52; c++) { cats[evaluate3([a, b, c]).cat]++; all.push([a, b, c]); }
ok(JSON.stringify(cats) === JSON.stringify([16440, 3744, 1096, 720, 52, 48]), 'hand counts ' + cats);
// Pair Plus house edge
for (const [k, t, expect] of [['standard', PAY_TABLES.standard, 7.28], ['better', PAY_TABLES.better, 2.32]]) {
  let s = 0; for (const h of all) s += pairPlus(evaluate3(h), t);
  const edge = -s / all.length * 100; ok(Math.abs(edge - expect) < 0.01, `pair plus ${k} edge ${edge.toFixed(3)} vs ${expect}`);
}
// Hands with the same ranks can differ by suit pattern (a rainbow hand and a two-suited hand block different dealer flushes),
// so each distinct (ranks, suit pattern) is evaluated once.
import { rankOf, suitOf } from '../engine/poker.js';
const sig = (h) => { const e = evaluate3(h), order = h.slice().sort((a, b) => rankOf(b) - rankOf(a) || suitOf(a) - suitOf(b)), m = new Map(); return e.cat + ':' + e.score + ':' + order.map((c) => { if (!m.has(suitOf(c))) m.set(suitOf(c), m.size); return m.get(suitOf(c)); }).join(''); };
// Q-6-4 vs exact EV: group hands by (ranks, flush) pattern so we enumerate each once
const seen = new Map(); let mism = 0, total = 0;
for (const h of all) {
  const key = sig(h);
  if (seen.has(key)) continue; seen.set(key, h);
}
for (const [key, h] of seen) {
  const ev = playEV(h), play = ev.play > ev.fold; total++;
  if (play !== shouldPlay(h)) { mism++; if (mism <= 6) console.log('mismatch', h.map(String), 'EV', ev.play.toFixed(4), 'rule', shouldPlay(h)); }
}
ok(mism === 0, `Q-6-4 rule matches exact EV for ${total} hand types (mismatches ${mism})`);
// Ante/Play house edge with optimal play, over all 22100 player hands (weighted)
let tot = 0, nh = 0;
const cache = new Map();
for (const h of all) {
  const key = sig(h); let v = cache.get(key);
  if (!v) { const ev = playEV(h); v = Math.max(ev.play, ev.fold); cache.set(key, v); }
  tot += v; nh++;
}
const edgeAnte = -tot / nh * 100;
ok(Math.abs(edgeAnte - 3.37) < 0.05, `ante/play edge per ante ${edgeAnte.toFixed(3)}% vs 3.37%`);
console.log('ante/play edge per ante:', edgeAnte.toFixed(3) + '%');
console.log(bad ? bad + ' problems' : 'threecard ok');
process.exit(bad ? 1 : 0);
