// Three Card Poker: hand ranking (straight beats flush), dealer qualifier, Ante/Play + Ante bonus + Pair Plus,
// exact EV by enumerating every dealer hand, and the Q-6-4 rule. Cards are engine/poker.js ints (0..51).
import { rankOf, suitOf } from './poker.js';

export const CATS = ['High card', 'Pair', 'Flush', 'Straight', 'Three of a kind', 'Straight flush'];
export function evaluate3(cards) {
  const r = cards.map(rankOf).sort((a, b) => b - a), flush = suitOf(cards[0]) === suitOf(cards[1]) && suitOf(cards[1]) === suitOf(cards[2]);
  const wheel = r[0] === 14 && r[1] === 3 && r[2] === 2;
  const straight = (r[0] - r[1] === 1 && r[1] - r[2] === 1) || wheel, top = wheel ? 3 : r[0];
  let cat, key;
  if (straight && flush) { cat = 5; key = top; }
  else if (r[0] === r[1] && r[1] === r[2]) { cat = 4; key = r[0]; }
  else if (straight) { cat = 3; key = top; }
  else if (flush) { cat = 2; key = (r[0] << 8) | (r[1] << 4) | r[2]; }
  else if (r[0] === r[1] || r[1] === r[2]) { cat = 1; const p = r[1], k = r[0] === r[1] ? r[2] : r[0]; key = (p << 4) | k; }
  else { cat = 0; key = (r[0] << 8) | (r[1] << 4) | r[2]; }
  return { cat, score: cat * 1e6 + key, name: CATS[cat], ranks: r };
}
export const dealerQualifies = (ev) => ev.cat > 0 || ev.ranks[0] >= 12;     // Queen-high or better

export const PAY_TABLES = {
  standard: { name: '40 · 30 · 6 · 3 · 1', sf: 40, trips: 30, straight: 6, flush: 3, pair: 1 },
  better: { name: '40 · 30 · 6 · 4 · 1', sf: 40, trips: 30, straight: 6, flush: 4, pair: 1 },
};
export const ANTE_BONUS = { 5: 5, 4: 4, 3: 1 };                              // by category: SF 5:1, trips 4:1, straight 1:1

export function pairPlus(ev, table = PAY_TABLES.standard) {
  return ev.cat === 5 ? table.sf : ev.cat === 4 ? table.trips : ev.cat === 3 ? table.straight : ev.cat === 2 ? table.flush : ev.cat === 1 ? table.pair : -1;
}

// Net result in ante units for one deal: { net, anteBonus, pp }. play=false is a fold after seeing your cards.
export function settle(player, dealer, play, table = PAY_TABLES.standard) {
  const pe = evaluate3(player), de = evaluate3(dealer);
  const pp = pairPlus(pe, table);
  if (!play) return { net: -1, anteBonus: 0, pp, pe, de };
  const bonus = ANTE_BONUS[pe.cat] || 0;
  let main;
  if (!dealerQualifies(de)) main = 1;                                        // ante pays 1:1, play pushes
  else main = pe.score > de.score ? 2 : pe.score < de.score ? -2 : 0;
  return { net: main + bonus, anteBonus: bonus, pp, pe, de, qualifies: dealerQualifies(de) };
}

// Exact EV (ante units) of Play vs Fold for a player hand, over every possible dealer hand.
export function playEV(player, table) {
  const rest = []; for (let c = 0; c < 52; c++) if (!player.includes(c)) rest.push(c);
  const pe = evaluate3(player), bonus = ANTE_BONUS[pe.cat] || 0;
  let sum = 0, n = 0, win = 0, push = 0, lose = 0, nq = 0;
  for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) for (let k = j + 1; k < rest.length; k++) {
    const de = evaluate3([rest[i], rest[j], rest[k]]);
    let main;
    if (!dealerQualifies(de)) { main = 1; nq++; }
    else if (pe.score > de.score) { main = 2; win++; } else if (pe.score < de.score) { main = -2; lose++; } else { main = 0; push++; }
    sum += main; n++;
  }
  return { play: sum / n + bonus, fold: -1, pNotQualify: nq / n, pWin: win / n, pLose: lose / n, pPush: push / n, anteBonus: bonus };
}

// The Q-6-4 rule: play any hand better than Queen-6-4 (compared as an ordinary high-card hand), fold the rest.
export function shouldPlay(player) {
  const pe = evaluate3(player);
  if (pe.cat > 0) return true;
  const r = pe.ranks;
  if (r[0] !== 12) return r[0] > 12;
  if (r[1] !== 6) return r[1] > 6;
  return r[2] >= 4;
}
export const handText = (ev) => ev.name;
