// Hi-Lo Count Trainer: card values, keeping a running count at speed, and true-count conversion.
// 2–6 = +1, 7–9 = 0, 10/J/Q/K/A = −1. A full deck always sums to 0 — that is the classic self-test.

import { cardSVG, makeCard, SUITS } from '../ui/cards.js';
import { hiLo } from '../app/shoe.js';
import { openSheet } from '../ui/sheet.js';

const rnd = (n) => Math.floor(Math.random() * n);
const sgn = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
const LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const rankOf = (l) => (l === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(l) ? 10 : Number(l));

const randCard = () => makeCard(rankOf(LABELS[rnd(13)]));

function freshDeck(n = 1) {
  const cards = [];
  for (let d = 0; d < n; d++) for (const suit of SUITS) for (const label of LABELS) cards.push({ v: rankOf(label), label, suit });
  for (let i = cards.length - 1; i > 0; i--) { const j = rnd(i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}

export function countTrainer(el, ctx) {
  let timer = null, stopped = false;
  const stop = () => { stopped = true; clearTimeout(timer); document.getElementById('app').classList.remove('focus'); };
  const best = () => (ctx.profile.bests = ctx.profile.bests || {});

  function hub() {
    document.getElementById('app').classList.remove('focus');
    const b = best();
    el.innerHTML = `<div class="topbar"><a class="back" href="#/play">‹ Play</a></div><h1>Count Trainer</h1>
      <p class="dim" style="margin-top:0">Hi-Lo counting. It will not make blackjack a winning game online, but it is the best way to understand what the shoe is doing, and the count shows up in the Live and Practice tables too.</p>
      <div class="card"><b>The values</b><div class="row" style="justify-content:space-around;margin-top:8px;text-align:center"><div><div class="big num ok">+1</div><div class="small dim">2 3 4 5 6</div></div><div><div class="big num">0</div><div class="small dim">7 8 9</div></div><div><div class="big num bad">−1</div><div class="small dim">10 J Q K A</div></div></div></div>
      <a class="card link" href="#" id="m1"><h3>1 · Card values</h3><div class="small dim">One card at a time: tap +1, 0 or −1. Gets you instant on the values.</div></a>
      <a class="card link" href="#" id="m2"><h3>2 · Speed count</h3><div class="small dim">Cards flash by; keep the count in your head; type it at the end. Best streak: <b>${b.countRun || 0}</b></div></a>
      <a class="card link" href="#" id="m3"><h3>3 · Deck run</h3><div class="small dim">All 52 cards, one by one. The count must finish at <b>0</b>. Best time: <b>${b.deckRun ? b.deckRun.toFixed(1) + ' s' : '—'}</b></div></a>
      <a class="card link" href="#" id="m4"><h3>4 · True count</h3><div class="small dim">Running count ÷ decks left. Quick conversion drills.</div></a>`;
    const go = (id, fn) => { el.querySelector(id).onclick = (e) => { e.preventDefault(); fn(); }; };
    go('#m1', values); go('#m2', speedSetup); go('#m3', deckRun); go('#m4', trueCount);
  }

  // ---- 1 · card values ---------------------------------------------------------------------
  function values() {
    let n = 0, ok = 0, streak = 0, card = null;
    const next = () => { card = randCard(); draw(); };
    const draw = (msg = '') => {
      el.innerHTML = `<div class="topbar"><a class="back" href="#" id="x">‹ Back</a><div class="grow"></div><span class="small dim num">${ok}/${n} · streak ${streak}</span></div>
        <div style="display:flex;justify-content:center;margin:24px 0;height:150px">${cardSVG(card, { cls: 'deal' })}</div>
        <div class="small" style="text-align:center;min-height:22px">${msg}</div>
        <div class="actionbar" style="grid-template-columns:repeat(3,1fr)"><button class="act" data-v="-1">−1</button><button class="act" data-v="0">0</button><button class="act" data-v="1">+1</button></div>`;
      el.querySelector('#x').onclick = (e) => { e.preventDefault(); hub(); };
      el.querySelectorAll('.act').forEach((b) => b.onclick = () => {
        const v = Number(b.dataset.v), right = v === hiLo(card.v);
        n++; if (right) { ok++; streak++; card = randCard(); draw(); }
        else { streak = 0; draw(`<span class="bad">${card.label} is ${sgn(hiLo(card.v))}</span> — try the next one`); setTimeout(() => { if (!stopped) { card = randCard(); draw(); } }, 900); }
      });
    };
    document.getElementById('app').classList.add('focus');
    next();
  }

  // ---- 2 · speed count ---------------------------------------------------------------------
  function speedSetup() {
    document.getElementById('app').classList.remove('focus');
    el.innerHTML = `<div class="topbar"><a class="back" href="#" id="x">‹ Back</a></div><h1>Speed count</h1>
      <div class="small dim">Speed (seconds per card)</div><div class="seg" id="sp" style="margin:6px 0 12px">${[1.5, 1, 0.7, 0.5].map((v, i) => `<button data-v="${v}" class="${i === 1 ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="small dim">Cards</div><div class="seg" id="nc" style="margin:6px 0 12px">${[15, 25, 40].map((v, i) => `<button data-v="${v}" class="${i === 1 ? 'on' : ''}">${v}</button>`).join('')}</div>
      <button class="btn primary block" id="go">Start</button>`;
    el.querySelector('#x').onclick = (e) => { e.preventDefault(); hub(); };
    const pick = (id) => el.querySelectorAll(`#${id} button`).forEach((b) => b.onclick = () => { el.querySelectorAll(`#${id} button`).forEach((x) => x.classList.remove('on')); b.classList.add('on'); });
    pick('sp'); pick('nc');
    el.querySelector('#go').onclick = () => speed(Number(el.querySelector('#sp .on').dataset.v), Number(el.querySelector('#nc .on').dataset.v));
  }

  function speed(sec, count) {
    const cards = freshDeck(2).slice(0, count);
    document.getElementById('app').classList.add('focus');
    let i = 0, run = 0;
    const step = () => {
      if (stopped) return;
      if (i >= cards.length) return finish();
      const c = cards[i++]; run += hiLo(c.v);
      el.innerHTML = `<div class="topbar"><span class="small dim num">${i}/${cards.length}</span></div><div style="display:flex;justify-content:center;margin:40px 0;height:150px">${cardSVG(c, { cls: 'deal' })}</div>`;
      timer = setTimeout(step, sec * 1000);
    };
    const finish = () => {
      let g = 0;
      const draw = () => {
        el.innerHTML = `<h2 style="text-align:center">What's the count?</h2><div class="row" style="justify-content:center;gap:14px;align-items:center;margin:20px 0"><button class="btn" id="m">−</button><div class="big num" style="min-width:80px;text-align:center">${sgn(g) || '0'}</div><button class="btn" id="p">+</button></div><button class="btn primary block" id="ok">Check</button>`;
        el.querySelector('#m').onclick = () => { g--; draw(); }; el.querySelector('#p').onclick = () => { g++; draw(); };
        el.querySelector('#ok').onclick = () => {
          const ok = g === run, b = best();
          b.countRunCur = ok ? (b.countRunCur || 0) + 1 : 0; b.countRun = Math.max(b.countRun || 0, b.countRunCur); ctx.save();
          document.getElementById('app').classList.remove('focus');
          el.innerHTML = `<h1 class="${ok ? 'ok' : 'bad'}">${ok ? 'Correct' : 'Off by ' + Math.abs(g - run)}</h1><p>The count was <b class="num">${sgn(run) || '0'}</b>${ok ? '' : `; you said <b class="num">${sgn(g) || '0'}</b>`}. ${count} cards at ${sec}s each.</p>
            <button class="btn primary block" id="again">Again</button><div class="gap"></div><button class="btn ghost block" id="back">Back</button>`;
          el.querySelector('#again').onclick = () => speed(sec, count); el.querySelector('#back').onclick = hub;
        };
      };
      draw();
    };
    // 3-2-1 lead-in
    el.innerHTML = `<h1 style="text-align:center;margin-top:60px">Ready…</h1>`;
    timer = setTimeout(step, 900);
  }

  // ---- 3 · deck run ------------------------------------------------------------------------
  function deckRun() {
    const cards = freshDeck(1);
    document.getElementById('app').classList.add('focus');
    let i = 0, t0 = 0, run = 0;
    const draw = () => {
      if (stopped) return;
      if (i >= cards.length) return done();
      const c = cards[i];
      el.innerHTML = `<div class="topbar"><a class="back" href="#" id="x">‹ Quit</a><div class="grow"></div><span class="small dim num">${i + 1}/52</span></div>
        <div style="display:flex;justify-content:center;margin:40px 0;height:150px">${cardSVG(c, { cls: 'deal' })}</div>
        <div class="actionbar" style="grid-template-columns:1fr"><button class="btn primary" id="nx">${i === 0 ? 'Start the clock' : 'Next card'}</button></div>`;
      el.querySelector('#x').onclick = (e) => { e.preventDefault(); hub(); };
      el.querySelector('#nx').onclick = () => { if (i === 0) t0 = performance.now(); run += hiLo(c.v); i++; draw(); };
    };
    const done = () => {
      const secs = (performance.now() - t0) / 1000;
      let g = 0;
      const ask = () => {
        el.innerHTML = `<h2 style="text-align:center">Final count?</h2><div class="small dim" style="text-align:center">${secs.toFixed(1)} s for 52 cards</div><div class="row" style="justify-content:center;gap:14px;align-items:center;margin:20px 0"><button class="btn" id="m">−</button><div class="big num" style="min-width:80px;text-align:center">${sgn(g) || '0'}</div><button class="btn" id="p">+</button></div><button class="btn primary block" id="ok">Check</button>`;
        el.querySelector('#m').onclick = () => { g--; ask(); }; el.querySelector('#p').onclick = () => { g++; ask(); };
        el.querySelector('#ok').onclick = () => {
          const ok = g === 0, b = best();
          if (ok && (!b.deckRun || secs < b.deckRun)) { b.deckRun = secs; ctx.save(); }
          document.getElementById('app').classList.remove('focus');
          el.innerHTML = `<h1 class="${ok ? 'ok' : 'bad'}">${ok ? 'Perfect — 0' : 'Not zero'}</h1><p>A full deck always counts to 0. ${ok ? `${secs.toFixed(1)} s. Under 30 s is a strong pace.` : 'You said ' + (sgn(g) || '0') + ' — a card was misread. Try again slower.'}</p>
            <button class="btn primary block" id="again">Again</button><div class="gap"></div><button class="btn ghost block" id="back">Back</button>`;
          el.querySelector('#again').onclick = deckRun; el.querySelector('#back').onclick = hub;
        };
      };
      ask();
    };
    draw();
  }

  // ---- 4 · true count ----------------------------------------------------------------------
  function trueCount() {
    let n = 0, ok = 0, q = null;
    const make = () => { const decks = [1, 1.5, 2, 2.5, 3, 4, 5][rnd(7)]; const rc = rnd(25) - 8; q = { decks, rc, tc: Math.round(rc / decks) }; };
    const draw = (msg = '') => {
      const opts = new Set([q.tc]); while (opts.size < 4) opts.add(q.tc + rnd(7) - 3);
      const arr = [...opts].sort((a, b) => a - b);
      el.innerHTML = `<div class="topbar"><a class="back" href="#" id="x">‹ Back</a><div class="grow"></div><span class="small dim num">${ok}/${n}</span></div>
        <div class="card"><div class="small dim">Running count</div><div class="big num">${sgn(q.rc) || '0'}</div><div class="small dim" style="margin-top:6px">Decks left</div><div class="big num">${q.decks}</div></div>
        <p style="text-align:center">True count (rounded)?</p><div class="small" style="text-align:center;min-height:22px">${msg}</div>
        <div class="actionbar" style="grid-template-columns:repeat(4,1fr)">${arr.map((v) => `<button class="act" data-v="${v}">${sgn(v) || '0'}</button>`).join('')}</div>`;
      el.querySelector('#x').onclick = (e) => { e.preventDefault(); hub(); };
      el.querySelectorAll('.act').forEach((b) => b.onclick = () => {
        n++; const right = Number(b.dataset.v) === q.tc; if (right) ok++;
        const msg2 = right ? '<span class="ok">Right</span>' : `<span class="bad">${sgn(q.rc)} ÷ ${q.decks} = ${(q.rc / q.decks).toFixed(1)} → ${sgn(q.tc) || '0'}</span>`;
        setTimeout(() => { if (!stopped) { make(); draw(); } }, right ? 250 : 1400);
        el.querySelectorAll('.act').forEach((x) => { x.disabled = true; });
        el.querySelector('.small[style*="min-height"]').innerHTML = msg2;
      });
    };
    make(); draw();
  }

  hub();
  return stop;
}
