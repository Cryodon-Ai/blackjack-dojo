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
  let timer = null, stopped = false, audioStop = null;
  const stop = () => { stopped = true; clearTimeout(timer); if (audioStop) audioStop(); document.getElementById('app').classList.remove('focus'); };
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
      <div class="small dim">Conditions</div><div class="seg" id="md" style="margin:6px 0 4px"><button data-v="look" class="on">Quiet</button><button data-v="noise" title="casino noise + questions to answer">Distracted</button><button data-v="hear">Hear it</button></div>
      <p class="small dim" id="mdn" style="margin-top:0">Cards are shown on screen.</p>
      <button class="btn primary block" id="go">Start</button>`;
    el.querySelector('#x').onclick = (e) => { e.preventDefault(); hub(); };
    const NOTE = { look: 'Cards are shown on screen.', noise: 'Casino noise plays and the “dealer” or a “waitress” interrupts: tap the question within two seconds <i>without losing the count</i>.', hear: 'Cards are spoken aloud, not shown. Listen and count (turn the volume up; works with the phone locked to the screen).' };
    const pick = (id) => el.querySelectorAll(`#${id} button`).forEach((b) => b.onclick = () => { el.querySelectorAll(`#${id} button`).forEach((x) => x.classList.remove('on')); b.classList.add('on'); });
    pick('sp'); pick('nc'); pick('md');
    el.querySelectorAll('#md button').forEach((b) => b.addEventListener('click', () => { el.querySelector('#mdn').innerHTML = NOTE[b.dataset.v]; }));
    el.querySelector('#go').onclick = () => speed(Number(el.querySelector('#sp .on').dataset.v), Number(el.querySelector('#nc .on').dataset.v), el.querySelector('#md .on').dataset.v);
  }

  const QUESTIONS = ['“Hit or stand for you, sir?”', '“Can I get you a drink?”', '“What’s your name again?”', '“Whose turn is it?”', '“Is this seat taken?”', '“Colour up your chips?”'];
  function noiseStart() {   // low casino-ish murmur: filtered noise (Web Audio); silent if unsupported
    try {
      const A = new (window.AudioContext || window.webkitAudioContext)(), len = A.sampleRate * 2, buf = A.createBuffer(1, len, A.sampleRate), d = buf.getChannelData(0);
      let last = 0; for (let k = 0; k < len; k++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[k] = last * 3.5; }
      const src = A.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; const g = A.createGain(); g.gain.value = 0.35;
      src.connect(f); f.connect(g); g.connect(A.destination); src.start();
      return () => { try { src.stop(); A.close(); } catch { /* ignore */ } };
    } catch { return () => {}; }
  }
  const spoken = (c) => ({ A: 'ace', J: 'jack', Q: 'queen', K: 'king' }[c.label] || c.label);

  function speed(sec, count, mode = 'look') {
    const cards = freshDeck(2).slice(0, count);
    document.getElementById('app').classList.add('focus');
    let i = 0, run = 0, asked = 0, answered = 0, stopNoise = mode === 'noise' ? noiseStart() : () => {}, openQ = null;
    const endAudio = () => { stopNoise(); stopNoise = () => {}; try { speechSynthesis.cancel(); } catch { /* ignore */ } };
    audioStop = endAudio;
    const step = () => {
      if (stopped) return endAudio();
      if (i >= cards.length) { endAudio(); return finish(); }
      const c = cards[i++]; run += hiLo(c.v);
      let q = '';
      if (mode === 'noise' && i > 2 && Math.random() < 0.22) { asked++; openQ = asked; q = `<button class="btn" id="dq" style="display:block;margin:0 auto">${QUESTIONS[rnd(QUESTIONS.length)]} — tap to answer</button>`; }
      const face = mode === 'hear' ? '<div class="big" style="font-size:64px">🔊</div>' : cardSVG(c, { cls: 'deal' });
      el.innerHTML = `<div class="topbar"><span class="small dim num">${i}/${cards.length}</span></div><div style="display:flex;justify-content:center;margin:40px 0;height:150px;align-items:center">${face}</div>${q}`;
      if (mode === 'hear') { try { const u = new SpeechSynthesisUtterance(spoken(c)); u.rate = Math.min(2, 1.1 / Math.max(0.5, sec) + 0.4); speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { /* ignore */ } }
      const b = el.querySelector('#dq'); if (b) { const mine = openQ; b.onclick = () => { if (openQ === mine) { answered++; b.disabled = true; b.textContent = 'Answered'; } }; }
      timer = setTimeout(step, Math.max(sec, q ? 2 : sec) * 1000);
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
          el.innerHTML = `<h1 class="${ok ? 'ok' : 'bad'}">${ok ? 'Correct' : 'Off by ' + Math.abs(g - run)}</h1><p>The count was <b class="num">${sgn(run) || '0'}</b>${ok ? '' : `; you said <b class="num">${sgn(g) || '0'}</b>`}. ${count} cards at ${sec}s each.${asked ? ` Interruptions answered: <b>${answered}/${asked}</b>.` : ''}</p>
            <button class="btn primary block" id="again">Again</button><div class="gap"></div><button class="btn ghost block" id="back">Back</button>`;
          el.querySelector('#again').onclick = () => speed(sec, count, mode); el.querySelector('#back').onclick = hub;
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
