// Inline-SVG playing cards. No image assets, no emoji. Card model: { v: 1..10, label, suit }.
// v is the engine rank (1 = ace, 10 = any ten-valued card); label is what is printed.

export const SUITS = ['s', 'h', 'd', 'c'];
const RED = '#e23a55', BLACK = '#14161c';
const isRed = (s) => s === 'h' || s === 'd';

// Suit glyphs drawn in a 24x24 box, centred at (12,12).
const GLYPH = {
  h: '<path d="M12 21.5C5 15.8 2 12.3 2 8.6 2 5.6 4.3 3.5 7 3.5c1.9 0 3.6 1 5 3 1.4-2 3.1-3 5-3 2.7 0 5 2.1 5 5.1 0 3.7-3 7.2-10 12.9z"/>',
  d: '<path d="M12 1.5 21 12l-9 10.5L3 12z"/>',
  s: '<path d="M12 1.8C7 7.5 3 10.6 3 14.3c0 2.5 1.9 4.2 4.2 4.2 1.7 0 3-.8 3.9-2.2-.1 2.2-.8 3.9-2.6 5.2h7c-1.8-1.3-2.5-3-2.6-5.2.9 1.4 2.2 2.2 3.9 2.2 2.3 0 4.2-1.7 4.2-4.2 0-3.7-4-6.8-9-12.5z"/>',
  c: '<circle cx="12" cy="7.3" r="4.7"/><circle cx="6.4" cy="14.6" r="4.7"/><circle cx="17.6" cy="14.6" r="4.7"/><path d="M12 11.5 9.4 22.5h5.2z"/>',
};

function pip(suit, x, y, size, flip) {
  const s = size / 24;
  const t = `translate(${x - 12 * s} ${y - 12 * s}) scale(${s})` + (flip ? ` rotate(180 12 12)` : '');
  return `<g transform="${t}" fill="${isRed(suit) ? RED : BLACK}">${GLYPH[suit]}</g>`;
}

const COLS = { l: 32, m: 50, r: 68 };
const PIPS = {
  1: [[50, 70, 0, 40]],
  2: [[50, 30], [50, 110, 1]],
  3: [[50, 30], [50, 70], [50, 110, 1]],
  4: [[32, 30], [68, 30], [32, 110, 1], [68, 110, 1]],
  5: [[32, 30], [68, 30], [50, 70], [32, 110, 1], [68, 110, 1]],
  6: [[32, 30], [68, 30], [32, 70], [68, 70], [32, 110, 1], [68, 110, 1]],
  7: [[32, 30], [68, 30], [50, 50], [32, 70], [68, 70], [32, 110, 1], [68, 110, 1]],
  8: [[32, 30], [68, 30], [50, 50], [32, 70], [68, 70], [50, 90, 1], [32, 110, 1], [68, 110, 1]],
  9: [[32, 30], [68, 30], [32, 56.7], [68, 56.7], [50, 70], [32, 83.3, 1], [68, 83.3, 1], [32, 110, 1], [68, 110, 1]],
  10: [[32, 30], [68, 30], [50, 43], [32, 56.7], [68, 56.7], [32, 83.3, 1], [68, 83.3, 1], [50, 97, 1], [32, 110, 1], [68, 110, 1]],
};

export function cardSVG(card, { faceDown = false, cls = '' } = {}) {
  if (faceDown || !card) {
    return `<svg class="pcard ${cls}" viewBox="0 0 100 140" role="img" aria-label="face-down card">
      <defs><pattern id="bk" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#1a2140"/><path d="M0 5h10M5 0v10" stroke="#2c376b" stroke-width="1.4"/></pattern></defs>
      <rect x="1.5" y="1.5" width="97" height="137" rx="9" fill="#f4f4f6"/><rect x="7" y="7" width="86" height="126" rx="5" fill="url(#bk)"/></svg>`;
  }
  const { label, suit } = card;
  const col = isRed(suit) ? RED : BLACK;
  const n = card.v;
  let center = '';
  const face = label === 'J' || label === 'Q' || label === 'K';
  if (face) {
    center = `<rect x="24" y="22" width="52" height="96" rx="7" fill="none" stroke="${col}" stroke-width="2" opacity=".55"/>
      <text x="50" y="82" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="46" font-weight="700" fill="${col}">${label}</text>
      ${pip(suit, 50, 32, 14, 0)}${pip(suit, 50, 108, 14, 1)}`;
  } else if (label === 'A') {
    center = pip(suit, 50, 70, 46, 0);
  } else {
    const layout = PIPS[label === '10' ? 10 : n] || [];
    center = layout.map(([x, y, f]) => pip(suit, x, y, 19, f)).join('');
  }
  const idx = label;
  const corner = (rot) => `<g transform="${rot ? 'rotate(180 50 70)' : ''}">
      <text x="11" y="24" font-family="-apple-system, 'SF Pro Display', system-ui, sans-serif" font-size="${idx === '10' ? 19 : 22}" font-weight="800" fill="${col}" letter-spacing="-1">${idx}</text>
      ${pip(suit, 15, 36, 12, 0)}</g>`;
  return `<svg class="pcard ${cls}" viewBox="0 0 100 140" role="img" aria-label="${label} of ${{ s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' }[suit]}">
    <rect x="1.5" y="1.5" width="97" height="137" rx="9" fill="#f7f7f9" stroke="#cfd0d6" stroke-width="1"/>
    ${corner(false)}${corner(true)}${center}</svg>`;
}

// ---- card construction --------------------------------------------------------------------
const TENS = ['10', 'J', 'Q', 'K'];
const rnd = (n) => Math.floor(Math.random() * n);

// A concrete card for an engine rank, with a random suit (and random ten-valued face).
export function makeCard(v, suit) {
  const label = v === 1 ? 'A' : v === 10 ? TENS[rnd(4)] : String(v);
  return { v, label, suit: suit || SUITS[rnd(4)] };
}

// Build a hand of concrete cards for a list of ranks, avoiding accidental identical (rank,suit) pairs.
export function makeHand(ranks) {
  const used = new Set();
  return ranks.map((v) => {
    for (let tries = 0; tries < 20; tries++) {
      const c = makeCard(v);
      const k = c.label + c.suit;
      if (!used.has(k)) { used.add(k); return c; }
    }
    return makeCard(v);
  });
}

// Fresh-shuffle draw from the ruleset's shoe (online RNG tables reshuffle every hand).
export function freshShoe(decks, removed = []) {
  const counts = Array(11).fill(0);
  const d = Number.isFinite(decks) ? decks : 8;
  for (let r = 1; r <= 9; r++) counts[r] = 4 * d;
  counts[10] = 16 * d;
  for (const v of removed) counts[v]--;
  let n = counts.reduce((a, b) => a + b, 0);
  return {
    counts,
    draw(force) {
      if (force) { counts[force]--; n--; return makeCard(force); }
      let k = rnd(n);
      for (let r = 1; r <= 10; r++) { k -= counts[r]; if (k < 0) { counts[r]--; n--; return makeCard(r); } }
      throw new Error('empty shoe');
    },
  };
}

// Hand total helpers over engine ranks.
export function handValue(ranks) {
  let hard = 0, ace = false;
  for (const v of ranks) { hard += v; if (v === 1) ace = true; }
  const soft = ace && hard <= 11;
  return { hard, soft, total: soft ? hard + 10 : hard, bust: hard > 21 };
}
export const handLabel = (ranks) => {
  const h = handValue(ranks);
  if (h.bust) return String(h.hard);
  return h.soft ? `${h.hard} / ${h.total}` : String(h.total);
};
