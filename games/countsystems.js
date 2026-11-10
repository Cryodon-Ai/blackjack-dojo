// Other counting systems, the ace side count, and the deck-estimation trainer.
//   systems  : card values and a deck run for Hi-Lo, KO, Hi-Opt I, Zen, Omega II, Wong Halves
//   aces     : an ace side count on top of Hi-Lo
//   decks    : estimate how many decks are left from the discard tray

import { cardSVG, makeCard, SUITS } from '../ui/cards.js';
import { say } from '../app/voice.js';
import { rec } from '../app/weak.js';

const LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const rnd = (n) => Math.floor(Math.random() * n);
const rankOf = (l) => (l === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(l) ? 10 : Number(l));
const sgn = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
const back = (to = '#/play/counting', label = 'Counting Pro') => `<div class="topbar"><a class="back" href="${to}">‹ ${label}</a></div>`;

// values by engine rank (1 = ace, 10 = any ten-valued card)
export const SYSTEMS = {
  hilo: { name: 'Hi-Lo', balanced: true, v: [0, -1, 1, 1, 1, 1, 1, 0, 0, 0, -1], note: 'The standard. Easy to learn, very good for the effort.' },
  hiopt1: { name: 'Hi-Opt I', balanced: true, v: [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, -1], note: 'Aces are neutral (use with an ace side count). Slightly better for betting, slightly worse for playing.' },
  ko: { name: 'KO (Knockout)', balanced: false, v: [0, -1, 1, 1, 1, 1, 1, 1, 0, 0, -1], note: 'Unbalanced: a deck sums to +4, so you never convert to a true count. Start at the initial running count (IRC) instead.' },
  zen: { name: 'Zen', balanced: true, v: [0, -1, 1, 1, 2, 2, 2, 1, 0, 0, -2], note: 'Level 2: more accurate than Hi-Lo, harder to keep at speed.' },
  omega2: { name: 'Omega II', balanced: true, v: [0, 0, 1, 1, 2, 2, 2, 1, 0, -1, -2], note: 'Level 2; aces neutral. Highest betting accuracy of the common systems, and a side count of aces is advised for insurance.' },
  halves: { name: 'Wong Halves', balanced: true, v: [0, -1, 0.5, 1, 1, 1.5, 1, 0.5, 0, -0.5, -1], note: 'Level 3 with half-points: very accurate and the hardest to count at speed.' },
};
const val = (sys, rank) => SYSTEMS[sys].v[rank];
const fmt = (x) => (Number.isInteger(x) ? sgn(x) || '0' : sgn(x));
export const deckSum = (sys) => { let s = 0; for (let r = 1; r <= 10; r++) s += SYSTEMS[sys].v[r] * (r === 10 ? 16 : 4); return s; };

function freshDeck(n = 1) {
  const cards = [];
  for (let d = 0; d < n; d++) for (const suit of SUITS) for (const label of LABELS) cards.push({ v: rankOf(label), label, suit });
  for (let i = cards.length - 1; i > 0; i--) { const j = rnd(i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}

export function countSystems(el, ctx, mode = 'systems') {
  if (mode === 'decks') return deckEstimate(el, ctx);
  if (mode === 'aces') return aceCount(el, ctx);
  let stopped = false, sys = (ctx.profile.counting ||= {}).sys || 'hilo';
  const stop = () => { stopped = true; document.getElementById('app').classList.remove('focus'); };

  function hub() {
    document.getElementById('app').classList.remove('focus');
    const S = SYSTEMS[sys], ds = deckSum(sys);
    el.innerHTML = `${back()}<h1>Counting systems</h1>
      <p class="dim small" style="margin-top:0">Hi-Lo is the standard and the best place to start. Other systems trade ease for accuracy. Pick one and learn its values.</p>
      <div class="seg" id="s" style="flex-wrap:wrap;margin:6px 0 10px">${Object.entries(SYSTEMS).map(([k, v]) => `<button data-v="${k}" class="${sys === k ? 'on' : ''}">${v.name}</button>`).join('')}</div>
      <div class="card"><b>${S.name}</b> <span class="pill ${S.balanced ? '' : 'due'}">${S.balanced ? 'balanced' : 'unbalanced'}</span><div class="small dim" style="margin:4px 0 8px">${S.note}</div>
        <table class="evtable" style="text-align:center;font-size:13px"><tr>${['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((l) => `<td class="dim">${l}</td>`).join('')}</tr><tr>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => `<td class="num ${S.v[r] > 0 ? 'ok' : S.v[r] < 0 ? 'bad' : ''}"><b>${fmt(S.v[r])}</b></td>`).join('')}</tr></table>
        <div class="small dim" style="margin-top:6px">A full deck sums to <b class="num">${fmt(ds)}</b>${S.balanced ? ': the self-test for your deck run.' : `: unbalanced, so each deck adds ${fmt(ds)}. ${sys === 'ko' ? 'Initial running count = 4 − 4 × decks (−20 for six decks); the “pivot” where you raise bets is +4.' : ''}`}</div></div>
      <button class="btn primary block" id="v">Card-value flash cards</button><div class="gap"></div><button class="btn block" id="d">Full-deck run</button>${S.balanced ? '' : '<p class="small dim">The deck run for an unbalanced system should end at ' + fmt(ds) + '.</p>'}`;
    el.querySelectorAll('#s button').forEach((b) => b.onclick = () => { sys = b.dataset.v; ctx.profile.counting.sys = sys; ctx.save(); hub(); });
    el.querySelector('#v').onclick = flash; el.querySelector('#d').onclick = deckRun;
  }

  function flash() {
    let n = 0, ok = 0, streak = 0, card = null, busy = false;
    const next = () => { card = makeCard(rankOf(LABELS[rnd(13)])); busy = false; draw(); };
    const vals = [...new Set([...Array(10)].map((_, i) => val(sys, i + 1)))].sort((a, b) => a - b);
    const draw = (msg = '') => {
      el.innerHTML = `<div class="topbar"><a class="back" href="#" id="x">‹ ${SYSTEMS[sys].name}</a><div class="grow"></div><span class="small dim num">${ok}/${n} · streak ${streak}</span></div>
        <div style="display:flex;justify-content:center;margin:24px 0;height:150px">${cardSVG(card, { cls: 'deal' })}</div><div class="small" style="text-align:center;min-height:22px">${msg}</div>
        <div class="actionbar" style="grid-template-columns:repeat(${vals.length},1fr)">${vals.map((v) => `<button class="act" data-v="${v}">${fmt(v)}</button>`).join('')}</div>`;
      el.querySelector('#x').onclick = (e) => { e.preventDefault(); hub(); };
      el.querySelectorAll('.act').forEach((b) => b.onclick = () => {
        if (busy) return; busy = true;
        const right = Number(b.dataset.v) === val(sys, card.v); n++; if (right) { ok++; streak++; } else streak = 0;
        rec(ctx, 'count:values:' + sys, card.label, right);
        if (right) next(); else { draw(`<span class="bad">${card.label} is ${fmt(val(sys, card.v))}</span>`); setTimeout(() => { if (!stopped && el.isConnected) next(); }, 1000); }
      });
    };
    document.getElementById('app').classList.add('focus'); next();
  }

  function deckRun() {
    const cards = freshDeck(1); document.getElementById('app').classList.add('focus');
    let i = 0, t0 = 0, run = 0;
    const draw = () => {
      if (stopped) return;
      if (i >= cards.length) return ask();
      const c = cards[i];
      el.innerHTML = `<div class="topbar"><a class="back" href="#" id="x">‹ Quit</a><div class="grow"></div><span class="small dim num">${i + 1}/52</span></div><div style="display:flex;justify-content:center;margin:40px 0;height:150px">${cardSVG(c, { cls: 'deal' })}</div><div class="actionbar" style="grid-template-columns:1fr"><button class="btn primary" id="nx">${i === 0 ? 'Start the clock' : 'Next card'}</button></div>`;
      el.querySelector('#x').onclick = (e) => { e.preventDefault(); hub(); };
      el.querySelector('#nx').onclick = () => { if (i === 0) t0 = performance.now(); run += val(sys, c.v); i++; draw(); };
    };
    const ask = () => {
      const secs = (performance.now() - t0) / 1000, want = deckSum(sys); let g = 0; const step = SYSTEMS[sys].v.some((x) => x % 1) ? 0.5 : 1;
      const render = () => {
        el.innerHTML = `<h2 style="text-align:center">Final count?</h2><div class="small dim" style="text-align:center">${secs.toFixed(1)} s · ${SYSTEMS[sys].name}</div><div class="row" style="justify-content:center;gap:14px;align-items:center;margin:20px 0"><button class="btn" id="m">−</button><div class="big num" style="min-width:80px;text-align:center">${fmt(g)}</div><button class="btn" id="p">+</button></div><button class="btn primary block" id="ok">Check</button>`;
        el.querySelector('#m').onclick = () => { g -= step; render(); }; el.querySelector('#p').onclick = () => { g += step; render(); };
        el.querySelector('#ok').onclick = () => {
          document.getElementById('app').classList.remove('focus'); const good = Math.abs(g - want) < 1e-9; rec(ctx, 'count:deckrun:' + sys, 'deck', good);
          el.innerHTML = `<h1 class="${good ? 'ok' : 'bad'}">${good ? 'Perfect' : 'Not ' + fmt(want)}</h1><p>${good ? `${secs.toFixed(1)} s.` : `A deck counts to ${fmt(want)} in ${SYSTEMS[sys].name}; you said ${fmt(g)}. Slow down and try again.`}</p><button class="btn primary block" id="again">Again</button><div class="gap"></div><button class="btn ghost block" id="bk">Back</button>`;
          el.querySelector('#again').onclick = deckRun; el.querySelector('#bk').onclick = hub;
        };
      };
      render();
    };
    draw();
  }
  hub();
  return stop;
}

// ---- ace side count ------------------------------------------------------------------------------------------------------
function aceCount(el, ctx) {
  let stopped = false, timer = null;
  const stop = () => { stopped = true; clearTimeout(timer); document.getElementById('app').classList.remove('focus'); };
  function setup() {
    document.getElementById('app').classList.remove('focus');
    el.innerHTML = `${back()}<h1>Ace side count</h1>
      <p class="dim small" style="margin-top:0">Hi-Lo counts aces as −1, but an ace is worth more to the player than a ten (blackjack, doubling soft hands) so a count that treats them as ordinary is slightly off. The fix: <b>keep a separate count of aces</b>. If more aces than expected are gone, the remaining shoe is ace-poor; fewer gone means ace-rich. Expected aces gone = 4 × decks dealt.</p>
      <div class="card small"><b>How it is used</b><br>Ace-rich (a surplus of aces left): bet a little more and take insurance more readily. Ace-poor: bet less. A common rule is to adjust the true count by about ±1 for each 2 aces above/below the expected number per deck left. It matters most for betting, and for insurance with Omega II or Hi-Opt I, where aces are not counted.</div>
      <button class="btn primary block" id="go">Run 52 cards (1 deck): count aces and Hi-Lo</button>`;
    el.querySelector('#go').onclick = run;
  }
  function run() {
    const cards = freshDeck(2).slice(0, 52 + rnd(40)), seenAces = cards.filter((c) => c.v === 1).length;
    document.getElementById('app').classList.add('focus');
    let i = 0;
    const step = () => {
      if (stopped) return;
      if (i >= cards.length) return ask();
      el.innerHTML = `<div class="topbar"><span class="small dim num">${i + 1}/${cards.length}</span></div><div style="display:flex;justify-content:center;margin:40px 0;height:150px">${cardSVG(cards[i], { cls: 'deal' })}</div>`;
      i++; timer = setTimeout(step, 700);
    };
    el.innerHTML = '<h1 style="text-align:center;margin-top:60px">Ready…</h1>'; timer = setTimeout(step, 800);
    function ask() {
      let g = 0;
      const dr = () => {
        el.innerHTML = `<h2 style="text-align:center">How many aces went by?</h2><div class="row" style="justify-content:center;gap:14px;align-items:center;margin:20px 0"><button class="btn" id="m">−</button><div class="big num" style="min-width:80px;text-align:center">${g}</div><button class="btn" id="p">+</button></div><button class="btn primary block" id="ok">Check</button>`;
        el.querySelector('#m').onclick = () => { g = Math.max(0, g - 1); dr(); }; el.querySelector('#p').onclick = () => { g++; dr(); };
        el.querySelector('#ok').onclick = () => {
          document.getElementById('app').classList.remove('focus');
          const exp = 4 * cards.length / 52, diff = seenAces - exp, right = g === seenAces; rec(ctx, 'count:aces', 'ace count', right);
          el.innerHTML = `<h1 class="${right ? 'ok' : 'bad'}">${right ? 'Correct' : 'Actually ' + seenAces}</h1><p>${cards.length} cards were dealt: expected ${exp.toFixed(1)} aces, saw ${seenAces}. The remaining shoe is <b>${diff > 1 ? 'ace-poor' : diff < -1 ? 'ace-rich' : 'about average'}</b> (${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}).</p><button class="btn primary block" id="again">Again</button><div class="gap"></div><a class="btn ghost block" style="display:block;text-align:center;text-decoration:none" href="#/play/counting">Back</a>`;
          el.querySelector('#again').onclick = run;
        };
      };
      dr();
    }
  }
  setup();
  return stop;
}

// ---- deck estimation -------------------------------------------------------------------------------------------------------
// A discard tray drawn as a stack: height is proportional to cards dealt. One deck is one bar-height.
function deckEstimate(el, ctx) {
  let n = 0, ok = 0, tot = 0, q = null, busy = false;
  const next = () => {
    busy = false;
    const total = pick([6, 6, 8, 2, 4]), left = Math.max(0.5, Math.round((0.5 + Math.random() * (total - 0.5)) * 2) / 2);
    q = { total, left, dealt: total - left };
    const W = 300, H = 120, perDeck = H / 8 * 1.0, discH = q.dealt * perDeck, shoeH = q.left * perDeck;
    const marks = (h, col) => Array.from({ length: Math.floor(h / perDeck) + 1 }, (_, i) => `<line x1="0" x2="${W / 2 - 14}" y1="${(H - i * perDeck).toFixed(1)}" y2="${(H - i * perDeck).toFixed(1)}" stroke="${col}" stroke-width=".5" opacity=".6"/>`).join('');
    const opts = [...new Set([q.left, q.left + 0.5, q.left - 0.5, q.left + 1, q.left - 1, q.left + 1.5].filter((x) => x >= 0.5))].sort(() => Math.random() - 0.5).slice(0, 4).sort((a, b) => a - b);
    if (!opts.includes(q.left)) opts[0] = q.left;
    el.innerHTML = `<div class="topbar"><a class="back" href="#/play/counting">‹ Counting Pro</a><div class="grow"></div><span class="small dim num">${ok}/${n}${n ? ' · avg error ' + (tot / n).toFixed(2) + ' decks' : ''}</span></div><h1>How many decks are left?</h1>
      <p class="dim small" style="margin-top:0">A ${q.total}-deck shoe. The discard tray holds the cards already dealt; each grid line is one deck's worth of height. Estimate the decks still in the shoe to the nearest half deck.</p>
      <svg viewBox="0 0 ${W} ${H + 24}" style="width:100%;max-width:340px;display:block;margin:0 auto"><g transform="translate(0 0)"><rect x="0" y="${H - discH}" width="${W / 2 - 14}" height="${discH}" fill="#3b6ea8" opacity=".85"/>${marks(discH, '#fff')}<text x="${(W / 2 - 14) / 2}" y="${H + 16}" text-anchor="middle" font-size="11" fill="#9aa">Discard tray</text></g>
        <g transform="translate(${W / 2 + 14} 0)"><rect x="0" y="0" width="${W / 2 - 14}" height="${H}" fill="none" stroke="#555" stroke-dasharray="3 3"/><text x="${(W / 2 - 14) / 2}" y="${H + 16}" text-anchor="middle" font-size="11" fill="#9aa">Reference: one deck = one line</text><rect x="${(W / 2 - 14) / 2 - 14}" y="${H - perDeck}" width="28" height="${perDeck}" fill="#c9a24a" opacity=".85"/></g></svg>
      <div id="fb" style="min-height:48px;text-align:center"></div>
      <div class="actionbar" style="grid-template-columns:repeat(${opts.length},1fr)">${opts.map((o) => `<button class="act" data-v="${o}">${o}</button>`).join('')}</div>`;
    el.querySelectorAll('.act').forEach((b) => b.onclick = () => {
      if (busy) return; busy = true;
      const v = Number(b.dataset.v), err = Math.abs(v - q.left), right = err < 1e-9; n++; tot += err; if (right) ok++;
      rec(ctx, 'count:decks', q.total + 'D', err <= 0.5);
      el.querySelectorAll('.act').forEach((x) => { x.disabled = true; if (Number(x.dataset.v) === q.left) x.classList.add('was-right'); else if (x === b) x.classList.add('picked-bad'); });
      el.querySelector('#fb').innerHTML = `<div class="small ${right ? 'ok' : 'bad'}">${right ? 'Exactly' : `Off by ${err} deck${err === 1 ? '' : 's'}`}: ${q.dealt} decks dealt of ${q.total}, so <b>${q.left}</b> left. Cards left: ${Math.round(q.left * 52)}.</div>`;
      setTimeout(() => { if (el.isConnected) next(); }, right ? 900 : 2200);
    });
  };
  next();
  return () => { busy = true; };
}
const pick = (a) => a[rnd(a.length)];
