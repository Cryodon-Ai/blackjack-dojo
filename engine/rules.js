// Rule-set schema, defaults and canonical key.
// Ranks throughout the engine: 1 = Ace, 2..9 = pip cards, 10 = any ten-valued card.

export const DEFAULT_RULES = Object.freeze({
  decks: 6,                    // 1 | 2 | 4 | 6 | 8 | Infinity
  dealerHitsSoft17: false,     // false = S17
  doubleAfterSplit: true,      // DAS
  resplitAces: false,
  surrender: 'none',           // 'none' | 'late'  (late requires peek)
  peek: true,                  // true = dealer peeks for BJ; false = European no-hole-card (ENHC)
  blackjackPays: 1.5,          // 1.5 (3:2) | 1.2 (6:5)
  doubleRestriction: 'any',    // 'any' | '9-11' (hard 9, 10, 11 only)
  maxSplitHands: 4,
});

// The reference game the verifier asserts against: 6 decks, S17, DAS, late surrender, peek, 3:2.
export const REFERENCE_RULES = Object.freeze({
  ...DEFAULT_RULES,
  decks: 6,
  dealerHitsSoft17: false,
  doubleAfterSplit: true,
  surrender: 'late',
  peek: true,
  blackjackPays: 1.5,
});

const DECKS = [1, 2, 4, 6, 8, Infinity];

export function normalizeRules(input = {}) {
  const r = { ...DEFAULT_RULES, ...input };
  if (!DECKS.includes(r.decks)) throw new Error(`decks must be one of ${DECKS.join(', ')}; got ${r.decks}`);
  if (!['none', 'late'].includes(r.surrender)) throw new Error(`surrender must be none|late; got ${r.surrender}`);
  if (![1.5, 1.2, 1].includes(r.blackjackPays)) throw new Error(`blackjackPays must be 1.5, 1.2 or 1; got ${r.blackjackPays}`);
  if (!['any', '9-11'].includes(r.doubleRestriction)) throw new Error(`doubleRestriction must be any|9-11; got ${r.doubleRestriction}`);
  if (!(r.maxSplitHands >= 2 && r.maxSplitHands <= 8)) throw new Error('maxSplitHands must be 2..8');
  return Object.freeze(r);
}

export function rulesKey(input) {
  const r = normalizeRules(input);
  return [
    Number.isFinite(r.decks) ? `${r.decks}D` : 'INF',
    r.dealerHitsSoft17 ? 'H17' : 'S17',
    r.doubleAfterSplit ? 'DAS' : 'NDAS',
    r.resplitAces ? 'RSA' : 'NRSA',
    r.surrender === 'late' ? 'LS' : 'NS',
    r.peek ? 'PEEK' : 'ENHC',
    r.blackjackPays === 1.5 ? '32' : r.blackjackPays === 1.2 ? '65' : '11',
    r.doubleRestriction === 'any' ? 'DANY' : 'D911',
    `SP${r.maxSplitHands}`,
  ].join('-');
}

export const UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];   // chart column order
export const upLabel = (u) => (u === 1 ? 'A' : u === 10 ? 'T' : String(u));
