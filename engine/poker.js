// Texas Hold'em engine: cards, 7-card hand evaluator, equity (Monte Carlo and exact for few cards), outs,
// pot odds, starting-hand ranges, Chen formula. Pure functions, no DOM.
//
// Card = integer 0..51: rank = (c >> 2) + 2 (2..14, 14 = Ace), suit = c & 3 (0 s, 1 h, 2 d, 3 c).

export const RANKS = '23456789TJQKA';
export const SUIT_CH = 'shdc';
export const rankOf = (c) => (c >> 2) + 2;
export const suitOf = (c) => c & 3;
export const mk = (rank, suit) => ((rank - 2) << 2) | suit;
export const cardStr = (c) => RANKS[rankOf(c) - 2] + SUIT_CH[suitOf(c)];
export const parseCard = (s) => mk(RANKS.indexOf(s[0].toUpperCase()) + 2, SUIT_CH.indexOf(s[1].toLowerCase()));
export const parseCards = (s) => s.trim().split(/\s+/).filter(Boolean).map(parseCard);

export const CATEGORIES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];

// ---- evaluator -------------------------------------------------------------------------------------
// Returns an integer: higher beats lower. Category in the top bits, then five 4-bit kickers.
function straightHigh(mask) {
  const m = mask | ((mask >> 14) & 1 ? 2 : 0);          // ace also counts low (bit 1)
  for (let h = 14; h >= 5; h--) if (((m >> (h - 4)) & 31) === 31) return h;
  return 0;
}
const pack = (cat, a) => { let s = cat; for (let i = 0; i < 5; i++) s = (s << 4) | (a[i] || 0); return s; };

export function evaluate(cards) {
  const cnt = new Int8Array(15), sc = new Int8Array(4), sm = [0, 0, 0, 0];
  let all = 0;
  for (const c of cards) { const r = (c >> 2) + 2, s = c & 3; cnt[r]++; sc[s]++; sm[s] |= 1 << r; all |= 1 << r; }
  for (let s = 0; s < 4; s++) if (sc[s] >= 5) {
    const sf = straightHigh(sm[s]);
    if (sf) return pack(8, [sf]);
    const k = []; for (let r = 14; r >= 2 && k.length < 5; r--) if (sm[s] >> r & 1) k.push(r);
    return pack(5, k);
  }
  const quads = [], trips = [], pairs = [], singles = [];
  for (let r = 14; r >= 2; r--) { const n = cnt[r]; if (n === 4) quads.push(r); else if (n === 3) trips.push(r); else if (n === 2) pairs.push(r); else if (n === 1) singles.push(r); }
  if (quads.length) { const kick = [...trips, ...pairs, ...singles].sort((a, b) => b - a)[0]; return pack(7, [quads[0], kick]); }
  if (trips.length && (trips.length > 1 || pairs.length)) return pack(6, [trips[0], Math.max(trips[1] || 0, pairs[0] || 0)]);
  const st = straightHigh(all);
  if (st) return pack(4, [st]);
  if (trips.length) return pack(3, [trips[0], singles[0], singles[1]]);
  if (pairs.length >= 2) return pack(2, [pairs[0], pairs[1], [...pairs.slice(2), ...singles].sort((a, b) => b - a)[0]]);
  if (pairs.length === 1) return pack(1, [pairs[0], singles[0], singles[1], singles[2]]);
  return pack(0, singles.slice(0, 5));
}
export const categoryOf = (score) => score >> 20;
export const categoryName = (score) => CATEGORIES[categoryOf(score)];
const RN = { 14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten', 9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two' };
const RNP = { 14: 'Aces', 13: 'Kings', 12: 'Queens', 11: 'Jacks', 10: 'Tens', 9: 'Nines', 8: 'Eights', 7: 'Sevens', 6: 'Sixes', 5: 'Fives', 4: 'Fours', 3: 'Threes', 2: 'Twos' };
export function describeHand(score) {
  const cat = score >> 20, k = [0, 1, 2, 3, 4].map((i) => (score >> (16 - 4 * i)) & 15);
  switch (cat) {
    case 8: return k[0] === 14 ? 'Royal flush' : `Straight flush, ${RN[k[0]]} high`;
    case 7: return `Four ${RNP[k[0]]}`;
    case 6: return `Full house, ${RNP[k[0]]} full of ${RNP[k[1]]}`;
    case 5: return `Flush, ${RN[k[0]]} high`;
    case 4: return `Straight, ${RN[k[0]]} high`;
    case 3: return `Three ${RNP[k[0]]}`;
    case 2: return `Two pair, ${RNP[k[0]]} and ${RNP[k[1]]}`;
    case 1: return `Pair of ${RNP[k[0]]}`;
    default: return `${RN[k[0]]} high`;
  }
}

// ---- deck, random ------------------------------------------------------------------------------------
export function rng(seed) {
  if (seed === undefined) return Math.random;
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function freshDeck(exclude = []) {
  const ex = new Set(exclude), d = [];
  for (let c = 0; c < 52; c++) if (!ex.has(c)) d.push(c);
  return d;
}
export function shuffle(deck, rand = Math.random) {
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}

// ---- hand classes (the 169 starting hands) ---------------------------------------------------------------
// Label: 'AA', 'AKs', 'AKo'. Ranks are always written high-to-low.
export const classLabel = (c1, c2) => {
  let a = rankOf(c1), b = rankOf(c2);
  if (a < b) [a, b] = [b, a];
  if (a === b) return RANKS[a - 2] + RANKS[b - 2];
  return RANKS[a - 2] + RANKS[b - 2] + (suitOf(c1) === suitOf(c2) ? 's' : 'o');
};
export function classCombos(label) {
  const a = RANKS.indexOf(label[0]) + 2, b = RANKS.indexOf(label[1]) + 2, out = [];
  if (a === b) { for (let s1 = 0; s1 < 4; s1++) for (let s2 = s1 + 1; s2 < 4; s2++) out.push([mk(a, s1), mk(a, s2)]); }
  else if (label[2] === 's') { for (let s = 0; s < 4; s++) out.push([mk(a, s), mk(b, s)]); }
  else { for (let s1 = 0; s1 < 4; s1++) for (let s2 = 0; s2 < 4; s2++) if (s1 !== s2) out.push([mk(a, s1), mk(b, s2)]); }
  return out;
}
export const ALL_CLASSES = (() => {
  const out = [];
  for (let a = 14; a >= 2; a--) for (let b = 14; b >= 2; b--) {
    if (a === b) out.push(RANKS[a - 2] + RANKS[b - 2]);
    else if (a > b) out.push(RANKS[a - 2] + RANKS[b - 2] + 's');
    else out.push(RANKS[b - 2] + RANKS[a - 2] + 'o');
  }
  return [...new Set(out)];
})();

// Range strings: "77+, A2s+, KTs+, QJo, T9s-65s, A5s-A2s". Returns a Set of class labels.
export function parseRange(str) {
  const set = new Set();
  const R = (ch) => RANKS.indexOf(ch) + 2;
  for (let tok of str.split(',').map((t) => t.trim()).filter(Boolean)) {
    if (tok.includes('-')) {
      const [x, y] = tok.split('-');
      if (x[0] === x[1]) { for (let r = Math.min(R(x[0]), R(y[0])); r <= Math.max(R(x[0]), R(y[0])); r++) set.add(RANKS[r - 2] + RANKS[r - 2]); }
      else if (x[0] === y[0]) { for (let r = Math.min(R(x[1]), R(y[1])); r <= Math.max(R(x[1]), R(y[1])); r++) set.add(x[0] + RANKS[r - 2] + x[2]); }
      else { const gap = R(x[0]) - R(x[1]); for (let hi = Math.min(R(x[0]), R(y[0])); hi <= Math.max(R(x[0]), R(y[0])); hi++) set.add(RANKS[hi - 2] + RANKS[hi - gap - 2] + x[2]); }
      continue;
    }
    const plus = tok.endsWith('+'); if (plus) tok = tok.slice(0, -1);
    if (tok[0] === tok[1]) { for (let r = R(tok[0]); r <= (plus ? 14 : R(tok[0])); r++) set.add(RANKS[r - 2] + RANKS[r - 2]); }
    else { const hi = R(tok[0]); for (let r = R(tok[1]); r < (plus ? hi : R(tok[1]) + 1); r++) set.add(tok[0] + RANKS[r - 2] + tok[2]); }
  }
  return set;
}
export const rangeCombos = (set) => [...set].reduce((n, l) => n + (l.length === 2 ? 6 : l[2] === 's' ? 4 : 12), 0);
export const rangePct = (set) => rangeCombos(set) / 1326;

// Chen formula: a quick points score for a starting hand (higher = stronger). Used for ordering, not as an oracle.
export function chen(label) {
  const a = RANKS.indexOf(label[0]) + 2, b = RANKS.indexOf(label[1]) + 2, suited = label[2] === 's', pair = a === b;
  const pts = (r) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
  let s = pts(a);
  if (pair) { s = Math.max(5, s * 2); if (a === 5) s = 6; }
  else {
    if (suited) s += 2;
    const gap = a - b - 1;
    s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
    if (gap <= 1 && a < 12) s += 1;
  }
  return Math.ceil(s);
}
// All 169 classes ordered strongest to weakest by preflop equity vs a random hand (computed once, lazily).
let _order = null;
export function strengthOrder() {
  if (_order) return _order;
  const rand = rng(12345), score = {};
  for (const l of ALL_CLASSES) {
    const combos = classCombos(l); let w = 0, n = 0;
    const [h1, h2] = combos[0];
    const deck = freshDeck([h1, h2]);
    for (let t = 0; t < 600; t++) {
      for (let i = 0; i < 7; i++) { const j = i + Math.floor(rand() * (deck.length - i)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      const hero = evaluate([h1, h2, deck[2], deck[3], deck[4], deck[5], deck[6]]);
      const opp = evaluate([deck[0], deck[1], deck[2], deck[3], deck[4], deck[5], deck[6]]);
      w += hero > opp ? 1 : hero === opp ? 0.5 : 0; n++;
    }
    score[l] = w / n;
  }
  _order = [...ALL_CLASSES].sort((x, y) => score[y] - score[x]);
  _order.score = score;
  return _order;
}
export const topRange = (frac) => {   // the strongest hands covering `frac` of all combos
  const out = new Set(); let n = 0;
  for (const l of strengthOrder()) { if (n / 1326 >= frac) break; out.add(l); n += l.length === 2 ? 6 : l[2] === 's' ? 4 : 12; }
  return out;
};

// ---- position-based preflop ranges (6-max, 100 big blinds, cash) ----------------------------------------------
export const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
export const RFI = {
  UTG: parseRange('66+, A2s+, KTs+, QTs+, JTs, T9s, ATo+, KQo'),
  HJ: parseRange('55+, A2s+, K9s+, QTs+, J9s+, T9s, 98s, ATo+, KJo+, QJo'),
  CO: parseRange('22+, A2s+, K6s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, A8o+, KTo+, QTo+, JTo'),
  BTN: parseRange('22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 75s+, 64s+, 54s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o'),
  SB: parseRange('22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 97s+, 86s+, 76s, 65s, 54s, A2o+, K9o+, QTo+, JTo'),
};
// Facing a raise: 3-bet (value + a few bluffs), call, otherwise fold. Keyed by the opener's position group.
export const VS_RAISE = {
  early: { threeBet: parseRange('QQ+, AKs, AKo, A5s, A4s'), call: parseRange('JJ-77, AQs-ATs, KQs, KJs, QJs, JTs, T9s, AQo') },
  late: { threeBet: parseRange('TT+, AQs+, AKo, A5s-A2s, KQs'), call: parseRange('99-22, AJs-A6s, KJs-KTs, QJs, QTs, JTs, J9s, T9s, 98s, 87s, 76s, AQo, AJo, KQo') },
  blinds: { threeBet: parseRange('TT+, AQs+, AKo, A5s-A2s, KQs'), call: parseRange('99-22, AJs-A6s, KJs-K9s, QJs-Q9s, JTs-J9s, T9s, 98s, 87s, 76s, 65s, AQo-ATo, KQo-KJo, QJo') },
};
export const openerGroup = (pos) => (pos === 'UTG' || pos === 'HJ' ? 'early' : 'late');
// BB defending vs a raise from `pos`: reuse the late/blinds sets; versus UTG/HJ tighten.
export function facingRaise(label, heroPos, openerPos) {
  const g = heroPos === 'SB' || heroPos === 'BB' ? (openerPos === 'UTG' || openerPos === 'HJ' ? 'early' : 'blinds') : openerGroup(openerPos);
  const t = VS_RAISE[g];
  if (t.threeBet.has(label)) return '3bet';
  if (t.call.has(label)) return 'call';
  return 'fold';
}
export const openAction = (label, pos) => (RFI[pos] && RFI[pos].has(label) ? 'raise' : 'fold');

// ---- equity ---------------------------------------------------------------------------------------------------
// hero: [c1,c2]; board: 0..5 cards; opps: array of opponent specs: null (random hand) | Set of class labels | [c1,c2] exact.
// Returns { win, tie, lose, equity } as fractions (equity counts ties as half).
export function equity(hero, board, opps, trials = 4000, rand = Math.random) {
  const known = [...hero, ...board], need = 5 - board.length;
  const sets = opps.map((o) => (o instanceof Set ? [...o].flatMap(classCombos) : null));
  let win = 0, tieN = 0, share = 0, done = 0;
  const base = freshDeck(known);
  for (let t = 0; t < trials; t++) {
    const used = new Set(known), holes = [];
    let ok = true;
    for (let i = 0; i < opps.length && ok; i++) {
      const o = opps[i];
      if (Array.isArray(o)) { holes.push(o); o.forEach((c) => used.add(c)); continue; }
      if (sets[i]) {
        let h = null;
        for (let tries = 0; tries < 30; tries++) { const c = sets[i][Math.floor(rand() * sets[i].length)]; if (!used.has(c[0]) && !used.has(c[1])) { h = c; break; } }
        if (!h) { ok = false; break; }
        used.add(h[0]); used.add(h[1]); holes.push(h);
      } else holes.push(null);
    }
    if (!ok) continue;
    const deck = base.filter((c) => !used.has(c));
    const total = holes.reduce((n, h) => n + (h ? 0 : 2), 0) + need;
    for (let i = 0; i < total; i++) { const j = i + Math.floor(rand() * (deck.length - i)); const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp; }
    let p = 0; const rs = [];
    const full = board.slice(); for (let i = 0; i < need; i++) full.push(deck[p++]);
    const hs = evaluate([...hero, ...full]);
    let best = -1, nb = 0;
    for (const h of holes) {
      const hole = h || [deck[p++], deck[p++]];
      const s = evaluate([...hole, ...full]);
      rs.push(s); if (s > best) { best = s; nb = 1; } else if (s === best) nb++;
    }
    if (hs > best) win++; else if (hs === best) { tieN++; share += 1 / (nb + 1); }
    done++;
  }
  const n = Math.max(1, done);
  const w = win / n, ti = tieN / n;
  return { win: w, tie: ti, lose: 1 - w - ti, equity: (win + share) / n, trials: done };
}

// Outs: cards that improve the hero to a better category on the next card, split into "clean" outs.
export function outs(hero, board) {
  if (board.length < 3 || board.length > 4) return { outs: [], count: 0 };
  const now = evaluate([...hero, ...board]), cat = categoryOf(now), res = [];
  for (const c of freshDeck([...hero, ...board])) {
    const s = evaluate([...hero, ...board, c]);
    // a real out makes two pair or better, beats your current category, and your hole cards do the work
    // (the board improving for everyone is not an out). Pairing a high card is counted separately as "pair outs".
    if (categoryOf(s) > cat && categoryOf(s) >= 2 && s > evaluate([...board, c])) res.push(c);
  }
  return { outs: res, count: res.length, now: describeHand(now) };
}

// Pot odds: the equity you need to call `toCall` into a pot of `pot` (pot BEFORE your call, includes their bet).
export const potOddsNeeded = (toCall, pot) => toCall / (pot + toCall);
// Rule of 2 and 4 estimate of the chance to hit by the river.
export const ruleOf = (outsCount, cardsToCome) => Math.min(99, outsCount * (cardsToCome === 2 ? 4 : 2));

// Draw type names for the board texture / coaching.
export function boardTexture(board) {
  if (board.length < 3) return {};
  const rs = board.map(rankOf).sort((a, b) => b - a), ss = board.map(suitOf);
  const sc = [0, 0, 0, 0]; ss.forEach((s) => sc[s]++);
  const maxSuit = Math.max(...sc);
  const paired = new Set(rs).size < rs.length;
  const span = rs[0] - rs[Math.min(2, rs.length - 1)];
  const connected = new Set(rs).size >= 3 && span <= 4;
  const high = rs[0] >= 12;
  return { paired, flushy: maxSuit >= 3, monotone: maxSuit >= 3 && board.length === 3, connected, high, wet: (maxSuit >= 3 ? 1 : 0) + (connected ? 1 : 0) >= 1 && !paired, dry: !paired && maxSuit < 3 && !connected };
}
