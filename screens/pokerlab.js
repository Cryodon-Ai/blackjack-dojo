// Poker lab: the advanced trainers.
//   #/play/poker/lab                 hub
//   #/play/poker/lab/spots           postflop spots: c-bet or give up, call / fold / raise
//   #/play/poker/lab/mdf             minimum defence, pot odds, bluff ratios and bluff-catcher decisions
//   #/play/poker/lab/blockers        which cards make the best bluffs
//   #/play/poker/lab/texture         board textures and who has the range advantage
//   #/play/poker/lab/pushfold        heads-up Nash push/fold charts for 2 to 25 big blinds + drill
//   #/play/poker/lab/icm             ICM calculator: what a tournament chip is really worth
//   #/play/poker/lab/stats           opponent stats from your table sessions + HUD reading drill
//   #/play/poker/lab/review          hand review with equity on every street
//   #/play/poker/lab/tilt            tilt scenarios, a cool-down ritual and a self-check

import { pcards, handGrid, ensurePokerCSS, pcard } from '../ui/pokercards.js';
import { freshDeck, shuffle, classLabel, classCombos, topRange, boardTexture, equity, cardStr, rankOf, suitOf, evaluate, describeHand, RANKS, ALL_CLASSES } from '../engine/poker.js';
import { gradeCbet, gradeFacing, mdf, bluffShare, potOdds, catcherEV, blockerProfile, rangeAdvantage, icm, icmCall, shoveEV } from '../engine/pokerlab.js';
import { STYLES } from '../engine/holdem.js';
import { cue, confetti } from '../app/feel.js';
import { rec } from '../app/weak.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const shuf = (a) => a.slice().sort(() => Math.random() - 0.5);
const pc = (x, d = 0) => `${(x * 100).toFixed(d)}%`;
const bb = (x) => (Math.round(x * 10) / 10).toString().replace(/\.0$/, '');
const back = (to = '#/play/poker/lab', label = 'Poker lab') => `<div class="topbar"><a class="back" href="${to}">‹ ${label}</a></div>`;
const link = (href, text) => `<a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:8px" href="${href}">${text}</a>`;
const deal = (n, exclude = []) => shuffle(freshDeck(exclude)).slice(0, n);
const isoDate = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default async function lab(el, parts, ctx) {
  ensurePokerCSS();
  const [sub] = parts;
  const P = (ctx.profile.poker ||= {});
  if (sub === 'spots') return quiz(el, ctx, { id: 'spots', title: 'Postflop spots', intro: 'A flop or turn decision. The answer comes from your equity against a sensible range, the pot odds, the outs and the board.', make: makeSpot, cols: 3 });
  if (sub === 'mdf') return quiz(el, ctx, { id: 'mdf', title: 'Defence and bluff maths', intro: 'The arithmetic that sets how often you must call, how often a bet can be a bluff, and whether a bluff-catcher is worth a call.', make: makeMdf, cols: 2 });
  if (sub === 'blockers') return quiz(el, ctx, { id: 'blockers', title: 'Blockers', intro: 'A river bluff works best with a hand that blocks the strong hands you want them to fold, and has no showdown value of its own.', make: makeBlocker, cols: 3 });
  if (sub === 'texture') return quiz(el, ctx, { id: 'texture', title: 'Board textures', intro: 'Read the flop: how wet or dry it is, and which player’s range it favours.', make: makeTexture, cols: 2 });
  if (sub === 'pushfold') return pushFold(el, ctx);
  if (sub === 'icm') return icmScreen(el, ctx);
  if (sub === 'stats') return oppStats(el, ctx);
  if (sub === 'review') return review(el, ctx, parts[1]);
  if (sub === 'tilt') return tilt(el, ctx);
  return hub(el, ctx, P);
}

function hub(el, ctx, P) {
  const L = (P.lab ||= {});
  const row = (id, t, d) => { const s = L[id]; return `<a class="card link row" href="#/play/poker/lab/${id}"><div class="grow"><h3>${t}</h3><div class="small dim">${d}</div></div><div class="num ${s && s.n && s.c / s.n >= 0.8 ? 'ok' : 'dim'}">${s && s.n ? Math.round(s.c / s.n * 100) + '%' : ''}</div></a>`; };
  el.innerHTML = `${back('#/play/poker', 'Poker')}<h1>Poker lab</h1>
    <p class="dim small" style="margin-top:0">Past the basics. These trainers use the same equity engine as the rest of the app, plus a precomputed hand-versus-hand table for push/fold and ICM.</p>
    <h2>After the flop</h2>
    ${row('spots', 'Postflop spots', 'C-bet or check, call, fold or raise: graded from equity against a range.')}
    ${row('texture', 'Board textures', 'Dry, wet, paired, monotone, and who the flop favours.')}
    ${row('blockers', 'Blockers', 'Which hand makes the best bluff on the river.')}
    ${row('mdf', 'Defence and bluff maths', 'MDF, pot odds, bluff ratios and bluff-catchers.')}
    <h2>Short stacks and tournaments</h2>
    <a class="card link" href="#/play/poker/lab/pushfold"><h3>Push/fold charts</h3><div class="small dim">Heads-up Nash shove and call ranges from 2 to 25 big blinds, with a drill.</div></a>
    <a class="card link" href="#/play/poker/lab/icm"><h3>ICM calculator</h3><div class="small dim">What your chips are really worth near the money, and the equity you need to call.</div></a>
    <h2>Your play</h2>
    <a class="card link" href="#/play/poker/lab/stats"><h3>Opponent stats</h3><div class="small dim">VPIP, PFR and aggression from your table sessions, and a drill reading HUD numbers.</div></a>
    <a class="card link" href="#/play/poker/lab/review"><h3>Hand review ${(P.history || []).length ? `<span class="dim num" style="float:right">${P.history.length} saved</span>` : ''}</h3><div class="small dim">Replay recent table hands with your equity on every street.</div></a>
    <a class="card link" href="#/play/poker/lab/tilt"><h3>Tilt trainer</h3><div class="small dim">What to do after a bad beat, a losing run or a big win, plus a one-minute reset.</div></a>
    <div class="card small"><b>How the answers are made.</b> Every grade is computed, not typed in: equity against a range by simulation, pot odds by arithmetic, blockers by counting combinations. For the postflop trainers, spots near the line between two plays are skipped, so the best answer is clear.</div>`;
}

// ---- generic multiple-choice quiz -----------------------------------------------------------------------------------------
function quiz(el, ctx, cfg) {
  const TOTAL = 12, L = ((ctx.profile.poker ||= {}).lab ||= {});
  let n = 0, c = 0, streak = 0, done = false, busy = false;
  const next = () => {
    if (done) return;
    if (n >= TOTAL) return finish();
    busy = false;
    const q = cfg.make(ctx);
    el.innerHTML = `${back()}<div class="row small dim" style="justify-content:space-between"><span>${cfg.title}</span><span class="num">${n + 1}/${TOTAL} · ${c} right · streak ${streak}</span></div>
      ${n === 0 ? `<p class="small dim" style="margin:6px 0">${cfg.intro}</p>` : ''}
      <div class="card" style="min-height:110px">${q.html}</div>
      <div class="qa-opts ${(q.cols || cfg.cols) === 2 ? 'two' : (q.cols || cfg.cols) === 3 ? 'three' : ''}" id="opts">${q.opts.map(([v, t]) => `<button data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div><div id="fb"></div>`;
    el.querySelectorAll('#opts button').forEach((b) => b.onclick = () => {
      if (busy) return; busy = true;
      const ok = b.dataset.v === String(q.right);
      n++; if (ok) { c++; streak++; } else streak = 0;
      const s = (L[cfg.id] ||= { n: 0, c: 0 }); s.n++; if (ok) s.c++;
      cue(ok); rec(ctx, 'poker:lab:' + cfg.id, q.tag || cfg.id, ok); ctx.save();
      el.querySelectorAll('#opts button').forEach((x) => { x.disabled = true; if (x.dataset.v === String(q.right)) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
      el.querySelector('#fb').innerHTML = `<div class="verdict ${ok ? 'ok' : 'bad'} pop"><div class="head ${ok ? 'ok' : 'bad'}">${ok ? 'Correct' : 'Not quite'}</div><div class="small dim">${q.why}</div><button class="btn primary block" id="nx" style="margin-top:8px">${n >= TOTAL ? 'Finish' : 'Next'}</button></div>`;
      el.querySelector('#nx').onclick = next;
    });
  };
  function finish() {
    done = true;
    el.innerHTML = `${back()}<h1>${cfg.title}</h1><div class="stat3"><div class="card"><div class="v ${c / n >= 0.85 ? 'ok' : ''}">${Math.round(c / n * 100)}%</div><div class="k">Accuracy</div></div><div class="card"><div class="v">${c}/${n}</div><div class="k">Right</div></div></div>
      <button class="btn primary block" id="again">Go again</button>${link('#/play/poker/lab', 'Back to the lab')}`;
    el.querySelector('#again').onclick = () => quiz(el, ctx, cfg);
    if (c / n >= 0.9) confetti();
  }
  next();
  return () => { done = true; busy = true; };
}

// ---- postflop spots --------------------------------------------------------------------------------------------------------------------
function heroHole(exclude = []) {
  if (Math.random() < 0.55) {
    const combos = [...topRange(0.4)].flatMap(classCombos).filter((c) => !exclude.includes(c[0]) && !exclude.includes(c[1]));
    return shuf(combos)[0];
  }
  return deal(2, exclude);
}
function makeSpot() {
  for (let tries = 0; tries < 80; tries++) {
    const cbet = Math.random() < 0.5;
    const board = deal(cbet ? 3 : pick([3, 4]));
    const hole = heroHole(board), pos = pick(['in position', 'out of position']);
    if (cbet) {
      const g = gradeCbet(hole, board), pot = pick([6, 6.5, 7]);
      if (g.gray) continue;
      const big = g.tex.wet || g.outs >= 8 || g.equity >= 0.66 && !g.tex.dry;
      const right = g.rec === 'check' ? 'check' : big ? 'big' : 'small';
      return { tag: 'c-bet', html: `<div class="small dim">You raised before the flop and one player called. You are ${pos}.</div><div class="small dim" style="margin-top:6px">Your hand</div>${pcards(hole)}<div class="small dim" style="margin-top:6px">Flop</div>${pcards(board)}<div class="small" style="margin-top:6px">Pot <b>${bb(pot)} bb</b>. It is checked to you. What do you do?</div>`,
        opts: [['check', 'Check'], ['small', `Bet ⅓ pot (${bb(pot / 3)})`], ['big', `Bet ¾ pot (${bb(pot * 0.75)})`]], right,
        why: `${g.why} ${right === 'big' ? 'The board is wet or you have outs, so bet big: charge draws and make folds count.' : right === 'small' ? 'The board is dry, so a small bet does the same job for less risk.' : ''}<br><span class="dim">Equity measured against the top third of hands, the calling range.</span>` };
    }
    const pot = pick([8, 10, 12, 16]), frac = pick([0.33, 0.5, 0.75, 1]), bet = Math.round(pot * frac * 2) / 2;
    const g = gradeFacing(hole, board, pot, bet);
    if (g.gray) continue;
    return { tag: 'facing a bet', html: `<div class="small dim">A solid player bets into you. You are ${pos}.</div><div class="small dim" style="margin-top:6px">Your hand</div>${pcards(hole)}<div class="small dim" style="margin-top:6px">${board.length === 3 ? 'Flop' : 'Turn'}</div>${pcards(board)}<div class="small" style="margin-top:6px">Pot <b>${bb(pot)} bb</b>, he bets <b>${bb(bet)} bb</b> (${Math.round(bet / pot * 100)}% pot). You need <b>${Math.round(g.need * 100)}%</b> equity to call.</div>`,
      opts: [['fold', 'Fold'], ['call', 'Call'], ['raise', 'Raise']], right: g.rec, why: `${g.why}<br><span class="dim">Equity measured against the top 28% of hands: a bet usually means a real hand.</span>` };
  }
  return makeSpot();
}

// ---- MDF and bluff maths -----------------------------------------------------------------------------------------------------------------
function numOpts(truth, step = 5) {
  const set = new Set([Math.round(truth)]);
  for (const d of shuf([-2, -1, 1, 2, 3, -3])) { if (set.size >= 4) break; const v = Math.round(truth) + d * step; if (v >= 1 && v <= 99) set.add(v); }
  return shuf([...set]).map((v) => [String(v), v + '%']);
}
function makeMdf() {
  const kind = pick(['mdf', 'need', 'bluffs', 'catcher', 'catcher']);
  const pot = pick([40, 60, 100, 120, 200]), frac = pick([0.33, 0.5, 0.67, 0.75, 1, 1.5]), bet = Math.round(pot * frac / 5) * 5;
  const f = Math.round(bet / pot * 100);
  if (kind === 'mdf') { const v = mdf(bet, pot) * 100; return { tag: 'MDF', html: `<div>Pot <b>${pot}</b>. Villain bets <b>${bet}</b> (${f}% pot).</div><div style="margin-top:8px"><b>How often must you continue (call or raise) to stop a pure bluff from showing a profit?</b></div>`, opts: numOpts(v), right: String(Math.round(v)), why: `Minimum defence frequency = pot ÷ (pot + bet) = ${pot} ÷ ${pot + bet} = <b>${v.toFixed(0)}%</b>. Fold more than that and any two cards bluff profitably.` }; }
  if (kind === 'need') { const v = potOdds(bet, pot) * 100; return { tag: 'pot odds', html: `<div>Pot <b>${pot}</b> before his bet. He bets <b>${bet}</b>.</div><div style="margin-top:8px"><b>What equity do you need to call?</b></div>`, opts: numOpts(v), right: String(Math.round(v)), why: `You risk ${bet} to win ${pot + bet}. Needed equity = ${bet} ÷ (${pot} + ${bet} + ${bet}) = <b>${v.toFixed(0)}%</b>.` }; }
  if (kind === 'bluffs') { const v = bluffShare(bet, pot) * 100; return { tag: 'bluff share', html: `<div>River. Pot <b>${pot}</b>, you bet <b>${bet}</b>.</div><div style="margin-top:8px"><b>What share of your betting range can be bluffs so that a bluff-catcher is indifferent to calling?</b></div>`, opts: numOpts(v), right: String(Math.round(v)), why: `Bluff share = bet ÷ (pot + 2 × bet) = ${bet} ÷ ${pot + 2 * bet} = <b>${v.toFixed(0)}%</b>. More bluffs than that and calling profits; fewer and folding does.` }; }
  const value = 3 + rnd(7), bl = 1 + rnd(7), ev = catcherEV(bet, pot, value, bl), q = bluffShare(bet, pot), need = value * q / (1 - q);
  return { tag: 'bluff-catcher', html: `<div>River. Pot <b>${pot}</b>, he bets <b>${bet}</b>. You hold a bluff-catcher that beats only bluffs. You put his betting range at <b>${value}</b> value combos and <b>${bl}</b> bluff combos.</div><div style="margin-top:8px"><b>Call or fold?</b></div>`,
    opts: [['call', 'Call'], ['fold', 'Fold']], right: ev > 0 ? 'call' : 'fold', cols: 2,
    why: `Calling wins ${pot + bet} ${bl} times in ${value + bl} and loses ${bet} otherwise: EV = <b>${ev >= 0 ? '+' : '−'}${Math.abs(ev).toFixed(1)}</b>. He needs about ${need.toFixed(1)} bluffs per ${value} value hands to make you indifferent; he has ${bl}.` };
}

// ---- blockers ---------------------------------------------------------------------------------------------------------------------------------
function makeBlocker() {
  for (let tries = 0; tries < 150; tries++) {
    const board = deal(5), cand = [];
    const dead = new Set(board);
    let pool = freshDeck(board);
    pool = shuffle(pool);
    for (let i = 0; i + 1 < pool.length && cand.length < 3; i += 2) cand.push([pool[i], pool[i + 1]]);
    const prof = cand.map((h) => blockerProfile(h, board));
    if (prof.some((p) => p.beatenBy < 0.55)) continue;           // all three must be real bluffing hands
    const order = prof.map((p, i) => [p.blocksStrong, i]).sort((a, b) => b[0] - a[0]);
    if (order[0][0] - order[1][0] < 0.06) continue;
    const letters = ['A', 'B', 'C'];
    return { tag: 'blockers', html: `<div class="small dim">River. You are out of position and plan to bluff. Villain’s likely range is strong.</div><div class="small dim" style="margin-top:6px">Board</div>${pcards(board)}
      <div class="row" style="gap:14px;flex-wrap:wrap;margin-top:8px">${cand.map((h, i) => `<div><div class="small dim">Hand ${letters[i]}</div>${pcards(h)}</div>`).join('')}</div><div style="margin-top:8px"><b>Which hand is the best bluff?</b></div>`,
      opts: letters.map((l) => [l, 'Hand ' + l]), right: letters[order[0][1]],
      why: `Share of villain’s strongest 15% of combos each hand removes: ${letters.map((l, i) => `${l} ${pc(prof[i].blocksStrong, 0)}`).join(', ')}. The fewer strong hands he can hold, the more often he folds, and all three of yours lose at showdown anyway.` };
  }
  return makeBlocker();
}

// ---- board textures -------------------------------------------------------------------------------------------------------------------------------
function texLabel(board) {
  const t = boardTexture(board), suits = [0, 0, 0, 0];
  board.forEach((c) => suits[suitOf(c)]++);
  const maxSuit = Math.max(...suits);
  if (t.paired) return 'paired';
  if (maxSuit === 3) return 'monotone';
  if (maxSuit === 2 && t.connected) return 'wet';
  if (maxSuit === 1 && !t.connected) return 'dry';
  return null;
}
const TEX_NAME = { dry: 'Dry (rainbow, disconnected)', wet: 'Wet (two suits, connected)', paired: 'Paired', monotone: 'Monotone (one suit)' };
function makeTexture() {
  if (Math.random() < 0.55) {
    for (;;) {
      const board = deal(3), l = texLabel(board);
      if (!l) continue;
      const why = { dry: 'Three different suits and no straight draws: few draws, so hands rarely change. Small bets work.', wet: 'Two of a suit and connected cards: lots of flush and straight draws, so hand strength changes fast. Bet big or give up.', paired: 'A pair on board makes trips and full houses possible, and few draws. Usually good for the raiser.', monotone: 'Three of one suit: anyone with one card of that suit has a flush draw, and a flush is possible. Range bets are rare.' }[l];
      return { tag: 'texture', html: `<div class="small dim">Flop</div>${pcards(board)}<div style="margin-top:8px"><b>What kind of board is it?</b></div>`, opts: Object.entries(TEX_NAME), right: l, why };
    }
  }
  for (let t = 0; t < 40; t++) {
    const board = deal(3), a = rangeAdvantage(board);
    if (a.favours === 'even') continue;
    return { tag: 'range advantage', html: `<div class="small dim">You raised from early position and the big blind called. Flop:</div>${pcards(board)}<div style="margin-top:8px"><b>Whose range does this flop favour?</b></div>`,
      opts: [['pfr', 'The raiser'], ['caller', 'The caller']], right: a.favours, cols: 2,
      why: `Averaged over their ranges, the raiser has about ${pc(a.pfr)} equity here and the caller ${pc(a.caller)}. Raisers own the high cards and pairs; callers own the low, connected and suited hands.` };
  }
  return makeTexture();
}

// ---- push / fold ---------------------------------------------------------------------------------------------------------------------------------------
let pfCache = null;
async function loadPF() {
  if (!pfCache) {
    const [pf, eq] = await Promise.all([fetch('./data/hu-pushfold.json').then((r) => r.json()), fetch('./data/hu-equity.json').then((r) => r.json())]);
    pfCache = { pf, eq };
  }
  return pfCache;
}
async function pushFold(el, ctx) {
  el.innerHTML = `${back()}<h1>Push / fold</h1><p class="dim">Loading the charts…</p>`;
  let data;
  try { data = await loadPF(); } catch { el.innerHTML = `${back()}<h1>Push / fold</h1><p class="bad">Could not load the chart data. Open this page once while online, then it works offline.</p>`; return; }
  const st = ((ctx.profile.poker ||= {}).pf ||= { stack: 10, side: 'push' });
  let sel = null, drill = null;
  const STACKS = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 25];
  function draw() {
    const row = data.pf[st.stack], set = new Set(st.side === 'push' ? row.push : row.call);
    const ev = sel && st.side === 'push' ? shoveEV(data.eq, sel, row.call, st.stack) : null;
    el.innerHTML = `${back()}<h1>Push / fold</h1>
      <p class="dim small" style="margin-top:0">Heads-up, no antes, effective stack in big blinds. These are the <b>Nash equilibrium</b> ranges: the small blind shoves or folds, the big blind calls or folds, and neither can do better by changing.</p>
      <div class="small dim">Effective stack (big blinds)</div><div class="seg" id="k" style="margin:6px 0 8px;flex-wrap:wrap">${STACKS.map((s) => `<button data-v="${s}" class="${st.stack === s ? 'on' : ''}">${s}</button>`).join('')}</div>
      <div class="seg" id="sd" style="margin:0 0 8px"><button data-v="push" class="${st.side === 'push' ? 'on' : ''}">Small blind shoves</button><button data-v="call" class="${st.side === 'call' ? 'on' : ''}">Big blind calls</button></div>
      <div class="card">${handGrid((l) => (set.has(l) ? 'in' : '') + (l === sel ? ' sel' : ''))}
        <p class="small" style="margin-bottom:0">${st.side === 'push' ? `Shove <b>${pc(row.pushPct, 0)}</b> of hands` : `Call <b>${pc(row.callPct, 0)}</b> of hands`} at ${st.stack} bb. ${sel ? `<br><b>${sel}</b>: ${set.has(sel) ? (st.side === 'push' ? 'shove' : 'call') : 'fold'}${ev !== null ? ` · shoving EV ${ev >= 0 ? '+' : '−'}${Math.abs(ev).toFixed(2)} bb vs ${'−0.50'} for folding` : ''}` : '<span class="dim">Tap a hand for details.</span>'}</p></div>
      <button class="btn primary block" id="dr">Drill me</button>
      <div class="card small"><b>Why it works.</b> With a short stack your fold equity does most of the work: the big blind has to call a shove with a wide enough range or you profit by shoving anything. The small blind’s range is wider than the big blind’s calling range because the big blind is getting a price and the small blind has the initiative. Ranges tighten steadily as stacks get deeper. Ranges are solved on chip value (no ICM); in a tournament near the bubble, call tighter.</div>`;
    el.querySelectorAll('#k button').forEach((b) => b.onclick = () => { st.stack = Number(b.dataset.v); ctx.save(); draw(); });
    el.querySelectorAll('#sd button').forEach((b) => b.onclick = () => { st.side = b.dataset.v; ctx.save(); draw(); });
    el.querySelectorAll('td.hg').forEach((td) => td.onclick = () => { sel = td.dataset.h; draw(); });
    el.querySelector('#dr').onclick = startDrill;
  }
  function startDrill() {
    let n = 0, c = 0;
    const TOTAL = 20, L = ((ctx.profile.poker ||= {}).lab ||= {});
    const next = () => {
      if (n >= TOTAL) return finish();
      const stack = pick([5, 6, 8, 10, 12, 15, 20]), row = data.pf[stack], side = pick(['push', 'call']);
      // pick hands near the boundary half of the time
      const set = new Set(side === 'push' ? row.push : row.call);
      const lab = Math.random() < 0.5 ? pick(ALL_CLASSES) : pick([...set, ...ALL_CLASSES.filter((l) => !set.has(l))].filter((l) => ALL_CLASSES.indexOf(l) > 20));
      const cards = shuf(classCombos(lab))[0], right = set.has(lab) ? 'go' : 'fold';
      el.innerHTML = `${back('#/play/poker/lab/pushfold', 'Charts')}<div class="row small dim" style="justify-content:space-between"><span>Push / fold drill</span><span class="num">${n + 1}/${TOTAL} · ${c} right</span></div>
        <div class="card"><div class="small dim">Heads-up, effective stack <b>${stack} bb</b>.</div><div class="small dim" style="margin-top:6px">You are the ${side === 'push' ? '<b>small blind</b>, first to act' : '<b>big blind</b> facing an all-in'}.</div>${pcards(cards)}</div>
        <div class="qa-opts two" id="o"><button data-v="go">${side === 'push' ? 'Shove all-in' : 'Call'}</button><button data-v="fold">Fold</button></div><div id="fb"></div>`;
      el.querySelectorAll('#o button').forEach((b) => b.onclick = () => {
        const ok = b.dataset.v === right; n++; if (ok) c++;
        const s = (L.pushfold ||= { n: 0, c: 0 }); s.n++; if (ok) s.c++; cue(ok); rec(ctx, 'poker:pushfold', `${lab} ${side} ${stack}bb`, ok); ctx.save();
        el.querySelectorAll('#o button').forEach((x) => { x.disabled = true; if (x.dataset.v === right) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
        el.querySelector('#fb').innerHTML = `<div class="verdict ${ok ? 'ok' : 'bad'} pop"><div class="head ${ok ? 'ok' : 'bad'}">${ok ? 'Correct' : 'Not quite'}</div><div class="small dim">${lab} is a ${right === 'go' ? (side === 'push' ? 'shove' : 'call') : 'fold'} at ${stack} bb (the ${side === 'push' ? 'shove' : 'call'} range there is ${pc(side === 'push' ? row.pushPct : row.callPct, 0)} of hands).</div><button class="btn primary block" id="nx" style="margin-top:8px">${n >= TOTAL ? 'Finish' : 'Next'}</button></div>`;
        el.querySelector('#nx').onclick = next;
      });
    };
    const finish = () => { el.innerHTML = `${back('#/play/poker/lab/pushfold', 'Charts')}<h1>Push / fold drill</h1><div class="stat3"><div class="card"><div class="v ${c / n >= 0.85 ? 'ok' : ''}">${Math.round(c / n * 100)}%</div><div class="k">Accuracy</div></div></div><button class="btn primary block" id="a">Again</button>`; el.querySelector('#a').onclick = startDrill; if (c / n >= 0.9) confetti(); };
    next();
  }
  draw();
}

// ---- ICM calculator ------------------------------------------------------------------------------------------------------------------------------------------
function icmScreen(el, ctx) {
  const st = ((ctx.profile.poker ||= {}).icm ||= { stacks: [4000, 3000, 2000, 1000], pays: [50, 30, 20, 0], hero: 1, vill: 0, dead: 150 });
  function draw() {
    const eq = icm(st.stacks, st.pays), tot = st.stacks.reduce((a, b) => a + b, 0), pool = st.pays.reduce((a, b) => a + b, 0);
    const h = Math.min(st.hero, st.stacks.length - 1), v = Math.min(st.vill, st.stacks.length - 1);
    const r = h !== v ? icmCall(st.stacks, st.pays, h, v, st.dead) : null;
    const num = (id, val, label) => `<label class="field" style="margin:0"><span class="small dim">${label}</span><input id="${id}" type="number" inputmode="decimal" value="${val}"></label>`;
    el.innerHTML = `${back()}<h1>ICM calculator</h1>
      <p class="dim small" style="margin-top:0">In a tournament, chips are worth less than their share of the prizes once the money is close: doubling your stack does not double your equity. ICM turns stacks into dollar equity.</p>
      <div class="card"><div class="row small dim" style="gap:6px"><span style="width:28px">#</span><span class="grow">Stack</span><span class="grow">Prize</span><span class="grow" style="text-align:right">ICM value</span></div>
        ${st.stacks.map((s, i) => `<div class="row" style="gap:6px;margin-top:4px;align-items:center"><span style="width:28px" class="${i === h ? 'ok' : i === v ? 'bad' : 'dim'}">${i === h ? 'You' : i === v ? 'Vil' : i + 1}</span><input class="grow" data-s="${i}" type="number" inputmode="numeric" value="${s}"><input class="grow" data-p="${i}" type="number" inputmode="decimal" value="${st.pays[i] || 0}"><span class="grow num" style="text-align:right">$${eq[i].toFixed(2)} <span class="dim small">(${pc(s / tot, 0)} of chips)</span></span></div>`).join('')}
        <div class="row" style="gap:8px;margin-top:8px"><button class="btn small" id="add" ${st.stacks.length >= 8 ? 'disabled' : ''}>+ player</button><button class="btn small ghost" id="rm" ${st.stacks.length <= 2 ? 'disabled' : ''}>− player</button><span class="grow small dim" style="text-align:right">Prize pool $${pool}</span></div></div>
      <div class="card"><b>The decision</b><div class="row" style="gap:8px;margin-top:6px">${num('hv', h + 1, 'You are player #')}${num('vv', v + 1, 'He shoves, player #')}${num('dd', st.dead, 'Dead chips (blinds, antes)')}</div>
        ${r ? `<table class="evtable" style="margin-top:8px"><tr><td>Fold</td><td class="num">$${r.fold.toFixed(2)}</td></tr><tr><td>Call and win</td><td class="num ok">$${r.win.toFixed(2)}</td></tr><tr><td>Call and lose</td><td class="num bad">$${r.lose.toFixed(2)}</td></tr>
          <tr><td>Equity needed in chips (no ICM)</td><td class="num">${pc(r.needChips, 1)}</td></tr><tr><td><b>Equity needed with ICM</b></td><td class="num"><b>${pc(r.needICM, 1)}</b></td></tr></table>
          <p class="small" style="margin-bottom:0">${r.needICM - r.needChips > 0.005 ? `ICM costs you <b>${((r.needICM - r.needChips) * 100).toFixed(1)}</b> points of equity: you must be ${pc(r.needICM, 0)} to call, not ${pc(r.needChips, 0)}. Call tighter than the chip maths suggests.` : 'ICM barely changes this call.'} The shover’s side is the mirror image: shoving into a covered short stack is cheaper than it looks.</p>` : '<p class="small dim">Pick two different players.</p>'}</div>`;
    el.querySelectorAll('[data-s]').forEach((i) => i.onchange = () => { st.stacks[Number(i.dataset.s)] = Math.max(0, Number(i.value) || 0); ctx.save(); draw(); });
    el.querySelectorAll('[data-p]').forEach((i) => i.onchange = () => { st.pays[Number(i.dataset.p)] = Math.max(0, Number(i.value) || 0); ctx.save(); draw(); });
    el.querySelector('#add').onclick = () => { st.stacks.push(1500); st.pays.push(0); ctx.save(); draw(); };
    el.querySelector('#rm').onclick = () => { st.stacks.pop(); st.pays.pop(); ctx.save(); draw(); };
    el.querySelector('#hv').onchange = (e) => { st.hero = Math.max(0, Math.min(st.stacks.length - 1, Number(e.target.value) - 1)); ctx.save(); draw(); };
    el.querySelector('#vv').onchange = (e) => { st.vill = Math.max(0, Math.min(st.stacks.length - 1, Number(e.target.value) - 1)); ctx.save(); draw(); };
    el.querySelector('#dd').onchange = (e) => { st.dead = Math.max(0, Number(e.target.value) || 0); ctx.save(); draw(); };
  }
  draw();
}

// ---- opponent stats --------------------------------------------------------------------------------------------------------------------------------------------
const ARCH = {
  nit: { name: 'Nit', vpip: [8, 14], pfr: [6, 12], tip: 'Folds a lot. Steal their blinds, fold to their aggression: they have it.' },
  tag: { name: 'Solid regular', vpip: [16, 24], pfr: [13, 20], tip: 'Plays like you. Look for small leaks; avoid big pots without a strong hand.' },
  lag: { name: 'Loose-aggressive', vpip: [26, 36], pfr: [20, 30], tip: 'Lots of pressure. Widen your calling range, trap with strong hands, 3-bet for value.' },
  station: { name: 'Calling station', vpip: [38, 55], pfr: [4, 10], tip: 'Calls too much, rarely bluffs. Value-bet thinly, never bluff, fold to their rare raises.' },
  maniac: { name: 'Maniac', vpip: [48, 70], pfr: [32, 50], tip: 'Bets and raises everything. Let them bluff into your strong hands; call down wider.' },
};
function oppStats(el, ctx) {
  const life = (ctx.profile.poker ||= {}).oppStats || {};
  const rows = Object.entries(life).filter(([, o]) => o.h >= 10);
  el.innerHTML = `${back()}<h1>Opponent stats</h1>
    <p class="dim small" style="margin-top:0"><b>VPIP</b> is how often a player puts money in before the flop; <b>PFR</b> is how often they raise. The gap between them says a lot: a big gap is a passive caller, a small gap is an aggressor. <b>AF</b> compares postflop bets and raises with calls.</p>
    <div class="card"><h3>From your table sessions</h3>${rows.length ? `<table class="evtable"><tr><td class="small dim">Style</td><td class="small dim">Hands</td><td class="small dim">VPIP</td><td class="small dim">PFR</td><td class="small dim">AF</td></tr>${rows.map(([k, o]) => `<tr><td>${STYLES[k] ? STYLES[k].label : k}</td><td class="num">${o.h}</td><td class="num">${Math.round(o.v / o.h * 100)}</td><td class="num">${Math.round(o.p / o.h * 100)}</td><td class="num">${o.k ? (o.a / o.k).toFixed(1) : '—'}</td></tr>`).join('')}</table>` : '<p class="small dim" style="margin:0">Play the practice table with the HUD on (it shows VPIP / PFR after six hands) and the numbers build up here.</p>'}</div>
    <div class="card"><h3>What the numbers mean</h3><table class="evtable">${Object.values(ARCH).map((a) => `<tr><td><b>${a.name}</b><div class="small dim">${a.tip}</div></td><td class="num">${a.vpip[0]}–${a.vpip[1]} / ${a.pfr[0]}–${a.pfr[1]}</td></tr>`).join('')}</table><div class="small dim">VPIP / PFR, six-handed</div></div>
    <button class="btn primary block" id="dr">Read the HUD (drill)</button>`;
  el.querySelector('#dr').onclick = () => quiz(el, ctx, {
    id: 'hud', title: 'Read the HUD', cols: 2, intro: 'A player’s numbers over a few hundred hands. What type are they and how do you play against them?',
    make: () => {
      const k = pick(Object.keys(ARCH)), a = ARCH[k], v = a.vpip[0] + rnd(a.vpip[1] - a.vpip[0] + 1), p = a.pfr[0] + rnd(a.pfr[1] - a.pfr[0] + 1);
      return { tag: 'HUD', html: `<div>VPIP <b class="num">${v}</b> · PFR <b class="num">${Math.min(p, v)}</b> · over 300 hands</div><div style="margin-top:8px"><b>What type of player is this?</b></div>`, opts: Object.entries(ARCH).map(([id, x]) => [id, x.name]), right: k, why: `<b>${a.name}</b>. ${a.tip}` };
    },
  });
}

// ---- hand review ---------------------------------------------------------------------------------------------------------------------------------------------------
function review(el, ctx, idx) {
  const hist = (ctx.profile.poker ||= {}).history || [];
  if (idx !== undefined && hist[Number(idx)]) return reviewHand(el, ctx, hist[Number(idx)]);
  el.innerHTML = `${back()}<h1>Hand review</h1>
    <p class="dim small" style="margin-top:0">The last ${hist.length || 'few'} hands from your practice-table sessions. Open one to see your equity on every street against the cards the others really held.</p>
    ${hist.length ? hist.map((h, i) => `<a class="card link row" href="#/play/poker/lab/review/${i}"><div class="grow"><div>${pcards(h.hole[0])}</div><div class="small dim">${isoDate(h.t)} · ${h.pos} · ${h.fmt === '6' ? '6-max' : h.fmt === '3' ? '3-handed' : 'heads-up'} · ${h.stack} bb</div></div><div class="num ${h.net[0] > 0 ? 'ok' : h.net[0] < 0 ? 'bad' : ''}">${h.net[0] >= 0 ? '+' : '−'}${bb(Math.abs(h.net[0]))} bb</div></a>`).join('') : '<div class="card small dim">No hands saved yet. Play the <a href="#/play/poker/table">practice table</a> and your hands appear here.</div>'}`;
}
function reviewHand(el, ctx, h) {
  const names = h.names, hero = h.hole[0];
  // live opponents at each street, from the log
  const folded = new Set(), snaps = [{ street: 'preflop', board: [], live: [], out: false }];
  for (const r of h.log) {
    if (r.deal) snaps.push({ street: r.street, board: r.deal.slice(), live: [...h.active].filter((s) => !folded.has(s)), out: folded.has(0) });
    else if (r.type === 'fold') folded.add(r.seat);
  }
  const endLive = [...h.active].filter((s) => !folded.has(s));
  const preOpps = (snaps[1] ? snaps[1].live : endLive).filter((s) => s !== 0);
  const rows = snaps.map((sn) => {
    const opps = (sn.street === 'preflop' ? preOpps : sn.live.filter((s) => s !== 0));
    if (!opps.length || sn.out) return { ...sn, eq: null, opps };
    const e = equity(hero, sn.board, opps.map((s) => h.hole[s]), 2500);
    const r = equity(hero, sn.board, opps.map(() => null), 1500);
    return { ...sn, eq: e.equity, vsRandom: r.equity, opps };
  });
  const streetActions = (street) => h.log.filter((r) => !r.deal && r.street === street).map((r) => `${r.seat === 0 ? 'You' : names[r.seat]} (${r.pos}) ${r.type === 'raise' ? 'raise to ' + bb(r.to) : r.type === 'call' ? 'call ' + bb(r.amount) : r.type}`).join(' · ');
  const bar = (v) => v === null ? '' : `<div style="height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;margin:4px 0"><div style="height:100%;width:${Math.round(v * 100)}%;background:${v >= 0.5 ? 'var(--ok)' : 'var(--bad)'}"></div></div>`;
  const first = rows.find((r) => r.eq !== null), last = [...rows].reverse().find((r) => r.eq !== null);
  const swing = first && last && last !== first ? last.eq - first.eq : 0;
  el.innerHTML = `${back('#/play/poker/lab/review', 'Hands')}<h1>Hand review</h1>
    <div class="card"><div class="row" style="gap:10px;align-items:center">${pcards(hero)}<div class="grow small dim">${h.pos} · ${h.stack} bb · ${h.fmt === '6' ? '6-max' : h.fmt === '3' ? '3-handed' : 'heads-up'}</div><b class="num ${h.net[0] > 0 ? 'ok' : h.net[0] < 0 ? 'bad' : ''}">${h.net[0] >= 0 ? '+' : '−'}${bb(Math.abs(h.net[0]))} bb</b></div>
      <div class="small dim" style="margin-top:6px">Opponents: ${[...h.active].filter((s) => s !== 0).map((s) => `${names[s]} ${pcards(h.hole[s])}`).join(' · ')}</div></div>
    ${rows.map((r) => `<div class="card"><div class="row" style="justify-content:space-between"><b style="text-transform:capitalize">${r.street}</b>${r.board.length ? pcards(r.board) : ''}</div>
      ${r.eq === null ? '<div class="small dim">You were out of the hand.</div>' : `${bar(r.eq)}<div class="small">Your equity against what they really held: <b class="${r.eq >= 0.5 ? 'ok' : 'bad'}">${pc(r.eq)}</b> <span class="dim">· against a random hand ${pc(r.vsRandom)}</span></div>`}
      <div class="small dim" style="margin-top:4px">${streetActions(r.street) || 'No betting.'}</div></div>`).join('')}
    <div class="card small"><b>How to read this.</b> ${first && last && last !== first ? `Your equity went from ${pc(first.eq)} to ${pc(last.eq)} (${swing >= 0 ? '+' : '−'}${Math.abs(Math.round(swing * 100))} points). ` : ''}Equity against their <i>actual</i> cards tells you how the hand ran. It is not the same as whether your decisions were right: you never know their cards when you act. A good fold can be a hand that was winning; a bad call can win. Judge decisions against their <i>range</i>, with the coach, and treat the run-out as luck.</div>`;
}

// ---- tilt -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const TILT = [
  { s: 'You lose a big pot at showdown when your opponent hits a two-outer on the river. The next hand is dealt immediately.', o: ['Play it normally: the last hand has no effect on this one.', 'Play it faster and looser to win it back.', 'Push all-in on the next good-looking hand.'], r: 0, w: 'A bad beat is variance, and you played it right. The only mistake available now is changing how you play because of it. Take a breath before you look at your cards.' },
  { s: 'You are down three buy-ins today, over your stop-loss. You feel certain you can win it back at a higher stake.', o: ['Move up one level to win it back faster.', 'Stop. Your stop-loss exists for exactly this moment.', 'Play on at this level until you are even.'], r: 1, w: 'A stop-loss is useless if you ignore it when you most want to. Chasing at higher stakes risks more at the moment your judgement is worst.' },
  { s: 'You have won five hours in a row and feel invincible. A player at the table is clearly better than the rest.', o: ['Keep going, you are in the zone.', 'Seek out the tough player to prove yourself.', 'Keep your normal game; consider a break or leaving: confidence is also a leak.'], r: 2, w: 'Winning streaks cause overconfidence, wider calling, and bigger bets than the cards justify. Treat a heater like a cold run: same discipline.' },
  { s: 'You have folded for 40 minutes and you are bored.', o: ['Play a few marginal hands to stay involved.', 'Wait. Folding is most of the game; or take a short break.', 'Bluff the next pot to make something happen.'], r: 1, w: 'Boredom tilt makes you play hands you would never choose. Short breaks and a task list (note reads, review a hand) beat action for its own sake.' },
  { s: 'You are three hours in, tired, and making small mistakes you would normally catch.', o: ['Push on, you are close to your target.', 'Quit the session. Your decisions are worth less when you are tired.', 'Switch to a second table so you stay awake.'], r: 1, w: 'Decision quality drops sharply with fatigue. More tables or more hours make it worse. A session you end early costs little; a tired one can cost plenty.' },
  { s: 'An opponent berates you in chat after you win a pot.', o: ['Reply and tell them what you think.', 'Mute chat, keep playing, and note whether they are tilting: that helps you.', 'Leave the table angry.'], r: 1, w: 'An angry opponent is a gift if you stay calm. Engaging gets you angry too.' },
  { s: 'You realise you made a clear mistake in a big pot that cost you a stack.', o: ['Think about nothing else for the next hour.', 'Note the hand to review later and go back to the next decision.', 'Win it back with a big bluff.'], r: 1, w: 'Mistakes are how you learn, and the lesson comes after the session. During play, the only useful thought is the next decision.' },
  { s: 'You are on the bubble of a tournament with a short stack and you keep folding while the blinds eat you.', o: ['Shove only if you are certain you have the best hand.', 'Use the push/fold charts: waiting too long is the more expensive error.', 'Fold until the bubble bursts: it is guaranteed money.'], r: 1, w: 'Fear of busting makes you wait past the point of profit. ICM supports tighter calls, but your own shoves need fold equity and the charts say when.' },
  { s: 'You lose three buy-ins in a row on correct decisions (you were ahead each time).', o: ['Your strategy must be wrong: change it.', 'Check the decisions in the review, then continue. Short runs of losses are normal.', 'Raise the stakes to speed up recovery.'], r: 1, w: 'A winning player can lose several buy-ins in a row; the swing is large. Review decisions, not results, and change only what the review finds.' },
  { s: 'Your friend at the table wins a huge pot with a hand you think they played badly.', o: ['Tell them what they did wrong.', 'Let it go. Results ≠ decisions, and it is not your table to coach.', 'Copy what they did next time.'], r: 1, w: 'Resentment is a quiet tilt source. Ignore it and play your game.' },
];
function tilt(el, ctx) {
  const L = ((ctx.profile.poker ||= {}).lab ||= {});
  el.innerHTML = `${back()}<h1>Tilt trainer</h1>
    <p class="dim small" style="margin-top:0">Tilt is playing worse because of how you feel, and it costs more than any strategy leak. Three tools: scenarios, a one-minute reset, and a quick self-check.</p>
    <button class="btn primary block" id="sc">Scenarios (10 situations)</button>
    <button class="btn block" id="rs" style="margin-top:8px">One-minute reset</button>
    <button class="btn block" id="ck" style="margin-top:8px">Am I on tilt? (self-check)</button>
    <div class="card small" style="margin-top:12px"><b>The rules that work.</b> Set a stop-loss and a time limit before you start. Take a break after any big loss, win or bad beat. Never change stakes in the middle of a session. Review decisions, not results.</div>`;
  el.querySelector('#sc').onclick = () => quiz(el, ctx, {
    id: 'tilt', title: 'Tilt scenarios', cols: 1, intro: 'What do you do?',
    make: () => { const t = pick(TILT), order = shuf(t.o.map((o, i) => [String(i), o])); return { tag: 'tilt', html: `<div>${t.s}</div>`, opts: order, right: String(t.r), cols: 1, why: t.w }; },
  });
  el.querySelector('#rs').onclick = () => reset(el, ctx);
  el.querySelector('#ck').onclick = () => selfCheck(el, ctx);
}
function reset(el, ctx) {
  let t = 0, timer = null, running = false;
  const PH = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
  el.innerHTML = `${back('#/play/poker/lab/tilt', 'Tilt')}<h1>One-minute reset</h1>
    <p class="dim small" style="margin-top:0">Box breathing: four seconds in, hold four, out four, hold four. Do it after a bad beat before you look at your next hand.</p>
    <div class="card" style="text-align:center"><div id="ph" style="font-size:22px;margin:30px 0 6px">Ready</div><div id="ct" class="big num">60</div>
      <div style="height:90px;display:flex;align-items:center;justify-content:center"><div id="bx" style="width:30px;height:30px;border-radius:8px;background:var(--info);transition:all 4s linear"></div></div></div>
    <button class="btn primary block" id="go">Start</button>`;
  const stop = () => { clearInterval(timer); running = false; };
  el.querySelector('#go').onclick = () => {
    if (running) return; running = true; t = 0;
    timer = setInterval(() => {
      t++;
      const phase = Math.floor((t - 1) / 4) % 4, bx = el.querySelector('#bx');
      if (!bx) return stop();
      el.querySelector('#ph').textContent = PH[phase]; el.querySelector('#ct').textContent = String(60 - t);
      const size = phase === 0 || phase === 1 ? 90 : 30; bx.style.width = bx.style.height = size + 'px';
      if (t >= 60) { stop(); el.querySelector('#ph').textContent = 'Done. Decide your next hand fresh.'; const L = ((ctx.profile.poker ||= {}).lab ||= {}); L.resets = (L.resets || 0) + 1; ctx.save(); }
    }, 1000);
  };
  return stop;
}
function selfCheck(el, ctx) {
  const Q = ['I am thinking about a hand from earlier more than the one in front of me.', 'I have played a hand I would normally fold, just to be involved.', 'I am betting bigger than usual to win back a loss.', 'I am annoyed at another player or the dealer.', 'I have broken my stop-loss or time limit, or I am about to.', 'I am playing faster than usual.'];
  const ans = Array(Q.length).fill(false);
  function draw() {
    const n = ans.filter(Boolean).length;
    el.innerHTML = `${back('#/play/poker/lab/tilt', 'Tilt')}<h1>Am I on tilt?</h1><p class="dim small" style="margin-top:0">Tick what is true right now.</p>
      <div class="card">${Q.map((q, i) => `<label class="toggle" style="display:flex;gap:10px;margin:8px 0"><input type="checkbox" data-i="${i}" ${ans[i] ? 'checked' : ''}> <span class="small">${q}</span></label>`).join('')}</div>
      <div class="card"><b class="${n >= 3 ? 'bad' : n >= 1 ? 'due' : 'ok'}">${n >= 3 ? 'You are on tilt. Stop for now.' : n >= 1 ? 'Early warning. Take a short break and do the reset.' : 'You look steady.'}</b><div class="small dim">${n >= 3 ? 'Leave the table, do the one-minute reset, and decide before you come back whether to play at all today.' : n >= 1 ? 'One or two signs are normal; the danger is when they stack up.' : 'Keep checking in every hour: tilt creeps up.'}</div></div>`;
    el.querySelectorAll('[data-i]').forEach((c) => c.onchange = () => { ans[Number(c.dataset.i)] = c.checked; draw(); });
  }
  draw();
}
