// The baccarat table: dealer behind the felt, Player and Banker hands side by side, and the bet spots.
// state: { player:[cards], banker:[cards], newFrom:{p,b}, winner, pPair, bPair, bets:{player,banker,tie,playerPair,bankerPair},
//          say (html), mood, variant:'live'|'practice', hideTotals, odds:{...payout labels} }

import { cardSVG } from './cards.js';
import { total } from '../engine/baccarat.js';
import { dealerFig, SHOE, animateDeal, startBlink } from './table.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

function hand(cards, newFrom, seat) {
  return cards.map((c, i) => cardSVG(c, { cls: `${i >= newFrom ? 'deal' : ''} ${i === 2 ? 'third' : ''}` }).replace('class="pcard', `data-seat="${seat}" data-n="${i}" class="pcard`)).join('');
}

export function renderBaccTable(el, st) {
  const variant = st.variant || 'live';
  const nf = st.newFrom || { p: 99, b: 99 };
  const pT = st.player.length ? total(st.player.map((c) => c.v)) : null;
  const bT = st.banker.length ? total(st.banker.map((c) => c.v)) : null;
  const win = st.winner;
  const bets = st.bets || {};
  const zone = (id, label, pays, cls) => `<button class="bzone ${cls} ${bets[id] ? 'has' : ''} ${st.winner && st.winning && st.winning.includes(id) ? 'won' : ''}" data-bet="${id}" ${st.betsOpen ? '' : 'disabled'}>
      <span class="bz-name">${label}</span><span class="bz-pays">${pays}</span>${bets[id] ? `<span class="bz-chip num">${money(bets[id])}</span>` : ''}</button>`;
  const o = st.odds || {};
  const handsPart = `
      <div class="bseat ${win === 'player' ? 'win' : win && win !== 'tie' ? 'lose' : ''}"><div class="blabel player">PLAYER</div><div class="cards">${hand(st.player, nf.p, 'p')}</div><div class="badge ${pT === null ? 'dim' : ''}">${pT === null || st.hideTotals ? '–' : pT}</div></div>
      <div class="bseat ${win === 'banker' ? 'win' : win && win !== 'tie' ? 'lose' : ''}"><div class="blabel banker">BANKER</div><div class="cards">${hand(st.banker, nf.b, 'd')}</div><div class="badge ${bT === null ? 'dim' : ''}">${bT === null || st.hideTotals ? '–' : bT}</div></div>`;
  const flag = win === 'tie' ? '<div class="tie-flag">TIE</div>' : '';
  const zonesPart = st.hideZones ? '' : `<div class="bz-row small-zones">${zone('playerPair', 'P PAIR', `${o.pair || 11}:1`, 'pair')}${zone('tie', 'TIE', `${o.tie || 8}:1`, 'tie')}${zone('bankerPair', 'B PAIR', `${o.pair || 11}:1`, 'pair')}</div>
      <div class="bz-row big-zones">${zone('player', 'PLAYER', '1:1', 'player')}${zone('banker', 'BANKER', o.banker || '19:20', 'banker')}</div>`;
  const felt = el.firstElementChild, key = `${variant}|${!!st.hideZones}`;
  if (felt && felt.classList.contains('bacc') && el._bkey === key) {
    felt.querySelector('.bhands').innerHTML = handsPart;
    felt.querySelector('.tie-slot').innerHTML = flag;
    felt.querySelector('.bzones').innerHTML = zonesPart;
    felt.querySelector('.dealer-say').innerHTML = st.say || '';
    felt.querySelector('.dealer-fig').setAttribute('data-mood', st.mood || '');
    animateDeal(el);
    return;
  }
  el._bkey = key;
  el.innerHTML = `<div class="felt bacc ${variant}">
    <div class="spot"></div>
    <div class="dealer-stage bstage">
      ${dealerFig(variant, st.mood || '')}
      <div class="shoe-side">${SHOE}</div>
      <div class="dealer-say small" style="max-width:96px">${st.say || ''}</div>
    </div>
    <div class="bhands">${handsPart}</div>
    <div class="tie-slot">${flag}</div>
    <div class="bzones">${zonesPart}</div>
    <div class="rail"></div>
  </div>`;
  animateDeal(el);
  startBlink(el);
}
