// Poker lab maths: heads-up Nash push/fold from a precomputed equity matrix, ICM, MDF and bluff ratios,
// range advantage, blocker analysis and postflop spot grading. Pure functions, no DOM.

import { ALL_CLASSES, classCombos, evaluate, freshDeck, rankOf, suitOf, equity, topRange, boardTexture, outs, categoryOf, potOddsNeeded } from './poker.js';

// ---- combos per class --------------------------------------------------------------------------------------
export const COMBOS = ALL_CLASSES.map((l) => (l.length === 2 ? 6 : l[2] === 's' ? 4 : 12));
const P = COMBOS.map((c) => c / 1326);

// ---- heads-up push / fold Nash (chip EV, effective stack S in big blinds) ---------------------------------------------
// data.eq[i*169+j] = equity of class i against class j, x10000.
export function solvePushFold(data, S, iters = 600) {
  const N = ALL_CLASSES.length, E = (i, j) => data.eq[i * N + j] / 10000;
  const push = new Float64Array(N).fill(0.5), call = new Float64Array(N).fill(0.5);
  for (let k = 1; k <= iters; k++) {
    const step = 1 / (k + 1);
    const newPush = new Float64Array(N), newCall = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let v = 0.5;
      for (let j = 0; j < N; j++) v += P[j] * (call[j] * (2 * E(i, j) - 1) * S + (1 - call[j]) * 1);
      newPush[i] = v > 0 ? 1 : 0;
    }
    for (let j = 0; j < N; j++) {
      let v = 0;
      for (let i = 0; i < N; i++) v += P[i] * push[i] * ((2 * E(j, i) - 1) * S + 1);
      newCall[j] = v > 0 ? 1 : 0;
    }
    for (let i = 0; i < N; i++) { push[i] += step * (newPush[i] - push[i]); call[i] += step * (newCall[i] - call[i]); }
  }
  const pick = (arr) => ALL_CLASSES.filter((_, i) => arr[i] >= 0.5);
  const pushSet = pick(push), callSet = pick(call);
  const pct = (set) => set.reduce((n, l) => n + COMBOS[ALL_CLASSES.indexOf(l)], 0) / 1326;
  return { stack: S, push: pushSet, call: callSet, pushPct: pct(pushSet), callPct: pct(callSet) };
}

// Chip EV (in bb) of an SB shove with class `label` against a calling set, at stack S.
export function shoveEV(data, label, callSet, S) {
  const N = ALL_CLASSES.length, i = ALL_CLASSES.indexOf(label), calls = new Set(callSet);
  let ev = 0;
  for (let j = 0; j < N; j++) ev += P[j] * (calls.has(ALL_CLASSES[j]) ? (2 * data.eq[i * N + j] / 10000 - 1) * S : 1);
  return ev;   // absolute EV of the shove, to compare with fold = -0.5
}

// ---- ICM (Malmuth-Harville) ----------------------------------------------------------------------------------------------
// stacks: chips per player; payouts: prize for 1st, 2nd, ... Returns each player's expected prize.
export function icm(stacks, payouts) {
  const n = stacks.length, out = new Array(n).fill(0);
  const pay = payouts.slice(0, n);
  function rec(remaining, place, prob) {
    if (place >= pay.length || remaining.length === 0) return;
    const tot = remaining.reduce((a, i) => a + stacks[i], 0);
    if (tot <= 0) return;
    for (const i of remaining) {
      const p = prob * stacks[i] / tot;
      if (p <= 0) continue;
      out[i] += p * pay[place];
      rec(remaining.filter((x) => x !== i), place + 1, p);
    }
  }
  rec([...Array(n).keys()], 0, 1);
  return out;
}

// Hero (index h) faces an all-in from villain (index v): call amount is min of the two stacks. `dead` = blinds/antes in the pot.
// Returns ICM $ for fold / win / lose, and the equity needed to call under ICM vs in plain chips.
export function icmCall(stacks, payouts, h, v, dead = 0) {
  const c = Math.min(stacks[h], stacks[v]);
  const base = stacks.slice();
  const fold = icm(base, payouts)[h];
  const win = base.slice(); win[h] += c + dead; win[v] -= c;
  const lose = base.slice(); lose[h] -= c; lose[v] += c + dead;
  const eW = icm(win, payouts)[h], eL = icm(lose, payouts)[h];
  const need = eW === eL ? 1 : (fold - eL) / (eW - eL);
  return { fold, win: eW, lose: eL, needICM: Math.max(0, Math.min(1, need)), needChips: c / (2 * c + dead), call: c };
}

// ---- defence and bluff arithmetic --------------------------------------------------------------------------------------------
export const mdf = (bet, pot) => pot / (pot + bet);                    // minimum defence frequency vs a bet of `bet` into `pot`
export const bluffShare = (bet, pot) => bet / (pot + 2 * bet);          // share of a betting range that can be bluffs for the caller to be indifferent
export const potOdds = (bet, pot) => bet / (pot + 2 * bet);            // equity needed to call a bet (pot BEFORE the bet)

// EV of calling a river bet with a bluff-catcher when the bettor has `value` combos of value hands and `bluffs` combos of bluffs.
export function catcherEV(bet, pot, value, bluffs) {
  const pWin = bluffs / (value + bluffs);
  return pWin * (pot + bet) - (1 - pWin) * bet;
}

// ---- ranges and boards ------------------------------------------------------------------------------------------------------------
const PFR = topRange(0.2), CALLER = topRange(0.32);
export const PFR_RANGE = PFR, CALLER_RANGE = CALLER;

// Average equity of one range against another on a given flop (Monte Carlo over sampled hands).
export function rangeEquity(rangeA, rangeB, board, samples = 60, trials = 80, rand = Math.random) {
  const combosA = [...rangeA].flatMap(classCombos).filter((c) => !board.includes(c[0]) && !board.includes(c[1]));
  let sum = 0, n = 0;
  for (let s = 0; s < samples; s++) {
    const h = combosA[Math.floor(rand() * combosA.length)];
    if (!h) continue;
    const e = equity(h, board, [rangeB], trials, rand);
    sum += e.equity; n++;
  }
  return n ? sum / n : 0.5;
}

// Which side does a flop favour? Uses the preflop raiser's range against the caller's.
export function rangeAdvantage(board, rand = Math.random) {
  const pfr = rangeEquity(PFR, CALLER, board, 70, 90, rand);
  return { pfr, caller: 1 - pfr, favours: pfr > 0.535 ? 'pfr' : pfr < 0.485 ? 'caller' : 'even' };
}

// ---- blockers --------------------------------------------------------------------------------------------------------------------------
// On a full board, how much of the villain's strong (top 15%) and weak (bottom 40%) combos does each of your two cards remove?
export function blockerProfile(hero, board) {
  const dead = new Set([...hero, ...board]);
  const all = freshDeck(board), combos = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) combos.push([all[i], all[j], evaluate([all[i], all[j], ...board])]);
  combos.sort((a, b) => b[2] - a[2]);
  const strong = combos.slice(0, Math.round(combos.length * 0.15)), weak = combos.slice(Math.round(combos.length * 0.6));
  const hit = (set) => set.filter((c) => hero.includes(c[0]) || hero.includes(c[1])).length / set.length;
  const heroScore = evaluate([...hero, ...board]);
  const rank = combos.filter((c) => c[2] > heroScore).length / combos.length;       // share of combos that beat you
  return { blocksStrong: hit(strong), blocksWeak: hit(weak), beatenBy: rank, strongN: strong.length, weakN: weak.length, ok: !hero.some((c) => board.includes(c)) };
}

// ---- postflop spots ---------------------------------------------------------------------------------------------------------------------
// Grades a flop decision from computed equity against a plausible range, outs and the texture. A coaching heuristic, not a solver:
// spots in the grey zone are rejected so the "right" answer is clear.
export function gradeCbet(hero, board, rand = Math.random) {
  const e = equity(hero, board, [CALLER], 1200, rand).equity, o = outs(hero, board), tex = boardTexture(board);
  const cat = categoryOf(evaluate([...hero, ...board]));
  const draw = o.count >= 8;
  let rec, why;
  if (e >= 0.66) { rec = 'bet'; why = `You have about ${Math.round(e * 100)}% against a calling range: bet for value${tex.wet ? ' and charge the draws' : ''}.`; }
  else if (e >= 0.5 && cat >= 1) { rec = tex.dry ? 'bet' : 'check'; why = tex.dry ? `A modest hand (${Math.round(e * 100)}%) on a dry board: a small bet gets value from worse and folds out overcards.` : `A medium-strength hand (${Math.round(e * 100)}%) on a wet board: check and keep the pot small, you are not far enough ahead.`; }
  else if (draw) { rec = 'bet'; why = `${o.count} outs gives you a semi-bluff: you win when they fold now and often when you hit later.`; }
  else if (e < 0.4) { rec = tex.dry && e > 0.3 ? 'bet' : 'check'; why = rec === 'bet' ? 'Nothing much, but this board hit the raiser’s range far harder than the caller’s: a small bluff is fine.' : `Only ${Math.round(e * 100)}% and no real draw: give up a bluff on this texture, check and see a free card.`; }
  else { rec = 'check'; why = `${Math.round(e * 100)}% with little else: a check keeps the pot under control.`; }
  const gray = (e > 0.62 && e < 0.7) || (e > 0.47 && e < 0.53) || (e > 0.36 && e < 0.44 && !draw);
  return { rec, why, equity: e, outs: o.count, gray, tex };
}

// Facing a bet of `bet` into `pot` (pot before the bet): call / fold / raise from equity against a tight betting range.
export function gradeFacing(hero, board, pot, bet, rand = Math.random) {
  const rng = topRange(0.28);
  const e = equity(hero, board, [rng], 1200, rand).equity, need = potOdds(bet, pot);
  const o = board.length < 5 ? outs(hero, board) : { count: 0 };
  let rec, why;
  if (e >= 0.78) { rec = 'raise'; why = `${Math.round(e * 100)}% against their betting range: raise for value, you are far ahead.`; }
  else if (e >= need + 0.05) { rec = 'call'; why = `You need ${Math.round(need * 100)}% to call and you have about ${Math.round(e * 100)}%: call.`; }
  else if (e <= need - 0.05) { rec = 'fold'; why = `You need ${Math.round(need * 100)}% and have about ${Math.round(e * 100)}%${o.count >= 8 ? ` (even counting ${o.count} outs)` : ''}: fold.`; }
  else { rec = e >= need ? 'call' : 'fold'; why = `Close: you need ${Math.round(need * 100)}% and have ${Math.round(e * 100)}%.`; }
  const gray = Math.abs(e - need) < 0.05 || (e > 0.74 && e < 0.82);
  return { rec, why, equity: e, need, gray };
}
