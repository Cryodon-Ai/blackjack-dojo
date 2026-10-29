// Video Poker in the Play tab. Three modes share one machine: Learn (lessons with exact answers),
// Practice (no risk, the coach grades every draw and can show the best hold), and Play (the machine
// with a credit meter and a session stop). Every pay and every coach number comes from engine/videopoker.js.
import { cardSVG, SUITS } from '../ui/cards.js';
import {
  TABLES, TABLE_ORDER, PAYTABLE_ORDER, HAND_NAME, shuffledDeck, keyOf, evaluateHolds, describeHold,
  freshHandValue, rankOf, suitOf,
} from '../engine/videopoker.js';
import { cue, deal as dealSound } from '../app/feel.js';

const START = 1000;       // starting credits for Practice and Play
const BET_MAX = 5;
const PLAY_STOP = 200;    // Play: the session stops once you are this far down
const EPS = 1e-9;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const back = (to, label) => `<div class="topbar"><a class="back" href="${to}">‹ ${label}</a></div>`;
const money = (x) => (Math.round(x * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
const signed = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + money(Math.abs(x));
const bitsOf = (held) => held.reduce((m, h, i) => (h ? m | (1 << i) : m), 0);

// Engine card (int) -> the card model ui/cards.js draws. Ten-valued faces keep their true label.
const artFor = (c) => {
  const r = rankOf(c);
  const label = r === 14 ? 'A' : r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : String(r);
  return { v: r === 14 ? 1 : Math.min(r, 10), label, suit: SUITS[suitOf(c)] };
};

// Profile slice for video poker. Created on first use, so older profiles load cleanly.
function stateOf(ctx) {
  const vp = (ctx.profile.videoPoker ||= {});
  vp.variant = TABLES[vp.variant] ? vp.variant : 'job96';
  vp.bet = vp.bet >= 1 && vp.bet <= BET_MAX ? vp.bet : BET_MAX;
  vp.practice ||= { credits: START, hands: 0, optimal: 0, lost: 0 };
  vp.play ||= { credits: START, hands: 0, net: 0, session: 0 };
  return vp;
}

export function videoPoker(el, parts, ctx) {
  const [sub, arg] = parts;
  if (sub === 'learn') return arg !== undefined ? lesson(el, ctx, Number(arg)) : lessons(el, ctx);
  if (sub === 'practice') return machine(el, ctx, 'practice');
  if (sub === 'play') return machine(el, ctx, 'play');
  return hub(el, ctx);
}

// ---- hub ------------------------------------------------------------------------------------------
function hub(el, ctx) {
  const vp = stateOf(ctx);
  const tiles = TABLE_ORDER.map((id) => {
    const t = TABLES[id];
    return `<button class="vpm-pick ${vp.variant === id ? 'on' : ''}" data-id="${id}">
      <span><b>${t.name} ${t.variant}</b><small>Returns ${t.ret} with perfect play</small></span><span class="vpm-check"></span></button>`;
  }).join('');
  el.innerHTML = `${back('#/play', 'Play')}<h1>Video Poker</h1>
    <p class="dim small" style="margin-top:0">Pick a pay table. Then learn it, practise it with a coach that grades every draw, or play it on the machine.</p>
    <h2>Pay table</h2>${tiles}
    <h2>Modes</h2>
    <a class="card link" href="#/play/video/learn"><h3>Learn</h3><div class="small dim">Hand rankings, reading a paytable, holding and drawing, and what a deal is worth. Each lesson ends with hands to play, graded exactly.</div></a>
    <a class="card link" href="#/play/video/practice"><h3>Practice</h3><div class="small dim">No risk. Pick your hold, then see the exact best hold and what your choice cost. Ask for the best hold before you draw.</div></a>
    <a class="card link" href="#/play/video/play"><h3>Play</h3><div class="small dim">The machine: credits, bet one, max bet, a win meter, and a session stop at −${PLAY_STOP} credits. No coach.</div></a>
    <div class="card"><b>Honest reminder.</b> Perfect play gets close to the published return and never above 100%. Credits here are practice chips, not money.</div>`;
  el.querySelectorAll('.vpm-pick').forEach((b) => b.onclick = async () => { vp.variant = b.dataset.id; await ctx.save(); hub(el, ctx); });
}

// ---- learn ----------------------------------------------------------------------------------------
const LESSONS = [
  {
    title: 'How a hand is ranked',
    body: (t) => `<p>Every hand is five cards from one 52-card deck. From best to worst, the hands on this table are:</p>
      <ol>${PAYTABLE_ORDER.filter((k) => t.coins[k] !== undefined).map((k) => `<li>${HAND_NAME[k]}</li>`).join('')}</ol>
      <p class="small dim">${t.name === 'Bonus Poker' ? 'Bonus Poker pays four of a kind by rank: four aces, four 2s to 4s, and four 5s to kings.' : 'A pair pays only when it is jacks, queens, kings or aces. A lower pair pays nothing.'}</p>`,
  },
  {
    title: 'Reading the paytable',
    body: (t) => `<p>The paytable gives coins for each coin you bet. A pay of 6 on a 5-coin bet returns 30 coins.</p>
      <p>This app pays the royal flush at 800 per coin at every bet size. Many real machines pay a royal at max bet only, so check the glass before you play one.</p>
      <div class="small dim">Table: ${t.name} ${t.variant}, returns ${t.ret} with perfect play at max bet.</div>`,
  },
  {
    title: 'Holding: pairs and made hands',
    body: () => `<p>Keep anything that already pays. Keep a pair of jacks or better, two pair, three of a kind, or a full house. A pair of tens or lower pays nothing on Jacks or Better, so it is kept only when the draw is worth more. The coach will tell you when that is.</p>
      <p>Try the hands below. The coach counts every possible draw, so the answer is exact.</p>`,
    exercise: true,
  },
  {
    title: 'Holding: draws to a flush or a straight',
    body: () => `<p>Four cards to a royal flush is the strongest draw you can make. Four to a straight flush and four to a flush are both worth holding, and the coach shows which one this table prefers.</p>
      <p>Try the hands below and compare your choice with the exact best hold.</p>`,
    exercise: true,
  },
  {
    title: 'What a fresh deal is worth',
    body: () => `<p>Suppose you skip the draw and simply keep the five cards you were dealt. Averaged over every possible deal, that returns the value shown below. Drawing is what lifts the return toward the published figure.</p>`,
    extra: (root, t) => {
      root.innerHTML = `<div class="card" id="fresh"><div class="small dim">Computing every possible deal…</div></div>`;
      setTimeout(() => {
        root.querySelector('#fresh').innerHTML = `<div class="small dim">${t.name} ${t.variant}, no draw</div><div class="big num">${freshHandValue(t.coins).toFixed(3)}</div><div class="small dim">coins returned per coin bet, exact over all 2,598,960 deals</div>`;
      }, 30);
    },
  },
  {
    title: 'Choosing a table',
    body: () => `<p>The published returns with perfect play at max bet are the best guide to a table:</p>
      <ul>
        ${TABLE_ORDER.map((id) => `<li><b>${TABLES[id].name} ${TABLES[id].variant}</b>: ${TABLES[id].ret}</li>`).join('')}
      </ul>
      <p>The 9/6 pays 9 for a full house and 6 for a flush, which is why it is the better table. Dropping to 8/5 costs about two points of return. Bonus Poker's four-of-a-kind pays make 8/5 worth more than 8/5 Jacks or Better.</p>
      <p class="small dim">Sources: <a href="https://www.lasvegasadvisor.com/gambling-with-an-edge/comparing-bonus-poker-with-super-aces-bonus-poker/">Las Vegas Advisor, comparing Bonus Poker</a> and <a href="https://www.deucescracked.com/blog/video-poker-strategy-paytables-rtp">Deuces Cracked, paytables and returns</a>.</p>`,
  },
];

function lessons(el, ctx) {
  el.innerHTML = `${back('#/play/video', 'Video Poker')}<h1>Learn</h1>
    <p class="dim small" style="margin-top:0">Short lessons, each with hands to play. The answers come from the same engine as the coach.</p>
    ${LESSONS.map((l, i) => `<a class="card link" href="#/play/video/learn/${i}"><div class="small dim">Lesson ${i + 1}</div><h3>${l.title}</h3></a>`).join('')}`;
}

function lesson(el, ctx, n) {
  const L = LESSONS[n];
  if (!L) return lessons(el, ctx);
  const vp = stateOf(ctx), t = TABLES[vp.variant];
  const prev = n > 0 ? `<a class="btn" href="#/play/video/learn/${n - 1}" style="text-decoration:none;display:flex;align-items:center;justify-content:center">‹ Previous</a>` : '<span></span>';
  const next = n < LESSONS.length - 1 ? `<a class="btn primary" href="#/play/video/learn/${n + 1}" style="text-decoration:none;display:flex;align-items:center;justify-content:center">Next ›</a>` : `<a class="btn primary" href="#/play/video/practice" style="text-decoration:none;display:flex;align-items:center;justify-content:center">Practise it</a>`;
  el.innerHTML = `${back('#/play/video/learn', 'Lessons')}<div class="small dim">Lesson ${n + 1} of ${LESSONS.length} · ${t.name} ${t.variant}</div><h1>${L.title}</h1>
    <div class="card lesson">${L.body(t)}</div><div id="extra"></div>
    <div class="row" style="gap:10px;margin-top:10px">${prev}${next}</div>`;
  const root = el.querySelector('#extra');
  if (L.extra) L.extra(root, t);
  if (L.exercise) exercise(root, t);
}

// Three random hands. Tap the cards to keep, check, and the coach shows the exact best hold.
function exercise(root, t) {
  const ex = { hand: [], held: [false, false, false, false, false], idx: 0, score: 0, checked: null };
  const next = () => { ex.hand = shuffledDeck().slice(0, 5); ex.held = [false, false, false, false, false]; ex.idx++; ex.checked = null; paint(); };
  const paint = () => {
    const cards = ex.hand.map((c, i) => `<button class="vpm-slot ex ${ex.held[i] ? 'held' : ''}" data-i="${i}" ${ex.checked ? 'disabled' : ''}><span class="vpm-light ${ex.held[i] ? 'on' : ''}">HOLD</span>${cardSVG(artFor(c))}</button>`).join('');
    let verdict = '';
    if (ex.checked) {
      const { best, evs, mask, ok } = ex.checked;
      verdict = `<div class="card ${ok ? 'ok' : 'bad'}"><b>${ok ? 'Right.' : 'Not the best hold.'}</b>
        <div class="small" style="margin-top:6px">Best: <b>${esc(describeHold(ex.hand, best))}</b> · ${evs[best].toFixed(3)} coins per coin</div>
        ${ok ? '' : `<div class="small" style="margin-top:4px">You: ${esc(describeHold(ex.hand, mask))} · ${evs[mask].toFixed(3)} coins per coin</div>`}</div>`;
    }
    const done = ex.idx >= 3 && ex.checked;
    const btn = done ? '' : ex.checked
      ? `<button class="btn primary block" id="next">Next hand</button>`
      : `<button class="btn primary block" id="check">Check my hold</button>`;
    root.innerHTML = `<div class="card"><div class="row"><b>Hand ${Math.min(ex.idx, 3)} of 3</b><div class="grow"></div><span class="small dim">Score ${ex.score}</span></div>
      <div class="vpm-hand">${cards}</div>
      ${verdict}
      <div style="margin-top:10px">${done ? `<div class="small">Finished: ${ex.score} of 3 right.</div>` : btn}</div></div>`;
    root.querySelectorAll('.vpm-slot.ex').forEach((b) => b.onclick = () => { ex.held[Number(b.dataset.i)] = !ex.held[Number(b.dataset.i)]; paint(); });
    root.querySelector('#check')?.addEventListener('click', () => {
      const bits = bitsOf(ex.held);
      const { best, evs } = evaluateHolds(ex.hand, t.coins);
      const ok = evs[best] - evs[bits] < EPS;
      ex.checked = { mask: bits, best, evs, ok };
      if (ok) ex.score++;
      cue(ok);
      paint();
    });
    root.querySelector('#next')?.addEventListener('click', next);
  };
  next();
}

// ---- the machine: Practice and Play --------------------------------------------------------------
function machine(el, ctx, mode) {
  const vp = stateOf(ctx), t = TABLES[vp.variant];
  const isPractice = mode === 'practice';
  const wallet = isPractice ? vp.practice : vp.play;
  const st = {
    phase: 'idle', hand: [], rest: [], held: [false, false, false, false, false], heldAtDraw: null,
    grade: null, hint: null, hintBusy: false, bet: vp.bet, win: 0, msg: '', busy: false,
  };
  let rollTimer = 0;
  const save = () => ctx.save();
  const stopped = () => !isPractice && wallet.session <= -PLAY_STOP;

  function paint(anim) {
    const live = st.phase === 'hold';
    const needsNew = stopped() || (!isPractice && wallet.credits < vp.bet);
    const cards = [0, 1, 2, 3, 4].map((i) => {
      const c = st.hand[i];
      const cls = anim === 'deal' ? 'deal' : anim === 'flip' && !st.heldAtDraw?.[i] ? 'flip' : '';
      const face = c === undefined ? cardSVG(null, { faceDown: true }) : cardSVG(artFor(c), { cls });
      const light = st.held[i] && live ? 'on' : st.hint !== null && live && (st.hint & (1 << i)) ? 'hint' : '';
      return `<button class="vpm-slot ${st.phase === 'done' && st.heldAtDraw?.[i] ? 'kept' : ''}" data-i="${i}" ${live ? '' : 'disabled'} style="--d:${i * 90}ms">
        <span class="vpm-light ${light}">${light === 'hint' ? 'BEST' : 'HOLD'}</span>${face}</button>`;
    }).join('');

    let main;
    if (needsNew && !isPractice) main = { id: 'new', label: 'NEW SESSION', cls: 'primary' };
    else if (st.phase === 'hold') main = { id: 'draw', label: 'DRAW', cls: 'primary' };
    else if (st.phase === 'checking') main = { id: 'wait', label: '…', cls: '' };
    else main = { id: 'deal', label: 'DEAL', cls: 'primary', disabled: !isPractice && wallet.credits < vp.bet };

    const win = st.grade && st.grade.won ? st.grade : null;
    const message = st.phase === 'idle'
      ? (stopped() ? `Session stop reached. You are down ${PLAY_STOP} credits.` : 'Press DEAL')
      : st.phase === 'hold' ? (st.hint !== null ? `Best hold: ${esc(describeHold(st.hand, st.hint))}` : 'Tap cards to HOLD, then DRAW')
      : st.phase === 'checking' ? 'Checking every possible draw…'
      : win ? `${esc(HAND_NAME[st.grade.key])} pays ${t.coins[st.grade.key]} × ${st.bet} = ${money(st.grade.won)}`
      : 'No winning hand';

    const hintBtn = isPractice ? `<button class="vpm-ghost" id="hint" ${st.phase !== 'hold' || st.hintBusy || st.hint !== null ? 'disabled' : ''}>${st.hintBusy ? 'Checking…' : 'Show best hold'}</button>` : '';
    const sessionLine = isPractice
      ? `<span>Practice</span><span class="num">${wallet.hands} hands</span>`
      : `<span>Session</span><span class="num ${wallet.session < 0 ? 'neg' : wallet.session > 0 ? 'pos' : ''}">${signed(wallet.session)}</span><span class="dim">stop at −${PLAY_STOP}</span>`;

    const paytable = `<div class="vpm-pays">
      <div class="vpm-pays-head"><span>${t.name} ${t.variant}</span><span>per coin</span><span>at ${vp.bet}</span></div>
      ${PAYTABLE_ORDER.filter((k) => t.coins[k] !== undefined).map((k) => `<div class="vpm-pay ${win && win.key === k ? 'hit' : ''}"><span>${HAND_NAME[k]}</span><span class="num">${t.coins[k]}</span><span class="num">${t.coins[k] * vp.bet}</span></div>`).join('')}
    </div>`;

    let feedback = '';
    if (isPractice && st.grade) {
      const g = st.grade;
      feedback = `<div class="card ${g.optimal ? 'ok' : 'bad'}"><b>${g.optimal ? 'Best hold' : 'Not the best hold'}</b>
        <div class="small" style="margin-top:6px">You: ${esc(describeHold(g.initial, g.mask))} · ${g.evs[g.mask].toFixed(3)} coins per coin</div>
        ${g.optimal ? '' : `<div class="small" style="margin-top:4px">Best: ${esc(describeHold(g.initial, g.best))} · ${g.evs[g.best].toFixed(3)} coins per coin</div>
        <div class="small" style="margin-top:6px">That choice costs about <b class="num">${money(g.cost)}</b> credits in the long run at this bet.</div>`}
        <div class="small dim" style="margin-top:6px">Exact: every possible draw is counted.</div></div>`;
    }
    const record = isPractice && wallet.hands
      ? `<div class="card"><b>Your record</b><div class="small dim" style="margin-top:6px">Hands ${wallet.hands} · best holds ${Math.round((wallet.optimal / wallet.hands) * 100)}%${wallet.lost ? ` · mistakes cost about ${money(wallet.lost)} credits` : ''}</div></div>` : '';

    el.innerHTML = `${back('#/play/video', 'Video Poker')}
      <div class="vpm-machine">
        <div class="vpm-marquee"><span>${t.name.toUpperCase()}</span><b>${t.variant}</b></div>
        <div class="vpm-screen">
          <div class="vpm-hand">${cards}</div>
          <div class="vpm-msg">${message}</div>
        </div>
        <div class="vpm-meters">
          <div><small>CREDITS</small><b class="num" id="credits">${money(wallet.credits)}</b></div>
          <div><small>BET</small><b class="num">${vp.bet}</b></div>
          <div><small>WIN</small><b class="num" id="win">${money(st.win)}</b></div>
        </div>
        <div class="vpm-buttons">
          <button class="vpm-btn" id="bet" ${st.phase === 'hold' || st.phase === 'checking' ? 'disabled' : ''}><small>BET ONE</small>${vp.bet}</button>
          <button class="vpm-btn" id="max" ${st.phase === 'hold' || st.phase === 'checking' ? 'disabled' : ''}><small>MAX BET</small>${BET_MAX}</button>
          <button class="vpm-btn main ${main.cls}" id="main" ${main.disabled ? 'disabled' : ''} data-act="${main.id}">${main.label}</button>
        </div>
      </div>
      <div class="vpm-status">${sessionLine}</div>
      ${hintBtn ? `<div style="margin:8px 0">${hintBtn}</div>` : ''}
      ${feedback}${paytable}${record}
      ${isPractice ? `<div class="small dim" style="margin-top:6px">Practice is free. Your coach grades every draw.</div>` : `<div class="small dim" style="margin-top:6px">Play has no coach. Your session stops at −${PLAY_STOP} credits. That rule is yours to keep.</div>`}`;
    bind();
  }

  function bind() {
    el.querySelectorAll('.vpm-slot[data-i]').forEach((b) => b.onclick = () => {
      if (st.phase !== 'hold') return;
      const i = Number(b.dataset.i);
      st.held[i] = !st.held[i];
      paint();
    });
    el.querySelector('#bet')?.addEventListener('click', async () => { vp.bet = (vp.bet % BET_MAX) + 1; await save(); paint(); });
    el.querySelector('#max')?.addEventListener('click', async () => { vp.bet = BET_MAX; await save(); paint(); });
    el.querySelector('#hint')?.addEventListener('click', hint);
    el.querySelector('#main')?.addEventListener('click', (e) => {
      const act = e.currentTarget.dataset.act;
      if (act === 'new') return newSession();
      if (act === 'draw') return draw();
      if (act === 'deal') return deal();
    });
  }

  async function newSession() {
    wallet.credits = START;
    if (!isPractice) wallet.session = 0;
    st.phase = 'idle'; st.hand = []; st.grade = null; st.win = 0;
    await save(); paint();
  }

  async function deal() {
    if (st.phase !== 'idle' && st.phase !== 'done') return;
    if (wallet.credits < vp.bet) {
      if (!isPractice) return;
      wallet.credits = START;
    }
    wallet.credits -= vp.bet;
    st.bet = vp.bet;
    const deck = shuffledDeck();
    st.hand = deck.slice(0, 5);
    st.rest = deck.slice(5);
    st.held = [false, false, false, false, false];
    st.heldAtDraw = null; st.grade = null; st.hint = null; st.win = 0;
    st.phase = 'hold';
    dealSound(5);
    await save();
    paint('deal');
  }

  function hint() {
    if (st.phase !== 'hold' || st.hintBusy) return;
    st.hintBusy = true;
    paint();
    setTimeout(() => {
      st.hint = evaluateHolds(st.hand, t.coins).best;
      st.hintBusy = false;
      paint();
    }, 30);
  }

  function draw() {
    if (st.phase !== 'hold') return;
    const initial = st.hand.slice(), held = st.held.slice(), bet = st.bet;
    st.phase = 'checking';
    paint();
    // Let the "checking" state paint before the exact values are computed (about 0.3 s).
    setTimeout(async () => {
      const mask = bitsOf(held);
      let grade = { mask, initial };
      if (isPractice) {
        const { best, evs } = evaluateHolds(initial, t.coins);
        grade = { ...grade, best, evs, optimal: evs[best] - evs[mask] < EPS, cost: (evs[best] - evs[mask]) * bet };
      }
      const hand = initial.slice();
      for (let i = 0; i < 5; i++) if (!held[i]) hand[i] = st.rest.shift();
      const key = keyOf(hand, t.coins);
      const won = (t.coins[key] || 0) * bet;
      grade.key = key;
      grade.won = won;
      st.hand = hand;
      st.heldAtDraw = held;
      st.grade = grade;
      st.phase = 'done';
      wallet.credits += won;
      wallet.hands += 1;
      if (isPractice) {
        if (grade.optimal) wallet.optimal = (wallet.optimal || 0) + 1;
        else wallet.lost = (wallet.lost || 0) + grade.cost;
      } else {
        wallet.net += won - bet;
        wallet.session += won - bet;
      }
      cue(won > 0 || grade.optimal);
      await save();
      paint('flip');
      rollUp(won);
    }, 30);
  }

  // Win meter counts up over half a second, like a machine's tally.
  function rollUp(won) {
    clearInterval(rollTimer);
    if (!won) return;
    const steps = 12;
    let k = 0;
    rollTimer = setInterval(() => {
      k++;
      st.win = Math.round((won * k) / steps * 100) / 100;
      const w = el.querySelector('#win');
      if (w) w.textContent = money(st.win);
      if (k >= steps) clearInterval(rollTimer);
    }, 40);
  }

  paint();
  return () => clearInterval(rollTimer);
}
