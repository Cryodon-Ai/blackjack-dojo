// Precompute preflop all-in equity of every starting-hand class against every other (169 x 169) by Monte Carlo.
// Writes data/hu-equity.json: { classes:[...169 labels...], trials, eq:[...28561 ints 0..10000 = hero equity x10000] }.
//   node tools/gen-hu-equity.mjs [trialsPerPair]
import { writeFileSync } from 'node:fs';
import { ALL_CLASSES, classCombos, evaluate } from '../engine/poker.js';
const TRIALS = Number(process.argv[2]) || 2500;
const N = ALL_CLASSES.length;
const combos = ALL_CLASSES.map((l) => classCombos(l));
let seed = 12345;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const eq = new Array(N * N).fill(5000);
const t0 = Date.now();
const mark = new Uint8Array(52);
for (let a = 0; a < N; a++) {
  for (let b = a; b < N; b++) {
    let sum = 0, done = 0;
    for (let t = 0; t < TRIALS; t++) {
      const ha = combos[a][Math.floor(rand() * combos[a].length)], hb = combos[b][Math.floor(rand() * combos[b].length)];
      if (ha[0] === hb[0] || ha[0] === hb[1] || ha[1] === hb[0] || ha[1] === hb[1]) continue;
      mark.fill(0); mark[ha[0]] = mark[ha[1]] = mark[hb[0]] = mark[hb[1]] = 1;
      const board = [];
      while (board.length < 5) { const c = Math.floor(rand() * 52); if (!mark[c]) { mark[c] = 1; board.push(c); } }
      const sa = evaluate([ha[0], ha[1], ...board]), sb = evaluate([hb[0], hb[1], ...board]);
      sum += sa > sb ? 1 : sa === sb ? 0.5 : 0; done++;
    }
    const e = done ? sum / done : 0.5;
    eq[a * N + b] = Math.round(e * 10000);
    eq[b * N + a] = a === b ? 5000 : 10000 - Math.round(e * 10000);
  }
  if (a % 10 === 0) console.log(`row ${a}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
writeFileSync(new URL('../data/hu-equity.json', import.meta.url), JSON.stringify({ classes: ALL_CLASSES, trials: TRIALS, eq }));
console.log('done in', ((Date.now() - t0) / 1000).toFixed(0), 's');
