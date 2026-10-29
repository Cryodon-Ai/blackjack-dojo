// Jacks or Better video poker, 9/6 pay table, single 52-card deck.
// Cards are ints: c = (rank - 2) * 4 + suit, rank 2..14 (14 = ace), suit 0..3.
// Pure logic: the deal, hand evaluation, the pay table, and the exact expected value of every hold.

export const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];
export const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const rankOf = (c) => (c >> 2) + 2;
export const suitOf = (c) => c & 3;
export const cardLabel = (c) => (RANK_LABEL[rankOf(c)] || String(rankOf(c))) + SUIT_GLYPH[suitOf(c)];

// Coins paid per coin bet. 9/6 is the full-pay Jacks or Better table: 99.54% return with perfect play.
export const PAY_96 = Object.freeze({
  royal: 800, straightFlush: 50, four: 25, fullHouse: 9, flush: 6, straight: 4, three: 3, twoPair: 2, jacksOrBetter: 1, none: 0,
});
export const HAND_NAME = Object.freeze({
  royal: 'Royal flush', straightFlush: 'Straight flush', four: 'Four of a kind', fullHouse: 'Full house', flush: 'Flush',
  straight: 'Straight', three: 'Three of a kind', twoPair: 'Two pair', jacksOrBetter: 'Jacks or better', none: 'Nothing',
});

const cnt = new Int8Array(15); // scratch, reused: a hand evaluation makes no allocations

// Category of a five-card hand (array of ints). Returns a key of PAY_96.
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

export const payFor = (cards, pay = PAY_96) => pay[categoryOf(cards)];

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
export function holdEV(kept, remaining, pay = PAY_96) {
  const k = 5 - kept.length;
  if (k === 0) return pay[categoryOf(kept)];
  const m = remaining.length;
  const hand = kept.slice();
  for (let j = 0; j < k; j++) hand.push(0);
  const ix = Array.from({ length: k }, (_, i) => i);
  let sum = 0, n = 0;
  for (;;) {
    for (let j = 0; j < k; j++) hand[kept.length + j] = remaining[ix[j]];
    sum += pay[categoryOf(hand)];
    n++;
    let i = k - 1;
    while (i >= 0 && ix[i] === m - k + i) i--;
    if (i < 0) break;
    ix[i]++;
    for (let j = i + 1; j < k; j++) ix[j] = ix[j - 1] + 1;
  }
  return sum / n;
}

// Every hold, as a bitmask over the five positions (bit i set = card i is kept), with its exact EV.
// Returns { best, evs } where best is the mask with the highest EV. On a tie, the hold keeping more cards wins.
export function evaluateHolds(hand, pay = PAY_96) {
  const evs = new Array(32);
  let best = 0, bestEV = -1;
  for (let mask = 0; mask < 32; mask++) {
    const kept = [], inHand = [];
    for (let i = 0; i < 5; i++) {
      if (mask & (1 << i)) kept.push(hand[i]);
      else inHand.push(hand[i]);
    }
    const remaining = [];
    for (let c = 0; c < 52; c++) if (!hand.includes(c)) remaining.push(c);
    const ev = holdEV(kept, remaining, pay);
    evs[mask] = ev;
    const better = ev > bestEV + 1e-12;
    const tie = Math.abs(ev - bestEV) <= 1e-12 && popcount(mask) > popcount(best);
    if (better || tie) { best = mask; bestEV = ev; }
  }
  return { best, evs };
}

const popcount = (m) => { let n = 0; for (let x = m; x; x &= x - 1) n++; return n; };

// Plain-English description of a hold, for the coach.
export function describeHold(hand, mask) {
  const held = hand.filter((_, i) => mask & (1 << i));
  if (held.length === 0) return 'Draw five new cards';
  if (held.length === 5) return `Keep all five (${HAND_NAME[categoryOf(held)]})`;
  return `Hold ${held.map(cardLabel).join(' ')}`;
}
