// The table scene: felt, rail, dealer, shoe, betting circle. Every game draws through renderTable, so
// the practice room, drills, Live Table and Gravity all sit at a real-looking table with a dealer who
// deals from the shoe. Pure SVG + CSS, no image assets.
//
// state: { dealer:[cards], hideHole, hands:[{cards, active, note}], newFrom:{dealer, hands:[n]},
//          variant: 'live' | 'practice' | 'drill', bet?: number }

import { cardSVG, handValue } from './cards.js';
import { ctx } from '../app/ctx.js';
import { deal as dealSound } from '../app/feel.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function badge(cards) {
  const h = handValue(cards.map((c) => c.v));
  if (h.bust) return `<div class="badge bad">${h.hard} <span class="small">bust</span></div>`;
  if (h.soft && h.total !== 21) return `<div class="badge">${h.hard} / <span class="soft">${h.total}</span></div>`;
  if (h.soft && h.total === 21 && cards.length === 2) return `<div class="badge ok">21</div>`;
  return `<div class="badge">${h.total}</div>`;
}

const NAMETAG = { live: 'DEALER', practice: 'COACH', drill: 'DEALER' };

function dealerSVG(variant) {
  return `<svg class="dealer-fig" viewBox="0 0 84 92" aria-hidden="true">
    <path class="vest" d="M4 92C4 64 22 56 42 56s38 8 38 36z"/>
    <path d="M31 58 42 80 53 58z" fill="#f2f2f4"/>
    <path d="M42 62 33 57v10zM42 62l9-5v10z" class="bow"/><circle cx="42" cy="62" r="2.4" class="bow"/>
    <rect x="52" y="74" width="20" height="8" rx="2" fill="#f2f2f4" opacity=".92"/><text x="62" y="80.4" text-anchor="middle" font-size="5" font-weight="800" fill="#222" font-family="system-ui,sans-serif">${NAMETAG[variant] || 'DEALER'}</text>
    <g class="head"><circle cx="42" cy="31" r="17" fill="#e2b890"/>
      <path d="M25 29c0-12 8-18 17-18s17 6 17 18c-4-6-10-9-17-9s-13 3-17 9z" fill="#2b221c"/>
      <circle cx="36" cy="33" r="1.7" fill="#2b221c"/><circle cx="48" cy="33" r="1.7" fill="#2b221c"/>
      <path d="M36 41q6 5 12 0" fill="none" stroke="#7a4a35" stroke-width="1.8" stroke-linecap="round"/></g>
    <g class="arm"><rect x="62" y="64" width="11" height="26" rx="5.5" class="vest"/><circle cx="67.5" cy="90" r="5.5" fill="#e2b890"/></g>
  </svg>`;
}

const SHOE_SVG = `<svg class="shoe" viewBox="0 0 64 54" aria-hidden="true"><path d="M3 20 44 8l17 12v26L16 52 3 44z" fill="#23262e"/><path d="M3 20 44 8l17 12-42 12z" fill="#34384a"/><path d="M16 32 61 20v6L16 38z" fill="#f4f4f6"/><path d="M16 38 61 26v3L16 41z" fill="#c9cad2"/></svg>`;

function arcText(variant) {
  let line = 'BLACKJACK PAYS 3 TO 2';
  try {
    const r = ctx.rules;
    const pay = r.blackjackPays === 1.2 ? '6 TO 5' : r.blackjackPays === 1 ? '1 TO 1' : '3 TO 2';
    line = `BLACKJACK PAYS ${pay} · DEALER ${r.dealerHitsSoft17 ? 'HITS' : 'STANDS'} SOFT 17`;
  } catch { /* default text */ }
  if (variant === 'practice') line = 'PRACTICE TABLE · NO MONEY';
  return `<svg class="arc" viewBox="0 0 360 46" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><path id="arcp" d="M10 6Q180 40 350 6"/></defs><text><textPath href="#arcp" startOffset="50%" text-anchor="middle">${esc(line)}</textPath></text></svg>`;
}

const chip = (c, dy) => `<ellipse class="chip ${c}" cx="20" cy="${dy}" rx="14" ry="5.5"/>`;
const CHIPS = `<svg class="chips" viewBox="0 0 40 30" aria-hidden="true">${chip('c1', 24)}${chip('c2', 20)}${chip('c3', 16)}${chip('c1', 12)}</svg>`;

function dealerLine(state) {
  const cards = state.dealer;
  if (state.hideHole) return `Dealer shows <b>${cards[0].v === 1 ? 'Ace' : cards[0].v === 10 ? 'ten' : cards[0].v}</b>`;
  const h = handValue(cards.map((c) => c.v));
  if (h.bust) return 'Dealer <b class="bad">busts</b>';
  if (cards.length === 2 && h.total === 21) return 'Dealer has <b>blackjack</b>';
  return `Dealer has <b>${h.total}</b>`;
}

export function renderTable(el, state) {
  const variant = state.variant || 'live';
  const nf = state.newFrom || {};
  const dealerHTML = state.dealer.map((c, i) => {
    const isNew = !!state.newFrom && i >= (nf.dealer || 0);
    const flip = isNew && i === 1 && !state.hideHole && nf.dealer === 1;
    return cardSVG(c, { faceDown: state.hideHole && i === 1, cls: isNew ? (flip ? 'flip' : 'deal') : '' }).replace('class="pcard', `data-seat="d" data-n="${i}" class="pcard`);
  }).join('');
  const multi = state.hands.length > 1;
  const handsHTML = state.hands.map((h, hi) => {
    const from = state.newFrom && state.newFrom.hands ? (state.newFrom.hands[hi] ?? 0) : 0;
    const cs = h.cards.map((c, i) => cardSVG(c, { cls: (state.newFrom && i >= from) ? 'deal' : '' }).replace('class="pcard', `data-seat="p" data-n="${i}" class="pcard`)).join('');
    return `<div class="hand ${h.active ? 'active' : ''}"><div class="cards">${cs}</div>${badge(h.cards)}${h.note ? `<div class="small dim">${esc(h.note)}</div>` : ''}</div>`;
  }).join('');
  const bet = state.bet ? `<div class="bet-amt num">$${state.bet}</div>` : '';

  el.innerHTML = `<div class="felt ${variant}">
    <div class="rail"></div>
    <div class="dealer-zone">
      <div class="dealer-side">${dealerSVG(variant)}<div class="dealer-say small">${dealerLine(state)}</div></div>
      <div class="seat dseat"><div class="cards">${dealerHTML}</div>${state.hideHole ? `<div class="badge dim">${state.dealer[0].v === 1 ? 'A' : state.dealer[0].v}</div>` : badge(state.dealer)}</div>
      <div class="shoe-side">${SHOE_SVG}</div>
    </div>
    ${arcText(variant)}
    <div class="seat pseat">${multi ? `<div class="split-hands">${handsHTML}</div>` : handsHTML}</div>
    <div class="bet-spot"><div class="circle">${bet}</div>${CHIPS}</div>
  </div>`;
  animateDeal(el);
}

// Fly each new card from the shoe to where it lands, in dealing order (player, dealer, player, dealer…).
function animateDeal(el) {
  const felt = el.querySelector('.felt');
  const fresh = [...el.querySelectorAll('.pcard.deal, .pcard.flip')];
  if (!fresh.length) return;
  const s = (ctx.profile && ctx.profile.settings) || {};
  if (s.dealAnim === false || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { fresh.forEach((c) => c.classList.remove('deal', 'flip')); return; }
  const shoe = el.querySelector('.shoe').getBoundingClientRect();
  const sx = shoe.left + shoe.width * 0.35, sy = shoe.top + shoe.height * 0.35;
  const order = fresh.filter((c) => c.classList.contains('deal')).sort((a, b) => (Number(a.dataset.n) - Number(b.dataset.n)) || (a.dataset.seat === 'p' ? -1 : 1) - (b.dataset.seat === 'p' ? -1 : 1));
  order.forEach((c, k) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--sx', `${Math.round(sx - (r.left + r.width / 2))}px`);
    c.style.setProperty('--sy', `${Math.round(sy - (r.top + r.height / 2))}px`);
    c.style.setProperty('--sr', `${-25 + (k % 2) * 40}deg`);
    c.style.setProperty('--d', `${k * 210}ms`);
  });
  fresh.filter((c) => c.classList.contains('flip')).forEach((c) => c.style.setProperty('--d', '120ms'));
  felt.classList.add('dealing');
  dealSound(order.length);
  clearTimeout(felt._t);
  felt._t = setTimeout(() => felt.classList.remove('dealing'), order.length * 210 + 700);
}
