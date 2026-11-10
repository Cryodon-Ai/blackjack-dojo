// Hi-Lo index plays: the Illustrious 18, the Fab 4 surrenders and a few extras.
//
// An index play is a decision where the correct action flips at a given TRUE count. Rule of thumb:
// at or above the index you make the "play"; below it you make the "below" action. Some indices are
// negative (e.g. 13 v 2 at -1): basic strategy stands, but when the count drops under the index you hit.
//
// Source for the numbers: Don Schlesinger, Blackjack Attack (via Wizard of Odds), six decks, Hi-Lo.
// Six of them move with the soft-17 rule; those carry separate S17 / H17 values below.

const R = (id, tier, kind, total, up, s17, h17, play, below, label) => ({ id, tier, kind, total, up, s17, h17, play, below, label });

// tier: 'i18' = Illustrious 18, 'fab4' = Fab 4 surrenders, 'x' = extra (still worth knowing)
export const INDEX_RULES = [
  R('16v10', 'i18', 'hard', 16, 10, 0, 0, 'S', 'H', '16 vs 10'),
  R('15v10', 'i18', 'hard', 15, 10, 4, 4, 'S', 'H', '15 vs 10'),
  R('TTv5', 'i18', 'tt', 20, 5, 5, 5, 'P', 'S', '10,10 vs 5'),
  R('TTv6', 'i18', 'tt', 20, 6, 4, 4, 'P', 'S', '10,10 vs 6'),
  R('10v10', 'i18', 'hard', 10, 10, 4, 4, 'D', 'H', '10 vs 10'),
  R('12v3', 'i18', 'hard', 12, 3, 2, 2, 'S', 'H', '12 vs 3'),
  R('12v2', 'i18', 'hard', 12, 2, 3, 3, 'S', 'H', '12 vs 2'),
  R('11vA', 'i18', 'hard', 11, 1, 1, -1, 'D', 'H', '11 vs A'),
  R('9v2', 'i18', 'hard', 9, 2, 1, 1, 'D', 'H', '9 vs 2'),
  R('10vA', 'i18', 'hard', 10, 1, 4, 3, 'D', 'H', '10 vs A'),
  R('9v7', 'i18', 'hard', 9, 7, 3, 3, 'D', 'H', '9 vs 7'),
  R('16v9', 'i18', 'hard', 16, 9, 5, 5, 'S', 'H', '16 vs 9'),
  R('13v2', 'i18', 'hard', 13, 2, -1, -1, 'S', 'H', '13 vs 2'),
  R('12v4', 'i18', 'hard', 12, 4, 0, 0, 'S', 'H', '12 vs 4'),
  R('12v5', 'i18', 'hard', 12, 5, -2, -2, 'S', 'H', '12 vs 5'),
  R('12v6', 'i18', 'hard', 12, 6, -1, -3, 'S', 'H', '12 vs 6'),
  R('13v3', 'i18', 'hard', 13, 3, -2, -2, 'S', 'H', '13 vs 3'),
  // Fab 4 (only where late surrender is offered)
  R('14v10R', 'fab4', 'hard', 14, 10, 3, 3, 'R', 'H', '14 vs 10'),
  R('15v10R', 'fab4', 'hard', 15, 10, 0, 0, 'R', 'H', '15 vs 10'),
  R('15v9R', 'fab4', 'hard', 15, 9, 2, 2, 'R', 'H', '15 vs 9'),
  R('15vAR', 'fab4', 'hard', 15, 1, 1, -1, 'R', 'H', '15 vs A'),
  // Extras
  R('16vA', 'x', 'hard', 16, 1, 5, 3, 'S', 'H', '16 vs A'),
  R('16v8R', 'x', 'hard', 16, 8, 4, 4, 'R', 'H', '16 vs 8'),
];

export const INSURANCE_INDEX = 3;
export const insuranceTaken = (tc) => tc >= INSURANCE_INDEX;

export const tierName = { i18: 'Illustrious 18', fab4: 'Fab 4 surrender', x: 'Extra' };
export const idxOf = (rule, rules) => (rules && rules.dealerHitsSoft17 ? rule.h17 : rule.s17);
const upL = (u) => (u === 1 ? 'A' : String(u));
export const describe = (rule, rules) => {
  const i = idxOf(rule, rules), s = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
  const verb = { S: 'Stand', D: 'Double', P: 'Split', R: 'Surrender', H: 'Hit' }[rule.play];
  return `${verb} at ${s(i)} or higher`;
};

// Rules that make a given index row relevant (surrender rows need surrender; some stands are replaced by surrender).
export function activeRules(rules, { tiers = ['i18', 'fab4', 'x'] } = {}) {
  const surr = rules.surrender === 'late';
  return INDEX_RULES.filter((r) => {
    if (!tiers.includes(r.tier)) return false;
    if (r.play === 'R') return surr;
    // With late surrender on, 16 v 9/10/A and 15 v 10 are surrender spots at neutral; skip the stand indices there.
    if (surr && ['16v10', '15v10', '16v9', '16vA'].includes(r.id)) return false;
    return true;
  });
}

const handInfo = (cards) => {
  let hard = 0, ace = false;
  for (const v of cards) { hard += v; if (v === 1) ace = true; }
  const soft = ace && hard <= 11;
  return { hard, soft, total: soft ? hard + 10 : hard, n: cards.length };
};

// The index rule (if any) that governs this exact situation under these table rules.
export function ruleFor(rules, cards, up) {
  const h = handInfo(cards);
  const list = activeRules(rules);
  for (const r of list) {
    if (r.up !== up) continue;
    if (r.kind === 'tt') { if (h.n === 2 && cards[0] === 10 && cards[1] === 10) return r; continue; }
    if (h.soft || h.hard !== r.total) continue;
    if (r.play !== 'S' && r.play !== 'H' && h.n !== 2) continue;   // double / surrender / split are two-card plays
    // a pair we would split anyway is not a "hard total" decision
    if (h.n === 2 && cards[0] === cards[1] && cards[0] !== 10 && r.kind === 'hard' && ![5].includes(cards[0])) continue;
    return r;
  }
  return null;
}

// Apply the index plays on top of basic strategy.
//   basic : the basic-strategy action ('H','S','D','P','R')
//   legal : { H,S,D,P,R } booleans
// Returns { action, rule, index, deviated, above } — rule is null when no index governs the hand.
export function indexPlay(rules, cards, up, tc, basic, legal) {
  const rule = ruleFor(rules, cards, up);
  if (!rule || (basic === 'P' && rule.play !== 'P')) return { action: basic, rule: null, deviated: false };
  const index = idxOf(rule, rules), above = tc >= index;
  let action = above ? rule.play : rule.below;
  if (!legal[action]) action = (above ? rule.below : rule.play);
  if (!legal[action]) action = basic;
  return { action, rule, index, above, deviated: action !== basic };
}

export const roundTC = (tc) => Math.floor(tc);   // the usual convention: floor the true count when comparing to indices

// ---- betting ramps ------------------------------------------------------------------------------
// units to bet at each (floored) true count. Index = TC, clamped at both ends.
export const RAMPS = {
  '1-4': { name: '1–4', max: 4, at: (tc) => (tc < 2 ? 1 : tc === 2 ? 2 : tc === 3 ? 3 : 4) },
  '1-8': { name: '1–8', max: 8, at: (tc) => (tc < 2 ? 1 : tc === 2 ? 2 : tc === 3 ? 4 : tc === 4 ? 6 : 8) },
  '1-12': { name: '1–12', max: 12, at: (tc) => (tc < 2 ? 1 : tc === 2 ? 2 : tc === 3 ? 4 : tc === 4 ? 6 : tc === 5 ? 8 : tc === 6 ? 10 : 12) },
};
export const rampUnits = (id, tc) => RAMPS[id].at(Math.floor(tc));
// Rule of thumb: each +1 true count is worth roughly +0.5% player edge; start from the table's house edge.
export const edgeAtTC = (houseEdgePct, tc) => -houseEdgePct + 0.5 * tc;
