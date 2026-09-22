// Rule-set schema, defaults and canonical key.
// Ranks throughout the engine: 1 = Ace, 2..9 = pip cards, 10 = any ten-valued card.

export const DEFAULT_RULES = Object.freeze({
  decks: 6,                    // 1 | 2 | 4 | 6 | 8 | Infinity
  dealerHitsSoft17: false,     // false = S17
  doubleAfterSplit: true,      // DAS
  resplitAces: false,
  surrender: 'none',           // 'none' | 'late'  (late requires peekOn !== 'none')
  peekOn: 'both',              // 'both' | 'ace' | 'none' — which upcards the dealer checks for BJ before play
  blackjackPays: 1.5,          // 1.5 (3:2) | 1.2 (6:5)
  doubleRestriction: 'any',    // 'any' | '9-11' (hard 9, 10, 11 only)
  maxSplitHands: 4,
  charlie: null,                // null | integer — non-bust hand at this many cards auto-wins (e.g. 10-card Charlie)
});

// The reference game the verifier asserts against: 6 decks, S17, DAS, late surrender, peek, 3:2.
export const REFERENCE_RULES = Object.freeze({
  ...DEFAULT_RULES,
  decks: 6,
  dealerHitsSoft17: false,
  doubleAfterSplit: true,
  surrender: 'late',
  peekOn: 'both',
  blackjackPays: 1.5,
});

const DECKS = [1, 2, 4, 6, 8, Infinity];

export function normalizeRules(input = {}) {
  const r = { ...DEFAULT_RULES, ...input };
  if (typeof r.peek === 'boolean') { r.peekOn = r.peek ? 'both' : 'none'; delete r.peek; }   // legacy boolean shim
  if (!DECKS.includes(r.decks)) throw new Error(`decks must be one of ${DECKS.join(', ')}; got ${r.decks}`);
  if (!['none', 'late'].includes(r.surrender)) throw new Error(`surrender must be none|late; got ${r.surrender}`);
  if (!['both', 'ace', 'none'].includes(r.peekOn)) throw new Error(`peekOn must be both|ace|none; got ${r.peekOn}`);
  if (![1.5, 1.2, 1].includes(r.blackjackPays)) throw new Error(`blackjackPays must be 1.5, 1.2 or 1; got ${r.blackjackPays}`);
  if (!['any', '9-11'].includes(r.doubleRestriction)) throw new Error(`doubleRestriction must be any|9-11; got ${r.doubleRestriction}`);
  if (!(r.maxSplitHands >= 2 && r.maxSplitHands <= 8)) throw new Error('maxSplitHands must be 2..8');
  if (r.charlie !== null && !(Number.isInteger(r.charlie) && r.charlie >= 5)) throw new Error('charlie must be null or an integer >= 5');
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
    r.peekOn === 'both' ? 'PEEK' : r.peekOn === 'ace' ? 'PEEKA' : 'ENHC',
    r.blackjackPays === 1.5 ? '32' : r.blackjackPays === 1.2 ? '65' : '11',
    r.doubleRestriction === 'any' ? 'DANY' : 'D911',
    `SP${r.maxSplitHands}`,
    r.charlie ? `C${r.charlie}` : 'NC',
  ].join('-');
}

export const UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];   // chart column order
export const upLabel = (u) => (u === 1 ? 'A' : u === 10 ? 'T' : String(u));

// Whether the dealer checks for blackjack (and the player only acts after learning there isn't
// one) against this specific upcard. 'ace' games (e.g. Gravity Blackjack) peek on an Ace but not
// on a Ten, so a Ten-up dealer blackjack is only revealed after the player has already acted.
export const peeksOnUp = (rules, up) => rules.peekOn === 'both' || (rules.peekOn === 'ace' && up === 1);
