// Offers that are never correct for you: insurance, even money, every side bet.
// Each trap has a `why` grounded in a number the engine computed (or an explicit "not claimed" note).

import { insuranceEdge, perfectPairsEdge, edge21plus3, PP_TABLE, T213_TABLE } from '../engine/sidebets.js';

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const pc = (x, d = 1) => (x * 100).toFixed(d) + '%';

function stiffHand() {                        // a hand that is not a natural
  for (;;) {
    const a = 2 + rnd(9), b = 2 + rnd(9);
    if (!(a === 10 && b === 1) && !(a === 1 && b === 10)) return [a, b];
  }
}

const bet = () => pick([10, 20, 25, 50]);

export const TRAP_KINDS = {
  insurance() {
    const b = bet(), e = insuranceEdge(6);
    return {
      id: 'insurance', kind: 'Insurance', hand: { player: stiffHand(), up: 1 },
      title: 'Insurance?', html: `Dealer shows an <b>Ace</b>. Insurance costs <b>$${b / 2}</b> (half your $${b} bet) and pays 2:1 if the dealer has blackjack.`,
      edge: e, why: `Only ${pc(96 / 311)} of the unseen cards (6 decks) are tens, so the dealer has blackjack about 31% of the time — but the bet pays 2:1, not the 2.2:1 that would be fair. House edge ${pc(e)}: you lose about $${(e * 100).toFixed(2)} per $100 insured. It is a side bet on the hole card, not protection for your hand.`,
    };
  },
  evenMoney() {
    const b = bet();
    const p = 95 / 309;                        // ten among unseen cards after your A,T and dealer's A (6 decks)
    const play = (1 - p) * 1.5;
    return {
      id: 'evenmoney', kind: 'Even money', hand: { player: pick([[1, 10]]), up: 1 },
      title: 'Even money?', html: `You have <b>blackjack</b>; dealer shows an <b>Ace</b>. Take <b>even money</b> ($${b} now) instead of playing it out?`,
      edge: play - 1,       // cost of accepting: the value you give up per $1
      why: `Even money is insurance on a natural. The dealer has blackjack ${pc(p)} of the time (push). Playing on is worth (1 − ${p.toFixed(3)}) × 1.5 = ${play.toFixed(3)} per $1 versus a flat 1.000 for even money — declining is worth +$${((play - 1) * 100).toFixed(2)} per $100. Even money is insurance, and insurance is a losing bet.`,
    };
  },
  perfectPairs(mult) {
    const e = perfectPairsEdge(6, PP_TABLE), b = bet() / 5;
    return {
      id: 'pp', kind: 'Perfect Pairs', hand: { player: stiffHand(), up: 2 + rnd(9) },
      title: 'Perfect Pairs?', tempt: mult ? `×${mult} multiplier dropped` : null,
      html: `Side bet: your first two cards make a pair. Pays ${PP_TABLE.mixed}:1 mixed, ${PP_TABLE.colored}:1 colored, ${PP_TABLE.perfect}:1 perfect${mult ? ` — and a <b>×${mult}</b> multiplier just dropped on it` : ''}. Add $${b}?`,
      edge: e.edge,
      why: `With that paytable the bet hits only ${pc(e.hit)} of the time and carries a ${pc(e.edge)} house edge (computed, 6 decks) — about $${(e.edge * 100).toFixed(2)} lost per $100 bet, versus about 0.4 on the main game. ${mult ? 'A multiplier only matters on the rare hand it hits; whatever it does to the payout, the price of every other hand is unchanged, and I cannot verify a multiplier feature\'s odds — so no edge is claimed for it. ' : ''}Decline.`,
    };
  },
  threePlus21(mult) {
    const e = edge21plus3(6, T213_TABLE), b = bet() / 5;
    return {
      id: '213', kind: '21+3', hand: { player: stiffHand(), up: 2 + rnd(9) },
      title: '21+3 (poker) side bet?', tempt: mult ? `×${mult} multiplier dropped` : null,
      html: `Side bet: your two cards + the dealer's upcard make a poker hand (flush 5:1, straight 10:1, trips 30:1, straight flush 40:1, suited trips 100:1)${mult ? ` — a <b>×${mult}</b> multiplier just dropped` : ''}. Add $${b}?`,
      edge: e.edge,
      why: `Hits ${pc(e.hit)} of the time; ${pc(e.edge)} house edge for this paytable (computed, 6 decks) — roughly ${(e.edge * 100 / 0.4).toFixed(0)}× the cost of the main game per dollar. ${mult ? 'A drop-in multiplier changes how big a rare win is, not how often it happens; no edge is claimed for it here. ' : ''}Decline.`,
    };
  },
  dealerBust(mult) {
    const b = bet() / 5;
    return {
      id: 'bust', kind: 'Dealer bust', hand: { player: stiffHand(), up: 2 + rnd(9) },
      title: 'Dealer-bust side bet?', tempt: mult ? `×${mult} multiplier dropped` : null,
      html: `Side bet: the dealer will bust${mult ? ` — a <b>×${mult}</b> multiplier just dropped` : ''}. Add $${b}?`,
      edge: null,
      why: `The dealer busts only about 28% of hands overall, and the payout is set by the operator. I do not have this game's paytable, so I claim no edge — but every side bet I could compute (${pc(insuranceEdge(6))} insurance, ${pc(perfectPairsEdge(6).edge)} pairs, ${pc(edge21plus3(6).edge)} 21+3) is many times the main game's edge. Untested side bets get treated as negative until proven otherwise.`,
    };
  },
  poker(mult) {
    const b = bet() / 5;
    return {
      id: 'poker', kind: 'Poker hand', hand: { player: stiffHand(), up: 2 + rnd(9) },
      title: 'Poker side bet?', tempt: mult ? `×${mult} multiplier dropped` : null,
      html: `Side bet: a poker hand from your cards and the dealer's${mult ? ` — a <b>×${mult}</b> multiplier just dropped` : ''}. Add $${b}?`,
      edge: null,
      why: `Poker-style side bets pay big on rare hands and lose the rest. The closest one I can compute — 21+3 — costs ${pc(edge21plus3(6).edge)} per bet (6 decks). I do not have this game's paytable, so no edge is claimed; the default assumption is that it is worse than the main game.`,
    };
  },
  multiplierDrop() {
    const m = pick([5, 10, 25, 50, 100]);
    return pick([TRAP_KINDS.perfectPairs, TRAP_KINDS.threePlus21, TRAP_KINDS.dealerBust, TRAP_KINDS.poker])(m);
  },
};

export function randomTrap({ multipliers = true } = {}) {
  const r = Math.random();
  if (r < 0.2) return TRAP_KINDS.insurance();
  if (r < 0.35) return TRAP_KINDS.evenMoney();
  if (multipliers && r < 0.75) return TRAP_KINDS.multiplierDrop();
  return pick([TRAP_KINDS.perfectPairs, TRAP_KINDS.threePlus21, TRAP_KINDS.dealerBust, TRAP_KINDS.poker])();
}
