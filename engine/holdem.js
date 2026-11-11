// A 6-max no-limit Hold'em cash hand: state machine, simple bots with different styles, and a coach that
// grades the hero's decisions from equity, pot odds and position. Units are big blinds. Every player
// starts each hand with the same stack, so no side pots are ever needed.

import { evaluate, describeHand, categoryOf, freshDeck, shuffle, classLabel, equity, topRange, RFI, openAction, facingRaise, outs, potOddsNeeded, boardTexture, rankOf, suitOf, openerGroup, strengthOrder, ruleOf } from './poker.js';

export const POS_NAMES = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'];     // index = (seat - button + 6) % 6
export const STYLES = {
  nit: { label: 'Tight and passive', open: -1, call: 0.12, threeBet: 0.4, bluff: 0.02, aggr: 0.35, fold: 1.15 },
  tag: { label: 'Solid regular', open: 0, call: 0.2, threeBet: 1, bluff: 0.1, aggr: 0.65, fold: 1 },
  lag: { label: 'Loose and aggressive', open: 1, call: 0.3, threeBet: 1.6, bluff: 0.25, aggr: 0.85, fold: 0.85 },
  station: { label: 'Calling station', open: 1, call: 0.45, threeBet: 0.3, bluff: 0.02, aggr: 0.25, fold: 0.5 },
  maniac: { label: 'Maniac', open: 2, call: 0.35, threeBet: 2.5, bluff: 0.4, aggr: 0.95, fold: 0.7 },
};
const SHIFT = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];
const shiftPos = (pos, by) => { if (pos === 'BB') return 'SB'; const i = SHIFT.indexOf(pos); return SHIFT[Math.max(0, Math.min(SHIFT.length - 1, i + by))]; };

export class Hand {
  constructor({ names, styles, button, bb = 1, stack = 100, rand = Math.random, hero = 0, active = [0, 1, 2, 3, 4, 5] }) {
    this.n = 6; this.active = active;
    this.order = [0, 1, 2, 3, 4, 5].map((k) => (button + k) % 6).filter((x) => active.includes(x));   // active seats, button first
    this.m = this.order.length; this.names = names; this.styles = styles; this.button = button; this.bb = bb; this.rand = rand; this.hero = hero;
    this.deck = shuffle(freshDeck(), rand);
    this.hole = Array.from({ length: 6 }, () => [this.deck.pop(), this.deck.pop()]);
    this.board = []; this.street = 'preflop';
    this.stack = Array(6).fill(stack); this.bet = Array(6).fill(0); this.total = Array(6).fill(0);
    this.folded = [0, 1, 2, 3, 4, 5].map((x) => !active.includes(x)); this.allin = Array(6).fill(false); this.acted = Array(6).fill(false);
    this.log = []; this.done = false; this.winners = null;
    const sb = this.m === 2 ? this.order[0] : this.order[1], bbs = this.m === 2 ? this.order[1] : this.order[2];
    this._post(sb, bb / 2); this._post(bbs, bb);
    this.current = bb; this.lastRaise = bb; this.raises = 0; this.raiser = bbs; this.opener = null;
    this.toAct = this.order[(this.order.indexOf(bbs) + 1) % this.m];
    this._advanceToLive();
  }
  seatAt(posIdx) { return this.order[posIdx % this.m]; }
  posOf(seat) { const i = this.order.indexOf(seat); return this.m === 6 ? POS_NAMES[i] : this.m === 3 ? ['BTN', 'SB', 'BB'][i] : ['BTN', 'BB'][i]; }
  get pot() { return this.total.reduce((a, b) => a + b, 0); }
  live() { return [...Array(6).keys()].filter((s) => !this.folded[s]); }
  canAct(s) { return !this.folded[s] && !this.allin[s]; }
  _post(s, amt) { const a = Math.min(amt, this.stack[s]); this.stack[s] -= a; this.bet[s] += a; this.total[s] += a; if (this.stack[s] === 0) this.allin[s] = true; }
  _advanceToLive() { for (let i = 0; i < 6 && !this.canAct(this.toAct); i++) this.toAct = (this.toAct + 1) % 6; }

  toCall(s = this.toAct) { return Math.max(0, Math.min(this.current - this.bet[s], this.stack[s])); }
  legal(s = this.toAct) {
    const call = this.toCall(s), maxTo = this.bet[s] + this.stack[s];
    const minTo = Math.min(maxTo, this.current + this.lastRaise);
    return { fold: call > 0, check: call === 0, call, canRaise: this.stack[s] > call && this.live().filter((x) => this.canAct(x) && x !== s).length > 0, minTo, maxTo };
  }

  act(s, a) {
    if (this.done || s !== this.toAct) throw new Error('not your turn');
    const L = this.legal(s);
    let type = a.type, to = a.to;
    if (type === 'raise' && !L.canRaise) type = L.call > 0 ? 'call' : 'check';
    if (type === 'check' && L.call > 0) type = 'call';
    this.acted[s] = true;
    const rec = { seat: s, pos: this.posOf(s), street: this.street, type, pot: this.pot, toCall: L.call };
    if (type === 'fold') { this.folded[s] = true; }
    else if (type === 'check') { /* nothing */ }
    else if (type === 'call') { this._post(s, L.call); rec.amount = L.call; }
    else if (type === 'raise') {
      to = Math.max(L.minTo, Math.min(L.maxTo, Math.round((to ?? L.minTo) * 100) / 100));
      const size = to - this.current;
      this._post(s, to - this.bet[s]);
      if (size >= this.lastRaise - 1e-9) { this.lastRaise = size; this.acted = this.acted.map((v, i) => (i === s ? true : false)); }
      // a short all-in (less than a full raise) does not reopen the betting, but everyone still has to call it
      this.current = Math.max(this.current, this.bet[s]);
      this.raises++; this.raiser = s; if (this.street === 'preflop' && this.opener === null) this.opener = s;
      rec.to = this.bet[s]; rec.amount = rec.to;
    }
    this.log.push(rec);
    this._next(s);
    return rec;
  }

  _next(from) {
    const live = this.live();
    if (live.length === 1) return this._finish();
    const actors = live.filter((x) => this.canAct(x));
    const open = actors.filter((x) => !this.acted[x] || this.bet[x] < this.current - 1e-9);
    if (open.length === 0) return this._street();
    let nx = from;
    for (let i = 0; i < 6; i++) { nx = (nx + 1) % 6; if (open.includes(nx)) break; }
    this.toAct = nx;
  }

  _street() {
    const live = this.live();
    this.bet = Array(6).fill(0); this.current = 0; this.lastRaise = this.bb; this.raises = 0; this.acted = Array(6).fill(false); this.raiser = null;
    const actors = live.filter((x) => this.canAct(x));
    if (this.street === 'river') return this._finish();
    this.street = { preflop: 'flop', flop: 'turn', turn: 'river' }[this.street];
    this.deck.pop();                                  // burn
    const draw = this.street === 'flop' ? 3 : 1;
    for (let i = 0; i < draw; i++) this.board.push(this.deck.pop());
    this.log.push({ street: this.street, deal: this.board.slice(), pot: this.pot });
    if (actors.length <= 1) { return this._street(); }  // everyone (or all but one) all-in: run it out
    this.toAct = this.seatAt(1); this._advanceToLive();     // first live seat left of the button
  }

  _finish() {
    this.done = true; this.street = this.live().length === 1 ? this.street : 'showdown';
    const live = this.live(), pot = this.pot, win = Array(6).fill(0);
    if (live.length === 1) { win[live[0]] = pot; this.winners = [live[0]]; this.showdown = false; }
    else {
      while (this.board.length < 5) { this.deck.pop(); this.board.push(this.deck.pop()); }
      this.showdown = true;
      const sc = {}; let best = -1;
      for (const s of live) { sc[s] = evaluate([...this.hole[s], ...this.board]); if (sc[s] > best) best = sc[s]; }
      const w = live.filter((s) => sc[s] === best);
      for (const s of w) win[s] = pot / w.length;
      this.winners = w; this.scores = sc;
    }
    this.won = win;
    this.net = this.total.map((t, s) => win[s] - t);
  }
}

// ---- bots -----------------------------------------------------------------------------------------------------------
const rngRange = (rand, a) => rand() < a;
export function botAction(h, s) {
  const st = STYLES[h.styles[s]] || STYLES.tag, L = h.legal(s), rand = h.rand, pos = h.posOf(s);
  const hole = h.hole[s], label = classLabel(hole[0], hole[1]);
  const raise = (to) => ({ type: 'raise', to: Math.max(L.minTo, Math.min(L.maxTo, to)) });
  if (h.street === 'preflop') {
    if (h.raises === 0) {
      // unopened (blinds posted only)
      if (pos === 'BB') return { type: 'check' };
      const effPos = pos === 'SB' ? 'SB' : shiftPos(pos, st.open);
      const inRange = (RFI[effPos] || RFI.BTN).has(label) || (st.open >= 2 && rngRange(rand, 0.18));
      if (inRange) return raise(pos === 'BTN' || pos === 'SB' ? 2.5 + (pos === 'SB' ? 0.5 : 0) : 3);
      if (st.call >= 0.4 && L.call > 0 && rngRange(rand, 0.2) && label[2] === 's') return { type: 'call' };   // station limps
      return { type: L.call > 0 ? 'fold' : 'check' };
    }
    const opener = h.opener ?? h.raiser, openerPos = h.posOf(opener);
    if (h.raises === 1) {
      const a = facingRaise(label, pos, openerPos);
      const callSet = topRange(st.call + (pos === 'BB' ? 0.14 : 0));
      if (a === '3bet' && rngRange(rand, Math.min(0.95, 0.55 * st.threeBet + 0.35))) return raise(h.current * (pos === 'SB' || pos === 'BB' ? 4 : 3.2));
      if (a === '3bet' || a === 'call' || callSet.has(label)) {
        const need = L.call / (h.pot + L.call);
        if (a === 'fold' && need > 0.3 && !rngRange(rand, st.call)) return { type: 'fold' };
        return { type: 'call' };
      }
      if (rngRange(rand, 0.05 * st.threeBet) && label[2] === 's') return raise(h.current * 3.2);  // light 3-bet
      return { type: 'fold' };
    }
    // facing a 3-bet or more
    const premium = ['AA', 'KK', 'QQ', 'AKs', 'AKo'].includes(label);
    if (['AA', 'KK'].includes(label)) return raise(L.maxTo);
    if (premium || (['JJ', 'TT', 'AQs'].includes(label) && h.raises === 2 && rngRange(rand, 0.5))) return L.call > 0 ? { type: 'call' } : { type: 'check' };
    return { type: 'fold' };
  }
  // postflop: equity against a range that depends on the action so far
  const board = h.board, villains = h.live().filter((x) => x !== s).length;
  const facing = L.call > 0, potBefore = h.pot - 0;
  const range = topRange(facing ? (h.raises >= 2 ? 0.2 : 0.38) : 0.55);
  const eq = equity(hole, board, Array(Math.min(2, villains)).fill(range), 160, rand).equity;
  const tex = boardTexture(board), od = outs(hole, board), draws = od.count;
  const pot = h.pot, size = (f) => Math.round(Math.max(1, pot * f) * 10) / 10;
  if (!facing) {
    const value = eq > (villains > 1 ? 0.62 : 0.56) * (1.1 - st.aggr * 0.25);
    const semi = draws >= 8 && board.length < 5 && rngRange(rand, st.aggr * 0.6);
    const bluff = !value && rngRange(rand, st.bluff * (tex.dry ? 1.3 : 0.8));
    if (value && rngRange(rand, 0.55 + st.aggr * 0.4)) return raise(h.bet[s] + size(tex.wet ? 0.7 : 0.45) );
    if (semi || bluff) return raise(h.bet[s] + size(0.55));
    return { type: 'check' };
  }
  const need = potOddsNeeded(L.call, pot);
  const strong = eq > 0.74 && rngRange(rand, st.aggr);
  if (strong && L.canRaise) return raise(h.current + Math.max(h.lastRaise, pot * 0.75));
  if (eq > need * st.fold + 0.03) return { type: 'call' };
  if (draws >= 8 && board.length < 5 && eq > need * 0.8) return { type: 'call' };
  if (rngRange(rand, st.bluff * 0.25) && L.canRaise && !tex.paired) return raise(h.current + Math.max(h.lastRaise, pot * 0.8));
  return { type: 'fold' };
}

// ---- coach ---------------------------------------------------------------------------------------------------------------
// Returns what a sound player would do here and why. Rec is one of 'fold','check','call','raise'.
export function coach(h, s) {
  const L = h.legal(s), hole = h.hole[s], label = classLabel(hole[0], hole[1]), pos = h.posOf(s);
  const facing = L.call > 0;
  if (h.street === 'preflop') {
    if (h.raises === 0) {
      if (pos === 'BB') return { rec: 'check', why: 'Nobody has raised and you are in the big blind: take the free flop.', label, pos, preflop: true };
      const ok = openAction(label, pos) === 'raise';
      return { rec: ok ? 'raise' : 'fold', preflop: true, label, pos, why: ok ? `${label} is in the standard opening range from ${pos}. Raise to about 2.5–3 big blinds.` : `${label} is outside the standard opening range from ${pos}. Fold: opening it loses money in the long run.` };
    }
    const opener = h.opener ?? h.raiser, openerPos = h.posOf(opener);
    if (h.raises === 1) {
      const a = facingRaise(label, pos, openerPos);
      const callNote = a === 'call' ? 'a hand worth calling a raise with' : a === '3bet' ? 'strong enough to re-raise' : 'too weak to continue against this raise';
      return { rec: a === '3bet' ? 'raise' : a, preflop: true, label, pos, why: `${label} versus a raise from ${openerPos}: ${callNote}. ${a === '3bet' ? 'Re-raise to about 3 times their bet (4 times out of position).' : a === 'call' ? 'Call, and play carefully after the flop.' : 'Fold; the pot odds do not make up for the weak hand.'}` };
    }
    const prem = ['AA', 'KK', 'QQ', 'AKs', 'AKo'].includes(label);
    return { rec: prem ? (['AA', 'KK'].includes(label) ? 'raise' : 'call') : 'fold', preflop: true, label, pos, why: prem ? `${label} is strong enough to continue against a 3-bet${['AA', 'KK'].includes(label) ? ' — put the money in' : ': call and see the flop'}.` : `Against a 3-bet or more, fold everything below the top of your range. ${label} is not strong enough.` };
  }
  const villains = h.live().filter((x) => x !== s).length;
  const range = topRange(facing ? (h.raises >= 2 ? 0.2 : 0.38) : 0.6);
  const eqR = equity(hole, h.board, Array(Math.min(3, villains)).fill(range), 1500);
  const eq = eqR.equity, od = outs(hole, h.board), tex = boardTexture(h.board);
  const hand = describeHand(evaluate([...hole, ...h.board]));
  const pot = h.pot, base = { equity: eq, hand, outs: od.count, texture: tex, pot };
  const cards2c = h.board.length === 3 ? 2 : 1;
  if (facing) {
    const need = potOddsNeeded(L.call, pot);
    const drawNote = od.count >= 4 && h.board.length < 5 ? ` You have about ${od.count} outs (${ruleOf(od.count, cards2c)}% to hit${cards2c === 2 ? ' by the river' : ' on the next card'}).` : '';
    if (eq > 0.72 && L.canRaise) return { ...base, rec: 'raise', need, why: `${hand}. Your equity is about ${Math.round(eq * 100)}% against a typical range; you need only ${Math.round(need * 100)}% to call. Raise for value.${drawNote}` };
    if (eq >= need + 0.03) return { ...base, rec: 'call', need, why: `${hand}. You need ${Math.round(need * 100)}% equity to call and have about ${Math.round(eq * 100)}%: calling is profitable.${drawNote}` };
    if (od.count >= 8 && h.board.length < 5 && eq >= need - 0.07) return { ...base, rec: 'call', need, why: `${hand}. Your raw equity (${Math.round(eq * 100)}%) is just under the ${Math.round(need * 100)}% you need, but a strong draw earns extra when it hits (implied odds).${drawNote}` };
    return { ...base, rec: 'fold', need, why: `${hand}. You need ${Math.round(need * 100)}% equity and have about ${Math.round(eq * 100)}%.${drawNote} Folding saves money.` };
  }
  const drawNote = od.count >= 8 && h.board.length < 5 ? ` A semi-bluff is attractive: ${od.count} outs gives you a draw and fold equity.` : '';
  if (eq > 0.6) return { ...base, rec: 'raise', why: `${hand}. About ${Math.round(eq * 100)}% equity against a typical range: bet for value (${tex.wet ? 'about two-thirds of the pot on this wet board' : 'a third to a half of the pot on this dry board'}) so worse hands pay.` };
  if (od.count >= 8 && h.board.length < 5) return { ...base, rec: 'raise', why: `${hand}. You have a strong draw (${od.count} outs). Betting wins the pot now when they fold and still lets you hit when they call.` };
  return { ...base, rec: 'check', why: `${hand}. About ${Math.round(eq * 100)}% equity: not enough to bet for value and no strong draw. Check and keep the pot small.${drawNote}` };
}

export const classOf = (type) => (type === 'raise' ? 'raise' : type === 'fold' ? 'fold' : 'call');
export function grade(rec, type) {
  const r = rec === 'check' ? 'call' : rec, t = type === 'check' ? 'call' : type;
  const rc = r === 'raise' ? 'raise' : r === 'fold' ? 'fold' : 'call';
  if (rc === t) return 'good';
  if ((rc === 'call' && t === 'raise') || (rc === 'raise' && t === 'call')) return 'ok';
  return 'leak';
}
