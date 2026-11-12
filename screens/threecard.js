// Three Card Poker: learn, drills, a practice table and what it costs.
//   #/play/threecard            hub
//   #/play/threecard/learn      rules, rankings, pay tables, the Q-6-4 rule
//   #/play/threecard/drill      play or fold? (graded with the exact EV of every hand)
//   #/play/threecard/rank       who wins? (rankings and the dealer qualifier)
//   #/play/threecard/table      practice table with a bankroll, Ante/Play and Pair Plus
//   #/play/threecard/cost       what each bet costs and an expected-loss calculator

import { evaluate3, dealerQualifies, settle, playEV, shouldPlay, PAY_TABLES, pairPlus, ANTE_BONUS } from '../engine/threecard.js';
import { freshDeck, shuffle, rankOf } from '../engine/poker.js';
import { pcards, ensurePokerCSS, pcard, back as cardBack } from '../ui/pokercards.js';
import { cue, confetti } from '../app/feel.js';
import { rec } from '../app/weak.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const usd = (n) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n * 100) / 100).toLocaleString()}`;
const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
const bk = (to = '#/play/threecard', label = 'Three Card Poker') => `<div class="topbar"><a class="back" href="${to}">‹ ${label}</a></div>`;
const link = (href, text) => `<a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:8px" href="${href}">${text}</a>`;
const deal = (n) => shuffle(freshDeck()).slice(0, n);
const RN = (r) => ({ 14: 'A', 13: 'K', 12: 'Q', 11: 'J' }[r] || String(r));
const hand3 = (ev) => ev.cat === 0 ? `${RN(ev.ranks[0])}-high` : ev.cat === 1 ? `Pair of ${RN(ev.ranks[1])}s` : ev.name;

export default async function threecard(el, parts, ctx) {
  ensurePokerCSS();
  const [sub] = parts;
  const T = (ctx.profile.tcp ||= { drill: { n: 0, c: 0 }, rank: { n: 0, c: 0 }, table: { hands: 0, bad: 0 }, pay: 'standard' });
  if (sub === 'learn') return learn(el, T);
  if (sub === 'drill') return playFold(el, ctx, T);
  if (sub === 'rank') return rankDrill(el, ctx, T);
  if (sub === 'table') return table(el, ctx, T);
  if (sub === 'cost') return cost(el, ctx, T);
  return hub(el, T);
}

function hub(el, T) {
  const pc = (s) => (s.n ? Math.round(s.c / s.n * 100) + '%' : '');
  el.innerHTML = `${bk('#/play', 'Play')}<h1>Three Card Poker</h1>
    <p class="dim small" style="margin-top:0">A fast casino card game against the dealer. There is exactly one decision: look at your three cards and either <b>play</b> (a bet equal to your ante) or <b>fold</b>. Get that one decision right every time, and know what the extra bets cost.</p>
    <a class="card link ok" href="#/play/threecard/learn"><h3>Learn the game</h3><div class="small dim">Rankings (a straight beats a flush here), the dealer qualifier, bonuses, Pair Plus, and the Q-6-4 rule.</div></a>
    <a class="card link" href="#/play/threecard/drill"><h3>Play or fold? <span class="dim num" style="float:right">${pc(T.drill)}</span></h3><div class="small dim">A hand, then the call. Graded with the exact value of playing against every possible dealer hand.</div></a>
    <a class="card link" href="#/play/threecard/rank"><h3>Who wins? <span class="dim num" style="float:right">${pc(T.rank)}</span></h3><div class="small dim">Rank the hands, including when the dealer fails to qualify.</div></a>
    <a class="card link" href="#/play/threecard/table"><h3>Practice table <span class="dim num" style="float:right">${T.table.hands ? T.table.hands + ' hands' : ''}</span></h3><div class="small dim">A bankroll, Ante, Play and Pair Plus. Every decision checked against the rule.</div></a>
    <a class="card link" href="#/play/threecard/cost"><h3>What it costs</h3><div class="small dim">The exact house edge of each bet and an expected-loss calculator.</div></a>
    <div class="card"><b>Honest reminder.</b> Played perfectly, Ante/Play costs the player about <b>3.4%</b> of each ante. Pair Plus costs <b>7.3%</b> on the common pay table. No decision beyond play-or-fold exists, so there is no skill edge to find.</div>`;
}

function learn(el, T) {
  const sec = (t, b) => `<div class="card"><h3>${t}</h3>${b}</div>`;
  const rows = [['Straight flush', '3 in a row, one suit (48 of 22,100 hands)'], ['Three of a kind', 'Three of the same rank (52 hands)'], ['Straight', '3 in a row (720 hands)'], ['Flush', '3 of one suit (1,096 hands)'], ['Pair', 'Two of the same rank; the kicker decides ties (3,744 hands)'], ['High card', 'Everything else: compare the highest card, then the next (16,440 hands)']];
  el.innerHTML = `${bk()}<h1>Learn Three Card Poker</h1>
    ${sec('1. The deal', '<p class="small">You and the dealer each get three cards. You put up an <b>Ante</b> (and optionally a <b>Pair Plus</b> side bet). You look at your cards. Then:</p><ul class="small" style="padding-left:18px;margin:0"><li><b>Play</b>: bet exactly as much as your ante.</li><li><b>Fold</b>: lose the ante (the Pair Plus bet is separate and still resolves).</li></ul>')}
    ${sec('2. Rankings, best to worst', `<table class="evtable">${rows.map(([n, d]) => `<tr><td><b>${n}</b><div class="small dim">${d}</div></td></tr>`).join('')}</table><p class="small dim" style="margin-bottom:0"><b>A straight beats a flush</b>: with only three cards, straights are rarer, so they rank higher. Ace can be high (Q-K-A) or low (A-2-3).</p>`)}
    ${sec('3. The dealer must qualify', '<p class="small">The dealer needs <b>Queen-high or better</b>. If the dealer does not qualify, your <b>Ante pays 1 to 1</b> and your <b>Play bet is returned</b> (a push). If the dealer does qualify, the better hand wins both bets, and a tie pushes both.</p>')}
    ${sec('4. The Ante bonus', '<p class="small">Paid on the ante whether or not the dealer qualifies or wins, as long as you play: <b>straight flush 5 to 1</b>, <b>three of a kind 4 to 1</b>, <b>straight 1 to 1</b>.</p>')}
    ${sec('5. Pair Plus', `<p class="small">A side bet that pays on <i>your own</i> hand alone, with the dealer ignored, even if you fold. The common pay tables:</p>
      <table class="evtable"><tr><td></td><td class="small dim">Standard</td><td class="small dim">Better</td></tr>${[['Straight flush', 'sf'], ['Three of a kind', 'trips'], ['Straight', 'straight'], ['Flush', 'flush'], ['Pair', 'pair']].map(([n, k]) => `<tr><td>${n}</td><td class="num">${PAY_TABLES.standard[k]} : 1</td><td class="num">${PAY_TABLES.better[k]} : 1</td></tr>`).join('')}</table>
      <p class="small dim" style="margin-bottom:0">Check the pay table before you play: the flush paying 4 instead of 3 changes the edge from 7.28% to 2.32%.</p>`)}
    ${sec('6. The one rule: Q-6-4', '<p class="small"><b>Play any hand that is better than Queen-6-4. Fold Queen-6-4 and worse.</b> Compare as ordinary high cards: Q-6-5 plays, Q-6-4 plays (it is the boundary: play it), Q-6-3 folds, Q-5-x folds, J-high folds, any pair or better plays. This is the optimal strategy; the drill checks it against the exact value of every hand.</p>')}
    ${link('#/play/threecard/drill', 'Drill play or fold')}`;
}

// ---- generic quiz (same shape as the other trainers) -----------------------------------------------------------------------------------------------
function quiz(el, ctx, st, cfg) {
  const TOTAL = cfg.total || 15;
  let n = 0, c = 0, streak = 0, done = false, busy = false;
  const next = () => {
    if (done) return;
    if (n >= TOTAL) return finish();
    busy = false;
    const q = cfg.make();
    el.innerHTML = `${bk()}<div class="row small dim" style="justify-content:space-between"><span>${cfg.title}</span><span class="num">${n + 1}/${TOTAL} · ${c} right · streak ${streak}</span></div>
      <div class="card" style="min-height:110px">${q.html}</div><div class="qa-opts two" id="opts">${q.opts.map(([v, t]) => `<button data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div><div id="fb"></div>`;
    el.querySelectorAll('#opts button').forEach((b) => b.onclick = () => {
      if (busy) return; busy = true;
      const ok = b.dataset.v === String(q.right);
      n++; if (ok) { c++; streak++; } else streak = 0;
      st.n++; if (ok) st.c++; cue(ok); rec(ctx, 'tcp:' + cfg.id, q.tag || cfg.id, ok); ctx.save();
      el.querySelectorAll('#opts button').forEach((x) => { x.disabled = true; if (x.dataset.v === String(q.right)) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
      el.querySelector('#fb').innerHTML = `<div class="verdict ${ok ? 'ok' : 'bad'} pop"><div class="head ${ok ? 'ok' : 'bad'}">${ok ? 'Correct' : 'Not quite'}</div><div class="small dim">${q.why}</div><button class="btn primary block" id="nx" style="margin-top:8px">${n >= TOTAL ? 'Finish' : 'Next'}</button></div>`;
      el.querySelector('#nx').onclick = next;
    });
  };
  function finish() {
    done = true;
    el.innerHTML = `${bk()}<h1>${cfg.title}</h1><div class="stat3"><div class="card"><div class="v ${c / n >= 0.9 ? 'ok' : ''}">${Math.round(c / n * 100)}%</div><div class="k">Accuracy</div></div><div class="card"><div class="v">${c}/${n}</div><div class="k">Right</div></div></div>
      <button class="btn primary block" id="again">Go again</button>${link('#/play/threecard', 'Back')}`;
    el.querySelector('#again').onclick = () => quiz(el, ctx, st, cfg);
    if (c / n >= 0.93) confetti();
  }
  next();
  return () => { done = true; busy = true; };
}

// ---- play or fold ---------------------------------------------------------------------------------------------------------------------------------------
function borderline() {
  // queen-high hands around the Q-6-4 line show up often, since that is where the decision is hard
  for (;;) {
    const h = deal(3), e = evaluate3(h);
    if (e.cat === 0 && e.ranks[0] >= 11 && e.ranks[0] <= 13 && Math.random() < 0.8) return h;
    if (Math.random() < 0.15) return h;
  }
}
function playFold(el, ctx, T) {
  return quiz(el, ctx, T.drill, {
    id: 'drill', title: 'Play or fold?', make: () => {
      const h = borderline(), e = evaluate3(h), ev = playEV(h), right = shouldPlay(h) ? 'play' : 'fold';
      const why = `<b>${hand3(e)}</b>. Playing is worth <b>${ev.play >= 0 ? '+' : '−'}${Math.abs(ev.play).toFixed(3)}</b> antes on average; folding costs exactly <b>−1.000</b>. ${right === 'play' ? 'Playing loses less, so play' : 'Folding loses less, so fold'}. (The dealer fails to qualify ${pct(ev.pNotQualify, 0)} of the time; you win ${pct(ev.pWin, 0)}, lose ${pct(ev.pLose, 0)}.) The rule: play Q-6-4 and better.`;
      return { tag: hand3(e), html: `<div class="small dim">Your hand</div>${pcards(h)}<div style="margin-top:8px"><b>Play (bet equal to your ante) or fold?</b></div>`, opts: [['play', 'Play'], ['fold', 'Fold']], right, why };
    },
  });
}

// ---- rankings drill ---------------------------------------------------------------------------------------------------------------------------------------
function rankDrill(el, ctx, T) {
  return quiz(el, ctx, T.rank, {
    id: 'rank', title: 'Who wins?', total: 12, make: () => {
      for (;;) {
        const c = deal(6), p = c.slice(0, 3), d = c.slice(3), pe = evaluate3(p), de = evaluate3(d);
        const q = dealerQualifies(de);
        const right = !q ? 'nq' : pe.score > de.score ? 'you' : pe.score < de.score ? 'dealer' : 'tie';
        const why = !q ? `The dealer has ${hand3(de)}: not Queen-high, so the dealer does not qualify. Ante pays 1 to 1 and the Play bet pushes.` : right === 'tie' ? 'Identical ranking: both bets push.' : `${right === 'you' ? 'You' : 'The dealer'} win${right === 'you' ? '' : 's'}: ${hand3(pe)} against ${hand3(de)}${pe.cat === 2 || pe.cat === 3 ? ' (remember: a straight beats a flush)' : ''}.`;
        return { tag: 'ranking', html: `<div class="small dim">You</div>${pcards(p)}<div class="small dim" style="margin-top:6px">Dealer</div>${pcards(d)}<div style="margin-top:8px"><b>What happens (you played)?</b></div>`, opts: [['you', 'You win'], ['dealer', 'Dealer wins'], ['nq', 'Dealer does not qualify'], ['tie', 'Push']], right, why };
      }
    },
  });
}

// ---- practice table ---------------------------------------------------------------------------------------------------------------------------------------
function table(el, ctx, T) {
  const S = (T.sess ||= { bank: 1000, ante: 10, pp: 0 }), PT = PAY_TABLES[T.pay] || PAY_TABLES.standard;
  let busy = false, stopped = false;
  function bet() {
    el.innerHTML = `${bk()}<h1>Practice table</h1><p class="dim small" style="margin-top:0">Play money. Every play-or-fold is checked against the optimal rule (play Q-6-4 and better).</p>
      <div class="card"><div class="row"><span class="grow small dim">Bankroll</span><b class="num">${usd(S.bank)}</b></div>
        <div class="small dim" style="margin-top:8px">Ante</div><div class="seg" id="a" style="margin:4px 0 8px">${[5, 10, 25, 50].map((v) => `<button data-v="${v}" class="${S.ante === v ? 'on' : ''}">$${v}</button>`).join('')}</div>
        <div class="small dim">Pair Plus (side bet)</div><div class="seg" id="p" style="margin:4px 0 8px">${[0, 5, 10].map((v) => `<button data-v="${v}" class="${S.pp === v ? 'on' : ''}">${v ? '$' + v : 'None'}</button>`).join('')}</div>
        <div class="small dim">Pair Plus pay table</div><div class="seg" id="t" style="margin:4px 0">${Object.entries(PAY_TABLES).map(([k, v]) => `<button data-v="${k}" class="${(T.pay || 'standard') === k ? 'on' : ''}">${v.name}</button>`).join('')}</div></div>
      <button class="btn primary block" id="go" ${S.bank < S.ante * 2 + S.pp ? 'disabled' : ''}>Deal</button>
      ${S.bank < S.ante * 2 + S.pp ? '<button class="btn block" id="rb" style="margin-top:8px">Reset bankroll to $1,000</button>' : ''}`;
    const seg = (id, key, cast) => el.querySelectorAll(`#${id} button`).forEach((b) => b.onclick = () => { if (key === 'pay') T.pay = b.dataset.v; else S[key] = cast(b.dataset.v); ctx.save(); bet(); });
    seg('a', 'ante', Number); seg('p', 'pp', Number); seg('t', 'pay', String);
    el.querySelector('#go').onclick = round;
    const rb = el.querySelector('#rb'); if (rb) rb.onclick = () => { S.bank = 1000; ctx.save(); bet(); };
  }
  function round() {
    busy = false;
    const d = deal(6), me = d.slice(0, 3), dl = d.slice(3), e = evaluate3(me), best = shouldPlay(me) ? 'play' : 'fold';
    S.bank -= S.ante + S.pp;
    el.innerHTML = `${bk()}<div class="row small dim" style="justify-content:space-between"><span>Ante ${usd(S.ante)}${S.pp ? ' · Pair Plus ' + usd(S.pp) : ''}</span><span class="num">${usd(S.bank)}</span></div>
      <div class="card" style="text-align:center"><div class="small dim">Dealer</div><div>${dl.map(() => cardBack()).join('')}</div><div class="small dim" style="margin-top:8px">You</div>${pcards(me)}<div class="small"><b>${hand3(e)}</b></div></div>
      <div class="actionbar" style="grid-template-columns:1fr 1fr"><button class="act" data-a="fold">Fold</button><button class="act" data-a="play">Play ${usd(S.ante)}</button></div><div id="fb"></div>`;
    el.querySelectorAll('.act').forEach((b) => b.onclick = () => {
      if (busy) return; busy = true;
      const play = b.dataset.a === 'play', right = play === (best === 'play');
      T.table.hands++; if (!right) T.table.bad++; rec(ctx, 'tcp:table', hand3(e), right);
      const r = settle(me, dl, play, PT);
      const mainNet = play ? r.net * S.ante : -S.ante, ppNet = S.pp ? (r.pp > 0 ? r.pp * S.pp : -S.pp) : 0;
      // the ante (and Pair Plus) left the bankroll at the deal; a played hand also stakes the Play bet, which comes back with the winnings
      S.bank += (play ? S.ante + mainNet : 0) + (S.pp ? S.pp + ppNet : 0);
      ctx.save();
      const total = mainNet + ppNet;
      const dText = `Dealer: ${hand3(r.de)}${play ? (r.qualifies ? '' : ' (does not qualify)') : ''}`;
      cue(total >= 0);
      el.querySelector('#fb').innerHTML = `<div class="card" style="text-align:center"><div>${dl.map((c) => pcard(c)).join('')}</div><div class="small">${dText}</div></div>
        <div class="verdict ${total > 0 ? 'ok' : total < 0 ? 'bad' : ''} pop"><div class="head ${total > 0 ? 'ok' : total < 0 ? 'bad' : ''}">${total > 0 ? 'You win ' + usd(total) : total < 0 ? 'You lose ' + usd(-total) : 'Push'}</div>
        <div class="small dim">${play ? `Ante/Play ${r.net >= 0 ? '+' : '−'}${usd(Math.abs(mainNet))}${r.anteBonus ? ` (includes ${usd(r.anteBonus * S.ante)} ante bonus)` : ''}` : 'You folded: the ante is lost'}${S.pp ? ` · Pair Plus ${ppNet >= 0 ? '+' : '−'}${usd(Math.abs(ppNet))} (${r.pp > 0 ? hand3(r.pe) + ' pays ' + r.pp + ':1' : 'no pair or better'})` : ''}</div>
        <div class="small ${right ? 'ok' : 'bad'}" style="margin-top:6px">${right ? '✓ Right decision.' : `✗ The optimal play was to ${best}: ${hand3(e)} ${best === 'play' ? 'is better than' : 'is not better than'} Queen-6-4.`}</div>
        <button class="btn primary block" id="nx" style="margin-top:8px">Next hand</button></div>`;
      el.querySelector('#nx').onclick = bet;
    });
  }
  bet();
  return () => { stopped = true; busy = true; };
}

// ---- cost ---------------------------------------------------------------------------------------------------------------------------------------------------------
let edgeCache = null;
function computeEdges() {
  if (edgeCache) return edgeCache;
  const all = []; for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) for (let c = b + 1; c < 52; c++) all.push([a, b, c]);
  const pp = {}; for (const [k, t] of Object.entries(PAY_TABLES)) { let s = 0; for (const h of all) s += pairPlus(evaluate3(h), t); pp[k] = -s / all.length; }
  const played = all.filter((h) => shouldPlay(h)).length / all.length;      // 14,900 of 22,100 hands
  edgeCache = { pp, ante: 0.03373, playFreq: played };    // Ante/Play edge: exact enumeration, asserted in tools/threecard-test.mjs
  return edgeCache;
}
function cost(el, ctx, T) {
  const E = computeEdges(), st = (T.calc ||= { ante: 25, pp: 0, hph: 50, hrs: 2 });
  function draw() {
    const wag = (st.ante * (1 + E.playFreq) + st.pp) * st.hph * st.hrs, loss = st.ante * E.ante * st.hph * st.hrs + st.pp * E.pp.standard * st.hph * st.hrs;
    el.innerHTML = `${bk()}<h1>What it costs</h1>
      <p class="dim small" style="margin-top:0">Exact figures from enumerating every possible deal.</p>
      <div class="card"><table class="evtable"><tr><td>Ante / Play (optimal play)</td><td class="num bad">${pct(E.ante, 2)} of each ante</td></tr><tr><td class="small dim">about ${pct(E.ante / (1 + E.playFreq), 2)} of total money wagered</td><td></td></tr>
        <tr><td>Pair Plus, 40·30·6·3·1</td><td class="num bad">${pct(E.pp.standard, 2)}</td></tr><tr><td>Pair Plus, 40·30·6·4·1</td><td class="num">${pct(E.pp.better, 2)}</td></tr></table>
        <p class="small dim" style="margin-bottom:0">Pair Plus costs twice as much as the main bet on the usual pay table, and yet it is the bet most players add. Only the pay table with the flush at 4 to 1 comes close to the main game.</p></div>
      <div class="card"><h3>Expected-loss calculator</h3><div class="row" style="gap:8px;flex-wrap:wrap"><label class="field grow">Ante ($)<input id="ca" type="number" value="${st.ante}"></label><label class="field grow">Pair Plus ($)<input id="cp" type="number" value="${st.pp}"></label>
        <label class="field grow">Hands / hour<input id="ch" type="number" value="${st.hph}"></label><label class="field grow">Hours<input id="chr" type="number" step="0.5" value="${st.hrs}"></label></div>
        <p class="small" style="margin-bottom:0">You will wager about <b>${usd(wag)}</b> and the house expects to keep <b class="bad">${usd(loss)}</b>. Three Card Poker deals about 50 hands an hour, so the cost adds up fast.</p></div>`;
    const num = (id, k) => { el.querySelector('#' + id).onchange = (e) => { st[k] = Math.max(0, Number(e.target.value) || 0); ctx.save(); draw(); }; };
    num('ca', 'ante'); num('cp', 'pp'); num('ch', 'hph'); num('chr', 'hrs');
  }
  draw();
}
