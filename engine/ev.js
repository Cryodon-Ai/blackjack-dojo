// Exact expected-value solver.
//
// Method
//  - Dealer outcome distribution is computed by exhaustive recursion over the actual shoe
//    composition (or fixed probabilities for an infinite deck). No sampling.
//  - The hole card is modelled as the dealer's first draw. Because unseen cards are
//    exchangeable, this is equivalent to it having been dealt earlier.
//  - Player play after the first decision is composition-dependent optimal (best of stand/hit at
//    every reachable multiset of drawn cards), memoised on (hand, shoe composition).
//  - "Peek" games: the player only decides after the dealer has been checked for blackjack, so EVs
//    are conditional on dealer-no-BJ. We carry unnormalised values W = E[payoff * 1{no dealer BJ}]
//    and divide by P(no BJ) at the end. Every action at a state shares that divisor, so argmax(W)
//    equals argmax(conditional EV).
//  - ENHC games: no conditioning; a dealer BJ costs the full wager on every hand/double.
//
// Known approximation: split hands are valued as independent hands drawn from the shoe with both
// pair cards removed (hand 2's draws are not reduced by hand 1's draws). Resplitting is modelled
// exactly as a sequential process over the total hand count (see _splitTotalW).

import { normalizeRules } from './rules.js';

export class Solver {
  constructor(rulesIn) {
    this.rules = normalizeRules(rulesIn);
    this.infinite = !Number.isFinite(this.rules.decks);
    this.base = new Float64Array(11);
    if (this.infinite) {
      for (let r = 1; r <= 9; r++) this.base[r] = 1 / 13;
      this.base[10] = 4 / 13;
      this.baseN = 1;
    } else {
      const d = this.rules.decks;
      for (let r = 1; r <= 9; r++) this.base[r] = 4 * d;
      this.base[10] = 16 * d;
      this.baseN = 52 * d;
    }
    this.c = Float64Array.from(this.base);
    this.n = this.baseN;
    this.dealerCache = new Map();
    this.hitCache = new Map();
  }

  clearCaches() { this.dealerCache.clear(); this.hitCache.clear(); }

  // ---- shoe primitives -------------------------------------------------------------------
  _reset() { this.c.set(this.base); this.n = this.baseN; }
  _take(r) {
    if (this.infinite) return;
    if (this.c[r] <= 0) throw new Error(`rank ${r} not available in ${this.rules.decks}-deck shoe`);
    this.c[r]--; this.n--;
  }
  _put(r) { if (!this.infinite) { this.c[r]++; this.n++; } }
  _sig() { return this.infinite ? 'inf' : this.c.join(','); }
  _pBJ(up) {
    if (up === 1) return this.c[10] / this.n;
    if (up === 10) return this.c[1] / this.n;
    return 0;
  }
  _nMass(up) { return this.rules.peek ? 1 - this._pBJ(up) : 1; }

  // ---- dealer ----------------------------------------------------------------------------
  // Returns Float64Array(7): [P17, P18, P19, P20, P21, Pbust, Pblackjack], unconditional.
  _dealer(up) {
    const key = this._sig() + '|' + up;
    let D = this.dealerCache.get(key);
    if (D) return D;
    D = new Float64Array(7);
    const c = this.c;
    const inf = this.infinite;
    const hitSoft = this.rules.dealerHitsSoft17;
    const rec = (hard, ace, p) => {
      let total = hard, soft = false;
      if (ace && hard <= 11) { total = hard + 10; soft = true; }
      if (total > 21) { D[5] += p; return; }
      if (total >= 18 || (total === 17 && !(soft && hitSoft))) { D[total - 17] += p; return; }
      for (let r = 1; r <= 10; r++) {
        const cnt = c[r];
        if (cnt <= 0) continue;
        const pr = inf ? cnt : cnt / this.n;
        if (!inf) { c[r]--; this.n--; }
        rec(hard + r, ace || r === 1, p * pr);
        if (!inf) { c[r]++; this.n++; }
      }
    };
    for (let r = 1; r <= 10; r++) {
      const cnt = c[r];
      if (cnt <= 0) continue;
      const pr = inf ? cnt : cnt / this.n;
      if (!inf) { c[r]--; this.n--; }
      if ((up === 1 && r === 10) || (up === 10 && r === 1)) D[6] += pr;
      else rec(up + r, up === 1 || r === 1, pr);
      if (!inf) { c[r]++; this.n++; }
    }
    this.dealerCache.set(key, D);
    return D;
  }

  // ---- player values (all in W scale; see header) ----------------------------------------
  _standW(total, up) {
    const D = this._dealer(up);
    let w = D[5];
    for (let i = 0; i < 5; i++) {
      const dt = 17 + i;
      w += D[i] * (total > dt ? 1 : total === dt ? 0 : -1);
    }
    if (!this.rules.peek) w -= D[6];
    return w;
  }

  _canDouble(hard, ace) {
    if (this.rules.doubleRestriction === 'any') return true;
    return !ace && hard >= 9 && hard <= 11;
  }

  // Best of stand/hit for a hand already committed to normal play (no double/split/surrender).
  _contW(hard, ace, up) {
    const total = ace && hard <= 11 ? hard + 10 : hard;
    const stand = this._standW(total, up);
    if (total >= 21) return stand;
    return Math.max(stand, this._hitW(hard, ace, up));
  }

  _hitW(hard, ace, up) {
    const key = (hard * 2 + (ace ? 1 : 0)) + '|' + this._sig() + '|' + up;
    const hit = this.hitCache.get(key);
    if (hit !== undefined) return hit;
    const c = this.c, inf = this.infinite;
    let w = 0;
    for (let r = 1; r <= 10; r++) {
      const cnt = c[r];
      if (cnt <= 0) continue;
      const pr = inf ? cnt : cnt / this.n;
      if (!inf) { c[r]--; this.n--; }
      const nh = hard + r;
      w += pr * (nh > 21 ? -this._nMass(up) : this._contW(nh, ace || r === 1, up));
      if (!inf) { c[r]++; this.n++; }
    }
    this.hitCache.set(key, w);
    return w;
  }

  // One card, then stand, on a doubled bet.
  _doubleW(hard, ace, up) {
    const c = this.c, inf = this.infinite;
    let w = 0;
    for (let r = 1; r <= 10; r++) {
      const cnt = c[r];
      if (cnt <= 0) continue;
      const pr = inf ? cnt : cnt / this.n;
      if (!inf) { c[r]--; this.n--; }
      const nh = hard + r;
      if (nh > 21) w += pr * -this._nMass(up);
      else {
        const na = ace || r === 1;
        w += pr * this._standW(na && nh <= 11 ? nh + 10 : nh, up);
      }
      if (!inf) { c[r]++; this.n++; }
    }
    return 2 * w;
  }

  // Value of the best play of a split hand that started as card r and just drew d. Resplitting is
  // handled by the caller (_splitTotalW), which tracks total hands sequentially.
  _afterSplitDraw(r, d, up) {
    const R = this.rules;
    const hard = r + d;
    const ace = r === 1 || d === 1;
    const total = ace && hard <= 11 ? hard + 10 : hard;
    if (r === 1) return this._standW(total, up);     // split aces: one card only, no hitting
    let best = this._contW(hard, ace, up);
    if (R.doubleAfterSplit && this._canDouble(hard, ace)) best = Math.max(best, this._doubleW(hard, ace, up));
    return best;
  }

  // Total value of splitting a pair of r. Hands are played one after another; G(j, t) is the value
  // of j pending single-card hands when t hands exist in total. A drawn card equal to r may be
  // resplit into two pending hands while t < maxSplitHands (aces only if resplitAces).
  // Approximation kept: every hand draws from the shoe with just the pair removed (hand 1's
  // draws are not removed before hand 2 is dealt) — a card-removal effect of order 1/(52*decks).
  _splitTotalW(r, up) {
    const R = this.rules, c = this.c, inf = this.infinite;
    const p = new Float64Array(11), v = new Float64Array(11);
    for (let d = 1; d <= 10; d++) {
      const cnt = c[d];
      if (cnt <= 0) continue;
      p[d] = inf ? cnt : cnt / this.n;
      if (!inf) { c[d]--; this.n--; }
      v[d] = this._afterSplitDraw(r, d, up);
      if (!inf) { c[d]++; this.n++; }
    }
    const canRe = r !== 1 || R.resplitAces;
    const max = R.maxSplitHands;
    const memo = new Map();
    const G = (j, t) => {
      if (j === 0) return 0;
      const key = j * 100 + t;
      const m = memo.get(key);
      if (m !== undefined) return m;
      let w = 0;
      for (let d = 1; d <= 10; d++) {
        if (p[d] === 0) continue;
        let best = v[d] + G(j - 1, t);
        if (d === r && canRe && t < max) best = Math.max(best, G(j + 1, t + 1));
        w += p[d] * best;
      }
      memo.set(key, w);
      return w;
    };
    return G(2, 2);
  }

  // ---- public: evaluate one decision ----------------------------------------------------
  // cards: array of ranks (1..10) in the player's hand. up: dealer upcard rank.
  // Returns EVs per $1 of *original* wager, conditional on the decision being reached.
  evaluate(up, cards) {
    const R = this.rules;
    this._reset();
    this._take(up);
    for (const c of cards) this._take(c);
    let hard = 0, ace = false;
    for (const c of cards) { hard += c; if (c === 1) ace = true; }
    const soft = ace && hard <= 11;
    const total = soft ? hard + 10 : hard;
    const n = cards.length;
    const N0 = this._nMass(up);
    const res = {
      up, cards: cards.slice(), hard, soft, total, n,
      N0,
      pBJ: R.peek ? 1 - N0 : this._pBJ(up),
      blackjack: n === 2 && total === 21,
      W: {}, ev: {}, legal: { stand: true, hit: true, double: false, split: false, surrender: false },
    };
    if (hard > 21) throw new Error('hand already busted');
    if (res.blackjack) {
      // Peek games: conditional EV is the full blackjack payout. ENHC: dealer BJ pushes, so scale.
      res.ev.stand = R.peek ? R.blackjackPays : R.blackjackPays * (1 - res.pBJ);
      this._reset();
      return res;
    }
    res.W.stand = this._standW(total, up);
    res.W.hit = this._hitW(hard, ace, up);
    if (n === 2 && this._canDouble(hard, ace)) { res.legal.double = true; res.W.double = this._doubleW(hard, ace, up); }
    if (n === 2 && cards[0] === cards[1]) {
      res.legal.split = true;
      res.W.split = this._splitTotalW(cards[0], up);
    }
    if (n === 2 && R.surrender === 'late' && R.peek) { res.legal.surrender = true; res.W.surrender = -0.5 * N0; }
    for (const a of Object.keys(res.W)) res.ev[a] = res.W[a] / N0;
    this._reset();
    return res;
  }

  // Relative probability of being dealt exactly this multiset of cards (any order), given the
  // upcard has been removed. Used to weight compositions when averaging a "total-dependent" cell.
  _handProb(cards) {
    let p = 1;
    const taken = [];
    for (const r of cards) {
      if (!this.infinite && this.c[r] <= 0) { p = 0; break; }
      p *= this.infinite ? this.c[r] : this.c[r] / this.n;
      this._take(r); taken.push(r);
    }
    for (const r of taken) this._put(r);
    // count distinct orderings of the multiset
    const counts = {};
    for (const r of cards) counts[r] = (counts[r] || 0) + 1;
    let perms = 1;
    for (let i = 2; i <= cards.length; i++) perms *= i;
    for (const k of Object.keys(counts)) for (let i = 2; i <= counts[k]; i++) perms /= i;
    return p * perms;
  }

  // Total-dependent evaluation: probability-weighted average over several compositions of the
  // same total (this is what a published chart cell means). Split is excluded from the average.
  evaluateTotal(up, hands) {
    this._reset(); this._take(up);
    const ws = hands.map((h) => this._handProb(h));
    this._reset();
    const sumW = {}, legal = { stand: true, hit: true, double: false, split: false, surrender: false };
    let sumN = 0;
    hands.forEach((h, i) => {
      if (!(ws[i] > 0)) return;
      const r = this.evaluate(up, h);
      sumN += ws[i] * r.N0;
      for (const a of Object.keys(r.W)) if (a !== 'split') sumW[a] = (sumW[a] || 0) + ws[i] * r.W[a];
      for (const a of Object.keys(r.legal)) if (a !== 'split' && r.legal[a]) legal[a] = true;
    });
    const ev = {};
    for (const a of Object.keys(sumW)) ev[a] = sumW[a] / sumN;
    return { up, hands, ev, legal, weights: ws };
  }

  // Simulator helper: best non-split first decision for a hand with the given hard total / ace flag.
  // Intended for an infinite-deck solver (no card removal beyond the upcard).
  decisionNoSplit(hard, ace, up, canDouble) {
    this._reset(); this._take(up);
    const total = ace && hard <= 11 ? hard + 10 : hard;
    let best = 'S', bv = this._standW(total, up);
    if (total < 21) { const h = this._hitW(hard, ace, up); if (h > bv + 1e-12) { best = 'H'; bv = h; } }
    if (canDouble) { const d = this._doubleW(hard, ace, up); if (d > bv + 1e-12) { best = 'D'; bv = d; } }
    return best;
  }

  // ---- public: overall house edge --------------------------------------------------------
  // Enumerates every (upcard, player card 1, player card 2) with exact probabilities, plays each
  // with its own composition-dependent optimal action, and returns the player's expected result
  // per initial bet (negative = house edge). Slow for finite decks; intended for verification and
  // for the Tier 6 rule-cost table.
  houseEdge({ onProgress } = {}) {
    const R = this.rules;
    let ev = 0;
    this._reset();
    const c = this.c, inf = this.infinite;
    for (let up = 1; up <= 10; up++) {
      const pu = inf ? c[up] : c[up] / this.n;
      this._take(up);
      for (let a = 1; a <= 10; a++) {
        if (!inf && c[a] <= 0) continue;
        const pa = inf ? c[a] : c[a] / this.n;
        this._take(a);
        for (let b = a; b <= 10; b++) {
          if (!inf && c[b] <= 0) continue;
          const pb = inf ? c[b] : c[b] / this.n;
          const mult = a === b ? 1 : 2;
          this._take(b);
          const p = pu * pa * pb * mult;
          // evaluate() resets the shoe, so hand it the cards and re-establish state afterwards.
          const saveC = Float64Array.from(c), saveN = this.n;
          const res = this.evaluate(up, [a, b]);
          c.set(saveC); this.n = saveN;
          ev += p * this._uncondEV(res);
          this._put(b);
        }
        this._put(a);
      }
      this._put(up);
      this.clearCaches();
      if (onProgress) onProgress(up);
    }
    return { ev, edge: -ev };
  }

  _uncondEV(res) {
    const R = this.rules;
    if (res.blackjack) return R.peek ? (1 - res.pBJ) * R.blackjackPays : res.ev.stand;
    let best = -Infinity;
    for (const a of Object.keys(res.ev)) if (res.legal[a] && res.ev[a] > best) best = res.ev[a];
    if (!R.peek) return best;                // ENHC: BJ losses already inside W
    return (1 - res.pBJ) * best - res.pBJ;   // peek: dealer BJ costs the original bet only
  }
}
