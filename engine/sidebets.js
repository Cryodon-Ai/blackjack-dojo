// Exact house edges for common side bets, by enumeration over the shoe, for an explicitly stated paytable.
// Nothing here is claimed for any specific casino's version: paytables vary. Suits: 0..3 (0,3 = black; 1,2 = red).

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

// 21+3: your two cards plus the dealer's upcard form a poker hand.
export const T213_TABLE = { flush: 5, straight: 10, trips: 30, straightFlush: 40, suitedTrips: 100 };
export function edge21plus3(decks, pay = T213_TABLE) {
  const N = 52 * decks;
  const cls = (a, b, c) => {
    const [ra, sa] = [a >> 2, a & 3], [rb, sb] = [b >> 2, b & 3], [rc, sc] = [c >> 2, c & 3];
    const suited = sa === sb && sb === sc;
    if (ra === rb && rb === rc) return suited ? 'suitedTrips' : 'trips';
    const r = [ra, rb, rc].sort((x, y) => x - y);              // 0 = ace ... 12 = king
    const straight = (r[1] === r[0] + 1 && r[2] === r[1] + 1) || (r[0] === 0 && r[1] === 11 && r[2] === 12);   // A-2-3 ... Q-K-A
    if (straight && suited) return 'straightFlush';
    if (straight) return 'straight';
    if (suited) return 'flush';
    return null;
  };
  let ev = 0, hit = 0;
  for (let a = 0; a < 52; a++) for (let b = 0; b < 52; b++) for (let c = 0; c < 52; c++) {
    const na = decks, nb = decks - (b === a), nc = decks - (c === a) - (c === b);
    if (nb <= 0 || nc <= 0) continue;
    const p = (na / N) * (nb / (N - 1)) * (nc / (N - 2));
    const k = cls(a, b, c);
    if (k) { ev += p * pay[k]; hit += p; } else ev -= p;   // winners add their net payout, losers subtract the bet
  }
  return { edge: -ev, hit };
}
