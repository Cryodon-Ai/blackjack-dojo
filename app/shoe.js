// A persistent, finite shoe: deals without replacement, tracks the Hi-Lo running count, and
// reshuffles when the cut card is reached (or every hand, to mimic an RNG table).
// Drawing a uniformly random remaining card is statistically identical to dealing from a shuffled shoe.

import { makeCard } from '../ui/cards.js';

const HILO = [0, -1, 1, 1, 1, 1, 1, 0, 0, 0, -1];   // index = engine rank (1 = Ace, 10 = any ten)
export const hiLo = (rank) => HILO[rank];

export const DEFAULT_SHOE = Object.freeze({ pen: 0.75, mode: 'shoe', count: 'off' });
// pen   : fraction of the shoe dealt before the cut card (reshuffle happens before the next hand)
// mode  : 'shoe' = persistent shoe, 'rng' = fresh shuffle every hand
// count : 'off' | 'show' (running count on screen) | 'quiz' (asked now and then)

const rnd = (n) => Math.floor(Math.random() * n);

export class Shoe {
  constructor(decks, { pen = DEFAULT_SHOE.pen, mode = DEFAULT_SHOE.mode } = {}) {
    this.decks = Number.isFinite(decks) ? decks : 8;
    this.pen = pen; this.mode = mode;
    this.shuffleCount = 0;
    this.shuffle();
  }

  shuffle() {
    const c = Array(11).fill(0);
    for (let r = 1; r <= 9; r++) c[r] = 4 * this.decks;
    c[10] = 16 * this.decks;
    this.counts = c;
    this.total = 52 * this.decks;
    this.n = this.total;
    this.running = 0;
    this.hidden = 0;                 // Hi-Lo value of a face-down card (the hole card) not yet counted
    this.shuffleCount++;
  }

  get dealt() { return this.total - this.n; }
  get decksLeft() { return this.n / 52; }
  get cutAt() { return Math.floor(this.total * this.pen); }
  get cardsToCut() { return Math.max(0, this.cutAt - this.dealt); }
  get seenCount() { return this.running - this.hidden; }                 // what a player at the table would have
  get trueCount() { return this.seenCount / Math.max(0.5, this.decksLeft); }

  // Call between hands. Returns true if it reshuffled.
  prepare() {
    if (this.mode === 'rng' || this.dealt >= this.cutAt || this.n < 20) { this.shuffle(); return true; }
    return false;
  }

  draw(force) {
    if (this.n <= 0) this.shuffle();               // only reachable mid-hand in a 1-deck game at deep penetration
    let r = force;
    if (!r) {
      let k = rnd(this.n);
      for (r = 1; r <= 10; r++) { k -= this.counts[r]; if (k < 0) break; }
    }
    this.counts[r]--; this.n--; this.running += HILO[r];
    return makeCard(r);
  }

  // The hole card is drawn at the deal but is face-down: keep it out of the visible count until revealed.
  hideHole(rank) { this.hidden = HILO[rank]; }
  revealHole() { this.hidden = 0; }

  snapshot() { return this.counts.slice(); }

  // Throwaway copy used to look for a hand that matches a practice focus without consuming real cards.
  clone() { const s = Object.create(Shoe.prototype); Object.assign(s, this); s.counts = this.counts.slice(); return s; }
}

export const shoeFromProfile = (profile, decks) => new Shoe(decks, { ...DEFAULT_SHOE, ...(profile.settings.shoe || {}) });

export function shoeStatus(shoe) {
  if (shoe.mode === 'rng') return 'Fresh shuffle every hand';
  return `${shoe.n} cards · ${shoe.decksLeft.toFixed(1)} decks left · cut card in ${shoe.cardsToCut}`;
}
