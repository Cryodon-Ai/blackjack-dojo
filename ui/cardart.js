// Shared SVG art for the playing cards: paper and rim gradients, the court-card figures (J, Q, K) and
// the card back. Defined once in a hidden <svg> and referenced with <use>, so a table full of cards
// stays light. The card back colours come from CSS variables (--cb1, --cb2), set by the card-back setting.

const GOLD = '#e0b13c', GOLD_D = '#8a6a12', BLUE = '#2b4c9b', BLUE_D = '#18306a', RED = '#c2303f', RED_D = '#7a1824';
const OUT = '#3a2616';

// Each court symbol is the top half of the figure in a 56 x 48 box; the card draws it twice (second rotated 180).
const COURT = {
  K: `<symbol id="cK" viewBox="0 0 56 48" overflow="visible">
    <line x1="5" y1="5" x2="5" y2="48" stroke="${GOLD}" stroke-width="2.2"/><circle cx="5" cy="5" r="3.2" fill="${GOLD}" stroke="${GOLD_D}" stroke-width=".6"/><path d="M2.2 5h5.6M5 2.2v5.6" stroke="${GOLD_D}" stroke-width=".5"/>
    <path d="M6 48C8 37 17 32 28 32s20 5 22 16z" fill="${BLUE}" stroke="${BLUE_D}" stroke-width=".8"/>
    <path d="M14 48 28 35 42 48" fill="none" stroke="${GOLD}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M28 35v13" stroke="${GOLD}" stroke-width="1.2"/>
    <path d="M12 36.5Q28 46 44 36.5L41.5 41Q28 49 14.5 41z" fill="#f8f5ee" stroke="#6a6a6a" stroke-width=".5"/>
    <g fill="#222"><circle cx="19" cy="40.5" r=".9"/><circle cx="24" cy="43.2" r=".9"/><circle cx="29" cy="44" r=".9"/><circle cx="34" cy="43.2" r=".9"/><circle cx="38.5" cy="40.5" r=".9"/></g>
    <rect x="24.6" y="29" width="6.8" height="6" fill="url(#skin)"/>
    <path d="M18.4 22.5q0 12 9.6 13.5 9.6-1.5 9.6-13.5-3 6-9.6 6t-9.6-6z" fill="#9a9aa4" stroke="#6a6a74" stroke-width=".5"/>
    <ellipse cx="28" cy="23" rx="8.8" ry="9.8" fill="url(#skin)" stroke="${OUT}" stroke-width=".8"/>
    <path d="M19.4 21q-1.6 5 .6 9M36.6 21q1.6 5-.6 9" fill="none" stroke="#9a9aa4" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M22.2 21.2q2-1.4 4 0M29.8 21.2q2-1.4 4 0" fill="none" stroke="#6a5a4a" stroke-width=".9" stroke-linecap="round"/>
    <circle cx="24.2" cy="23.2" r="1" fill="#2a2018"/><circle cx="31.8" cy="23.2" r="1" fill="#2a2018"/>
    <path d="M28 24.4v3" stroke="#c89a78" stroke-width=".8" stroke-linecap="round"/>
    <path d="M23.4 28.4q4.6-2.2 9.2 0q-4.6 1.6-9.2 0z" fill="#a8a8b2" stroke="#6a6a74" stroke-width=".4"/>
    <path d="M18 15.5 19.2 4 24 10.6 28 2.5 32 10.6 36.8 4 38 15.5z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width=".8" stroke-linejoin="round"/>
    <rect x="18" y="13.4" width="20" height="3.6" fill="${RED}" stroke="${GOLD_D}" stroke-width=".6"/>
    <circle cx="19.2" cy="4" r="1.3" fill="${RED}"/><circle cx="28" cy="2.5" r="1.4" fill="#3a6ad0"/><circle cx="36.8" cy="4" r="1.3" fill="${RED}"/>
    <circle cx="23.5" cy="15.2" r=".9" fill="#f6e08a"/><circle cx="28" cy="15.2" r=".9" fill="#f6e08a"/><circle cx="32.5" cy="15.2" r=".9" fill="#f6e08a"/>
  </symbol>`,
  Q: `<symbol id="cQ" viewBox="0 0 56 48" overflow="visible">
    <path d="M16 22C12 36 14 44 19 48h19c5-4 7-12 3-26C38.5 11 18.5 11 16 22z" fill="#7a4a24" stroke="#4a2c14" stroke-width=".7"/>
    <path d="M6 48C8 38 17 33.5 28 33.5S48 38 50 48z" fill="${RED}" stroke="${RED_D}" stroke-width=".8"/>
    <path d="M17 48 28 37l11 11" fill="none" stroke="${GOLD}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M19 38.5Q28 45 37 38.5" fill="none" stroke="${GOLD}" stroke-width="1.2"/>
    <g fill="#f8efe0" stroke="#b89a60" stroke-width=".3"><circle cx="21" cy="40.2" r="1.15"/><circle cx="24.6" cy="42.6" r="1.15"/><circle cx="28" cy="43.4" r="1.15"/><circle cx="31.4" cy="42.6" r="1.15"/><circle cx="35" cy="40.2" r="1.15"/></g>
    <rect x="25" y="29" width="6" height="6" fill="url(#skin)"/>
    <ellipse cx="28" cy="23" rx="8" ry="9.4" fill="url(#skin)" stroke="${OUT}" stroke-width=".8"/>
    <path d="M19.6 22Q28 10.5 36.4 22Q31 16.4 28 16.4T19.6 22z" fill="#7a4a24"/>
    <path d="M21.4 21.4q1.9-1.5 3.8 0M30.8 21.4q1.9-1.5 3.8 0" fill="none" stroke="#5a3a24" stroke-width=".9" stroke-linecap="round"/>
    <circle cx="23.4" cy="23.4" r="1" fill="#2a2018"/><circle cx="32.6" cy="23.4" r="1" fill="#2a2018"/>
    <path d="M22.2 22.6l-1-.8M33.8 22.6l1-.8" stroke="#2a2018" stroke-width=".6" stroke-linecap="round"/>
    <path d="M28 24.2v2.6" stroke="#c89a78" stroke-width=".8" stroke-linecap="round"/>
    <path d="M24.8 29.2q3.2 2.2 6.4 0q-3.2 .9-6.4 0z" fill="#c2303f" stroke="#7a1824" stroke-width=".4"/>
    <circle cx="21.5" cy="26.6" r="1.5" fill="#e89a8e" opacity=".5"/><circle cx="34.5" cy="26.6" r="1.5" fill="#e89a8e" opacity=".5"/>
    <path d="M20.5 14.5 21.6 6.5 25 10.4 28 4.2 31 10.4 34.4 6.5 35.5 14.5z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width=".8" stroke-linejoin="round"/>
    <circle cx="28" cy="4.4" r="1.3" fill="${RED}"/><circle cx="21.6" cy="6.6" r="1" fill="#3a6ad0"/><circle cx="34.4" cy="6.6" r="1" fill="#3a6ad0"/>
    <path d="M47 27v21" stroke="#2f8a3a" stroke-width="1.5"/><path d="M47 38q-5-2-6-6 5 0 6 6zM47 34q5-1 6-5-5-1-6 5z" fill="#3aa04a"/>
    <circle cx="47" cy="25.5" r="4.2" fill="#d63a48" stroke="#8a1a28" stroke-width=".6"/><path d="M45 25.5q2-3 4 0q-2 2.4-4 0z" fill="#a8202e"/>
  </symbol>`,
  J: `<symbol id="cJ" viewBox="0 0 56 48" overflow="visible">
    <line x1="50" y1="3" x2="50" y2="48" stroke="#9a9ca6" stroke-width="2"/><path d="M50 5.5 56 9.5 50 15z" fill="#d6d9e2" stroke="#8a8c96" stroke-width=".5"/>
    <path d="M16.5 22Q14 30 17 38h6M39.5 22Q42 30 39 38h-6" fill="#6a4426" stroke="#3e2814" stroke-width=".6"/>
    <path d="M6 48C8 37.5 17 33 28 33s20 4.5 22 15z" fill="#2f7d5d" stroke="#1a4a36" stroke-width=".8"/>
    <path d="M28 33v15M16 38.6 40 38.6" stroke="${GOLD}" stroke-width="1.3"/><path d="M14 48 28 38l14 10" fill="none" stroke="${GOLD}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M18 36.5Q28 43 38 36.5" fill="none" stroke="#f1f1f1" stroke-width="2.2"/>
    <rect x="25" y="29" width="6" height="6" fill="url(#skin)"/>
    <ellipse cx="28" cy="23.6" rx="8.2" ry="9.2" fill="url(#skin)" stroke="${OUT}" stroke-width=".8"/>
    <path d="M19.8 22Q28 13 36.2 22Q31 18 28 18T19.8 22z" fill="#6a4426"/>
    <path d="M22 21.8q2-1.3 4 0M30 21.8q2-1.3 4 0" fill="none" stroke="#5a3a24" stroke-width=".9" stroke-linecap="round"/>
    <circle cx="24" cy="23.8" r="1" fill="#2a2018"/><circle cx="32" cy="23.8" r="1" fill="#2a2018"/>
    <path d="M28 24.6v2.4" stroke="#c89a78" stroke-width=".8" stroke-linecap="round"/>
    <path d="M25 29.2q3 1.8 6 0" fill="none" stroke="#a8504a" stroke-width=".9" stroke-linecap="round"/>
    <path d="M17.6 17.4Q19 6 28 5.6T38.4 17.4L36 18.6Q28 13.4 20 18.6z" fill="${RED}" stroke="${RED_D}" stroke-width=".8"/>
    <path d="M36.6 10.6Q50 -1 52 8 46 8.4 38 14.4z" fill="#fafafa" stroke="#9a9a9a" stroke-width=".6"/><path d="M38 12Q46 5 51 7.5" fill="none" stroke="#c9c9c9" stroke-width=".5"/>
    <rect x="17.6" y="16.4" width="20.8" height="2.6" rx="1" fill="${GOLD}" stroke="${GOLD_D}" stroke-width=".5"/>
  </symbol>`,
};

const DEFS = `<svg id="card-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f6f3ec"/><stop offset="1" stop-color="#e7e2d6"/></linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <radialGradient id="skin" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#f9dcb8"/><stop offset="1" stop-color="#e2b185"/></radialGradient>
    <pattern id="lattice" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" style="fill:var(--cb1)"/><path d="M0 4.5h9M4.5 0v9" style="stroke:var(--cb2)" stroke-width="1.1"/><circle cx="4.5" cy="4.5" r="1.1" style="fill:var(--cb2)"/></pattern>
    ${Object.values(COURT).join('')}
    <symbol id="cardback" viewBox="0 0 100 140" overflow="visible">
      <rect x="1.5" y="1.5" width="97" height="137" rx="9" fill="url(#paper)" stroke="rgba(0,0,0,.4)"/>
      <rect x="6" y="6" width="88" height="128" rx="5" fill="url(#lattice)" stroke="#fff" stroke-width="1.5"/>
      <rect x="10.5" y="10.5" width="79" height="119" rx="3" fill="none" style="stroke:var(--cb2)" stroke-width="1"/>
      <ellipse cx="50" cy="70" rx="23" ry="30" style="fill:var(--cb1);stroke:#fff" stroke-width="1.6"/>
      <ellipse cx="50" cy="70" rx="18" ry="25" fill="none" style="stroke:var(--cb2)" stroke-width="1"/>
      <path d="M50 49l4.6 14.2H69l-11.7 8.6 4.5 14L50 77.6l-11.8 8.2 4.5-14L31 63.2h14.4z" fill="#fff" opacity=".92"/>
      <rect x="1.5" y="1.5" width="97" height="137" rx="9" fill="url(#gloss)" opacity=".5"/>
    </symbol>
  </defs></svg>`;

export function ensureCardDefs() {
  if (typeof document === 'undefined' || document.getElementById('card-defs')) return;
  const host = document.body || document.documentElement;
  host.insertAdjacentHTML('afterbegin', DEFS);
}

// The court-card figure area (56 x 96): top half plus the same half turned 180 degrees.
export const courtArt = (label) => `<g transform="translate(22 22)"><use href="#c${label}" width="56" height="48"/></g><g transform="rotate(180 50 70) translate(22 22)"><use href="#c${label}" width="56" height="48"/></g>`;
