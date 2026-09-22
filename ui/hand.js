// The reusable hand-example component: table, action bar, verdict panel.

import { cardSVG, handValue } from './cards.js';
import { ACTION_NAME, signed, usd100, pct } from '../app/feedback.js';
import { upLabel, peeksOnUp } from '../engine/rules.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function badge(cards) {
  const ranks = cards.map((c) => c.v);
  const h = handValue(ranks);
  if (h.bust) return `<div class="badge bad">${h.hard} <span class="small">bust</span></div>`;
  if (h.soft && h.total !== 21) return `<div class="badge">${h.hard} / <span class="soft">${h.total}</span></div>`;
  if (h.soft && h.total === 21 && cards.length === 2) return `<div class="badge ok">21</div>`;
  return `<div class="badge">${h.total}</div>`;
}

// state: { dealer:[cards], hideHole:boolean, hands:[{cards, active, note, done}], newFrom: {dealer:n, hands:[n]} }
// newFrom marks how many cards already existed, so only new ones animate.
export function renderTable(el, state) {
  const dealerCards = state.dealer.map((c, i) => cardSVG(c, { faceDown: state.hideHole && i === 1, cls: (state.newFrom && i >= (state.newFrom.dealer || 0)) ? 'deal' : '' })).join('');
  const dealerBadge = state.hideHole
    ? `<div class="badge dim">${state.dealer[0].v === 1 ? 'A' : state.dealer[0].v}</div>`
    : badge(state.dealer);
  const multi = state.hands.length > 1;
  const hands = state.hands.map((h, hi) => {
    const nf = state.newFrom && state.newFrom.hands ? (state.newFrom.hands[hi] ?? 0) : 0;
    const cs = h.cards.map((c, i) => cardSVG(c, { cls: (state.newFrom && i >= nf) ? 'deal' : '' })).join('');
    return `<div class="hand ${h.active ? 'active' : ''}"><div class="cards">${cs}</div>${badge(h.cards)}${h.note ? `<div class="small dim">${esc(h.note)}</div>` : ''}</div>`;
  }).join('');
  el.innerHTML = `<div class="table">
    <div class="seat"><div class="who">Dealer</div><div class="cards">${dealerCards}</div>${dealerBadge}</div>
    <div class="seat"><div class="who">You</div>${multi ? `<div class="split-hands">${hands}</div>` : hands}</div>
  </div>`;
}

// ---- action bar ----------------------------------------------------------------------------
const ACTS = [['H', 'Hit'], ['S', 'Stand'], ['D', 'Double'], ['P', 'Split'], ['R', 'Surr.']];

export function illegalReason(rules, ctx, act) {
  if (act === 'D') {
    if (ctx.cards > 2) return 'You can only double on your first two cards.';
    if (ctx.afterSplit && !rules.doubleAfterSplit) return 'This table does not allow doubling after a split.';
    if (ctx.afterSplitAces) return 'Split aces get one card each — no double.';
    if (rules.doubleRestriction === '9-11') return 'This table only allows doubling on hard 9, 10 or 11.';
  }
  if (act === 'P') {
    if (ctx.cards !== 2) return 'You can only split your first two cards.';
    if (!ctx.pair) return 'Only a pair can be split.';
    if (ctx.handsCount >= rules.maxSplitHands) return `This table allows at most ${rules.maxSplitHands} hands.`;
    if (ctx.pair === 1 && ctx.afterSplit && !rules.resplitAces) return 'This table does not allow resplitting aces.';
  }
  if (act === 'R') {
    if (rules.surrender !== 'late') return 'This table does not offer surrender.';
    const checks = ctx.up !== undefined ? peeksOnUp(rules, ctx.up) : rules.peekOn !== 'none';
    if (!checks) return rules.peekOn === 'ace' ? 'This table only checks for blackjack against an Ace — no surrender against a Ten.' : 'Late surrender needs the dealer to check for blackjack first.';
    if (ctx.cards > 2 || ctx.afterSplit) return 'Surrender is only offered on your first two cards, before splitting.';
  }
  if (act === 'H' && ctx.afterSplitAces) return 'Split aces get one card each — no more hitting.';
  return 'Not available right now.';
}

// legal: {H,S,D,P,R: bool}. onAct(letter). reasons: {letter: text}. Long-press a dimmed button for the reason.
export function renderActionBar(el, { legal, reasons = {}, onAct, disabled = false, only = null, show = ['H', 'S', 'D', 'P', 'R'] }) {
  const acts = ACTS.filter(([k]) => show.includes(k));
  el.innerHTML = acts.map(([k, name]) => {
    const off = disabled || !legal[k] || (only && !only.includes(k));
    return `<button class="act ${k} ${off ? 'off' : ''}" data-a="${k}" aria-disabled="${off}">${name}<small>${k}</small></button>`;
  }).join('');
  el.style.gridTemplateColumns = `repeat(${acts.length}, 1fr)`;
  el.querySelectorAll('.act').forEach((b) => {
    const k = b.dataset.a;
    let timer = null, long = false;
    const start = () => { long = false; timer = setTimeout(() => { long = true; if (b.classList.contains('off') && reasons[k]) toast(reasons[k]); }, 450); };
    const end = () => { clearTimeout(timer); };
    b.addEventListener('pointerdown', start);
    b.addEventListener('pointerup', end); b.addEventListener('pointerleave', end); b.addEventListener('pointercancel', end);
    b.addEventListener('click', () => {
      if (long) return;
      if (b.classList.contains('off')) { if (reasons[k] && !disabled) toast(reasons[k]); return; }
      onAct(k);
    });
  });
}

export function markActions(el, chosen, correct) {
  el.querySelectorAll('.act').forEach((b) => {
    const k = b.dataset.a;
    b.classList.remove('picked-ok', 'picked-bad', 'was-right');
    if (k === chosen) b.classList.add(chosen === correct ? 'picked-ok' : 'picked-bad');
    if (k === correct && chosen !== correct) b.classList.add('was-right');
  });
}

let toastTimer = null;
export function toast(msg, ms = 2600) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

// ---- verdict panel -------------------------------------------------------------------------
export function dealerBars(t, up) {
  const rows = [['17', t[17]], ['18', t[18]], ['19', t[19]], ['20', t[20]], ['21', t[21]], ['Bust', t.bust]];
  const max = Math.max(...rows.map((r) => r[1]));
  return `<div class="bars">${rows.map(([k, v]) => `<div class="bar"><span class="lbl">${k}</span><span class="track"><span class="fill ${k === 'Bust' ? 'break' : ''}" style="width:${(v / max * 100).toFixed(1)}%"></span></span><span class="num">${pct(v, 1)}</span></div>`).join('')}</div>`;
}

// fb: result of feedback.explain(). Buttons are attached by the caller through the returned element.
export function renderVerdict(el, fb, { showCost = true, upcard, compact = false } = {}) {
  const ok = fb.isCorrect;
  const head = ok ? 'Correct' : fb.timeout ? `Time's up — ${ACTION_NAME[fb.correct]}` : `${ACTION_NAME[fb.correct]} — not ${ACTION_NAME[fb.chosen]}`;
  const rows = fb.lines.map((l) => `<tr class="${l.best ? 'best' : ''} ${l.mine && !ok ? 'mine wrong' : ''} ${l.legal ? '' : 'illegal'}"><td>${l.name}${l.best ? ' ✓' : ''}${l.mine && !ok ? ' (you)' : ''}${l.legal ? '' : ' — n/a'}</td><td class="num">${signed(l.ev, 1)}</td></tr>`).join('');
  const costLine = !ok && showCost && fb.cost > 0.00005
    ? `<p class="small">That choice costs <b class="bad">${usd100(fb.cost)}</b> per $100 wagered on this hand${fb.cost < 0.01 ? ' — a small leak' : fb.cost > 0.06 ? ' — a big one' : ''}.</p>` : '';
  el.innerHTML = `<div class="verdict ${ok ? 'ok' : 'bad'} ${compact ? '' : 'pop'}">
    <div class="head ${ok ? 'ok' : 'bad'}">${head}</div>
    <div class="reason">${esc(fb.reason)}</div>
    ${costLine}
    <table class="evtable">${rows}</table>
    <div class="small dim">Expected result per $1 bet, before any side bets.</div>
    <details class="why"><summary>Why? Dealer's ${upLabel(upcard)} — how it finishes</summary>${dealerBars(fb.dealer, upcard)}
      <p class="small dim">Hitting ${fb.soft ? 'a soft' : 'this'} ${fb.total} busts ${pct(fb.bustHit)} of the time. Standing wins ${pct(fb.stand.win)}, pushes ${pct(fb.stand.push)}, loses ${pct(fb.stand.lose)}.</p></details>
  </div>`;
}
