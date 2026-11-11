// Checks for engine/pokerlab.js: push/fold equilibrium is stable, ICM adds up, MDF and bluff arithmetic.
import { readFileSync } from 'node:fs';
import { solvePushFold, icm, icmCall, mdf, bluffShare, potOdds, catcherEV, COMBOS, gradeCbet, gradeFacing, blockerProfile } from '../engine/pokerlab.js';
import { ALL_CLASSES, parseCards, equity } from '../engine/poker.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } };
const near = (a, b, t, m) => ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);
const data = JSON.parse(readFileSync(new URL('../data/hu-equity.json', import.meta.url)));
const N = 169, E = (i, j) => data.eq[i * N + j] / 10000;
// matrix sanity
near(E(ALL_CLASSES.indexOf('AA'), ALL_CLASSES.indexOf('KK')), 0.82, 0.015, 'AA vs KK');
near(E(ALL_CLASSES.indexOf('AKs'), ALL_CLASSES.indexOf('QQ')), 0.46, 0.02, 'AKs vs QQ');
near(E(ALL_CLASSES.indexOf('72o'), ALL_CLASSES.indexOf('AA')), 0.12, 0.02, '72o vs AA');
near(E(3, 3), 0.5, 0.0001, 'mirror');
// push/fold: exploitability
const pw = COMBOS.map((c) => c / 1326);
for (const S of [5, 10, 15]) {
  const r = solvePushFold(data, S, 700), push = new Set(r.push), call = new Set(r.call);
  let gain = 0;   // best response of SB to the final call range, minus SB's equilibrium EV
  const sbEV = (i, p) => { let v = 0; for (let j = 0; j < N; j++) v += pw[j] * (call.has(ALL_CLASSES[j]) ? (2 * E(i, j) - 1) * S : 1); return p ? v : -0.5; };
  let cur = 0, best = 0;
  for (let i = 0; i < N; i++) { cur += pw[i] * sbEV(i, push.has(ALL_CLASSES[i])); best += pw[i] * Math.max(sbEV(i, true), -0.5); }
  ok(best - cur < 0.02, `SB exploitability ${S}bb ${(best - cur).toFixed(4)}`);
  ok(push.has('AA') && call.has('AA') && call.has('AKs') && !call.has('72o') && !call.has('32o'), `${S}bb sane edges`);
  ok(r.pushPct > r.callPct, `${S}bb: SB pushes wider than BB calls`);
}
const a = solvePushFold(data, 5, 400), b = solvePushFold(data, 15, 400);
ok(a.pushPct > b.pushPct && a.callPct > b.callPct, 'ranges tighten as stacks deepen');
// ICM
const eq = icm([5000, 3000, 2000], [50, 30, 20]);
near(eq.reduce((x, y) => x + y, 0), 100, 1e-9, 'icm sums to prize pool');
ok(eq[0] < 50 * 0.5 + 30 * 0.5 + 0 + 10 && eq[0] > eq[1] && eq[1] > eq[2], 'icm ordered by stack');
near(icm([1000, 1000, 1000], [50, 30, 20])[0], 100 / 3, 1e-9, 'equal stacks equal equity');
near(icm([1, 0, 0], [50, 30, 20])[0], 50, 1e-9, 'sole chip holder wins first');
const call = icmCall([5000, 3000, 2000], [50, 30, 20], 1, 0, 0);
ok(call.needICM > call.needChips, 'ICM makes calling tighter than chip EV');
near(call.needChips, 0.5, 1e-9, 'chip EV needs 50% with no dead money');
// MDF / bluffs
near(mdf(50, 100), 100 / 150, 1e-9, 'mdf half pot'); near(mdf(100, 100), 0.5, 1e-9, 'mdf pot');
near(bluffShare(100, 100), 1 / 3, 1e-9, 'pot bet 1/3 bluffs'); near(potOdds(100, 100), 1 / 3, 1e-9, 'pot odds pot bet');
near(catcherEV(100, 100, 2, 1), 0, 1e-9, 'indifference at 2:1');
ok(catcherEV(100, 100, 2, 2) > 0 && catcherEV(100, 100, 3, 1) < 0, 'catcher EV signs');
// spots
const h = parseCards('As Kh'), flop = parseCards('Ad 7c 2s');
const g = gradeCbet(h, flop); ok(g.rec === 'bet' && g.equity > 0.66, 'top pair top kicker c-bets');
const g2 = gradeFacing(parseCards('7h 2d'), parseCards('As Ks Qs'), 10, 7.5); ok(g2.rec === 'fold', 'air folds to a big bet');
const g3 = gradeFacing(parseCards('Ah Kd'), parseCards('As Ac Kc'), 10, 5); ok(g3.rec === 'raise', 'full house raises');
// blockers
const bp = blockerProfile(parseCards('As 3d'), parseCards('Ks 9s 5s 2c 2d'));
const bp2 = blockerProfile(parseCards('Ah 3d'), parseCards('Ks 9s 5s 2c 2d'));
ok(bp.blocksStrong > bp2.blocksStrong, 'the ace of spades blocks more of the strong hands on a flush board');
console.log(bad ? bad + ' problems' : 'pokerlab ok');
process.exit(bad ? 1 : 0);
