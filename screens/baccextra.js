// Baccarat extras: road reading (Big Eye Boy, Small Road, Cockroach Pig), the speed ladder, the temptation
// trap, and the table chooser. All maths comes from engine/baccarat.js and app/roads.js.
//   #/play/baccarat/roads         what the scoreboards are and how derived roads are marked
//   #/play/baccarat/roadsdrill    read the roads: predict the next mark, count streaks, name patterns
//   #/play/baccarat/ladder        draw-rule speed ladder: the clock tightens as you climb
//   #/play/baccarat/trap          temptation trap: 30 hands, every one with a reason to make a bad bet
//   #/play/baccarat/chooser       compare two tables by what they really cost

import { playRound, settle, edges } from '../engine/baccarat.js';
import { derivedMarks, nextMarks, bigColumns, describePattern } from '../app/roads.js';
import { bigFromResults, derivedHTML, beadHTML } from '../ui/roads-view.js';
import { baccCfg, edgesFor } from '../games/baccarat.js';
import { cue, confetti } from '../app/feel.js';
import { rec } from '../app/weak.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const pct = (x, d = 2) => `${(x * 100).toFixed(d)}%`;
const usd = (n) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;
const back = (to = '#/play/baccarat', label = 'Baccarat') => `<div class="topbar"><a class="back" href="${to}">‹ ${label}</a></div>`;
const link = (href, text) => `<a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:8px" href="${href}">${text}</a>`;
const NAME = { bigEye: 'Big Eye Boy', small: 'Small Road', cockroach: 'Cockroach Pig' };
const OFFSET = { bigEye: 1, small: 2, cockroach: 3 };

// A realistic-looking run of results (banker ≈ 45.9%, player ≈ 44.6%, tie ≈ 9.5%).
function randomResults(n) {
  const out = [];
  while (out.length < n) { const x = Math.random(); out.push(x < 0.459 ? 'banker' : x < 0.905 ? 'player' : 'tie'); }
  return out;
}

// ---- roads: the lesson --------------------------------------------------------------------------------------------
export function roadsLesson(el) {
  const ex = [...'BBPBPPPBBBPB'].map((c) => (c === 'B' ? 'banker' : 'player')).concat(['tie', 'banker']);
  el.innerHTML = `${back()}<h1>Reading the roads</h1>
    <p class="dim small" style="margin-top:0">The scoreboards at every baccarat table. Learn to read them because they are everywhere and half of what people say at the table comes from them. Know up front: they record the past; they do not predict the next card.</p>
    <div class="card"><h3>Bead plate and Big Road</h3><p class="small">The <b>bead plate</b> lists every hand in order. The <b>Big Road</b> groups streaks: each time the winner changes you move to a new column; the same winner again goes down. Ties are a green slash on the last hand. A streak longer than six turns right along the bottom (a “dragon tail”).</p>
      ${bigFromResults(ex)}</div>
    <div class="card"><h3>The derived roads</h3><p class="small">Three small roads are built from the Big Road. They show whether the Big Road is <i>repeating itself</i>. Each mark is red or blue:</p>
      <ul class="small" style="padding-left:18px;margin:0">
        <li><b class="bad">Red</b>: it repeated the pattern (the streak continued, or it chopped the way it chopped before).</li>
        <li><b class="info">Blue</b>: it broke the pattern.</li></ul>
      <p class="small"><b>Big Eye Boy</b> (hollow rings) looks one column back, <b>Small Road</b> (solid dots) two columns back, <b>Cockroach Pig</b> (slashes) three.</p>
      ${Object.keys(NAME).map((k) => `<div class="small dim" style="margin-top:6px">${NAME[k]}</div>${derivedHTML(derivedMarks(randomResultsFixed(), OFFSET[k]), k)}`).join('')}
      <p class="small dim" style="margin-bottom:0">The rule for a new entry: if it starts a new column, red if the column before it is as long as the one that many columns before that; otherwise (a streak continuing) red if the column beside it reached this row, blue if it ended one row short, red again if it ended two or more short.</p></div>
    <div class="card"><h3>What the patterns are called</h3><ul class="small" style="padding-left:18px;margin:0">
      <li><b>Dragon</b>: six or more of the same winner in a row.</li><li><b>Ping pong / chop</b>: alternating every hand.</li><li><b>Two-two</b>, <b>one-two</b>: repeating short columns.</li></ul></div>
    <div class="card"><b>Honest reminder.</b> The roads are a tidy way of drawing the past. After any streak or pattern the next hand is still a fresh deal with about the same odds (Banker 45.8%, Player 44.6%, Tie 9.5%). People bet “with the trend” and “against the trend” with equal conviction; neither beats the edge. Test it yourself in <a href="#/play/baccarat/truth">Do patterns work?</a> and feel it in the <a href="#/play/baccarat/trap">Temptation trap</a>.</div>
    ${link('#/play/baccarat/roadsdrill', 'Drill reading the roads')}`;
}
function randomResultsFixed() { return [...'BBPBPPPBBBPBBPPBPBBBPPBPBBPBPPPPBB'].map((c) => (c === 'B' ? 'banker' : 'player')); }

// ---- roads drill ---------------------------------------------------------------------------------------------------------
export function roadsDrill(el, ctx) {
  const TOTAL = 15;
  let n = 0, c = 0, streak = 0, done = false, busy = false;
  const st = ((ctx.profile.bacc ||= {}).roads ||= { n: 0, c: 0 });

  function make() {
    const kind = pick(['next', 'next', 'next', 'streak', 'pattern']);
    if (kind === 'streak') {
      const res = randomResults(20 + rnd(14)), cols = bigColumns(res), last = cols[cols.length - 1];
      const right = String(last.len);
      return { html: `${bigFromResults(res)}<div style="margin-top:8px"><b>How many ${last.winner === 'banker' ? 'Banker' : 'Player'}s in a row right now?</b></div><div class="small dim">Ties do not break a streak.</div>`,
        opts: [1, 2, 3, 4, 5, 6].map((v) => [String(v), String(v) + (v === 6 ? '+' : '')]), right: last.len >= 6 ? '6' : right, why: `The last column is ${last.len} long. Ties are ignored on the Big Road.`, cols: 3 };
    }
    if (kind === 'pattern') {
      const script = pick([
        { s: 'BPBPBP', id: 'pingpong' }, { s: 'BBPPBB', id: 'twotwo' }, { s: 'PBBPBBP', id: 'onetwo' }, { s: 'PPBBBBBBB', id: 'dragon' }, { s: 'BBBPBPPPBB', id: 'none' },
      ]);
      const res = [...script.s].map((x) => (x === 'B' ? 'banker' : 'player'));
      const p = describePattern(res), names = { pingpong: 'Ping pong', twotwo: 'Two-two', onetwo: 'One-two', dragon: 'Dragon', none: 'No named pattern' };
      return { html: `${bigFromResults(res)}<div style="margin-top:8px"><b>What is the Big Road showing at the end?</b></div>`, opts: Object.entries(names), right: p.id, why: `${p.name}. Names are for talking about the past; they carry no information about the next hand.`, cols: 2 };
    }
    // next mark
    for (let tries = 0; tries < 20; tries++) {
      const res = randomResults(26 + rnd(14)), road = pick(Object.keys(NAME)), nextWho = pick(['banker', 'player']);
      const nm = nextMarks(res, nextWho)[road];
      if (nm === null && tries < 12) continue;   // prefer questions with a real mark
      const right = nm === null ? 'none' : nm;
      const why = nm === null ? `That hand would not add an entry to the ${NAME[road]} (it starts at column ${OFFSET[road] + 1}, and this hand does not reach a cell that counts).` : nm === 'r' ? `Red: the ${nextWho} result repeats the pattern ${OFFSET[road]} column${OFFSET[road] > 1 ? 's' : ''} back.` : `Blue: the ${nextWho} result breaks the pattern ${OFFSET[road]} column${OFFSET[road] > 1 ? 's' : ''} back.`;
      return { html: `<div class="small dim">Big Road</div>${bigFromResults(res)}<div class="small dim" style="margin-top:6px">${NAME[road]}</div>${derivedHTML(derivedMarks(res, OFFSET[road]), road)}<div style="margin-top:8px"><b>If the next hand is <span class="${nextWho === 'banker' ? 'bad' : 'info'}">${nextWho === 'banker' ? 'Banker' : 'Player'}</span>, what does the ${NAME[road]} get?</b></div>`,
        opts: [['r', 'Red'], ['b', 'Blue'], ['none', 'No entry']], right, why, cols: 3 };
    }
  }

  function next() {
    if (done) return;
    if (n >= TOTAL) return finish();
    busy = false;
    const q = make();
    el.innerHTML = `${back('#/play/baccarat/roads', 'Roads')}<div class="row small dim" style="justify-content:space-between"><span>Read the roads</span><span class="num">${n + 1}/${TOTAL} · ${c} right · streak ${streak}</span></div>
      <div class="card">${q.html}</div><div class="qa-opts ${q.cols === 2 ? 'two' : 'three'}" id="opts">${q.opts.map(([v, t]) => `<button data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div><div id="fb"></div>`;
    el.querySelectorAll('#opts button').forEach((b) => b.onclick = () => {
      if (busy) return; busy = true;
      const ok = b.dataset.v === String(q.right);
      n++; if (ok) { c++; streak++; } else streak = 0; st.n++; if (ok) st.c++;
      cue(ok); rec(ctx, 'bacc:roads', 'roads', ok); ctx.save();
      el.querySelectorAll('#opts button').forEach((x) => { x.disabled = true; if (x.dataset.v === String(q.right)) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
      el.querySelector('#fb').innerHTML = `<div class="verdict ${ok ? 'ok' : 'bad'} pop"><div class="head ${ok ? 'ok' : 'bad'}">${ok ? 'Correct' : 'Not quite'}</div><div class="small dim">${esc(q.why)}</div><button class="btn primary block" id="nx" style="margin-top:8px">${n >= TOTAL ? 'Finish' : 'Next'}</button></div>`;
      el.querySelector('#nx').onclick = next;
    });
  }
  function finish() {
    done = true;
    el.innerHTML = `${back('#/play/baccarat/roads', 'Roads')}<h1>Read the roads</h1><div class="stat3"><div class="card"><div class="v ${c / n >= 0.85 ? 'ok' : ''}">${Math.round(c / n * 100)}%</div><div class="k">Accuracy</div></div><div class="card"><div class="v">${c}/${n}</div><div class="k">Right</div></div></div>
      <p class="small dim">You can read the roads now. They still do not tell you what the next hand will be.</p>
      <button class="btn primary block" id="again">Go again</button>${link('#/play/baccarat', 'Back to baccarat')}`;
    el.querySelector('#again').onclick = () => roadsDrill(el, ctx);
    if (c / n >= 0.9) confetti();
  }
  next();
  return () => { done = true; };
}

// ---- speed ladder ---------------------------------------------------------------------------------------------------------
const LEVELS = [10, 8, 6, 5, 4, 3, 2.5, 2];
export function ladder(el, ctx, DRILLS) {
  const cfg = baccCfg(ctx), st = (ctx.profile.bacc.ladder ||= { best: 0, runs: 0 });
  const POOL = ['count', 'player', 'banker', 'banker', 'winner'];
  let level = 0, right = 0, total = 0, strikes = 0, streak = 0, top = 0, done = false, timer = null, busy = false;

  function next() {
    if (done) return;
    if (strikes >= 3 || total >= 40) return finish();
    busy = false;
    const id = pick(POOL), q = DRILLS[id].make(cfg), secs = LEVELS[level], t0 = Date.now();
    el.innerHTML = `${back()}<div class="row small dim" style="justify-content:space-between"><span>Speed ladder · level <b class="num">${level + 1}</b> · ${secs}s</span><span class="num">${right}/${total} · ${'●'.repeat(3 - strikes)}${'○'.repeat(strikes)}</span></div>
      <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;margin:6px 0"><div id="bar" style="height:100%;width:100%;background:var(--ok);transition:width ${secs}s linear"></div></div>
      <div class="card" style="min-height:110px">${q.html}</div><div class="qa-opts ${DRILLS[id].cols === 2 ? 'two' : DRILLS[id].cols === 3 ? 'three' : ''}" id="opts">${q.opts.map(([v, t]) => `<button data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div><div id="fb" class="small" style="min-height:24px"></div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => { const b = el.querySelector('#bar'); if (b) b.style.width = '0%'; }));
    const settle_ = (ok, timedOut) => {
      if (busy) return; busy = true; clearTimeout(timer);
      total++;
      if (ok) { right++; streak++; if (streak % 4 === 0 && level < LEVELS.length - 1) level++; }
      else { strikes++; streak = 0; if (level > 0) level--; }
      top = Math.max(top, level);
      cue(ok); rec(ctx, 'bacc:ladder:' + id, String(q.right), ok);
      el.querySelectorAll('#opts button').forEach((x) => { x.disabled = true; if (x.dataset.v === String(q.right)) x.classList.add('right'); });
      el.querySelector('#fb').innerHTML = ok ? '' : `<span class="bad">${timedOut ? 'Time. ' : 'Not quite. '}</span>${esc(q.why)}`;
      timer = setTimeout(next, ok ? 250 : 1800);
    };
    el.querySelectorAll('#opts button').forEach((b) => b.onclick = () => settle_(b.dataset.v === String(q.right), false));
    timer = setTimeout(() => settle_(false, true), secs * 1000 + 60 - (Date.now() - t0));
  }
  function finish() {
    done = true; clearTimeout(timer);
    const bestNow = top + 1; const newBest = bestNow > st.best;
    st.best = Math.max(st.best, bestNow); st.runs++; ctx.save();
    el.innerHTML = `${back()}<h1>Speed ladder</h1><div class="stat3"><div class="card"><div class="v ${newBest ? 'ok' : ''}">${bestNow}</div><div class="k">Top level${newBest ? ' · new best' : ''}</div></div><div class="card"><div class="v">${right}/${total}</div><div class="k">Right</div></div><div class="card"><div class="v">${st.best}</div><div class="k">Best ever</div></div></div>
      <p class="small dim">Levels run from 10 seconds a decision down to 2. A real dealer takes about two seconds a draw, so level 8 is table speed. Every fourth correct answer in a row moves you up; a miss or a timeout costs a strike and a level.</p>
      <button class="btn primary block" id="again">Climb again</button>${link('#/play/baccarat', 'Back to baccarat')}`;
    el.querySelector('#again').onclick = () => ladder(el, ctx, DRILLS);
    if (newBest && bestNow >= 5) confetti();
  }
  next();
  return () => { done = true; clearTimeout(timer); };
}

// ---- temptation trap ---------------------------------------------------------------------------------------------------------
// Thirty real hands. Before each, a classic reason to make a bad bet. Sit out, bet the cheapest side, or take the bait.
// At the end: what you did against what every choice was expected to cost.
const RANK_OF_LABEL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10];
function dealHand(cfg) {
  const labels = [];
  const round = playRound(() => { const l = rnd(13); labels.push(l); return RANK_OF_LABEL[l]; });
  return { round, pairs: { player: labels[0] === labels[2], banker: labels[1] === labels[3] } };
}
export function trap(el, ctx) {
  const cfg = baccCfg(ctx), e = edgesFor(cfg), TOTAL = 30, UNIT = 10, BIG = 30;
  const st = (ctx.profile.bacc.trap ||= { runs: 0, baited: 0, hands: 0 });
  const hist = [];
  let i = 0, bank = 500, chased = false, baited = 0, discip = 0, expCost = 0, expDiscip = 0, lastLost = false, done = false, busy = false;
  const EDGE = { player: -e.player, banker: -e.banker, tie: -(cfg.tiePays * e.odds.tie - (1 - e.odds.tie)), playerPair: -e.pair, bankerPair: -e.pair };
  const bj = (k) => ({ player: 'Player', banker: 'Banker', tie: 'Tie', playerPair: 'Player Pair', bankerPair: 'Banker Pair' }[k]);

  function bait() {
    const streak = (() => { let n = 0; const rs = hist.filter((h) => h !== 'tie'); for (let k = rs.length - 1; k >= 0 && rs[k] === rs[rs.length - 1]; k--) n++; return { n, who: rs[rs.length - 1] }; })();
    const sinceTie = (() => { let n = 0; for (let k = hist.length - 1; k >= 0 && hist[k] !== 'tie'; k--) n++; return n; })();
    const cands = [];
    if (streak.n >= 3) cands.push({ msg: `${streak.who === 'banker' ? 'Banker' : 'Player'} has won ${streak.n} in a row. It has to break soon.`, kind: streak.who === 'banker' ? 'player' : 'banker', why: 'Gambler’s fallacy: a streak does not make the opposite side due.' });
    if (streak.n >= 3) cands.push({ msg: `${streak.who === 'banker' ? 'Banker' : 'Player'} is on fire: ${streak.n} straight. Ride the streak.`, kind: streak.who, why: 'Following a streak is as empty as fighting it: each hand is a fresh deal.' });
    if (sinceTie >= 8) cands.push({ msg: `No Tie in the last ${sinceTie} hands. It is overdue.`, kind: 'tie', why: 'Ties come about 1 hand in 10.5 whatever happened before; nothing is “overdue”.' });
    cands.push({ msg: 'The table is chopping. Bet the opposite of last hand.', kind: hist.length && hist[hist.length - 1] === 'banker' ? 'player' : 'banker', why: 'Chasing a pattern. The pattern is in the past.' });
    cands.push({ msg: 'Pair side bet pays 11 to 1. Cheap thrill, big payout.', kind: pick(['playerPair', 'bankerPair']), why: `A pair hits about 1 in ${Math.round(1 / e.pPair)} and the bet costs ${pct(EDGE.playerPair, 1)}: ${Math.round(EDGE.playerPair / -EDGE.banker)}× the cost of Banker.` });
    if (lastLost) cands.push({ msg: 'You just lost. Triple the bet and win it back.', kind: 'banker', amt: BIG, chase: true, why: 'Chasing a loss does not change the odds; it raises the stake at the same edge.' });
    const c = pick(cands);
    if (c.kind === 'banker' && !c.amt) { c.amt = BIG; c.msg += ' Press the bet while you are sure.'; c.why += ' And tripling the stake triples the expected loss.'; }
    return c;
  }

  function next() {
    if (done) return;
    if (i >= TOTAL) return finish();
    busy = false;
    const b = bait(), amt = b.amt || UNIT;
    el.innerHTML = `${back()}<div class="row small dim" style="justify-content:space-between"><span>Hand ${i + 1}/${TOTAL}</span><span class="num ${bank >= 500 ? 'ok' : 'bad'}">${usd(bank)}</span></div>
      ${hist.length ? beadHTML(hist.map((w) => ({ winner: w }))) : ''}
      <div class="card" style="margin-top:8px"><div class="small dim">The table talks</div><div style="font-size:17px;margin:4px 0"><i>“${esc(b.msg)}”</i></div></div>
      <div class="actionbar" style="grid-template-columns:1fr;gap:8px">
        <button class="act" data-c="out">Sit this one out</button>
        <button class="act" data-c="banker">Banker ${usd(UNIT)} <span class="dim small">(cheapest bet)</span></button>
        <button class="act" data-c="bait">${esc(bj(b.kind))} ${usd(amt)} <span class="dim small">(take the bait)</span></button></div><div id="fb"></div>`;
    el.querySelectorAll('.act').forEach((x) => x.onclick = () => choose(x.dataset.c, b, amt));
  }

  function choose(c, b, amt) {
    if (busy) return; busy = true;
    const { round, pairs } = dealHand(cfg);
    hist.push(round.winner);
    const kind = c === 'bait' ? b.kind : 'banker', stake = c === 'out' ? 0 : c === 'bait' ? amt : UNIT;
    const net = stake ? settle(stake, kind, round, cfg, pairs) : 0;
    bank += net; lastLost = stake > 0 && net < 0;
    if (c === 'bait') { baited++; expCost += stake * EDGE[kind]; }
    if (c === 'banker') discip++;
    expDiscip += c === 'out' ? 0 : c === 'bait' ? 0 : UNIT * EDGE.banker;
    const label = { player: 'Player wins', banker: 'Banker wins', tie: 'Tie' }[round.winner];
    el.querySelector('#fb').innerHTML = `<div class="verdict ${net >= 0 ? 'ok' : 'bad'} pop"><div class="head ${net >= 0 ? 'ok' : 'bad'}">${label}${stake ? ` · you ${net > 0 ? 'won ' + usd(net) : net < 0 ? 'lost ' + usd(-net) : 'pushed'}` : ' · you kept your money'}</div>
      ${c === 'bait' ? `<div class="small dim">${esc(b.why)}</div>` : ''}</div>`;
    el.querySelectorAll('.act').forEach((x) => { x.disabled = true; });
    cue(net >= 0);
    i++;
    setTimeout(next, c === 'bait' ? 2000 : 900);
  }

  function finish() {
    done = true;
    st.runs++; st.baited += baited; st.hands += TOTAL; ctx.save();
    const rate = baited / TOTAL;
    el.innerHTML = `${back()}<h1>Temptation trap</h1><div class="stat3"><div class="card"><div class="v ${bank >= 500 ? 'ok' : 'bad'}">${usd(bank - 500)}</div><div class="k">Your result</div></div><div class="card"><div class="v ${rate > 0.3 ? 'bad' : 'ok'}">${baited}/${TOTAL}</div><div class="k">Took the bait</div></div><div class="card"><div class="v bad">${usd(expCost)}</div><div class="k">Expected cost of the bait</div></div></div>
      <div class="card small"><p style="margin-top:0">Every one of those thirty prompts sounded convincing, and every one was a reason to bet that has no effect on the next hand. ${baited === 0 ? '<b>You never took the bait.</b> That is the whole skill.' : `You took the bait <b>${baited}</b> time${baited > 1 ? 's' : ''}; those bets were expected to cost you about <b class="bad">${usd(expCost)}</b> over the session.`}</p>
        <p style="margin-bottom:0">Your actual result is luck: you can win a session by taking bad bets. The expected cost is what you pay over the long run. Across all runs you have taken the bait on <b>${Math.round(st.baited / Math.max(1, st.hands) * 100)}%</b> of hands.</p></div>
      <button class="btn primary block" id="again">Another 30 hands</button>${link('#/play/baccarat', 'Back to baccarat')}`;
    el.querySelector('#again').onclick = () => trap(el, ctx);
    if (baited <= 1) confetti();
  }
  next();
  return () => { done = true; busy = true; };
}

// ---- table chooser ------------------------------------------------------------------------------------------------------------
const VARIANTS = [['standard', '5% commission'], ['ez', 'EZ (no commission)'], ['super6', 'Super 6 (no commission)']];
function tableEdges(t) {
  const decks = t.decks;
  const base = edges(decks, { variant: t.variant === 'ez' ? 'ez' : 'standard', decks, tiePays: t.tie, commission: t.variant === 'ez' ? 0 : 0.05, pairPays: t.pair });
  const o = base.odds;
  const banker = t.variant === 'super6' ? -((o.banker - o.banker6two - o.banker6three) + 0.5 * (o.banker6two + o.banker6three) - o.player) : -base.banker;
  return { banker, player: -base.player, tie: -base.tie, pair: -base.pair };
}
export function chooser(el, ctx) {
  const st = ((ctx.profile.bacc ||= {}).chooser ||= { A: { variant: 'standard', decks: 8, tie: 8, pair: 11 }, B: { variant: 'ez', decks: 8, tie: 9, pair: 11 }, bet: 50, hph: 70 });
  function draw() {
    const eA = tableEdges(st.A), eB = tableEdges(st.B);
    const cost = (e) => Math.min(e.banker, e.player);
    const wag = st.bet * st.hph;
    const col = (key, e) => {
      const t = st[key], best = cost(e);
      const seg = (id, items, cur) => `<div class="seg" id="${id}" style="margin:4px 0 8px;flex-wrap:wrap">${items.map(([v, l]) => `<button data-t="${key}" data-k="${id}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      return `<div class="card"><h3>Table ${key}</h3>
        <div class="small dim">Commission</div>${seg('variant', VARIANTS, t.variant)}
        <div class="small dim">Decks</div>${seg('decks', [[6, '6'], [8, '8']], t.decks)}
        <div class="small dim">Tie pays</div>${seg('tie', [[8, '8:1'], [9, '9:1']], t.tie)}
        <div class="small dim">Pair pays</div>${seg('pair', [[10, '10:1'], [11, '11:1']], t.pair)}
        <table class="evtable"><tr><td>Banker</td><td class="num">${pct(e.banker)}</td></tr><tr><td>Player</td><td class="num">${pct(e.player)}</td></tr><tr><td>Tie</td><td class="num bad">${pct(e.tie)}</td></tr><tr><td>Either pair</td><td class="num bad">${pct(e.pair)}</td></tr>
          <tr><td><b>Cheapest bet, per hour</b></td><td class="num"><b>${usd(wag * best)}</b></td></tr></table></div>`;
    };
    const diff = (cost(eA) - cost(eB)) * wag, winner = Math.abs(diff) < 0.5 ? null : diff < 0 ? 'A' : 'B';
    el.innerHTML = `${back()}<h1>Which table?</h1>
      <p class="dim small" style="margin-top:0">Two tables, same game, different small print. Set each one to what you see and compare what they really cost. “No commission” sounds better; check the numbers.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px"><label class="field grow">Bet ($)<input id="bet" type="number" inputmode="decimal" value="${st.bet}"></label><label class="field grow">Hands per hour<input id="hph" type="number" inputmode="numeric" value="${st.hph}"></label></div>
      ${col('A', eA)}${col('B', eB)}
      <div class="card"><h3>Verdict</h3><p class="small" style="margin:0">${winner ? `<b>Table ${winner}</b> is cheaper by about <b class="ok">${usd(Math.abs(diff))}</b> an hour at ${usd(st.bet)} a hand, betting the cheapest side.` : 'The two tables cost the same on the cheapest bet.'} ${[eA.tie, eB.tie].some((x) => x > 0.1) ? 'Ignore the Tie and pair bets at either: they cost 10% or more of every dollar.' : ''}</p></div>`;
    el.querySelectorAll('.seg button[data-t]').forEach((b) => b.onclick = () => { st[b.dataset.t][b.dataset.k] = b.dataset.k === 'variant' ? b.dataset.v : Number(b.dataset.v); ctx.save(); draw(); });
    const num = (id, k) => { el.querySelector('#' + id).onchange = (ev) => { const v = Number(ev.target.value); if (v > 0) { st[k] = v; ctx.save(); draw(); } }; };
    num('bet', 'bet'); num('hph', 'hph');
  }
  draw();
}
