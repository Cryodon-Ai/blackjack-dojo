// Every strategy statement the lessons make, in machine-checkable form.
// engine/verify.js asserts each claim against the engine, so lesson prose cannot drift from the truth.
// Each claim: for every row in `rows` and every upcard in `ups`, the chart action must equal `action`.
// `ups` uses chart labels: '2'..'9','T','A'. `rules` overrides the reference game.

const U = (s) => s.split('').map((c) => (c === 'T' ? 10 : c === 'A' ? 1 : Number(c)));
const ALL = '23456789TA';

export const CLAIMS = [
  // ---- Tier 2: hard totals ----
  { tier: 2, text: '17-20 always stand', rows: ['H17', 'H18', 'H19', 'H20'], ups: ALL, action: 'S' },
  { tier: 2, text: '5-8 always hit', rows: ['H5', 'H6', 'H7', 'H8'], ups: ALL, action: 'H' },
  { tier: 2, text: '9 doubles vs 3-6', rows: ['H9'], ups: '3456', action: 'D' },
  { tier: 2, text: '9 hits vs 2 and 7-A', rows: ['H9'], ups: '2789TA', action: 'H' },
  { tier: 2, text: '10 doubles vs 2-9', rows: ['H10'], ups: '23456789', action: 'D' },
  { tier: 2, text: '10 hits vs T, A', rows: ['H10'], ups: 'TA', action: 'H' },
  { tier: 2, text: '11 doubles vs 2-T', rows: ['H11'], ups: '23456789T', action: 'D' },
  { tier: 2, text: '11 hits vs A (S17)', rows: ['H11'], ups: 'A', action: 'H' },
  { tier: 2, text: '12 hits vs 2 and 3', rows: ['H12'], ups: '23', action: 'H' },
  { tier: 2, text: '12 stands vs 4-6', rows: ['H12'], ups: '456', action: 'S' },
  { tier: 2, text: '13-14 stand vs 2-6', rows: ['H13', 'H14'], ups: '23456', action: 'S' },
  { tier: 2, text: '12-16 hit vs 7-A (surrender aside)', rows: ['H12', 'H13', 'H14'], ups: '789TA', action: 'H' },
  { tier: 2, text: '15 stands vs 2-6, hits vs 7, 8, 9, A', rows: ['H15'], ups: '23456', action: 'S' },
  { tier: 2, text: '15 hits vs 7, 8, 9, A', rows: ['H15'], ups: '789A', action: 'H' },
  { tier: 2, text: '16 stands vs 2-6, hits vs 7-8', rows: ['H16'], ups: '23456', action: 'S' },
  { tier: 2, text: '16 hits vs 7 and 8', rows: ['H16'], ups: '78', action: 'H' },
  // ---- Tier 3: soft totals ----
  { tier: 3, text: 'A,2 and A,3 double vs 5-6, else hit', rows: ['A2', 'A3'], ups: '56', action: 'D' },
  { tier: 3, text: 'A,2 and A,3 hit vs everything else', rows: ['A2', 'A3'], ups: '234789TA', action: 'H' },
  { tier: 3, text: 'A,4 and A,5 double vs 4-6, else hit', rows: ['A4', 'A5'], ups: '456', action: 'D' },
  { tier: 3, text: 'A,4 and A,5 hit vs 2, 3, 7-A', rows: ['A4', 'A5'], ups: '23789TA', action: 'H' },
  { tier: 3, text: 'A,6 doubles vs 3-6', rows: ['A6'], ups: '3456', action: 'D' },
  { tier: 3, text: 'A,6 hits vs 2, 7-A', rows: ['A6'], ups: '2789TA', action: 'H' },
  { tier: 3, text: 'A,7 doubles vs 3-6', rows: ['A7'], ups: '3456', action: 'D' },
  { tier: 3, text: 'A,7 stands vs 2, 7, 8', rows: ['A7'], ups: '278', action: 'S' },
  { tier: 3, text: 'A,7 HITS vs 9, T, A', rows: ['A7'], ups: '9TA', action: 'H' },
  { tier: 3, text: 'soft 19+ always stand (S17)', rows: ['A8', 'A9'], ups: ALL, action: 'S' },
  // ---- Tier 4: pairs ----
  { tier: 4, text: 'always split A,A and 8,8', rows: ['AA', '88'], ups: ALL, action: 'P' },
  { tier: 4, text: 'never split tens', rows: ['TT'], ups: ALL, action: 'S' },
  { tier: 4, text: '5,5 doubles vs 2-9', rows: ['55'], ups: '23456789', action: 'D' },
  { tier: 4, text: '5,5 hits vs T, A', rows: ['55'], ups: 'TA', action: 'H' },
  { tier: 4, text: '4,4 splits vs 5-6 (DAS)', rows: ['44'], ups: '56', action: 'P' },
  { tier: 4, text: '4,4 hits otherwise', rows: ['44'], ups: '234789TA', action: 'H' },
  { tier: 4, text: '2,2 and 3,3 split vs 2-7 (DAS)', rows: ['22', '33'], ups: '234567', action: 'P' },
  { tier: 4, text: '2,2 and 3,3 hit vs 8-A', rows: ['22', '33'], ups: '89TA', action: 'H' },
  { tier: 4, text: '6,6 splits vs 2-6 (DAS)', rows: ['66'], ups: '23456', action: 'P' },
  { tier: 4, text: '6,6 hits vs 7-A', rows: ['66'], ups: '789TA', action: 'H' },
  { tier: 4, text: '7,7 splits vs 2-7', rows: ['77'], ups: '234567', action: 'P' },
  { tier: 4, text: '7,7 hits vs 8-A', rows: ['77'], ups: '89TA', action: 'H' },
  { tier: 4, text: '9,9 splits vs 2-6, 8, 9', rows: ['99'], ups: '234568' + '9', action: 'P' },
  { tier: 4, text: '9,9 stands vs 7, T, A', rows: ['99'], ups: '7TA', action: 'S' },
  // DAS matters
  { tier: 4, text: 'no DAS: 2,2 and 3,3 split only vs 4-7', rows: ['22', '33'], ups: '4567', action: 'P', rules: { doubleAfterSplit: false } },
  { tier: 4, text: 'no DAS: 2,2 and 3,3 hit vs 2, 3', rows: ['22', '33'], ups: '23', action: 'H', rules: { doubleAfterSplit: false } },
  { tier: 4, text: 'no DAS: 4,4 never split', rows: ['44'], ups: ALL, action: 'H', rules: { doubleAfterSplit: false } },
  { tier: 4, text: 'no DAS: 6,6 hits vs 2', rows: ['66'], ups: '2', action: 'H', rules: { doubleAfterSplit: false } },
  // ---- Tier 5: surrender ----
  { tier: 5, text: '16 surrenders vs 9, T, A', rows: ['H16'], ups: '9TA', action: 'R' },
  { tier: 5, text: '15 surrenders vs T', rows: ['H15'], ups: 'T', action: 'R' },
  { tier: 5, text: 'no surrender: 16 vs T hits, 15 vs T hits', rows: ['H15', 'H16'], ups: 'T', action: 'H', rules: { surrender: 'none' } },
  { tier: 5, text: 'H17 adds surrender: 15 vs A', rows: ['H15'], ups: 'A', action: 'R', rules: { dealerHitsSoft17: true } },
  { tier: 5, text: 'H17 adds surrender: 17 vs A', rows: ['H17'], ups: 'A', action: 'R', rules: { dealerHitsSoft17: true } },
  // ---- H17 differences the lessons mention ----
  { tier: 2, text: 'H17: 11 doubles vs A', rows: ['H11'], ups: 'A', action: 'D', rules: { dealerHitsSoft17: true } },
  { tier: 3, text: 'H17: A,7 doubles vs 2', rows: ['A7'], ups: '2', action: 'D', rules: { dealerHitsSoft17: true } },
  { tier: 3, text: 'H17: A,8 doubles vs 6', rows: ['A8'], ups: '6', action: 'D', rules: { dealerHitsSoft17: true } },
];

export const claimUps = (s) => U(s);
