// Coach: the part of the app that tells you what to do next and keeps you honest.
//   #/coach                 today's plan, leak report, belts
//   #/coach/session         pre-session plan (stop-loss, time) and post-session debrief
//   #/coach/results         real-session tracker with luck-vs-expected and a bankroll chart
//   #/coach/cost            what every game costs per hour (the house-edge ladder + calculator)
//   #/coach/settings        reality checks, voice, backup
//   #/coach/help            if gambling stops being fun
//   #/coach/print           printable cheat cards

import { srs } from '../app/srs.js';
import { store } from '../app/store.js';
import { POOLS } from '../curriculum/cells.js';
import { rulesKey } from '../engine/rules.js';
import { worst, acc } from '../app/weak.js';
import { INDEX_RULES, activeRules, idxOf, RAMPS, tierName } from '../engine/indices.js';
import { RFI, rangePct } from '../engine/poker.js';
import { LESSONS } from '../curriculum/poker.js';
import { handGrid, ensurePokerCSS } from '../ui/pokercards.js';
import { streakDays, handsOnDay } from '../app/labcore.js';
import { toast } from '../ui/hand.js';
import { confirmSheet } from '../ui/sheet.js';
import { say } from '../app/voice.js';
import { startGuard, planStatus } from '../app/guard.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const back = (to = '#/coach', label = 'Coach') => `<div class="topbar"><a class="back" href="${to}">‹ ${label}</a></div>`;
const link = (href, text) => `<a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:8px" href="${href}">${text}</a>`;
const money = (x) => `${x < 0 ? '−' : x > 0 ? '+' : ''}$${Math.abs(Math.round(x)).toLocaleString()}`;
const DAY = 86400000;

export default async function coach(el, parts, ctx) {
  const [sub] = parts;
  if (sub === 'session') return sessionScreen(el, ctx);
  if (sub === 'results') return results(el, ctx);
  if (sub === 'cost') return cost(el, ctx);
  if (sub === 'settings') return settings(el, ctx);
  if (sub === 'help') return help(el);
  if (sub === 'print') return printCards(el, ctx);
  return home(el, ctx);
}

// ---- belts -------------------------------------------------------------------------------------------------------
const BELTS = [[0, 'White', '#e8e8ee'], [15, 'Yellow', '#ffd54a'], [30, 'Orange', '#ff9d3d'], [45, 'Green', '#46e6b0'], [60, 'Blue', '#7aa7ff'], [75, 'Brown', '#b07a4a'], [90, 'Black', '#555']];
const beltOf = (score) => { let i = 0; BELTS.forEach(([min], k) => { if (score >= min) i = k; }); return { i, name: BELTS[i][1], col: BELTS[i][2], next: BELTS[i + 1] || null }; };
const cov = (n, full) => Math.min(1, n / full);

async function scores(ctx) {
  const p = ctx.profile, rk = rulesKey(ctx.rules), pool = POOLS.all();
  // blackjack: share of the chart you have mastered under your current rules
  let mastered = 0; for (const c of srs.cache.values()) if (c.ruleSetKey === rk && srs.mastered(c)) mastered++;
  const bj = Math.min(100, mastered / Math.max(1, pool.length) * 100);
  const c = p.counting || {}, dv = c.dev, rp = c.ramp, tb = c.table;
  const cAcc = [dv, rp].filter((x) => x && x.n >= 10).map((x) => x.c / x.n);
  const cq = cAcc.length ? cAcc.reduce((a, b) => a + b, 0) / cAcc.length : 0;
  const counting = cq * 100 * cov((dv?.n || 0) + (rp?.n || 0) + (tb?.hands || 0), 200);
  const bs = (p.bacc && p.bacc.stats) || {}, bk = Object.values(bs).filter((x) => x.n >= 5);
  const baccQ = bk.length ? bk.reduce((a, x) => a + x.c / x.n, 0) / bk.length : 0;
  const bacc = baccQ * 100 * cov(bk.length, 6);
  const po = p.poker || {}, ps = Object.values(po.stats || {}).filter((x) => x.n >= 5);
  const pQ = ps.length ? ps.reduce((a, x) => a + x.c / x.n, 0) / ps.length : 0;
  const lessons = LESSONS.filter((l) => (po.lessons || {})[l.id]).length / LESSONS.length;
  const tq = po.table && po.table.dec ? po.table.good / po.table.dec : 0;
  const poker = 100 * (0.3 * lessons + 0.4 * pQ * cov(ps.length, 6) + 0.3 * tq * cov(po.table?.hands || 0, 100));
  return { bj, counting, bacc, poker };
}

// ---- home --------------------------------------------------------------------------------------------------------
async function home(el, ctx) {
  const p = ctx.profile, sessions = await store.allSessions(), sc = await scores(ctx), plan = planStatus(ctx);
  const goal = p.settings.dailyGoal || 30, today = handsOnDay(sessions), streak = streakDays(sessions);
  const ago = (mode, days) => sessions.some((s) => (s.mode || '').startsWith(mode) && Date.now() - s.date < days * DAY);
  const wk = worst(ctx, { n: 30 });
  const byGame = (pre) => wk.filter((w) => w.game.startsWith(pre));
  const rk = rulesKey(ctx.rules), due = srs.dueCount(ctx.rules, POOLS.all());
  // today's plan: what is weakest, what has been neglected
  const tasks = [];
  if (due > 0) tasks.push({ t: `${due} blackjack cells due for review`, s: 'Spaced repetition: the ones you are about to forget.', href: '#/lab', m: Math.max(3, Math.min(10, Math.round(due / 4))), done: ago('lab', 1) || ago('drill', 1) });
  const bc = byGame('count:'); if (bc.length) tasks.push({ t: `Counting: fix ${bc.slice(0, 3).map((x) => x.key).join(', ')}`, s: 'Your weakest index plays and bets.', href: '#/play/counting/dev', m: 5, done: ago('count', 1) });
  else if (!(p.counting && p.counting.dev)) tasks.push({ t: 'Start the Illustrious 18', s: 'You have not drilled the index plays yet.', href: '#/play/counting/dev', m: 5, done: false });
  const pk = byGame('poker:'); if (pk.length) tasks.push({ t: `Poker: ${pk.slice(0, 3).map((x) => x.key).join('; ')}`, s: 'Your most-missed spots.', href: '#/play/poker/drills', m: 6, done: ago('poker', 1) });
  else if (!(p.poker && p.poker.lessons && Object.keys(p.poker.lessons).length)) tasks.push({ t: 'Poker lesson 1: hand rankings', s: 'Five minutes to start.', href: '#/play/poker/learn/basics', m: 5, done: false });
  const bb = byGame('bacc:'); if (bb.length) tasks.push({ t: `Baccarat: ${bb[0].key} (${Math.round(bb[0].rate * 100)}%)`, s: 'Your weakest baccarat drill.', href: '#/play/baccarat', m: 4, done: ago('bacc', 1) });
  if (!ago('count-play', 7)) tasks.push({ t: 'A Count & Play session', s: 'Counting at table speed: you have not done one this week.', href: '#/play/counting/table', m: 10, done: false });
  if (!ago('poker-table', 7)) tasks.push({ t: 'A poker practice session', s: '20 hands with the coach grading.', href: '#/play/poker/table', m: 10, done: false });
  const total = tasks.reduce((a, t) => a + t.m, 0);
  const leaks = wk.slice(0, 8);
  const worstBJ = [...srs.cache.values()].filter((c) => c.ruleSetKey === rk && c.attempts >= 3 && c.correct < c.attempts).sort((a, b) => a.correct / a.attempts - b.correct / b.attempts || (b.evLostTotal || 0) - (a.evLostTotal || 0)).slice(0, 4);
  const lock = p.cooldownUntil && p.cooldownUntil > Date.now() ? p.cooldownUntil : 0;
  const GN = { bj: 'Blackjack', counting: 'Counting', bacc: 'Baccarat', poker: 'Poker' };
  const beltCards = Object.entries(sc).map(([k, v]) => { const b = beltOf(v); return `<div class="card" style="margin:0;padding:10px 12px"><div class="row" style="justify-content:space-between"><b>${GN[k]}</b><span class="small" style="color:${b.col}">● ${b.name} belt</span></div><div style="height:6px;background:var(--surface2);border-radius:3px;margin:6px 0"><div style="height:6px;width:${Math.min(100, v)}%;background:${b.col};border-radius:3px"></div></div><div class="small dim">${Math.round(v)} / 100${b.next ? ` · ${b.next[0] - Math.round(v) > 0 ? b.next[0] - Math.round(v) : 1} points to ${b.next[1]}` : ' · top rank'}</div></div>`; }).join('');
  const gname = (g) => ({ 'count:dev': 'Index play', 'count:ramp': 'Bet sizing', 'count:play': 'Count & Play', 'poker:table': 'Poker table' }[g] || g.replace(':', ' · ').replace('poker', 'Poker').replace('bacc', 'Baccarat'));
  el.innerHTML = `<h1>Coach</h1>
    <a class="card link row" href="#/study"><div class="grow"><b>Coach memory</b><div class="small dim">Questions it could not answer, and what it has learned.</div></div><div class="dim">›</div></a>
    <a class="card link row" href="#/ask" style="border-color:var(--info)"><div class="grow"><b class="info">Ask the Coach</b><div class="small dim">Any hand, count, bet or concept. Plain English, worked out with the real solvers, offline.</div></div>›</a>
    ${lock ? `<div class="card" style="border-color:var(--due)"><b class="due">Cooldown until ${new Date(lock).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</b><div class="small dim">You went past your stop-loss. Take the break: practice is fine, real-money play can wait. <a href="#/coach/help">Help and limits</a> · <a href="#" id="clrlock">End cooldown</a></div></div>` : ''}
    ${plan ? `<div class="card"><b>Session in progress</b> · ${plan.game}<div class="small dim">${plan.elapsedMin} of ${plan.minutes} min · stop-loss $${plan.limit}</div>${link('#/coach/session', 'End session and debrief')}</div>` : ''}
    <div class="card row"><div class="grow"><div class="small dim">Today</div><b class="num">${today}</b> <span class="dim">of ${goal} reps</span><div style="height:6px;background:var(--surface2);border-radius:3px;margin-top:6px"><div style="height:6px;width:${Math.min(100, today / goal * 100)}%;background:var(--ok);border-radius:3px"></div></div></div><div style="text-align:right"><div class="small dim">Streak</div><b class="num ${streak ? 'ok' : 'dim'}">${streak}</b> <span class="small dim">day${streak === 1 ? '' : 's'}</span></div></div>
    <h2>Today's plan <span class="small dim" style="text-transform:none">· about ${total} min</span></h2>
    ${tasks.length ? tasks.slice(0, 5).map((t) => `<a class="card link row" href="${t.href}"><div class="grow"><b>${esc(t.t)}</b><div class="small dim">${esc(t.s)}</div></div><div class="small ${t.done ? 'ok' : 'dim'}">${t.done ? '✓ done' : t.m + ' min'}</div></a>`).join('') : '<div class="card small dim">Nothing is overdue. Pick any game and keep the streak going.</div>'}
    <h2>Leak report</h2>
    <div class="card"><div class="small dim" style="margin-bottom:6px">The spots you miss most, across every game (at least two tries each).</div>
      ${leaks.length || worstBJ.length ? `<table class="evtable">${worstBJ.map((c) => `<tr><td>Blackjack · ${esc(c.rowKey)} vs ${c.up === 1 ? 'A' : c.up}</td><td class="num bad">${Math.round(c.correct / c.attempts * 100)}%</td><td class="small dim num">${c.attempts}×</td></tr>`).join('')}${leaks.map((w) => `<tr><td>${esc(gname(w.game))} · ${esc(w.key)}</td><td class="num bad">${Math.round(w.rate * 100)}%</td><td class="small dim num">${w.n}×</td></tr>`).join('')}</table>` : '<div class="small dim">No leaks recorded yet. Play a few drills and they will show up here.</div>'}</div>
    <h2>Belts</h2><div style="display:grid;gap:8px">${beltCards}</div>
    <div class="small dim" style="margin:6px 0">A belt is accuracy × how much you have practised, so it only rises with real reps.</div>
    <h2>Keep yourself honest</h2>
    <a class="card link row" href="#/coach/session"><div class="grow"><b>Plan a real session</b><div class="small dim">Set a stop-loss and a time limit before you play; debrief after.</div></div>›</a>
    <a class="card link row" href="#/coach/results"><div class="grow"><b>Real results</b><div class="small dim">Your actual sessions, versus what the math says to expect.</div></div>›</a>
    <a class="card link row" href="#/coach/cost"><div class="grow"><b>What each game costs</b><div class="small dim">Expected loss per hour, ranked.</div></div>›</a>
    <a class="card link row" href="#/coach/print"><div class="grow"><b>Printable cheat cards</b><div class="small dim">Index plays, ranges, odds, baccarat: for a notebook, not the table.</div></div>›</a>
    <a class="card link row" href="#/coach/settings"><div class="grow"><b>Settings</b><div class="small dim">Reality checks, voice coach, backup.</div></div>›</a>
    <a class="card link row" href="#/coach/help"><div class="grow"><b>Help and limits</b><div class="small dim">If gambling stops being fun.</div></div>›</a>`;
  const cl = el.querySelector('#clrlock'); if (cl) cl.onclick = async (e) => { e.preventDefault(); p.cooldownUntil = 0; await ctx.save(); home(el, ctx); };
}

// ---- session ritual --------------------------------------------------------------------------------------------------
const GAMES = ['Blackjack', 'Baccarat', 'Poker (cash)', 'Poker (tournament)', 'Video poker', 'Other'];
function sessionScreen(el, ctx) {
  const p = ctx.profile, plan = planStatus(ctx);
  if (!plan) {
    const d = p.lastPlan || { game: 'Blackjack', limit: 50, minutes: 45, goal: 50 };
    el.innerHTML = `${back()}<h1>Plan a session</h1>
      <p class="dim small" style="margin-top:0">Decide before you sit down, when you are calm. The plan is a promise: when the limit or the time is reached, you stop.</p>
      <div class="card"><label class="field">Game<select id="g">${GAMES.map((g) => `<option ${g === d.game ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
        <label class="field">Stop-loss ($): the most I will lose today<input id="l" type="number" inputmode="decimal" value="${d.limit}"></label>
        <label class="field">Time limit (minutes)<input id="m" type="number" inputmode="numeric" value="${d.minutes}"></label>
        <label class="field">Win goal ($, optional): a number at which I am happy to leave<input id="w" type="number" inputmode="decimal" value="${d.goal}"></label></div>
      <div class="card small dim">Rules I am setting: stop when I lose my stop-loss, even if I think I am due; stop when the time is up; never replace a loss with more money than planned; no play while tired, upset or drinking.</div>
      <button class="btn primary block" id="go">Start session</button>${link('#/coach/results', 'Past results')}`;
    el.querySelector('#go').onclick = async () => {
      const limit = Number(el.querySelector('#l').value), minutes = Number(el.querySelector('#m').value);
      if (!(limit > 0 && minutes > 0)) return toast('Set a stop-loss and a time limit.');
      p.plan = { game: el.querySelector('#g').value, limit, minutes, goal: Number(el.querySelector('#w').value) || 0, start: Date.now() };
      p.lastPlan = { ...p.plan }; await ctx.save(); startGuard(ctx); toast('Session started. Play well, stop on time.', 2800); sessionScreen(el, ctx);
    };
    return;
  }
  el.innerHTML = `${back()}<h1>Session debrief</h1>
    <div class="card"><b>${plan.game}</b><div class="small dim">${plan.elapsedMin} of ${plan.minutes} minutes · stop-loss $${plan.limit}${plan.goal ? ` · goal +$${plan.goal}` : ''}</div></div>
    <div class="card"><label class="field">Result in dollars (negative for a loss)<input id="r" type="number" inputmode="decimal" placeholder="e.g. -35 or 20"></label>
      <label class="field">Hands played (optional)<input id="h" type="number" inputmode="numeric"></label>
      <label class="field">Average bet in dollars (optional)<input id="b" type="number" inputmode="decimal"></label>
      <label class="field">How did I feel? (1 = tilted, 5 = calm)<select id="mood">${[1, 2, 3, 4, 5].map((n) => `<option ${n === 4 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field">Did I follow my plan?<select id="ok"><option value="1">Yes</option><option value="0">No</option></select></label>
      <label class="field">One thing I did well, one thing to fix<textarea id="n" rows="3"></textarea></label></div>
    <button class="btn primary block" id="save">Save and finish</button><div class="gap"></div><button class="btn ghost block" id="cancel">Cancel session without saving</button>`;
  el.querySelector('#cancel').onclick = async () => { delete p.plan; await ctx.save(); startGuard(ctx); sessionScreen(el, ctx); };
  el.querySelector('#save').onclick = async () => {
    const r = Number(el.querySelector('#r').value);
    if (!Number.isFinite(r) || el.querySelector('#r').value === '') return toast('Enter the result (0 if you broke even).');
    const rec = { t: Date.now(), game: plan.game, result: r, hands: Number(el.querySelector('#h').value) || 0, bet: Number(el.querySelector('#b').value) || 0, mins: plan.elapsedMin, mood: Number(el.querySelector('#mood').value), followed: el.querySelector('#ok').value === '1', note: el.querySelector('#n').value.trim(), limit: plan.limit, planMin: plan.minutes };
    (p.real ||= []).push(rec); delete p.plan;
    if (-r >= plan.limit && plan.limit > 0) { p.cooldownUntil = Date.now() + 12 * 3600 * 1000; }
    await ctx.save(); startGuard(ctx);
    toast(p.cooldownUntil > Date.now() ? 'Saved. You hit your stop-loss: 12-hour cooldown started.' : 'Saved.', 3200);
    location.hash = '#/coach/results';
  };
}

// ---- real results ----------------------------------------------------------------------------------------------------------
const EDGE = { Blackjack: 0.5, Baccarat: 1.06, 'Poker (cash)': 0, 'Poker (tournament)': 0, 'Video poker': 0.46, Other: 3 };
function results(el, ctx) {
  const list = (ctx.profile.real ||= []).slice().sort((a, b) => a.t - b.t);
  let cum = 0; const pts = list.map((s) => (cum += s.result));
  const exp = list.reduce((a, s) => a - (s.hands && s.bet ? s.hands * s.bet * (EDGE[s.game] ?? 3) / 100 : 0), 0);
  const known = list.filter((s) => s.hands && s.bet).reduce((a, s) => a + s.result, 0);
  const W = 340, H = 110, mn = Math.min(0, ...pts), mx = Math.max(0, ...pts), sc = (v) => H - 8 - (v - mn) / Math.max(1, mx - mn) * (H - 16);
  const line = pts.length > 1 ? pts.map((v, i) => `${(8 + i / (pts.length - 1) * (W - 16)).toFixed(1)},${sc(v).toFixed(1)}`).join(' ') : '';
  const followed = list.filter((s) => s.followed).length;
  el.innerHTML = `${back()}<h1>Real results</h1>
    ${list.length ? `<div class="card"><div class="row"><div class="grow"><div class="small dim">Total</div><div class="big num ${cum >= 0 ? 'ok' : 'bad'}">${money(cum)}</div></div><div class="grow"><div class="small dim">Sessions</div><div class="big num">${list.length}</div></div><div class="grow"><div class="small dim">Stuck to plan</div><div class="big num ${followed === list.length ? 'ok' : 'due'}">${Math.round(followed / list.length * 100)}%</div></div></div>
      ${line ? `<svg viewBox="0 0 ${W} ${H}" style="width:100%;margin-top:8px"><line x1="8" x2="${W - 8}" y1="${sc(0)}" y2="${sc(0)}" stroke="var(--line)" stroke-dasharray="3 3"/><polyline points="${line}" fill="none" stroke="${cum >= 0 ? 'var(--ok)' : 'var(--bad)'}" stroke-width="2"/></svg>` : ''}</div>
      <div class="card"><h3>Luck versus the math</h3>${exp ? `<p class="small">For the sessions where you entered hands and average bet, the game's house edge predicts <b>${money(exp)}</b>. You actually got <b>${money(known)}</b>. The difference, <b>${money(known - exp)}</b>, is variance. Short samples swing far more than the edge: that is normal, not skill and not bad luck.</p>` : '<p class="small dim">Enter hands played and average bet in the debrief to see how your results compare with the expected loss.</p>'}</div>
      <h2>Sessions</h2>${list.slice().reverse().map((s) => `<div class="card"><div class="row" style="justify-content:space-between"><b>${esc(s.game)}</b><b class="num ${s.result >= 0 ? 'ok' : 'bad'}">${money(s.result)}</b></div><div class="small dim">${new Date(s.t).toLocaleDateString()} · ${s.mins} min · mood ${s.mood}/5 · ${s.followed ? 'followed plan' : '<span class="bad">broke plan</span>'}${s.hands ? ` · ${s.hands} hands` : ''}</div>${s.note ? `<div class="small" style="margin-top:4px">${esc(s.note)}</div>` : ''}</div>`).join('')}` : '<div class="card small dim">No real sessions yet. Plan one, play, then debrief: this page turns the notes into a picture.</div>'}
    ${link('#/coach/session', 'Plan a session')}`;
}

// ---- cost of play ---------------------------------------------------------------------------------------------------------------
export const COSTS = [
  ['Video poker, 9/6 Jacks or Better, perfect play', 0.46, 600], ['Blackjack, good rules, perfect basic strategy', 0.45, 70], ['Craps, don\'t pass / pass line', 1.4, 100], ['Baccarat, Banker bet', 1.06, 70], ['Baccarat, Player bet', 1.24, 70],
  ['Roulette, single zero', 2.7, 40], ['Casino War (going to war on ties)', 2.88, 70], ['Three Card Poker, Ante/Play', 3.37, 60], ['Blackjack, 6:5 payout, perfect play', 1.9, 70], ['Caribbean Stud', 5.22, 50], ['Roulette, double zero', 5.26, 40],
  ['Three Card Poker, Pair Plus', 7.28, 60], ['Dragon 7 / Panda 8 baccarat side bets', 7.61, 70], ['Baccarat, Tie (8 to 1)', 14.36, 70], ['Slots, typical range', 8, 600], ['Keno', 30, 150],
];
function cost(el, ctx) {
  const st = { i: 3, bet: 25, per: null };
  const draw = () => {
    const [name, edge, def] = COSTS[st.i], per = st.per ?? def, loss = st.bet * per * edge / 100;
    el.innerHTML = `${back()}<h1>What each game costs</h1>
      <p class="dim small" style="margin-top:0">The house edge is the average share of every dollar wagered that the house keeps. The cost per hour is bet × hands per hour × edge: the price of the entertainment. Edges are for correct play; slots and keno vary by machine and site.</p>
      <div class="card"><label class="field">Game<select id="g">${COSTS.map((c, i) => `<option value="${i}" ${i === st.i ? 'selected' : ''}>${c[0]}</option>`).join('')}</select></label>
        <div class="row" style="gap:8px"><label class="field grow">Bet ($)<input id="b" type="number" value="${st.bet}"></label><label class="field grow">Rounds per hour<input id="p" type="number" value="${per}"></label></div>
        <div class="small">You wager <b>$${(st.bet * per).toLocaleString()}</b> an hour. At ${edge}%, the expected cost is <b class="bad">$${loss.toFixed(2)} per hour</b>.</div></div>
      <h2>The ladder, cheapest first, at $${st.bet} a round</h2><div class="card"><table class="evtable">${COSTS.slice().sort((a, b) => a[1] * a[2] - b[1] * b[2]).map(([n, e, d]) => `<tr><td>${esc(n)}</td><td class="num">${e}%</td><td class="num bad">$${(st.bet * d * e / 100).toFixed(0)}/h</td></tr>`).join('')}</table><div class="small dim" style="margin-top:6px">Speed matters as much as edge: video poker is a cheap game played so fast that it can cost more per hour than a table game.</div></div>`;
    el.querySelector('#g').onchange = (e) => { st.i = Number(e.target.value); st.per = null; draw(); };
    el.querySelector('#b').onchange = (e) => { st.bet = Number(e.target.value) || 1; draw(); };
    el.querySelector('#p').onchange = (e) => { st.per = Number(e.target.value) || 1; draw(); };
  };
  draw();
}

// ---- settings -----------------------------------------------------------------------------------------------------------------------
function settings(el, ctx) {
  const s = ctx.profile.settings;
  const seg = (id, items, cur) => `<div class="seg" id="${id}" style="margin:6px 0 10px">${items.map(([v, t]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const draw = () => {
    el.innerHTML = `${back()}<h1>Settings</h1>
      <div class="small dim">Reality check: remind me every</div>${seg('rc', [[0, 'Off'], [15, '15 min'], [30, '30 min'], [60, '60 min']], s.realityMin ?? 30)}
      <div class="small dim">Voice coach (spoken feedback in drills)</div>${seg('vo', [[0, 'Off'], [1, 'On']], s.voice ? 1 : 0)}
      <div class="small dim">Daily goal (reps)</div>${seg('dg', [[15, '15'], [30, '30'], [60, '60'], [100, '100']], s.dailyGoal || 30)}
      <div class="small dim">Colour-blind friendly accents</div>${seg('cb', [[0, 'Off'], [1, 'On']], s.colorblind ? 1 : 0)}
      <div class="card"><h3>Backup</h3><p class="small dim">Everything lives on this device. Export a backup file regularly.</p>${link('#/stats', 'Open backup and restore')}</div>`;
    const bind = (id, fn) => el.querySelectorAll(`#${id} button`).forEach((b) => b.onclick = async () => { fn(Number(b.dataset.v)); await ctx.save(); startGuard(ctx); document.documentElement.classList.toggle('cb', !!s.colorblind); if (id === 'vo' && s.voice) say('Voice coach on'); draw(); });
    bind('rc', (v) => { s.realityMin = v; }); bind('vo', (v) => { s.voice = !!v; }); bind('dg', (v) => { s.dailyGoal = v; }); bind('cb', (v) => { s.colorblind = !!v; });
  };
  draw();
}

// ---- help --------------------------------------------------------------------------------------------------------------------------------
function help(el) {
  el.innerHTML = `${back()}<h1>Help and limits</h1>
    <div class="card"><p class="small" style="margin-top:0">Everything in this app is practice, and practice is the safe version. If real-money play is on your mind, these signs are worth taking seriously:</p>
      <ul class="small" style="padding-left:18px"><li>Playing longer or with more than you planned.</li><li>Chasing losses, or feeling you are “due”.</li><li>Hiding how much you play or lose.</li><li>Borrowing, or using money meant for bills.</li><li>Feeling anxious or low when you are not playing.</li></ul></div>
    <div class="card"><h3>Where to get help</h3><p class="small">In the United States, the National Problem Gambling Helpline is free, confidential and open 24 hours: call or text <b>1-800-GAMBLER</b>, or chat at <b>ncpgambling.org</b>. Most sites and casinos also offer self-exclusion and deposit limits: use them.</p></div>
    <div class="card"><h3>Habits that protect you</h3><ul class="small" style="padding-left:18px;margin:0"><li>Only play with money you can afford to lose entirely.</li><li>Set the stop-loss before you start (the Plan screen does this) and treat it as final.</li><li>Take breaks. Never play to “win it back”.</li><li>Do not play when tired, upset or drinking.</li></ul></div>
    ${link('#/coach/session', 'Plan a session')}`;
}

// ---- print ----------------------------------------------------------------------------------------------------------------------------------
function printCards(el, ctx) {
  ensurePokerCSS();
  const rules = ctx.rules, ir = activeRules(rules, { tiers: ['i18', 'fab4', 'x'] });
  const sg = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0');
  el.innerHTML = `${back()}<h1>Cheat cards</h1>
    <p class="dim small" style="margin-top:0">For a notebook or a second screen while you practise. Use your browser's print or “save as PDF”.</p>
    <button class="btn primary block" id="pr">Print / save as PDF</button>
    <div class="card"><h3>Hi-Lo and index plays</h3><div class="small">2–6 = +1 · 7–9 = 0 · 10 J Q K A = −1 · True count = running ÷ decks left</div>
      <table class="evtable" style="font-size:13px;margin-top:6px">${ir.map((r) => `<tr><td>${r.label}</td><td>${{ S: 'Stand', H: 'Hit', D: 'Double', P: 'Split', R: 'Surrender' }[r.play]}</td><td class="num">${sg(idxOf(r, rules))}+</td><td class="small dim">${tierName[r.tier]}</td></tr>`).join('')}<tr><td>Insurance</td><td>Take</td><td class="num">+3+</td><td class="small dim">Illustrious 18</td></tr></table>
      <div class="small dim" style="margin-top:6px">Bet ramps (units by true count ≤1, 2, 3, 4, 5, 6, 7+): ${Object.entries(RAMPS).map(([k, v]) => `${v.name}: ${[1, 2, 3, 4, 5, 6, 7].map((t) => v.at(t)).join('-')}`).join(' · ')}</div></div>
    <div class="card"><h3>Poker: raise-first-in ranges (6-max, 100bb)</h3>${['UTG', 'CO', 'BTN'].map((k) => `<div class="small"><b>${k}</b> ${Math.round(rangePct(RFI[k]) * 100)}%</div>${handGrid((l) => (RFI[k].has(l) ? 'in' : ''), { small: true })}`).join('')}</div>
    <div class="card"><h3>Poker: pot odds and outs</h3><table class="evtable" style="font-size:13px"><tr><td>Bet ⅓ pot</td><td class="num">need 20%</td><td>Flush draw</td><td class="num">9 outs</td></tr><tr><td>Bet ½ pot</td><td class="num">need 25%</td><td>Open-ended</td><td class="num">8 outs</td></tr><tr><td>Bet ⅔ pot</td><td class="num">need 29%</td><td>Gutshot</td><td class="num">4 outs</td></tr><tr><td>Bet pot</td><td class="num">need 33%</td><td>Two overcards</td><td class="num">6 outs</td></tr></table><div class="small dim">Flop: outs × 4. Turn: outs × 2.</div></div>
    <div class="card"><h3>Baccarat</h3><div class="small">Player draws on 0–5, stands on 6–7. Banker with no Player draw: draws 0–5. Otherwise by Player's third card: Banker 3 draws unless 8 · 4 draws on 2–7 · 5 draws on 4–7 · 6 draws on 6–7 · 7 stands. Costs: Banker 1.06% · Player 1.24% · Tie 14.4% · pairs 10–11%.</div></div>`;
  el.querySelector('#pr').onclick = () => window.print();
}
