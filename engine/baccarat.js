// Punto banco baccarat: values, the third-card rules, round resolution, payouts and exact odds.
// Cards are engine ranks (1 = Ace, 2..9, 10 = ten/J/Q/K). Baccarat value = rank, with every ten-valued card = 0.

export const bv = (rank) => (rank >= 10 ? 0 : rank);                 // value of one card
export const total = (ranks) => ranks.reduce((a, r) => a + bv(r), 0) % 10;

export const BACC_DEFAULT = Object.freeze({
  decks: 8,
  variant: 'standard',      // 'standard' = 5% commission on Banker wins; 'ez' = no commission, Banker wins with 3-card 7 push
  commission: 0.05,
  tiePays: 8,               // Tie pays 8:1 (some tables 9:1)
  pairPays: 11,             // either Pair side bet pays 11:1
});
export const normalizeBacc = (r = {}) => ({ ...BACC_DEFAULT, ...r, commission: (r.variant || 'standard') === 'ez' ? 0 : (r.commission ?? BACC_DEFAULT.commission) });

// ---- the draw rules ------------------------------------------------------------------------------
export const isNatural = (pTotal, bTotal) => pTotal >= 8 || bTotal >= 8;
export const playerDraws = (pTotal) => pTotal <= 5;

// p3 = the Player's third card rank, or null when the Player stood. bTotal = Banker's two-card total.
export function bankerDraws(bTotal, p3) {
  if (p3 === null || p3 === undefined) return bTotal <= 5;
  const v = bv(p3);
  switch (bTotal) {
    case 0: case 1: case 2: return true;
    case 3: return v !== 8;
    case 4: return v >= 2 && v <= 7;
    case 5: return v >= 4 && v <= 7;
    case 6: return v === 6 || v === 7;
    default: return false;
  }
}

// Plain-English reason for a Banker decision (used by the drills and the table's practice mode).
export function bankerReason(bTotal, p3) {
  const stood = p3 === null || p3 === undefined;
  if (stood) return bTotal <= 5 ? `The Player stood, so the Banker draws on 0–5 and stands on 6–7. Banker ${bTotal}: draws.` : `The Player stood, so the Banker draws on 0–5 and stands on 6–7. Banker ${bTotal}: stands.`;
  const v = bv(p3), draws = bankerDraws(bTotal, p3);
  const row = { 0: 'always draws', 1: 'always draws', 2: 'always draws', 3: 'draws unless the Player’s third card is an 8', 4: 'draws only if the Player’s third card is 2–7', 5: 'draws only if the Player’s third card is 4–7', 6: 'draws only if the Player’s third card is a 6 or 7', 7: 'always stands' }[bTotal];
  return `Banker ${bTotal} ${row}. The Player’s third card was worth ${v}, so the Banker ${draws ? 'draws' : 'stands'}.`;
}

// ---- one round ----------------------------------------------------------------------------------
// draw() returns the next card rank. Returns every card and the result.
export function playRound(draw) {
  const player = [draw()], banker = [draw()];
  player.push(draw()); banker.push(draw());
  let pT = total(player), bT = total(banker), p3 = null;
  const natural = isNatural(pT, bT);
  if (!natural) {
    if (playerDraws(pT)) { p3 = draw(); player.push(p3); pT = total(player); }
    if (bankerDraws(bT, p3)) { banker.push(draw()); bT = total(banker); }
  }
  return {
    player, banker, pTotal: pT, bTotal: bT, natural, playerThird: p3,
    winner: pT > bT ? 'player' : bT > pT ? 'banker' : 'tie',
  };
}

// Pair side bets look at the first two cards' printed ranks (a 10 and a King are not a pair), so they take card objects.
export const isPair = (cards) => cards.length >= 2 && cards[0].label === cards[1].label;

// Net result of one bet (+win, -loss, 0 push) for a round.
export function settle(bet, kind, round, rules = BACC_DEFAULT, pairs = {}) {
  const r = normalizeBacc(rules);
  switch (kind) {
    case 'player': return round.winner === 'player' ? bet : round.winner === 'banker' ? -bet : 0;
    case 'banker':
      if (round.winner === 'banker') {
        if (r.variant === 'ez' && round.banker.length === 3 && round.bTotal === 7) return 0;
        return +(bet * (1 - r.commission)).toFixed(2);
      }
      return round.winner === 'player' ? -bet : 0;
    case 'tie': return round.winner === 'tie' ? bet * r.tiePays : -bet;
    case 'playerPair': return pairs.player ? bet * r.pairPays : -bet;
    case 'bankerPair': return pairs.banker ? bet * r.pairPays : -bet;
    default: throw new Error('unknown bet ' + kind);
  }
}

// ---- exact probabilities ------------------------------------------------------------------------
// Enumerates every deal from a fresh n-deck shoe (cards grouped by baccarat value; 0 = ten-valued).
export function exactOdds(decks = 8) {
  const cnt = Array(10).fill(4 * decks); cnt[0] = 16 * decks;
  let n = 52 * decks;
  const out = { player: 0, banker: 0, tie: 0, banker3Seven: 0, playerNatural: 0, bankerNatural: 0 };
  const take = (v) => { cnt[v]--; n--; };
  const put = (v) => { cnt[v]++; n++; };
  const res = (p, b, w, p3 = null, bCards = 2) => {
    if (p > b) out.player += w; else if (b > p) { out.banker += w; if (bCards === 3 && b === 7) out.banker3Seven += w; } else out.tie += w;
  };
  for (let a = 0; a < 10; a++) {
    const wa = cnt[a] / n; take(a);
    for (let b = 0; b < 10; b++) {
      const wb = wa * cnt[b] / n; take(b);
      for (let c = 0; c < 10; c++) {
        const wc = wb * cnt[c] / n; take(c);
        for (let d = 0; d < 10; d++) {
          const w = wc * cnt[d] / n; take(d);
          const pT = (a + c) % 10, bT = (b + d) % 10;
          if (pT >= 8 || bT >= 8) { res(pT, bT, w); put(d); continue; }
          if (pT <= 5) {
            for (let e = 0; e < 10; e++) {
              const we = w * cnt[e] / n; take(e);
              const p2 = (pT + e) % 10;
              if (bankerDraws(bT, e === 0 ? 10 : e)) {
                for (let f = 0; f < 10; f++) { const wf = we * cnt[f] / n; res(p2, (bT + f) % 10, wf, e, 3); }
              } else res(p2, bT, we);
              put(e);
            }
          } else if (bankerDraws(bT, null)) {
            for (let f = 0; f < 10; f++) res(pT, (bT + f) % 10, w * cnt[f] / n, null, 3);
          } else res(pT, bT, w);
          put(d);
        }
        put(c);
      }
      put(b);
    }
    put(a);
  }
  // `e === 0 ? 10 : e` above: a drawn zero-value card is rank 10 (value 0) for the banker table.
  return out;
}

// House edge per unit bet from exact odds (a negative number is the player's expectation).
export function edges(decks = 8, rulesIn = BACC_DEFAULT) {
  const r = normalizeBacc({ ...rulesIn, decks });
  const o = exactOdds(decks);
  const pPair = (4 * decks - 1) / (52 * decks - 1);
  const banker = r.variant === 'ez' ? (o.banker - o.banker3Seven) - o.player : (1 - r.commission) * o.banker - o.player;
  return {
    odds: o,
    player: o.player - o.banker,
    banker,
    tie: r.tiePays * o.tie - (1 - o.tie),
    pair: r.pairPays * pPair - (1 - pPair),
    pPair,
  };
}
