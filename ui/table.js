// The table scene: padded rail, felt, a dealer behind the table, the shoe, the betting spot. Every game
// draws through renderTable, so the practice room, drills, Live Table and Gravity all sit at a real-looking
// table with a dealer who deals from the shoe. Pure SVG + CSS, no image assets.
//
// state: { dealer:[cards], hideHole, hands:[{cards, active, note}], newFrom:{dealer, hands:[n]},
//          variant: 'live' | 'practice' | 'drill', bet?: number }

import { cardSVG, handValue } from './cards.js';
import { dealerSVG } from './dealer.js';
import { ctx } from '../app/ctx.js';
import { deal as dealSound } from '../app/feel.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STEP = 300;   // ms between dealt cards; the dealer's arm cycle matches it

function badge(cards) {
  const h = handValue(cards.map((c) => c.v));
  if (h.bust) return `<div class="badge bad">${h.hard} <span class="small">bust</span></div>`;
  if (h.soft && h.total !== 21) return `<div class="badge">${h.hard} / <span class="soft">${h.total}</span></div>`;
  if (h.soft && h.total === 21 && cards.length === 2) return `<div class="badge ok">21</div>`;
  return `<div class="badge">${h.total}</div>`;
}

const SHOE_SVG = `<svg class="shoe" viewBox="0 0 70 58" aria-hidden="true"><defs><linearGradient id="shg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4f63"/><stop offset="1" stop-color="#1c1e27"/></linearGradient></defs>
  <path d="M3 22 48 8l19 13v28L18 56 3 47z" fill="url(#shg)" stroke="#000" stroke-opacity=".5"/>
  <path d="M3 22 48 8l19 13-46 14z" fill="#5b6178"/><path d="M18 35 67 21v7L18 42z" fill="#f4f4f6"/><path d="M18 42 67 28v3L18 45z" fill="#c4c6d0"/>
  <path d="M18 35 67 21" stroke="#fff" stroke-width="1" opacity=".7"/><rect x="21" y="47" width="14" height="4" rx="1.5" fill="#c9a24a" opacity=".8" transform="skewY(-16) translate(0 9)"/></svg>`;

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

const chip = (c, dy) => `<ellipse class="chip-side ${c}" cx="20" cy="${dy + 2.4}" rx="14" ry="5.6"/><ellipse class="chip ${c}" cx="20" cy="${dy}" rx="14" ry="5.6"/><ellipse class="chip-ring" cx="20" cy="${dy}" rx="10.6" ry="4.1"/>`;
const CHIPS = `<svg class="chips" viewBox="0 0 40 34" aria-hidden="true">${chip('c1', 27)}${chip('c2', 23)}${chip('c3', 19)}${chip('c1', 15)}${chip('c2', 11)}</svg>`;

function dealerLine(state) {
  const cards = state.dealer;
  if (state.hideHole) return `Dealer shows <b>${cards[0].v === 1 ? 'Ace' : cards[0].v === 10 ? 'ten' : cards[0].v}</b>`;
  const h = handValue(cards.map((c) => c.v));
  if (h.bust) return 'Dealer <b class="bad">busts</b>';
  if (cards.length === 2 && h.total === 21) return 'Dealer has <b>blackjack</b>';
  return `Dealer has <b>${h.total}</b>`;
}
function moodOf(state) {
  if (state.hideHole) return '';
  const h = handValue(state.dealer.map((c) => c.v));
  return h.bust ? 'bust' : state.dealer.length === 2 && h.total === 21 ? 'bj' : '';
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
  const char = (ctx.profile && ctx.profile.settings && ctx.profile.settings.dealerChar) || 'marcus';

  el.innerHTML = `<div class="felt ${variant}">
    <div class="spot"></div>
    <div class="dealer-stage">
      ${dealerSVG(char, { practice: variant === 'practice' }).replace('<svg class="dealer-fig"', `<svg data-mood="${moodOf(state)}" class="dealer-fig"`)}
      <div class="shoe-side">${SHOE_SVG}</div>
      <div class="dealer-say small">${dealerLine(state)}</div>
      <div class="seat dseat"><div class="cards">${dealerHTML}</div></div>
      <div class="dbadge">${state.hideHole ? `<div class="badge dim">${state.dealer[0].v === 1 ? 'A' : state.dealer[0].v}</div>` : badge(state.dealer)}</div>
    </div>
    ${arcText(variant)}
    <div class="seat pseat">${multi ? `<div class="split-hands">${handsHTML}</div>` : handsHTML}</div>
    <div class="bet-spot"><div class="circle">${bet}</div>${CHIPS}</div>
    <div class="rail"></div>
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
  const sx = shoe.left + shoe.width * 0.3, sy = shoe.top + shoe.height * 0.35;
  const order = fresh.filter((c) => c.classList.contains('deal')).sort((a, b) => (Number(a.dataset.n) - Number(b.dataset.n)) || (a.dataset.seat === 'p' ? -1 : 1) - (b.dataset.seat === 'p' ? -1 : 1));
  order.forEach((c, k) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--sx', `${Math.round(sx - (r.left + r.width / 2))}px`);
    c.style.setProperty('--sy', `${Math.round(sy - (r.top + r.height / 2))}px`);
    c.style.setProperty('--sr', `${-25 + (k % 2) * 40}deg`);
    c.style.setProperty('--d', `${k * STEP}ms`);
  });
  fresh.filter((c) => c.classList.contains('flip')).forEach((c) => c.style.setProperty('--d', '120ms'));
  felt.style.setProperty('--n', String(Math.max(1, order.length)));
  felt.style.setProperty('--step', `${STEP}ms`);
  felt.classList.add('dealing');
  dealSound(order.length);
  clearTimeout(felt._t);
  felt._t = setTimeout(() => felt.classList.remove('dealing'), order.length * STEP + 700);
}
