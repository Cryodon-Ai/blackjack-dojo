// Exact house edges for common side bets, by enumeration over the shoe, for an explicitly stated paytable.
// Nothing here is claimed for any specific casino's version: paytables vary. Suits: 0..3 (0,3 = black; 1,2 = red).

import { Shoe, mulberry32, playDealerCounted } from './sim.js';
import { normalizeRules } from './rules.js';

// Insurance / even money: pays 2:1 on a dealer ten-value hole card.
export function insuranceEdge(decks) {
  const N = 52 * decks;
  const p = (16 * decks) / (N - 1);
  return 1 - 3 * p;             // house edge (positive)
}

// Perfect Pairs: your first two cards. odds are net payouts (x:1).
export const PP_TABLE = { mixed: 6, colored: 12, perfect: 25 };
export function perfectPairsEdge(decks, pay = PP_TABLE) {
  const N = 52 * decks;
  const perfect = (decks - 1) / (N - 1), colored = decks / (N - 1), mixed = (2 * decks) / (N - 1);
  const win = perfect + colored + mixed;
  const ev = perfect * pay.perfect + colored * pay.colored + mixed * pay.mixed - (1 - win);
  return { edge: -ev, hit: win };
}

// Card encoding shared by the classifiers below: 0..51, rank = code>>2 (0=Ace..8=9,9=Ten,10=J,11=Q,
// 12=K), suit = code&3 (0=spades, 1=hearts, 2=diamonds, 3=clubs — 0,3 black; 1,2 red).
const RANK_OF_LABEL = { A: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9, J: 10, Q: 11, K: 12 };
const SUIT_IDX = { s: 0, h: 1, d: 2, c: 3 };
// Adapts a ui/cards.js concrete card ({label, suit}) to that 0..51 code, for settling one dealt hand
// (as opposed to the exact-edge functions below, which enumerate every code directly).
export const cardCode = (card) => RANK_OF_LABEL[card.label] * 4 + SUIT_IDX[card.suit];

export function classifyPerfectPairs(a, b) {
  const ra = a >> 2, sa = a & 3, rb = b >> 2, sb = b & 3;
  if (ra !== rb) return null;
  if (sa === sb) return 'perfect';
  const red = (s) => s === 1 || s === 2;
  return red(sa) === red(sb) ? 'colored' : 'mixed';
}

export function classify21plus3(a, b, c) {
  const [ra, sa] = [a >> 2, a & 3], [rb, sb] = [b >> 2, b & 3], [rc, sc] = [c >> 2, c & 3];
  const suited = sa === sb && sb === sc;
  if (ra === rb && rb === rc) return suited ? 'suitedTrips' : 'trips';
  const r = [ra, rb, rc].sort((x, y) => x - y);              // 0 = ace ... 12 = king
  const straight = (r[1] === r[0] + 1 && r[2] === r[1] + 1) || (r[0] === 0 && r[1] === 11 && r[2] === 12);   // A-2-3 ... Q-K-A
  if (straight && suited) return 'straightFlush';
  if (straight) return 'straight';
  if (suited) return 'flush';
  return null;
}

// 21+3: your two cards plus the dealer's upcard form a poker hand.
export const T213_TABLE = { flush: 5, straight: 10, trips: 30, straightFlush: 40, suitedTrips: 100 };
export function edge21plus3(decks, pay = T213_TABLE) {
  const N = 52 * decks;
  let ev = 0, hit = 0;
  for (let a = 0; a < 52; a++) for (let b = 0; b < 52; b++) for (let c = 0; c < 52; c++) {
    const na = decks, nb = decks - (b === a), nc = decks - (c === a) - (c === b);
    if (nb <= 0 || nc <= 0) continue;
    const p = (na / N) * (nb / (N - 1)) * (nc / (N - 2));
    const k = classify21plus3(a, b, c);
    if (k) { ev += p * pay[k]; hit += p; } else ev -= p;   // winners add their net payout, losers subtract the bet
  }
  return { edge: -ev, hit };
}

// Gravity Blackjack's own base paytables (before its multiplier feature), per the game's published
// rules — distinct from the generic PP_TABLE/T213_TABLE above, which model a typical standalone table.
export const GRAVITY_PP_TABLE = { mixed: 5, colored: 10, perfect: 20 };
export const GRAVITY_213_TABLE = { flush: 4, straight: 10, trips: 20, straightFlush: 30, suitedTrips: 100 };

// Lucky Ladies: your first two cards.
const LL_VAL = (r) => (r === 0 ? 11 : r <= 8 ? r + 1 : 10);   // two-card value; Ace counts as 11
const QUEEN = 11, HEARTS = 1;
export function classifyLuckyLadies(a, b) {
  const ra = a >> 2, sa = a & 3, rb = b >> 2, sb = b & 3;
  const total = LL_VAL(ra) + LL_VAL(rb);
  if (ra === QUEEN && rb === QUEEN && sa === HEARTS && sb === HEARTS) return 'qhPair';
  if (total === 20 && ra === rb && sa === sb) return 'matched20';
  if (total === 20 && sa === sb) return 'suited20';
  if (total === 20) return 'any20';
  if (ra === QUEEN || rb === QUEEN) return 'anyQueen';
  return null;
}

export const LL_TABLE = { qhPair: 100, matched20: 20, suited20: 10, any20: 2, anyQueen: 1 };
export function luckyLadiesEdge(decks, pay = LL_TABLE) {
  const N = 52 * decks;
  let ev = 0, hit = 0;
  for (let a = 0; a < 52; a++) for (let b = 0; b < 52; b++) {
    const na = decks, nb = decks - (b === a ? 1 : 0);
    if (nb <= 0) continue;
    const p = (na / N) * (nb / (N - 1));
    const k = classifyLuckyLadies(a, b);
    if (k) { ev += p * pay[k]; hit += p; } else ev -= p;
  }
  return { edge: -ev, hit };
}

// Dealer Bust: pays on a dealer bust, tiered by how many cards the dealer took. No exact closed
// form is implemented here (would require a card-count-indexed dealer recursion), so this is a
// seeded Monte Carlo estimate — call sites should label it as simulated, not exact.
export const DB_TABLE = { '3-4': 1, '5': 10, '6': 25, '7': 100, '8+': 300 };
export const dealerBustTier = (cards) => (cards <= 4 ? '3-4' : cards === 5 ? '5' : cards === 6 ? '6' : cards === 7 ? '7' : '8+');
export function dealerBustEdge(rulesIn, pay = DB_TABLE, trials = 1_000_000, seed = 42) {
  const rules = normalizeRules(rulesIn);
  const rand = mulberry32(seed);
  const shoe = new Shoe(rules, rand);
  const tierHits = { '3-4': 0, '5': 0, '6': 0, '7': 0, '8+': 0 };
  let ev = 0, hit = 0;
  for (let i = 0; i < trials; i++) {
    shoe.shuffle();
    const up = shoe.draw(), hole = shoe.draw();
    const { result, cards } = playDealerCounted(shoe, up, hole);
    if (result === 22) { const t = dealerBustTier(cards); tierHits[t]++; hit++; ev += pay[t]; }
    else ev -= 1;   // dealer stands or has blackjack: the bust bet loses
  }
  const hitRate = {}; for (const k of Object.keys(tierHits)) hitRate[k] = tierHits[k] / trials;
  return { edge: -ev / trials, hit: hit / trials, tierHits: hitRate, n: trials, simulated: true };
}
