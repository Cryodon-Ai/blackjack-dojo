// Tests for engine/baccarat.js and app/roads.js:  node tools/bacc-test.mjs
import { bv, total, playerDraws, bankerDraws, bankerReason, playRound, settle, exactOdds, edges, normalizeBacc, isNatural } from '../engine/baccarat.js';
import { beadPlate, bigRoad, longestStreak } from '../app/roads.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m}: got ${a} want ${b} ±${tol}`);

// ---- values ----
eq([1, 2, 9, 10].map(bv), [1, 2, 9, 0], 'card values');
eq(total([7, 8]), 5, '7+8=15 -> 5'); eq(total([10, 10]), 0, 'tens total zero'); eq(total([9, 9, 9]), 7, 'three nines -> 7'); eq(total([1, 1]), 2, 'ace counts one');

// ---- player rule ----
for (let t = 0; t <= 9; t++) eq(playerDraws(t), t <= 5, `player draws on ${t}`);

// ---- banker table, written out independently from the published chart ----
// rows: banker total; columns: player third card 0..9 (value), plus "stood"
const DRAW = {
  0: '1111111111', 1: '1111111111', 2: '1111111111',
  3: '1111111101',          // all but 8
  4: '0011111100',          // 2-7
  5: '0000111100',          // 4-7
  6: '0000001100',          // 6-7
  7: '0000000000',
};
for (let b = 0; b <= 7; b++) for (let v = 0; v <= 9; v++) eq(bankerDraws(b, v === 0 ? 10 : v), DRAW[b][v] === '1', `banker ${b} vs third ${v}`);
for (let b = 0; b <= 9; b++) eq(bankerDraws(b, null), b <= 5, `banker ${b} when player stood`);
ok(/draws/.test(bankerReason(3, 5)) && /stands/.test(bankerReason(3, 8)) && /stood/.test(bankerReason(6, null)), 'banker reasons read right');

// ---- scripted rounds ----
const script = (...cards) => { let i = 0; return () => cards[i++]; };
let r = playRound(script(9, 8, 10, 10));            // P: 9+10=9, B: 8+10=8 -> natural, player wins
ok(r.natural && r.winner === 'player' && r.player.length === 2 && r.banker.length === 2, 'natural 9 beats natural 8');
r = playRound(script(2, 3, 3, 4, 10, 2));           // P:2+3=5 draws, B:3+4=7 stands(7) ; P third 10 -> 5, banker 7 -> banker wins
eq([r.pTotal, r.bTotal, r.winner, r.banker.length], [5, 7, 'banker', 2], 'banker 7 stands');
r = playRound(script(1, 2, 3, 4, 6, 5));            // P: 1+3=4 draws a 6 -> 0 ; B: 2+4=6, p3=6 -> banker draws 5 -> 1  (player 0? 4+6=10->0)
eq([r.pTotal, r.bTotal], [0, 1], 'both draw'); eq(r.winner, 'banker', 'banker 1 beats player 0');
r = playRound(script(10, 4, 10, 5));                // P 0 draws; B 9 natural -> no draws
ok(r.natural && r.player.length === 2, 'natural stops all drawing');
r = playRound(script(3, 3, 3, 3));                  // P6 stands; B6 stands -> tie
eq(r.winner, 'tie', 'tie');

// ---- settlement ----
const R = (winner, bLen = 2, bTotal = 6) => ({ winner, banker: Array(bLen).fill(0), bTotal });
eq(settle(100, 'player', R('player')), 100, 'player win pays 1:1'); eq(settle(100, 'player', R('banker')), -100, 'player loses');
eq(settle(100, 'player', R('tie')), 0, 'tie pushes player'); eq(settle(100, 'banker', R('tie')), 0, 'tie pushes banker');
eq(settle(100, 'banker', R('banker')), 95, 'banker pays 0.95 with commission');
eq(settle(10, 'banker', R('banker')), 9.5, 'commission on $10');
eq(settle(100, 'banker', R('banker', 3, 7), { variant: 'ez' }), 0, 'EZ dragon 7 pushes');
eq(settle(100, 'banker', R('banker', 2, 7), { variant: 'ez' }), 100, 'EZ 2-card 7 pays full');
eq(settle(100, 'tie', R('tie')), 800, 'tie pays 8:1'); eq(settle(100, 'tie', R('tie'), { tiePays: 9 }), 900, 'tie 9:1'); eq(settle(100, 'tie', R('player')), -100, 'tie loses');
eq(settle(10, 'playerPair', R('banker'), undefined, { player: true }), 110, 'pair 11:1'); eq(settle(10, 'bankerPair', R('banker'), undefined, { player: true }), -10, 'pair loses');

// ---- exact odds vs published 8-deck figures (Wizard of Odds) ----
const o = exactOdds(8);
near(o.player, 0.446247, 1e-6, 'P(player)'); near(o.banker, 0.458597, 1e-6, 'P(banker)'); near(o.tie, 0.095156, 1e-6, 'P(tie)');
near(o.player + o.banker + o.tie, 1, 1e-12, 'probabilities sum to 1'); near(o.banker3Seven, 0.022534, 1e-6, 'P(dragon 7)');
const e = edges(8);
near(e.banker, -0.010579, 2e-6, 'banker edge'); near(e.player, -0.012351, 2e-6, 'player edge'); near(e.tie, -0.143596, 2e-6, 'tie 8:1 edge'); near(e.pair, -0.103614, 2e-6, 'pair edge');
near(edges(8, { tiePays: 9 }).tie, -0.048440, 2e-6, 'tie 9:1 edge'); near(edges(8, { variant: 'ez' }).banker, -0.010183, 2e-6, 'EZ banker edge');
ok(e.banker > e.player && e.player > e.tie, 'banker is the best bet, tie the worst');
near(edges(6).banker, -0.010579, 2e-4, '6-deck banker edge close'); near(edges(1).banker, -0.0114, 2e-3, '1-deck banker edge in range');
eq(normalizeBacc({ variant: 'ez' }).commission, 0, 'ez has no commission');

// ---- simulation matches the exact odds ----
let seed = 12345; const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const N = 120000; const tally = { player: 0, banker: 0, tie: 0 };
for (let i = 0; i < N; i++) {
  const c = Array(11).fill(32); c[0] = 0; c[10] = 128; let n = 416;     // fresh 8-deck shoe each round
  const w = playRound(() => { let k = Math.floor(rand() * n); for (let v = 1; v <= 10; v++) { k -= c[v]; if (k < 0) { c[v]--; n--; return v; } } }).winner;
  tally[w]++;
}
near(tally.player / N, o.player, 0.004, 'simulated player rate'); near(tally.banker / N, o.banker, 0.004, 'simulated banker rate'); near(tally.tie / N, o.tie, 0.003, 'simulated tie rate');

// ---- roads ----
const seq = ['banker', 'banker', 'tie', 'banker', 'player', 'player', 'banker'];
const big = bigRoad(seq);
eq(big.map((c) => [c.col, c.row, c.winner[0]]), [[0, 0, 'b'], [0, 1, 'b'], [0, 2, 'b'], [1, 0, 'p'], [1, 1, 'p'], [2, 0, 'b']], 'big road columns');
eq(big[1].ties, 1, 'tie marks the previous cell');
const long = bigRoad(Array(8).fill('banker'));
eq(long.map((c) => [c.col, c.row]).slice(5), [[0, 5], [1, 5], [2, 5]], 'dragon tail turns right on row 6');
const afterTail = bigRoad([...Array(8).fill('banker'), 'player']);
eq(afterTail[8], { col: 1, row: 0, winner: 'player', ties: 0 }, 'next streak starts beside the first column');
eq(bigRoad(['tie', 'player'])[0].ties, 1, 'leading tie is kept on the first cell');
eq(beadPlate(['banker', 'player', 'tie', 'banker', 'banker', 'player', 'tie']).slice(5).map((c) => [c.col, c.row]), [[0, 5], [1, 0]], 'bead plate fills 6 rows then next column');
eq(longestStreak(['banker', 'tie', 'banker', 'player', 'banker'], 'banker'), 2, 'longest streak ignores ties');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
