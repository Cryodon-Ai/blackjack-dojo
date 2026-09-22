// Dealer-outcome tables (exact) and Monte Carlo simulation (independent cross-check + variance work).
//
// The app displays the EXACT numbers from ev.js. Monte Carlo lives here to (a) cross-check the exact
// solver by a completely different method and (b) power the Tier 8 variance / Martingale sims.

import { Solver } from './ev.js';
import { Round } from './round.js';
import { buildChart } from './strategy.js';
import { normalizeRules, peeksOnUp } from './rules.js';

// ---- exact dealer table ---------------------------------------------------------------------
// For an upcard, returns final-total probabilities. When the dealer peeks (up = A or T), the table
// is CONDITIONAL on the dealer not having blackjack — that is the situation in which you decide.
export function dealerTable(rulesIn, up) {
  const rules = normalizeRules(rulesIn);
  const s = new Solver(rules);
  s._reset(); s._take(up);
  const D = s._dealer(up);
  const bj = D[6];
  const peeks = peeksOnUp(rules, up);
  const cond = peeks ? 1 - bj : 1;
  const t = { 17: D[0] / cond, 18: D[1] / cond, 19: D[2] / cond, 20: D[3] / cond, 21: D[4] / cond, bust: D[5] / cond };
  t.blackjack = peeks ? 0 : bj;
  t.pBlackjackUnconditional = bj;
  return t;
}

export function bustTable(rules) {
  const out = {};
  for (const up of [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]) out[up] = dealerTable(rules, up).bust;
  return out;
}

// ---- Monte Carlo ----------------------------------------------------------------------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Draws without replacement from a finite shoe (or i.i.d. from an infinite one).
export class Shoe {
  constructor(rulesIn, rand) {
    this.rules = normalizeRules(rulesIn);
    this.rand = rand;
    this.inf = !Number.isFinite(this.rules.decks);
    this.base = new Int32Array(11);
    if (!this.inf) {
      for (let r = 1; r <= 9; r++) this.base[r] = 4 * this.rules.decks;
      this.base[10] = 16 * this.rules.decks;
    }
    this.c = new Int32Array(11);
    this.n = 0;
    this.shuffle();
  }
  shuffle() { this.c.set(this.base); this.n = this.inf ? 0 : 52 * this.rules.decks; }
  take(r) { if (!this.inf) { this.c[r]--; this.n--; } }
  draw() {
    if (this.inf) {
      const x = Math.floor(this.rand() * 13) + 1;
      return x > 10 ? 10 : x;
    }
    let k = Math.floor(this.rand() * this.n);
    for (let r = 1; r <= 10; r++) { k -= this.c[r]; if (k < 0) { this.c[r]--; this.n--; return r; } }
    throw new Error('shoe exhausted');
  }
}

// Plays out the dealer's hand, tracking how many cards it took. Returns { result, cards } where
// result is 17..21, 22 (bust) or 'BJ'.
export function playDealerCounted(shoe, up, hole) {
  const hitSoft = shoe.rules.dealerHitsSoft17;
  let hard = up + hole, ace = up === 1 || hole === 1, cards = 2;
  if (hard === 11 && ace) return { result: 'BJ', cards };
  for (;;) {
    const soft = ace && hard <= 11;
    const total = soft ? hard + 10 : hard;
    if (total > 21) return { result: 22, cards };
    if (total >= 18 || (total === 17 && !(soft && hitSoft))) return { result: total, cards };
    const c = shoe.draw(); cards++;
    hard += c; if (c === 1) ace = true;
  }
}

// Plays out the dealer's hand. Returns 17..21, 22 (bust) or 'BJ'.
export function playDealer(shoe, up, hole) { return playDealerCounted(shoe, up, hole).result; }

// Monte Carlo dealer distribution given the upcard. Peek games discard dealer-BJ trials, mirroring
// what the exact table conditions on.
export function mcDealer(rulesIn, up, trials, seed = 1) {
  const rules = normalizeRules(rulesIn);
  const rand = mulberry32(seed);
  const shoe = new Shoe(rules, rand);
  const counts = { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, bust: 0, blackjack: 0 };
  let used = 0;
  for (let i = 0; i < trials; i++) {
    shoe.shuffle(); shoe.take(up);
    const hole = shoe.draw();
    const r = playDealer(shoe, up, hole);
    if (r === 'BJ') { counts.blackjack++; if (peeksOnUp(rules, up)) continue; }
    else if (r === 22) counts.bust++;
    else counts[r]++;
    used++;
  }
  const out = {};
  for (const k of Object.keys(counts)) out[k] = counts[k] / used;
  out.n = used;
  return out;
}

// Monte Carlo EV of STAND and of DOUBLE for a fixed two-card hand (both are policy-free, so they
// cross-check the exact solver without needing an independent strategy implementation).
// Peek games are conditional on no dealer BJ (BJ trials discarded).
export function mcFixedHand(rulesIn, cards, up, trials, seed = 7) {
  const rules = normalizeRules(rulesIn);
  const rand = mulberry32(seed);
  const shoe = new Shoe(rules, rand);
  let hard0 = 0, ace0 = false;
  for (const c of cards) { hard0 += c; if (c === 1) ace0 = true; }
  const total0 = ace0 && hard0 <= 11 ? hard0 + 10 : hard0;
  const pay = (total, d) => (d === 22 ? 1 : total > d ? 1 : total === d ? 0 : -1);
  let sStand = 0, sDouble = 0, used = 0, ssStand = 0, ssDouble = 0;
  for (let i = 0; i < trials; i++) {
    shoe.shuffle(); shoe.take(up); for (const c of cards) shoe.take(c);
    const hole = shoe.draw();
    if (peeksOnUp(rules, up) && ((up === 1 && hole === 10) || (up === 10 && hole === 1))) continue;
    // Stand path uses the dealer draws from the shoe directly after the hole; the double path needs a
    // player card first, so play them on independent shuffles but with identical (up, hole).
    const snapC = Int32Array.from(shoe.c), snapN = shoe.n;
    let d = playDealer(shoe, up, hole);
    let vs;
    if (d === 'BJ') vs = -1; else vs = pay(total0, d);
    sStand += vs; ssStand += vs * vs;
    shoe.c.set(snapC); shoe.n = snapN;
    const pc = shoe.draw();
    const hard = hard0 + pc, ace = ace0 || pc === 1;
    let vd;
    if (hard > 21) vd = -2;
    else {
      const tot = ace && hard <= 11 ? hard + 10 : hard;
      d = playDealer(shoe, up, hole);
      vd = d === 'BJ' ? -2 : 2 * pay(tot, d);
    }
    sDouble += vd; ssDouble += vd * vd;
    used++;
  }
  const mean = (s) => s / used;
  const se = (s, ss) => Math.sqrt(Math.max(0, ss / used - (s / used) ** 2) / used);
  return { stand: mean(sStand), standSE: se(sStand, ssStand), double: mean(sDouble), doubleSE: se(sDouble, ssDouble), n: used };
}


// ---- perfect-play policy + round simulation ------------------------------------------------
// Policy = the chart for the ruleset built at INFINITE decks (splits/surrender) + an infinite-deck
// stand/hit/double solver for everything else. It is total-dependent basic strategy: the same thing a
// well-drilled player executes, within ~0.01 pp of composition-perfect play.
export function makePolicy(rulesIn) {
  const inf = normalizeRules({ ...rulesIn, decks: Infinity });
  const solver = new Solver(inf);
  const chart = {};
  for (const row of buildChart(inf)) chart[row.key] = row.cells;
  const memo = new Map();
  const nosplit = (hard, ace, up, canD) => {
    const k = `${hard}|${ace ? 1 : 0}|${up}|${canD ? 1 : 0}`;
    let a = memo.get(k);
    if (!a) { a = solver.decisionNoSplit(hard, ace, up, canD); memo.set(k, a); }
    return a;
  };
  const pairKey = (r) => (r === 1 ? 'AA' : r === 10 ? 'TT' : `${r}${r}`);
  return (round, hi) => {
    const h = round.hands[hi], L = round.legal(hi), up = round.up.v;
    let hard = 0, ace = false;
    for (const c of h.cards) { hard += c.v; if (c.v === 1) ace = true; }
    if (h.cards.length === 2) {
      const pair = h.cards[0].v === h.cards[1].v;
      if (pair && L.P && chart[pairKey(h.cards[0].v)][up].action === 'P') return 'P';
      if (L.R) {
        const cell = pair && !ace ? chart[pairKey(h.cards[0].v)][up] : (!ace && hard >= 5 && hard <= 20 ? chart[`H${hard}`][up] : null);
        if (cell && cell.action === 'R') return 'R';
        // pair rows report P/H/S...; surrender for a pair hand is judged on its hard total
        if (pair && !ace && hard >= 5 && hard <= 20 && chart[`H${hard}`][up].action === 'R' && chart[pairKey(h.cards[0].v)][up].action !== 'P') return 'R';
      }
    }
    const a = nosplit(Math.min(hard, 21), ace, up, L.D);
    return L[a] ? a : (L.H ? 'H' : 'S');
  };
}

// Play `n` independent rounds (fresh shuffle each, like an online RNG table). Returns per-round nets.
export function playRounds(rulesIn, n, seed, policy, { keepNets = false } = {}) {
  const rules = normalizeRules(rulesIn);
  const rand = mulberry32(seed);
  const shoe = new Shoe(rules, rand);
  const draw = () => ({ v: shoe.draw() });
  let net = 0, sq = 0, wagered = 0, wins = 0, losses = 0, pushes = 0;
  const nets = keepNets ? new Float32Array(n) : null;
  for (let i = 0; i < n; i++) {
    shoe.shuffle();
    const r = new Round(rules, draw).deal();
    while (r.phase === 'player') {
      const hi = r.active;
      if (hi < 0) break;
      r.act(hi, policy(r, hi));
    }
    if (r.phase !== 'over') r.playDealer();
    const s = r.settle();
    net += s.net; sq += s.net * s.net; wagered += s.wagered;
    if (s.net > 0) wins++; else if (s.net < 0) losses++; else pushes++;
    if (nets) nets[i] = s.net;
  }
  return { n, net, sq, wagered, wins, losses, pushes, nets, mean: net / n, sd: Math.sqrt(Math.max(0, sq / n - (net / n) ** 2)) };
}
