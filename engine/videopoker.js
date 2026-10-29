// Draw poker engine for the Video Poker games: Jacks or Better (9/6 and 8/5) and Bonus Poker (8/5).
// Single 52-card deck, no wild cards. Cards are ints: c = (rank - 2) * 4 + suit, rank 2..14 (14 = ace), suit 0..3.
// Pure logic: the deal, hand evaluation, pay tables, and the exact expected value of every hold.

export const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];
export const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const rankOf = (c) => (c >> 2) + 2;
export const suitOf = (c) => c & 3;
export const cardLabel = (c) => (RANK_LABEL[rankOf(c)] || String(rankOf(c))) + SUIT_GLYPH[suitOf(c)];

// Coins paid per coin bet. Return figures are published with perfect strategy at max bet:
// 9/6 99.54%, 8/5 Jacks or Better 97.30%, Bonus Poker 8/5 99.17%.
export const TABLES = Object.freeze({
  job96: {
    id: 'job96', name: 'Jacks or Better', variant: '9/6', ret: '99.54%',
    coins: { royal: 800, straightFlush: 50, four: 25, fullHouse: 9, flush: 6, straight: 4, three: 3, twoPair: 2, jacksOrBetter: 1 },
  },
  job85: {
    id: 'job85', name: 'Jacks or Better', variant: '8/5', ret: '97.30%',
    coins: { royal: 800, straightFlush: 50, four: 25, fullHouse: 8, flush: 5, straight: 4, three: 3, twoPair: 2, jacksOrBetter: 1 },
  },
  bonus85: {
    id: 'bonus85', name: 'Bonus Poker', variant: '8/5', ret: '99.17%',
    coins: { royal: 800, straightFlush: 50, fourAces: 80, fourSmall: 40, fourHigh: 25, fullHouse: 8, flush: 5, straight: 4, three: 3, twoPair: 2, jacksOrBetter: 1 },
  },
});
export const TABLE_ORDER = ['job96', 'job85', 'bonus85'];
export const PAY_96 = TABLES.job96.coins; // kept for callers that predate the table list

// Printed names, in the order a paytable lists them.
export const HAND_NAME = Object.freeze({
  royal: 'Royal flush', straightFlush: 'Straight flush', fourAces: 'Four aces', fourSmall: 'Four 2s–4s', fourHigh: 'Four 5s–Ks',
  four: 'Four of a kind', fullHouse: 'Full house', flush: 'Flush', straight: 'Straight', three: 'Three of a kind',
  twoPair: 'Two pair', jacksOrBetter: 'Jacks or better', none: 'Nothing',
});
export const PAYTABLE_ORDER = ['royal', 'straightFlush', 'fourAces', 'fourSmall', 'fourHigh', 'four', 'fullHouse', 'flush', 'straight', 'three', 'twoPair', 'jacksOrBetter'];

const cnt = new Int8Array(15); // scratch, reused: a hand evaluation makes no allocations

// Category of a five-card hand (array of ints). 'four' covers all quads; keyOf() splits it by rank for tables that need it.
export function categoryOf(cards) {
  cnt.fill(0);
  const s0 = suitOf(cards[0]);
  let flush = true;
  for (let i = 0; i < 5; i++) {
    const c = cards[i];
    cnt[rankOf(c)]++;
    if (suitOf(c) !== s0) flush = false;
  }
  let pairs = 0, trips = 0, quads = 0, pairRank = 0, lo = 99, hi = 0, distinct = 0;
  for (let r = 2; r <= 14; r++) {
    const n = cnt[r];
    if (!n) continue;
    distinct++;
    if (r < lo) lo = r;
    if (r > hi) hi = r;
    if (n === 4) quads++;
    else if (n === 3) trips++;
    else if (n === 2) { pairs++; if (r >= 11) pairRank = r; }
  }
  // Straight: five distinct ranks in a run of five, or the ace-low wheel (A-2-3-4-5).
  const wheel = distinct === 5 && cnt[14] === 1 && cnt[2] === 1 && cnt[3] === 1 && cnt[4] === 1 && cnt[5] === 1;
  const straight = distinct === 5 && (hi - lo === 4 || wheel);
  if (straight && flush) return hi === 14 && lo === 10 ? 'royal' : 'straightFlush';
  if (quads) return 'four';
  if (trips && pairs) return 'fullHouse';
  if (flush) return 'flush';
  if (straight) return 'straight';
  if (trips) return 'three';
  if (pairs === 2) return 'twoPair';
  if (pairRank) return 'jacksOrBetter';
  return 'none';
}

// The pay-table key for a hand. Only call right after categoryOf (it reads the same scratch counts).
export function keyOf(cards, coins = PAY_96) {
  const cat = categoryOf(cards);
  if (cat !== 'four' || coins.fourAces === undefined) return cat;
  for (let r = 2; r <= 14; r++) {
    if (cnt[r] === 4) return r === 14 ? 'fourAces' : r <= 4 ? 'fourSmall' : 'fourHigh';
  }
  return cat;
}

// Coins per coin bet for a hand. Hands that are not on the table pay nothing.
export const payOf = (cards, coins = PAY_96) => coins[keyOf(cards, coins)] || 0;

// Shuffled 52-card deck. rng defaults to Math.random; tests pass a seeded one.
export function shuffledDeck(rng = Math.random) {
  const d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Exact expected multiplier of keeping `kept` and drawing 5 - kept.length cards from `remaining`.
// Enumerates every equally likely draw, so there is no sampling error.
export function holdEV(kept, remaining, coins = PAY_96) {
  const k = 5 - kept.length;
  if (k === 0) return payOf(kept, coins);
  const m = remaining.length;
  const hand = kept.slice();
  for (let j = 0; j < k; j++) hand.push(0);
  const ix = Array.from({ length: k }, (_, i) => i);
  let sum = 0, n = 0;
  for (;;) {
    for (let j = 0; j < k; j++) hand[kept.length + j] = remaining[ix[j]];
    sum += payOf(hand, coins);
    n++;
    let i = k - 1;
    while (i >= 0 && ix[i] === m - k + i) i--;
    if (i < 0) break;
    ix[i]++;
    for (let j = i + 1; j < k; j++) ix[j] = ix[j - 1] + 1;
  }
  return sum / n;
}

const popcount = (m) => { let n = 0; for (let x = m; x; x &= x - 1) n++; return n; };

// Every hold, as a bitmask over the five positions (bit i set = card i is kept), with its exact EV.
// Returns { best, evs } where best is the mask with the highest EV. On a tie, the hold keeping more cards wins.
export function evaluateHolds(hand, coins = PAY_96) {
  const evs = new Array(32);
  const remaining = [];
  for (let c = 0; c < 52; c++) if (!hand.includes(c)) remaining.push(c);
  let best = 0, bestEV = -1;
  for (let mask = 0; mask < 32; mask++) {
    const kept = [];
    for (let i = 0; i < 5; i++) if (mask & (1 << i)) kept.push(hand[i]);
    const ev = holdEV(kept, remaining, coins);
    evs[mask] = ev;
    const better = ev > bestEV + 1e-12;
    const tie = Math.abs(ev - bestEV) <= 1e-12 && popcount(mask) > popcount(best);
    if (better || tie) { best = mask; bestEV = ev; }
  }
  return { best, evs };
}

// Expected coins per coin bet for a fresh five-card deal with no draw. Exact (all 2,598,960 hands), cached.
const freshCache = new Map();
export function freshHandValue(coins = PAY_96) {
  let v = freshCache.get(coins);
  if (v !== undefined) return v;
  const h = [0, 0, 0, 0, 0];
  let sum = 0, n = 0;
  for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) for (let c = b + 1; c < 52; c++)
    for (let d = c + 1; d < 52; d++) for (let e = d + 1; e < 52; e++) {
      h[0] = a; h[1] = b; h[2] = c; h[3] = d; h[4] = e;
      sum += payOf(h, coins); n++;
    }
  v = sum / n;
  freshCache.set(coins, v);
  return v;
}

// Plain-English description of a hold, for the coach.
export function describeHold(hand, mask) {
  const held = hand.filter((_, i) => mask & (1 << i));
  if (held.length === 0) return 'Draw five new cards';
  if (held.length === 5) return `Keep all five (${HAND_NAME[categoryOf(held)]})`;
  return `Hold ${held.map(cardLabel).join(' ')}`;
}
