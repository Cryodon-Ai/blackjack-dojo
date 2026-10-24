// Shoe controls shared by the Live Table, Gravity Blackjack and Practice Table.

import { openSheet } from './sheet.js';
import { toast } from './hand.js';
import { shoeStatus, DEFAULT_SHOE } from '../app/shoe.js';

export const shoeSettings = (profile) => (profile.settings.shoe = { ...DEFAULT_SHOE, ...(profile.settings.shoe || {}) });

const sgn = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
const PENS = [0.5, 0.65, 0.75, 0.85];

// Line for the HUD: shoe size left, cut card, and (optionally) the Hi-Lo running count.
export function shoeLine(shoe, profile) {
  const cfg = shoeSettings(profile);
  const cnt = cfg.count === 'show' ? ` · count <b class="num">${sgn(shoe.seenCount)}</b> <span class="dim">(true ${sgn(+shoe.trueCount.toFixed(1))})</span>` : '';
  return `${shoeStatus(shoe)}${cnt}`;
}

// Between-hands housekeeping. Returns true when the shoe was reshuffled.
export function prepareShoe(shoe, profile) {
  const cfg = shoeSettings(profile);
  shoe.pen = cfg.pen; shoe.mode = cfg.mode;
  const fresh = shoe.prepare();
  if (fresh && cfg.mode === 'shoe' && shoe.shuffleCount > 1) toast('Cut card reached — new shoe shuffled.', 2200);
  return fresh;
}

// In-play sheet. Deck count lives in the rules (it changes the strategy), so it is shown, not edited, here.
export function openShoeSheet(ctx, shoe, { onChange } = {}) {
  const cfg = shoeSettings(ctx.profile);
  const sh = openSheet('<div id="ss"></div>');
  const root = sh.el.querySelector('#ss');
  const save = async () => { shoe.pen = cfg.pen; shoe.mode = cfg.mode; await ctx.save(); if (onChange) onChange(); draw(); };
  function draw() {
    root.innerHTML = `<h3>Shoe</h3>
      <p class="small dim" style="margin-top:0">${shoe.decks} deck${shoe.decks === 1 ? '' : 's'} · ${shoeStatus(shoe)}. Change the deck count under the table rules.</p>
      <div class="small dim">How it reshuffles</div>
      <div class="seg" id="mode" style="margin:6px 0 10px"><button data-v="shoe" class="${cfg.mode === 'shoe' ? 'on' : ''}">Live shoe (cut card)</button><button data-v="rng" class="${cfg.mode === 'rng' ? 'on' : ''}">Every hand</button></div>
      <div class="small dim">Cut card — reshuffle after this much of the shoe is dealt</div>
      <div class="seg" id="pen" style="margin:6px 0 10px">${PENS.map((p) => `<button data-v="${p}" class="${cfg.pen === p ? 'on' : ''}" ${cfg.mode === 'rng' ? 'disabled' : ''}>${Math.round(p * 100)}%</button>`).join('')}</div>
      <div class="small dim">Hi-Lo count</div>
      <div class="seg" id="cnt" style="margin:6px 0 10px"><button data-v="off" class="${cfg.count === 'off' ? 'on' : ''}">Hidden</button><button data-v="show" class="${cfg.count === 'show' ? 'on' : ''}">Show it</button><button data-v="quiz" class="${cfg.count === 'quiz' ? 'on' : ''}">Quiz me</button></div>
      <button class="btn block" id="rs">Reshuffle now</button><div class="gap"></div><button class="btn block ghost" id="x">Done</button>`;
    root.querySelectorAll('#mode button').forEach((b) => b.onclick = () => { cfg.mode = b.dataset.v; save(); });
    root.querySelectorAll('#pen button').forEach((b) => b.onclick = () => { cfg.pen = Number(b.dataset.v); save(); });
    root.querySelectorAll('#cnt button').forEach((b) => b.onclick = () => { cfg.count = b.dataset.v; save(); });
    root.querySelector('#rs').onclick = () => { shoe.shuffle(); toast('Shoe reshuffled.', 1600); if (onChange) onChange(); draw(); };
    root.querySelector('#x').onclick = sh.close;
  }
  draw();
}

// "What's the running count?" — returns { guess, actual, ok }.
export function askCount(shoe, stats) {
  return new Promise((resolve) => {
    let g = 0;
    const sh = openSheet('<div id="qc"></div>', { onClose: () => resolve(null) });
    const root = sh.el.querySelector('#qc');
    const draw = () => {
      root.innerHTML = `<h3>Count check</h3><p class="dim" style="margin-top:0">Hi-Lo running count of every card you've seen since the shuffle (2–6 = +1, 7–9 = 0, 10/A = −1).</p>
        <div class="row" style="justify-content:center;gap:14px;align-items:center;margin:12px 0"><button class="btn" id="m">−</button><div class="big num" style="min-width:70px;text-align:center">${g > 0 ? '+' : g < 0 ? '−' : ''}${Math.abs(g)}</div><button class="btn" id="p">+</button></div>
        <button class="btn primary block" id="ok">Check</button><div class="gap"></div><button class="btn ghost block" id="skip">Skip</button>`;
      root.querySelector('#m').onclick = () => { g--; draw(); };
      root.querySelector('#p').onclick = () => { g++; draw(); };
      root.querySelector('#skip').onclick = () => { sh.el.closest('.scrim').remove(); resolve(null); };
      root.querySelector('#ok').onclick = () => {
        const actual = shoe.seenCount, ok = g === actual;
        if (stats) { stats.asked++; if (ok) stats.right++; }
        root.innerHTML = `<h3 class="${ok ? 'ok' : 'bad'}">${ok ? 'Correct' : `Count was ${actual > 0 ? '+' : actual < 0 ? '−' : ''}${Math.abs(actual)}`}</h3>
          <p class="dim">True count ${(shoe.trueCount >= 0 ? '+' : '−') + Math.abs(shoe.trueCount).toFixed(1)} with ${shoe.decksLeft.toFixed(1)} decks left.</p><button class="btn primary block" id="go">Keep playing</button>`;
        root.querySelector('#go').onclick = () => { sh.el.closest('.scrim').remove(); resolve({ guess: g, actual, ok }); };
      };
    };
    draw();
  });
}
