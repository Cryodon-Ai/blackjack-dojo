// One round of blackjack under a rule set: deal, legal actions, act, dealer play, settlement.
// Card objects only need a numeric `.v` (1 = ace ... 10). Used by the Live Table UI and by simulators.

import { peeksOnUp } from './rules.js';

const val = (cards) => {
  let hard = 0, ace = false;
  for (const c of cards) { hard += c.v; if (c.v === 1) ace = true; }
  const soft = ace && hard <= 11;
  return { hard, ace, soft, total: soft ? hard + 10 : hard };
};
export const isBJ = (cards) => cards.length === 2 && val(cards).total === 21;

export class Round {
  constructor(rules, draw) {
    this.rules = rules; this.draw = draw;
    this.hands = []; this.dealer = [];
    this.phase = 'new';       // new -> player -> dealer -> over
    this.dealerBJ = false; this.peeked = false;
    this.log = [];
  }

  deal() {
    const R = this.rules;
    const p1 = this.draw(), up = this.draw(), p2 = this.draw(), hole = this.draw();
    this.dealer = [up, hole];
    const h = { cards: [p1, p2], bet: 1, done: false, fromSplit: false, splitAces: false, surrendered: false, doubled: false, bj: false };
    this.hands = [h];
    this.dealerBJ = isBJ(this.dealer);
    const peeks = peeksOnUp(R, up.v);
    if (peeks) this.peeked = true;
    h.bj = isBJ(h.cards);
    if (peeks && this.dealerBJ) { h.done = true; this.phase = 'over'; return this; }   // dealer BJ ends the round
    if (h.bj) { h.done = true; this.phase = 'over'; return this; }
    this.phase = 'player';
    return this;
  }

  get active() { return this.hands.findIndex((h) => !h.done); }
  get up() { return this.dealer[0]; }

  legal(hi) {
    const R = this.rules, h = this.hands[hi];
    const out = { H: false, S: false, D: false, P: false, R: false };
    if (!h || h.done || this.phase !== 'player') return out;
    const n = h.cards.length, v = val(h.cards);
    out.S = true;
    out.H = !h.splitAces;
    const dblOK = R.doubleRestriction === 'any' || (!v.ace && v.hard >= 9 && v.hard <= 11);
    out.D = n === 2 && dblOK && (!h.fromSplit || R.doubleAfterSplit) && !h.splitAces;
    out.P = n === 2 && h.cards[0].v === h.cards[1].v && this.hands.length < R.maxSplitHands && (h.cards[0].v !== 1 || !h.fromSplit || R.resplitAces);
    out.R = R.surrender === 'late' && peeksOnUp(R, this.up.v) && n === 2 && !h.fromSplit && this.hands.length === 1;
    return out;
  }

  _autoFinish(h) {
    const R = this.rules, v = val(h.cards);
    if (v.hard > 21) { h.done = true; return; }
    if (R.charlie && h.cards.length >= R.charlie) { h.done = true; h.charlie = true; return; }
    if (v.total === 21) h.done = true;
  }

  act(hi, a) {
    const h = this.hands[hi];
    const L = this.legal(hi);
    if (!L[a]) throw new Error(`illegal action ${a}`);
    if (a === 'S') h.done = true;
    else if (a === 'H') { h.cards.push(this.draw()); this._autoFinish(h); }
    else if (a === 'D') { h.bet *= 2; h.doubled = true; h.cards.push(this.draw()); h.done = true; }
    else if (a === 'R') { h.surrendered = true; h.done = true; }
    else if (a === 'P') {
      const [c1, c2] = h.cards;
      const aces = c1.v === 1;
      const mk = (c) => ({ cards: [c], bet: 1, done: false, fromSplit: true, splitAces: aces, surrendered: false, doubled: false, bj: false });
      const A = mk(c1), B = mk(c2);
      this.hands.splice(hi, 1, A, B);
      for (const x of [A, B]) {
        x.cards.push(this.draw());
        if (aces) {
          // split aces: one card only, unless an ace is drawn and resplitting aces is allowed
          const canRe = x.cards[1].v === 1 && this.rules.resplitAces && this.hands.length < this.rules.maxSplitHands;
          if (!canRe) x.done = true;
        } else this._autoFinish(x);
      }
    }
    if (this.active === -1) this.phase = 'dealer';
    return this;
  }

  // Dealer draws to completion (only if some hand is still in contention, unless forced — some side
  // bets, e.g. Gravity Blackjack's Dealer Bust, need the dealer's exact final card count regardless
  // of whether every player hand already busted or surrendered).
  playDealer(force = false) {
    const R = this.rules;
    const alive = force || this.hands.some((h) => !h.surrendered && !h.bj && val(h.cards).hard <= 21);
    if (alive && !this.dealerBJ) {
      for (;;) {
        const v = val(this.dealer);
        if (v.hard > 21) break;
        if (v.total > 17 || (v.total === 17 && !(v.soft && R.dealerHitsSoft17))) break;
        this.dealer.push(this.draw());
      }
    }
    this.phase = 'over';
    return this;
  }

  // Net result per hand and in total, in units of the base bet.
  settle() {
    const R = this.rules;
    if (this.phase !== 'over') throw new Error('round not over');
    const dv = val(this.dealer);
    const out = this.hands.map((h) => {
      const v = val(h.cards);
      let net, res;
      if (h.surrendered) { net = -0.5; res = 'surrender'; }
      else if (h.bj) { if (this.dealerBJ) { net = 0; res = 'push'; } else { net = R.blackjackPays; res = 'blackjack'; } }
      else if (h.charlie) { net = h.bet; res = 'charlie'; }
      else if (v.hard > 21) { net = -h.bet; res = 'lose'; }
      else if (this.dealerBJ) { net = -h.bet; res = 'lose'; }
      else if (dv.hard > 21) { net = h.bet; res = 'win'; }
      else if (v.total > dv.total) { net = h.bet; res = 'win'; }
      else if (v.total < dv.total) { net = -h.bet; res = 'lose'; }
      else { net = 0; res = 'push'; }
      return { net, res, total: v.total, bet: h.bet };
    });
    return { hands: out, net: out.reduce((a, b) => a + b.net, 0), dealerTotal: dv.total, dealerBJ: this.dealerBJ, wagered: this.hands.reduce((a, h) => a + h.bet, 0) };
  }
}
