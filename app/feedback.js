// Reason-first feedback. Every sentence is built from engine numbers (dealer outcome table, bust
// odds, EV of each option) — never "the chart says".

import { engine } from './engine-client.js';
import { upLabel } from '../engine/rules.js';

export const ACTION_NAME = { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split', R: 'Surrender' };
const KEY_OF = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' };
export const evKey = (a) => KEY_OF[a];

export const pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;
export const signed = (x, d = 1) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(d)}%`;
export const usd100 = (x) => `$${Math.abs(x * 100).toFixed(2)}`;      // per $100 wagered
export const upName = (u) => (u === 1 ? 'Ace' : u === 10 ? 'ten' : String(u));

// Probability that one more card busts a hard hand, given the cards already visible (fresh shuffle).
export function bustOnHit(rules, hand, up) {
  const d = Number.isFinite(rules.decks) ? rules.decks : Infinity;
  const cnt = Array(11).fill(0);
  for (let r = 1; r <= 9; r++) cnt[r] = 4 * d;
  cnt[10] = 16 * d;
  let n = 52 * d;
  if (!Number.isFinite(d)) { for (let r = 1; r <= 10; r++) cnt[r] = r === 10 ? 4 / 13 : 1 / 13; n = 1; }
  else for (const v of [...hand, up]) { cnt[v]--; n--; }
  const hard = hand.reduce((a, b) => a + b, 0);
  let bust = 0;
  for (let r = 1; r <= 10; r++) if (hard + r > 21) bust += cnt[r] / n;
  return bust;
}

function outcomes(t, total) {
  // Player standing on `total` vs dealer table t (conditional on no dealer BJ in peek games)
  let win = t.bust, push = 0, lose = 0;
  for (const dt of [17, 18, 19, 20, 21]) { if (total > dt) win += t[dt]; else if (total === dt) push += t[dt]; else lose += t[dt]; }
  return { win, push, lose };
}

function reasonText(c) {
  const { A, C, hard, soft, total, pairRank, up, t, pb, ev, rows } = c;
  const upn = upName(up), bust = t.bust;
  const o = outcomes(t, total);
  const evOf = (a) => ev[KEY_OF[a]];
  const others = Object.keys(ev).filter((k) => k !== KEY_OF[A]);
  const bestOther = others.sort((a, b) => ev[b] - ev[a])[0];
  const bestOtherEV = ev[bestOther];
  const nm = (k) => ({ hit: 'hitting', stand: 'standing', double: 'doubling', split: 'splitting', surrender: 'surrendering' }[k]);

  if (A === 'R') return `Surrender costs exactly 50% of the bet. Playing ${total} against a dealer ${upn} loses ${pct(-bestOtherEV, 1)} on average, so cutting the loss is cheaper.`;

  if (A === 'P') {
    if (pairRank === 1) return `An Ace is the best starting card in the game. Splitting is worth ${signed(evOf('P'))} against ${signed(bestOtherEV)} for ${nm(bestOther)} — two hands starting on 11 beat one soft 12.`;
    if (pairRank === 8) {
      return bust >= 0.35
        ? `A dealer ${upn} busts ${pct(bust)}, and 16 is your worst total. Two hands starting on 8 make better use of that weakness (${signed(evOf('P'))} vs ${signed(bestOtherEV)}).`
        : `16 is the worst total in the game. Splitting turns one bad hand into two chances — it loses ${pct(-evOf('P'), 1)} vs ${pct(-bestOtherEV, 1)} for ${nm(bestOther)}.`;
    }
    return `A dealer ${upn} busts ${pct(bust)}. Two hands starting on ${pairRank} are worth more than one ${total} here: ${signed(evOf('P'))} vs ${signed(bestOtherEV)} for ${nm(bestOther)}.`;
  }

  if (pairRank && C === 'P') {
    if (pairRank === 10) return `Twenty wins ${pct(o.win)} of the time against a dealer ${upn}. Splitting tens trades a near-lock for two shaky hands starting on 10.`;
    if (pairRank === 5) return `Two 5s make a 10, the best doubling total. Splitting gives you two weak 5s instead (${signed(ev.split)} vs ${signed(evOf(A))}).`;
    return `Splitting ${pairRank},${pairRank} against a dealer ${upn} is worth ${signed(ev.split)}, but ${nm(KEY_OF[A])} is worth ${signed(evOf(A))}.`;
  }

  if (A === 'D') {
    const alt = ev.hit > ev.stand ? 'hit' : 'stand';
    if (soft) return `A soft ${total} can't bust on one card and a dealer ${upn} busts ${pct(bust)}. That's the moment to put more money out: ${signed(ev.double)} doubling vs ${signed(ev[alt])} for ${nm(alt)}.`;
    return `A hard ${hard} turns into ${hard + 10} with any ten, and a dealer ${upn} busts ${pct(bust)}. Double while you're the favorite: ${signed(ev.double)} vs ${signed(ev[alt])} for ${nm(alt)}.`;
  }

  if (A === 'S') {
    if (!soft && hard >= 17) return `A hit busts ${pct(pb)} of the time at ${hard}, and standing already wins ${pct(o.win)} against a dealer ${upn}. Nothing to gain by drawing.`;
    if (!soft && hard >= 12 && bust >= 0.35) return `Dealer's ${upn} busts ${pct(bust)} of the time. Your ${hard} busts ${pct(pb)} if you hit. Let them break.`;
    if (soft) return `Soft ${total} wins ${pct(o.win)} and pushes ${pct(o.push)} against a dealer ${upn}. Drawing risks turning it into something worse for very little gain (${signed(ev.stand)} standing vs ${signed(ev.hit)} hitting).`;
    return `Standing is worth ${signed(ev.stand)} here against ${signed(ev.hit)} for hitting: a dealer ${upn} busts ${pct(bust)}, and a hit busts you ${pct(pb)}.`;
  }

  if (A === 'H') {
    if (soft) return `A dealer ${upn} finishes above 18 about ${pct(t[19] + t[20] + t[21])} of the time, so standing on ${total} wins only ${pct(o.win)}. A soft hand can't bust on one card, so take the free draw (${signed(ev.hit)} vs ${signed(ev.stand)}).`;
    if (hard <= 11) return `You can't bust on one card from ${hard}, so a hit can only help. Standing wins just ${pct(o.win)} against a dealer ${upn}.`;
    if (bust >= 0.35) return `A dealer ${upn} busts ${pct(bust)} — close, but a hit on ${hard} busts you only ${pct(pb)}. Hitting is worth ${signed(ev.hit)} vs ${signed(ev.stand)} for standing.`;
    return `A dealer ${upn} busts only ${pct(bust)}, so standing on ${hard} wins just ${pct(o.win)}. A hit busts you ${pct(pb)}, but still loses less: ${signed(ev.hit)} vs ${signed(ev.stand)}.`;
  }
  return `${ACTION_NAME[A]} is worth ${signed(evOf(A))} here, against ${signed(bestOtherEV)} for ${nm(bestOther)}.`;
}

// res: cell/decide result ({ev, legal, action}). hand: array of ranks. chosen: 'H'|'S'|... or null.
export async function explain(rules, hand, up, res, chosen, { timeout = false } = {}) {
  const t = await engine.dealer(rules, up);
  const hard = hand.reduce((a, b) => a + b, 0);
  const soft = hand.includes(1) && hard <= 11;
  const total = soft ? hard + 10 : hard;
  const pairRank = hand.length === 2 && hand[0] === hand[1] ? hand[0] : null;
  const pb = bustOnHit(rules, hand, up);
  const A = res.action;
  const reason = reasonText({ A, C: chosen, hard, soft, total, pairRank, up, t, pb, ev: res.ev });

  // Ordered EV lines for legal options.
  const lines = Object.keys(KEY_OF).filter((a) => res.ev[KEY_OF[a]] !== undefined).map((a) => ({
    action: a, name: ACTION_NAME[a], ev: res.ev[KEY_OF[a]], legal: !!res.legal[KEY_OF[a]],
    best: a === A, mine: a === chosen,
  })).sort((x, y) => (y.legal - x.legal) || (y.ev - x.ev));

  const bestEV = res.ev[KEY_OF[A]];
  const mineEV = chosen ? res.ev[KEY_OF[chosen]] : null;
  const cost = chosen && chosen !== A && mineEV !== undefined ? bestEV - mineEV : 0;   // fraction of one bet

  return {
    correct: A, chosen, timeout, isCorrect: timeout ? false : (!chosen || chosen === A), reason, lines, cost,
    dealer: t, bustHit: pb, hard, soft, total, pairRank,
    stand: outcomes(t, total),
    title: `${soft ? 'Soft ' : pairRank ? '' : 'Hard '}${pairRank ? (pairRank === 1 ? 'A,A' : pairRank === 10 ? 'T,T' : `${pairRank},${pairRank}`) : total} vs ${upLabel(up)}`,
  };
}
