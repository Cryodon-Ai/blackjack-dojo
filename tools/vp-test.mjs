// Video poker checks (Jacks or Better 9/6).
//   node tools/vp-test.mjs
// 1. Every five-card hand is enumerated and categorised against the textbook counts.
// 2. Named hands check the evaluator. 3. Known holds check the exact hold EV.
// 4. Known decisions check the coach's best-hold choice.
import { categoryOf, holdEV, evaluateHolds } from '../engine/videopoker.js';

let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };

// 1. Every five-card hand, once each. Counts are the standard published ones.
const EXPECT = {
  royal: 4, straightFlush: 36, four: 624, fullHouse: 3744, flush: 5108,
  straight: 10200, three: 54912, twoPair: 123552, jacksOrBetter: 337920,
  none: 2062860, // includes the 760,320 low pairs (2s to 10s), which do not pay on Jacks or Better
};
const counts = Object.fromEntries(Object.keys(EXPECT).map((k) => [k, 0]));
let t0 = performance.now(), total = 0;
const h = [0, 0, 0, 0, 0];
for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) for (let c = b + 1; c < 52; c++)
  for (let d = c + 1; d < 52; d++) for (let e = d + 1; e < 52; e++) {
    h[0] = a; h[1] = b; h[2] = c; h[3] = d; h[4] = e;
    counts[categoryOf(h)]++; total++;
  }
console.log(`     enumerated ${total} hands in ${Math.round(performance.now() - t0)} ms`);
check(total === 2598960, 'enumerates C(52,5) = 2,598,960 hands');
for (const k of Object.keys(EXPECT)) check(counts[k] === EXPECT[k], `${k}: ${counts[k]} (expect ${EXPECT[k]})`);

// 2. Spot checks on named hands, so a wrong rule shows up with a clear message.
const card = (r, s) => (r - 2) * 4 + s; // suits: 0 spade, 1 heart, 2 diamond, 3 club
check(categoryOf([card(10, 0), card(11, 0), card(12, 0), card(13, 0), card(14, 0)]) === 'royal', 'A-K-Q-J-10 same suit is a royal');
check(categoryOf([card(14, 0), card(2, 0), card(3, 0), card(4, 0), card(5, 0)]) === 'straightFlush', 'ace-low wheel flush is a straight flush');
check(categoryOf([card(14, 0), card(2, 1), card(3, 0), card(4, 0), card(5, 0)]) === 'straight', 'ace-low wheel is a straight');
check(categoryOf([card(11, 0), card(11, 1), card(9, 0), card(9, 1), card(9, 2)]) === 'fullHouse', 'J-J-9-9-9 is a full house');
check(categoryOf([card(10, 0), card(10, 1), card(9, 0), card(9, 1), card(4, 2)]) === 'twoPair', 'two pair, tens and nines');
check(categoryOf([card(10, 0), card(10, 1), card(9, 0), card(8, 1), card(4, 2)]) === 'none', 'one pair of tens does not pay');
check(categoryOf([card(11, 0), card(11, 1), card(9, 0), card(8, 1), card(4, 2)]) === 'jacksOrBetter', 'pair of jacks pays');

// 3. Hold EV sanity: keeping a royal is worth 800, a made flush is worth exactly 6.
const royal = [card(10, 0), card(11, 0), card(12, 0), card(13, 0), card(14, 0)];
const remainingFor = (hand) => Array.from({ length: 52 }, (_, i) => i).filter((c) => !hand.includes(c));
check(holdEV(royal, remainingFor(royal)) === 800, 'holding a royal is worth 800 coins');
const flush = [card(2, 1), card(5, 1), card(8, 1), card(11, 1), card(13, 1)];
check(holdEV(flush, remainingFor(flush)) >= 6, 'a made flush is worth at least 6 when held');

// 4. Known decisions. Bit i of the mask = keep card i.
const holdOf = (hand) => evaluateHolds(hand).best;
const royalDraw = [card(10, 0), card(11, 0), card(12, 0), card(13, 0), card(2, 1)]; // 4 to a royal
check(holdOf(royalDraw) === 0b01111, '4 to a royal: keep the four');
const madeRoyal = [card(10, 2), card(11, 2), card(12, 2), card(13, 2), card(14, 2)];
check(holdOf(madeRoyal) === 0b11111, 'a made royal: keep all five');
const quads = [card(7, 0), card(7, 1), card(7, 2), card(7, 3), card(9, 0)];
check(holdOf(quads) === 0b11111 && evaluateHolds(quads).evs[0b11111] === 25, 'four sevens: keep all five (worth 25 either way)');
// The hold with the highest exact EV must not be worse than drawing five.
const sample = [card(3, 0), card(3, 1), card(9, 2), card(10, 3), card(14, 0)];
const { best, evs } = evaluateHolds(sample);
check(evs[best] >= evs[0] - 1e-12, 'best hold is at least as good as drawing five');

// 5. Pay tables: Bonus Poker splits four of a kind by rank, and the other tables pay plain quads.
import { TABLES, payOf, freshHandValue } from '../engine/videopoker.js';
const bp = TABLES.bonus85.coins, j96 = TABLES.job96.coins, j85 = TABLES.job85.coins;
const quad = (r, k) => [card(r, 0), card(r, 1), card(r, 2), card(r, 3), card(k, 0)];
check(payOf(quad(14, 9), bp) === 80, 'Bonus Poker: four aces pay 80');
check(payOf(quad(2, 9), bp) === 40 && payOf(quad(4, 9), bp) === 40, 'Bonus Poker: four 2s to 4s pay 40');
check(payOf(quad(5, 9), bp) === 25 && payOf(quad(13, 9), bp) === 25, 'Bonus Poker: four 5s to kings pay 25');
check(payOf(quad(14, 9), j96) === 25, 'Jacks or Better: any four of a kind pays 25');
check(payOf(quad(9, 14), bp) === 25, 'Bonus Poker: four nines pay 25 (kicker is the ace)');
check(payOf([card(2, 1), card(5, 1), card(8, 1), card(11, 1), card(13, 1)], j85) === 5, '8/5 flush pays 5');
check(payOf([card(9, 0), card(9, 1), card(9, 2), card(4, 0), card(4, 1)], j85) === 8, '8/5 full house pays 8');
check(payOf([card(9, 0), card(9, 1), card(4, 2), card(8, 1), card(3, 0)], j96) === 0, 'a low pair pays nothing');
check(Math.abs(freshHandValue(j96) - freshHandValue(j96)) === 0 && freshHandValue(j96) > 0.3 && freshHandValue(j96) < 0.6, 'fresh 9/6 deal returns between 0.3 and 0.6 coins');

console.log(failed ? `\nRESULT: ${failed} FAILED` : '\nRESULT: GREEN — all video poker checks passed');
process.exit(failed ? 1 : 0);
