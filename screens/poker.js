// Texas Hold'em inside the Play tab:
//   #/play/poker                 hub
//   #/play/poker/learn[/id]      the lessons, in order
//   #/play/poker/ranges          starting-hand charts by seat (tap a hand)
//   #/play/poker/drills[/id]     drills
//   #/play/poker/table           practice table with a coach
//   #/play/poker/calc            equity calculator
//   #/play/poker/tools           rake and variance
//   #/play/poker/tips            cheat sheet and glossary

import { LESSONS, GLOSSARY, TIPS } from '../curriculum/poker.js';
import { DRILLS, pokerDrill } from '../games/pokerdrills.js';
import { pokerTable } from '../games/pokertable.js';
import lab from './pokerlab.js';
import { pcards, pstr, handGrid, ensurePokerCSS, pcard } from '../ui/pokercards.js';
import { RFI, VS_RAISE, rangePct, rangeCombos, chen, strengthOrder, equity, outs, evaluate, describeHand, categoryOf, potOddsNeeded, RANKS, SUIT_CH, mk, topRange, cardStr, rankOf, suitOf, freshDeck } from '../engine/poker.js';

const back = (to = '#/play/poker', label = 'Poker') => `<div class="topbar"><a class="back" href="${to}">‹ ${label}</a></div>`;
const link = (href, text) => `<a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:8px" href="${href}">${text}</a>`;
const helpers = { pstr, pcards };
const pc = (x, d = 0) => `${(x * 100).toFixed(d)}%`;

export default async function poker(el, parts, ctx) {
  ensurePokerCSS();
  const [sub, arg] = parts;
  if (sub === 'learn') return arg ? lesson(el, arg, ctx) : learnIndex(el, ctx);
  if (sub === 'ranges') return ranges(el, ctx);
  if (sub === 'drills') return arg && DRILLS[arg] ? pokerDrill(el, ctx, arg) : drillsIndex(el, ctx);
  if (sub === 'table') return pokerTable(el, ctx);
  if (sub === 'lab') return lab(el, parts.slice(1), ctx);
  if (sub === 'calc') return calc(el, ctx);
  if (sub === 'tools') return tools(el, ctx);
  if (sub === 'tips') return tips(el);
  return hub(el, ctx);
}

// ---- hub ----------------------------------------------------------------------------------------------
function hub(el, ctx) {
  const p = (ctx.profile.poker ||= {}), done = p.lessons || {}, nDone = LESSONS.filter((l) => done[l.id]).length, t = p.table;
  el.innerHTML = `${back('#/play', 'Play')}<h1>Poker</h1>
    <p class="dim small" style="margin-top:0">Texas Hold'em from the beginning: the rules, the math, starting hands by seat, how to play after the flop, bluffing, reading opponents, and bankroll. Learn it, drill it, then play practice hands against bots with a coach grading every decision.</p>
    <a class="card link ok" href="#/play/poker/learn"><h3>Learn Hold'em <span class="dim num" style="float:right">${nDone}/${LESSONS.length}</span></h3><div class="small dim">${LESSONS.length} short lessons in the right order: hand rankings, position, preflop, pot odds, postflop, bluffing, opponents, bankroll, tournaments, online play, and the mistakes that cost the most.</div></a>
    <a class="card link" href="#/play/poker/table"><h3>Practice table <span class="dim num" style="float:right">${t && t.hands ? t.hands + ' hands' : ''}</span></h3><div class="small dim">Six-handed against bots with different styles. Every decision is graded from equity, pot odds and position, with the reason.</div></a>
    <a class="card link" href="#/play/poker/ranges"><h3>Starting-hand charts</h3><div class="small dim">The raise-or-fold ranges for every seat, plus how to respond to a raise. Tap any hand.</div></a>
    <a class="card link" href="#/play/poker/drills"><h3>Drills</h3><div class="small dim">Hand ranking, outs, pot odds, preflop decisions, equity, positions.</div></a>
    <a class="card link" href="#/play/poker/lab"><h3>Poker lab</h3><div class="small dim">Postflop spots, board textures, blockers, MDF, heads-up push/fold charts, an ICM calculator, opponent stats, hand review with equity, and a tilt trainer.</div></a>
    <a class="card link" href="#/play/poker/calc"><h3>Equity calculator</h3><div class="small dim">Pick your cards and the board: your chance to win against a random hand, a range, or one known hand.</div></a>
    <a class="card link" href="#/play/poker/tools"><h3>Rake and variance</h3><div class="small dim">What the rake really costs you, and how large the swings are for a winning player.</div></a>
    <a class="card link" href="#/play/poker/tips"><h3>Tips and glossary</h3><div class="small dim">The cheat sheet: sixteen rules that win money, and the terms you will hear.</div></a>
    <div class="card"><b>Honest reminder.</b> Poker is a skill game against other players, not the house, so it can be beaten. But the rake is a real cost, results swing wildly in the short run, and most players lose. Play stakes you can afford, set a stop-loss, and treat practice as practice.</div>`;
}

// ---- lessons ------------------------------------------------------------------------------------------
function learnIndex(el, ctx) {
  const done = (ctx.profile.poker ||= {}).lessons || {};
  el.innerHTML = `${back()}<h1>Learn Hold'em</h1><p class="dim small" style="margin-top:0">In order. Each lesson takes about five minutes. Do the matching drill, then the practice table.</p>
    ${LESSONS.map((l) => `<a class="card link row" href="#/play/poker/learn/${l.id}"><div class="grow"><h3>${l.title}</h3><div class="small dim">${l.blurb}</div></div><div class="num ${done[l.id] ? 'ok' : 'dim'}" style="font-size:20px">${done[l.id] ? '✓' : '›'}</div></a>`).join('')}`;
}
function lesson(el, id, ctx) {
  const i = LESSONS.findIndex((l) => l.id === id);
  if (i < 0) return learnIndex(el, ctx);
  const L = LESSONS[i], prev = LESSONS[i - 1], next = LESSONS[i + 1];
  el.innerHTML = `${back('#/play/poker/learn', 'Lessons')}<h1>${L.title}</h1>${L.body(helpers)}
    <button class="btn primary block" id="done" style="margin-top:12px">${next ? 'Done: next lesson' : 'Done: finish'}</button>
    <div class="row" style="gap:8px;margin-top:8px">${prev ? `<a class="btn grow" style="text-align:center;text-decoration:none" href="#/play/poker/learn/${prev.id}">‹ ${prev.title.split('·')[0].trim()}</a>` : ''}${next ? `<a class="btn grow" style="text-align:center;text-decoration:none" href="#/play/poker/learn/${next.id}">${next.title.split('·')[0].trim()} ›</a>` : ''}</div>`;
  el.querySelector('#done').onclick = async () => { const p = (ctx.profile.poker ||= {}); (p.lessons ||= {})[id] = true; await ctx.save(); location.hash = next ? `#/play/poker/learn/${next.id}` : '#/play/poker/learn'; };
}

// ---- ranges -------------------------------------------------------------------------------------------
function ranges(el, ctx) {
  let mode = 'BTN';
  const sets = {
    UTG: { raise: RFI.UTG }, HJ: { raise: RFI.HJ }, CO: { raise: RFI.CO }, BTN: { raise: RFI.BTN }, SB: { raise: RFI.SB },
    early: { r3: VS_RAISE.early.threeBet, call: VS_RAISE.early.call }, late: { r3: VS_RAISE.late.threeBet, call: VS_RAISE.late.call }, blinds: { r3: VS_RAISE.blinds.threeBet, call: VS_RAISE.blinds.call },
  };
  const names = { UTG: 'Under the gun', HJ: 'Hijack', CO: 'Cutoff', BTN: 'Button', SB: 'Small blind (raise or fold)', early: 'Facing a raise from UTG / HJ', late: 'Facing a raise from late position (CO, BTN, SB)', blinds: 'Defending the blinds vs a late raise' };
  const draw = (sel = '') => {
    const S = sets[mode], isRFI = !!S.raise;
    const cls = (l) => (isRFI ? (S.raise.has(l) ? 'in' : '') : S.r3.has(l) ? 'r3' : S.call.has(l) ? 'c' : '') + (l === sel ? ' sel' : '');
    const total = isRFI ? rangePct(S.raise) : rangePct(S.r3) + rangePct(S.call);
    let info = '<div class="small dim">Tap a hand for details.</div>';
    if (sel) {
      const act = isRFI ? (S.raise.has(sel) ? 'Raise' : 'Fold') : S.r3.has(sel) ? '3-bet' : S.call.has(sel) ? 'Call' : 'Fold';
      const combos = sel.length === 2 ? 6 : sel[2] === 's' ? 4 : 12;
      info = `<div class="card"><b>${sel}</b> · ${act} <span class="dim">· ${combos} combinations · Chen score ${chen(sel)}</span></div>`;
    }
    el.innerHTML = `${back()}<h1>Starting-hand charts</h1>
      <p class="dim small" style="margin-top:0">Pairs are on the diagonal, <b>suited</b> hands above it, <b>offsuit</b> below. 6-max cash, 100bb. These are solid, profitable ranges: not solver-exact.</p>
      <div class="seg" id="m" style="margin:6px 0;flex-wrap:wrap">${['UTG', 'HJ', 'CO', 'BTN', 'SB'].map((k) => `<button data-v="${k}" class="${mode === k ? 'on' : ''}">${k}</button>`).join('')}</div>
      <div class="seg" id="m2" style="margin:6px 0 10px">${[['early', 'vs early raise'], ['late', 'vs late raise'], ['blinds', 'blinds']].map(([k, t]) => `<button data-v="${k}" class="${mode === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="small"><b>${names[mode]}</b> · ${isRFI ? `raise ${pc(total, 1)} of hands <span class="dim">(${rangeCombos(S.raise)} of 1326 combos)</span>` : `3-bet ${pc(rangePct(S.r3), 1)} · call ${pc(rangePct(S.call), 1)}`}</div>
      <div class="small" style="margin:6px 0">${isRFI ? '<span class="ok">■</span> raise · □ fold' : '<span style="color:#e0556a">■</span> 3-bet · <span style="color:#e5b64a">■</span> call · □ fold'}</div>
      ${handGrid(cls)}${info}
      <div class="card small dim">Why the ranges change by seat: the earlier you act, the more players are still to act behind you and the more likely one of them has a good hand. Out of position after the flop you also play worse. On the button, only the blinds remain, and you act last on every street.</div>`;
    el.querySelectorAll('#m button, #m2 button').forEach((b) => b.onclick = () => { mode = b.dataset.v; draw(); });
    el.querySelectorAll('td.hg').forEach((td) => td.onclick = () => draw(td.dataset.h));
  };
  draw();
}

// ---- drills index -----------------------------------------------------------------------------------------
function drillsIndex(el, ctx) {
  const st = ((ctx.profile.poker ||= {}).stats ||= {});
  const row = (id) => { const D = DRILLS[id], s = st[id]; return `<a class="card link row" href="#/play/poker/drills/${id}"><div class="grow"><h3>${D.title}</h3><div class="small dim">${D.sub}</div></div><div class="num ${!s ? 'dim' : s.c / s.n >= 0.9 ? 'ok' : s.c / s.n < 0.7 ? 'bad' : ''}" style="font-size:22px;font-weight:800">${s ? Math.round(s.c / s.n * 100) + '%' : '—'}</div></a>`; };
  el.innerHTML = `${back()}<h1>Poker drills</h1><p class="dim small" style="margin-top:0">Fifteen questions each, with the reason after every answer.</p>
    <h2>The basics</h2>${row('rank')}${row('name')}${row('position')}
    <h2>The math</h2>${row('outs')}${row('odds')}${row('equity')}
    <h2>Preflop</h2>${row('preflop')}${row('vsraise')}`;
}

// ---- equity calculator -----------------------------------------------------------------------------------------
function calc(el, ctx) {
  const st = { hero: [], board: [], opp: [], target: 'hero', n: 1, range: 'random', res: null, busy: false };
  const slots = { hero: 2, board: 5, opp: 2 };
  const used = () => new Set([...st.hero, ...st.board, ...st.opp]);
  function draw() {
    const u = used();
    const slot = (k, i) => { const c = st[k][i]; return `<button class="cslot ${st.target === k && st[k].length === i ? 'cur' : ''}" data-k="${k}" data-i="${i}">${c !== undefined ? pcard(c) : '<span class="dim">+</span>'}</button>`; };
    const grid = [0, 1, 2, 3].map((s) => `<div class="row" style="gap:2px;margin:2px 0">${Array.from({ length: 13 }, (_, i) => { const c = mk(14 - i, s); const red = s === 1 || s === 2; return `<button class="ck ${u.has(c) ? 'used' : ''}" data-c="${c}" style="color:${red ? '#e0556a' : 'inherit'}">${RANKS[12 - i]}<br>${'♠♥♦♣'[s]}</button>`; }).join('')}</div>`).join('');
    el.innerHTML = `${back()}<h1>Equity calculator</h1>
      <p class="dim small" style="margin-top:0">Tap a slot, then tap cards. Leave the board empty for preflop equity.</p>
      <style>.cslot{background:var(--surface2);border:1px solid var(--line);border-radius:8px;padding:2px;min-width:44px;height:58px;display:inline-flex;align-items:center;justify-content:center}.cslot.cur{outline:2px solid var(--info)}.cslot .pcard{width:36px;height:50px}.ck{flex:1;min-width:0;padding:8px 0;min-height:44px;line-height:1.25;font-size:12px;font-weight:700;border-radius:5px;border:1px solid var(--line);background:var(--surface2);color:var(--text);line-height:1.1}.ck.used{opacity:.25;pointer-events:none}</style>
      <div class="small dim">Your hand</div><div class="row" style="gap:6px">${slot('hero', 0)}${slot('hero', 1)}</div>
      <div class="small dim" style="margin-top:8px">Board (flop, turn, river)</div><div class="row" style="gap:6px;flex-wrap:wrap">${[0, 1, 2, 3, 4].map((i) => slot('board', i)).join('')}</div>
      <div class="small dim" style="margin-top:8px">Opponent</div>
      <div class="seg" id="r" style="margin:6px 0;flex-wrap:wrap">${[['random', 'Random hand'], ['t50', 'Top 50%'], ['t25', 'Top 25%'], ['t10', 'Top 10%'], ['known', 'Known hand']].map(([v, t]) => `<button data-v="${v}" class="${st.range === v ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${st.range === 'known' ? `<div class="row" style="gap:6px">${slot('opp', 0)}${slot('opp', 1)}</div>` : `<div class="small dim">Number of opponents</div><div class="seg" id="n" style="margin:6px 0">${[1, 2, 3, 4, 5].map((v) => `<button data-v="${v}" class="${st.n === v ? 'on' : ''}">${v}</button>`).join('')}</div>`}
      <div style="margin:8px 0">${grid}</div>
      <div class="row" style="gap:8px"><button class="btn grow" id="clr">Clear</button><button class="btn primary grow" id="go" ${st.hero.length < 2 || (st.range === 'known' && st.opp.length < 2) || st.busy ? 'disabled' : ''}>${st.busy ? 'Calculating…' : 'Calculate'}</button></div>
      <div id="out">${st.res ? resultHTML() : ''}</div>`;
    el.querySelectorAll('.cslot').forEach((b) => b.onclick = () => { st.target = b.dataset.k; const i = Number(b.dataset.i); if (st[b.dataset.k][i] !== undefined) { st[b.dataset.k].splice(i, 1); } draw(); });
    el.querySelectorAll('.ck').forEach((b) => b.onclick = () => {
      const c = Number(b.dataset.c);
      let k = st.target;
      if (st[k].length >= slots[k]) k = st.hero.length < 2 ? 'hero' : st.board.length < 5 ? 'board' : st.range === 'known' && st.opp.length < 2 ? 'opp' : k;
      if (st[k].length < slots[k]) st[k].push(c);
      if (st.hero.length === 2 && k === 'hero') st.target = 'board';
      if (st.board.length === 5 && k === 'board') st.target = st.range === 'known' ? 'opp' : 'board';
      st.res = null; draw();
    });
    el.querySelectorAll('#r button').forEach((b) => b.onclick = () => { st.range = b.dataset.v; if (st.range === 'known') st.target = st.opp.length < 2 ? 'opp' : st.target; st.res = null; draw(); });
    const nb = el.querySelectorAll('#n button'); nb.forEach((b) => b.onclick = () => { st.n = Number(b.dataset.v); st.res = null; draw(); });
    el.querySelector('#clr').onclick = () => { st.hero = []; st.board = []; st.opp = []; st.target = 'hero'; st.res = null; draw(); };
    el.querySelector('#go').onclick = run;
  }
  function resultHTML() {
    const r = st.res, o = st.board.length >= 3 && st.board.length <= 4 ? outs(st.hero, st.board) : null;
    const need = [['⅓ pot', 1 / 3], ['½ pot', 0.5], ['⅔ pot', 2 / 3], ['pot', 1]].map(([n, f]) => `${n}: ${pc(f / (1 + 2 * f))}`).join(' · ');
    return `<div class="card" style="margin-top:10px"><div class="row"><div class="grow"><div class="small dim">Your equity</div><div class="big num ${r.equity > 0.5 ? 'ok' : ''}">${pc(r.equity, 1)}</div></div><div class="grow small">Win <b>${pc(r.win, 1)}</b><br>Tie <b>${pc(r.tie, 1)}</b><br>Lose <b>${pc(r.lose, 1)}</b></div></div>
      ${st.board.length >= 3 ? `<div class="small" style="margin-top:6px">${describeHand(evaluate([...st.hero, ...st.board]))}${o ? ` · ${o.count} outs to two pair or better` : ''}</div>` : ''}
      <div class="small dim" style="margin-top:6px">Equity needed to call a bet of: ${need}.</div></div>`;
  }
  function run() {
    st.busy = true; draw();
    setTimeout(() => {
      const opps = st.range === 'known' ? [st.opp] : Array.from({ length: st.n }, () => (st.range === 'random' ? null : topRange(Number(st.range.slice(1)) / 100)));
      st.res = equity(st.hero, st.board, opps, 12000); st.busy = false;
      if (el.isConnected) draw();
    }, 30);
  }
  draw();
}

// ---- rake and variance --------------------------------------------------------------------------------------------
function tools(el, ctx) {
  const v = { rakePct: 5, cap: 3, flopPct: 45, avgPot: 8, bb: 0.25, hrs: 70, wr: 5, sd: 90, hands: 50000, res: null };
  const gauss = () => { let u = 0, w = 0; while (!u) u = Math.random(); while (!w) w = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w); };
  function sim() {
    const steps = Math.round(v.hands / 100), paths = 2000, end = [], dd = []; let neg = 0;
    for (let p = 0; p < paths; p++) {
      let s = 0, peak = 0, worst = 0;
      for (let i = 0; i < steps; i++) { s += v.wr + v.sd * gauss(); if (s > peak) peak = s; if (peak - s > worst) worst = peak - s; }
      end.push(s); dd.push(worst); if (s < 0) neg++;
    }
    end.sort((a, b) => a - b); dd.sort((a, b) => a - b);
    v.res = { neg: neg / paths, p5: end[Math.floor(paths * 0.05)], p50: end[Math.floor(paths / 2)], p95: end[Math.floor(paths * 0.95)], dd50: dd[Math.floor(paths / 2)], dd90: dd[Math.floor(paths * 0.9)] };
  }
  function draw() {
    const perHandRake = Math.min(v.avgPot * v.rakePct / 100, v.cap) * v.flopPct / 100, per100 = perHandRake * 100 / 6, perHr = per100 * v.hrs / 100 * v.bb;
    const num = (id, label, val, step = '1') => `<label class="field grow" style="min-width:110px">${label}<input id="${id}" type="number" step="${step}" value="${val}"></label>`;
    el.innerHTML = `${back()}<h1>Rake and variance</h1>
      <div class="card"><h3>What the rake costs you</h3><p class="small dim" style="margin-top:0">The room takes a percentage of each pot that sees a flop, up to a cap. With six players, you pay about a sixth of the total. Change the numbers to match your site.</p>
        <div class="row" style="gap:8px;flex-wrap:wrap">${num('rp', 'Rake %', v.rakePct, '0.5')}${num('cp', 'Cap (bb)', v.cap, '0.5')}${num('fp', 'Hands seeing a flop %', v.flopPct)}${num('ap', 'Average pot (bb)', v.avgPot, '0.5')}${num('bb', 'Big blind ($)', v.bb, '0.01')}${num('hh', 'Hands / hour', v.hrs)}</div>
        <p class="small">Your share of the rake: about <b class="bad">${per100.toFixed(1)} bb per 100 hands</b>, or <b class="bad">$${perHr.toFixed(2)} per hour</b> at $${v.bb} blinds. To make money you must first beat this, before any rakeback or bonus. A typical winning small-stakes player earns only a few bb/100 after rake.</p></div>
      <div class="card"><h3>How big are the swings?</h3><p class="small dim" style="margin-top:0">Simulated results for a player with your win rate. Standard deviation for 6-max no-limit is typically around 80–100 bb per 100 hands.</p>
        <div class="row" style="gap:8px;flex-wrap:wrap">${num('wr', 'Win rate (bb/100)', v.wr, '0.5')}${num('sd', 'Std dev (bb/100)', v.sd)}${num('hn', 'Hands', v.hands, '1000')}</div>
        <button class="btn primary block" id="sim" style="margin-top:8px">Simulate 2,000 players</button>
        ${v.res ? `<table class="evtable" style="margin-top:8px"><tr><td>Chance of being <b>behind</b> after ${v.hands.toLocaleString()} hands</td><td class="num ${v.res.neg > 0.2 ? 'bad' : ''}">${pc(v.res.neg)}</td></tr><tr><td>Unlucky 1 in 20 (5th percentile)</td><td class="num bad">${Math.round(v.res.p5).toLocaleString()} bb</td></tr><tr><td>Typical result</td><td class="num">${Math.round(v.res.p50).toLocaleString()} bb</td></tr><tr><td>Lucky 1 in 20 (95th percentile)</td><td class="num ok">+${Math.round(v.res.p95).toLocaleString()} bb</td></tr><tr><td>Typical worst downswing</td><td class="num">${Math.round(v.res.dd50).toLocaleString()} bb (${(v.res.dd50 / 100).toFixed(0)} buy-ins)</td></tr><tr><td>Worst downswing 1 time in 10</td><td class="num">${Math.round(v.res.dd90).toLocaleString()} bb (${(v.res.dd90 / 100).toFixed(0)} buy-ins)</td></tr></table>
          <div class="small dim" style="margin-top:6px">This is why a 20–30 buy-in bankroll is the minimum for cash games, and why results over a few thousand hands tell you almost nothing about skill.</div>` : ''}</div>`;
    const bind = (id, key) => el.querySelector('#' + id).onchange = () => { v[key] = Math.max(0, Number(el.querySelector('#' + id).value) || 0); v.res = null; draw(); };
    bind('rp', 'rakePct'); bind('cp', 'cap'); bind('fp', 'flopPct'); bind('ap', 'avgPot'); bind('bb', 'bb'); bind('hh', 'hrs'); bind('wr', 'wr'); bind('sd', 'sd'); bind('hn', 'hands');
    el.querySelector('#sim').onclick = () => { el.querySelector('#sim').textContent = 'Simulating…'; setTimeout(() => { sim(); draw(); }, 20); };
  }
  draw();
}

// ---- tips and glossary ----------------------------------------------------------------------------------------------
function tips(el) {
  el.innerHTML = `${back()}<h1>Tips and glossary</h1>
    <h2>Sixteen rules that win money</h2>${TIPS.map(([t, b]) => `<div class="card"><b>${t}.</b> <span class="small">${b}</span></div>`).join('')}
    <h2>Glossary</h2><div class="card"><table class="evtable" style="font-size:13px">${GLOSSARY.map(([t, d]) => `<tr><td><b>${t}</b></td><td class="small">${d}</td></tr>`).join('')}</table></div>`;
}
