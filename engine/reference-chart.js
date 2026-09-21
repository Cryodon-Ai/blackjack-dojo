// Published basic-strategy chart for the REFERENCE GAME:
//   6 decks, dealer stands on soft 17, double after split, late surrender, dealer peeks, 3:2.
// Transcribed by hand from the standard multi-deck (4-8 deck) published chart — NOT derived from
// engine/ev.js. Used only by verify.js; the app never displays this table.
//
// Cross-checked against the published text-form strategy for 4 decks, S17, DAS, surrender, peek
// (wizardofodds.com/games/blackjack/strategy/4-decks/, fetched 2026-09-19). Every rule line there
// agrees with this table: surrender hard 16 (not 8,8) vs 9/T/A and 15 vs T; split 2s/3s vs 2-7 (DAS),
// 4s vs 5-6 (DAS), 6s vs 2-6, 7s vs 2-7, 9s vs 2-6 & 8-9, always A,A & 8,8, never 5s/10s; double
// hard 9 vs 3-6, hard 10 vs 2-9, hard 11 vs 2-T, soft 13/14 vs 5-6, soft 15/16 vs 4-6, soft 17/18 vs 3-6;
// stand 12 vs 4-6, 13-16 vs 2-6; soft 18 hits vs 9/T/A.
// 7,7 vs T follows from those rules: not split (7s split only vs 2-7), not surrendered (hard 14),
// so it plays as hard 14 vs T = hit.
//
// Columns: dealer upcard 2 3 4 5 6 7 8 9 T A.
// Codes:   H hit  S stand  D double  P split  R surrender

export const REFERENCE_CHART = {
  H5:  'HHHHHHHHHH',
  H6:  'HHHHHHHHHH',
  H7:  'HHHHHHHHHH',
  H8:  'HHHHHHHHHH',
  H9:  'HDDDDHHHHH',
  H10: 'DDDDDDDDHH',
  H11: 'DDDDDDDDDH',
  H12: 'HHSSSHHHHH',
  H13: 'SSSSSHHHHH',
  H14: 'SSSSSHHHHH',
  H15: 'SSSSSHHHRH',
  H16: 'SSSSSHHRRR',
  H17: 'SSSSSSSSSS',
  H18: 'SSSSSSSSSS',
  H19: 'SSSSSSSSSS',
  H20: 'SSSSSSSSSS',
  H21: 'SSSSSSSSSS',

  A2:  'HHHDDHHHHH',
  A3:  'HHHDDHHHHH',
  A4:  'HHDDDHHHHH',
  A5:  'HHDDDHHHHH',
  A6:  'HDDDDHHHHH',
  A7:  'SDDDDSSHHH',
  A8:  'SSSSSSSSSS',
  A9:  'SSSSSSSSSS',

  '22': 'PPPPPPHHHH',
  '33': 'PPPPPPHHHH',
  '44': 'HHHPPHHHHH',
  '55': 'DDDDDDDDHH',
  '66': 'PPPPPHHHHH',
  '77': 'PPPPPPHHHH',
  '88': 'PPPPPPPPPP',
  '99': 'PPPPPSPPSS',
  TT:   'SSSSSSSSSS',
  AA:   'PPPPPPPPPP',
};
