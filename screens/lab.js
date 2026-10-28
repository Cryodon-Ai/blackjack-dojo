// Strategy Lab: several ways to learn the same basic-strategy chart. Every method feeds the shared
// per-cell mastery record in app/srs.js (3 correct in a row = mastered, a miss resets it).

import { startRunner } from '../games/runner.js';
import { ALWAYS_RULES, alwaysFor, LADDER, GUT, SHORTCUT, isStiffUp, coachPool, bucketOf, randomRanks, ROWS, ROW } from '../curriculum/cells.js';
import { UPCARDS, upLabel, rulesKey, normalizeRules } from '../engine/rules.js';
import { srs, MASTERED } from '../app/srs.js';
import { store } from '../app/store.js';
import { engine } from '../app/engine-client.js';
import { describeRules, PRESETS } from '../app/presets.js';
import { openRulesEditor } from '../ui/rules-editor.js';
import { openSheet, confirmSheet } from '../ui/sheet.js';
import { renderTable, toast } from '../ui/hand.js';
import { makeCard, makeHand } from '../ui/cards.js';
import { TAGS, whyChoices } from '../app/why.js';
import { ACTION_NAME, explain, evKey } from '../app/feedback.js';
import { journal } from '../app/journal.js';
import { cue } from '../app/feel.js';
import {
  BUCKET_NAME, recommend, symOf, runsText, streakDays, handsOnDay, methodInsights, slowSpots, worstCells, mistakeSummary,
} from '../app/labcore.js';

const DRILLABLE = ROWS.filter((r) => !(r.kind === 'hard' && r.total === 21));
const ALL = () => DRILLABLE.flatMap((r) => UPCARDS.map((u) => ({ rowKey: r.key, up: u })));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const labelOf = (rowKey, up) => `${ROW[rowKey].label} vs ${upLabel(up)}`;
const linkBtn = (href, text) => `<a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:8px" href="${href}">${text}</a>`;
const backBar = (to = '#/lab') => `<div class="topbar"><a class="back" href="${to}">‹ Lab</a></div>`;

export default async function lab(el, parts, ctx) {
  const [m, arg] = parts;
  switch (m) {
    case 'always': return always(el, ctx);
    case 'ladder': return arg ? run(el, ctx, { id: 'ladder-' + arg, ...ladderStage(arg) }) : ladder(el, ctx);
    case 'gut': return run(el, ctx, { id: 'gut', title: 'Gut-Check', pool: GUT(), blurb: 'These 20 spots feel wrong but are right.' });
    case 'why': return run(el, ctx, { id: 'why', title: 'Why Mode', pool: ALL(), why: true, blurb: 'Pick the play, then say why.' });
    case 'fade': return fade(el, ctx);
    case 'coach': return coach(el, ctx);
    case 'shortcut': return shortcut(el, ctx);
    case 'lists': return lists(el, ctx);
    case 'sprint': return sprint(el, ctx);
    case 'audit': return audit(el, ctx);
    case 'today': return today(el, ctx);
    case 'worst': return fixList(el, ctx, 'worst');
    case 'slow': return fixList(el, ctx, 'slow');
    case 'journal': return journalView(el, ctx);
    case 'insights': return insights(el, ctx);
    case 'when': return when(el);
    default: return hub(el, ctx);
  }
}

// ---- shared bits ----------------------------------------------------------------------------------
const chipOf = (ctx) => `<div class="card row" id="rulechip"><div class="grow"><div class="small dim">Table rules</div><div class="small">${describeRules(ctx.rules)}</div><div class="small dim" id="diff"></div></div><button class="btn small ghost" id="chg">Change</button></div>`;
function wireChip(el, ctx, again) {
  const b = el.querySelector('#chg');
  if (b) b.onclick = () => openRulesEditor(ctx.rules, { title: 'Table rules', onSave: async (r, id) => { await ctx.setRules(r, id); engine.prefill(ctx.rules, () => {}); again(); } });
}
const SYNC = ['reference', 'typical-online', 'grand-bonus', 'gravity'].map((id) => PRESETS.find((p) => p.id === id)).filter(Boolean);
const presetRow = (ctx) => `<div class="seg" id="presets" style="overflow-x:auto;margin-bottom:8px">${SYNC.map((p) => `<button data-p="${p.id}" class="${ctx.profile.activePresetId === p.id ? 'on' : ''}" style="min-width:104px;font-size:13px">${p.name.replace(' Blackjack', '').replace('Normal online blackjack', 'Normal online')}</button>`).join('')}</div>`;
function wirePresets(el, ctx, again) {
  el.querySelectorAll('#presets button').forEach((b) => b.onclick = async () => {
    const p = PRESETS.find((x) => x.id === b.dataset.p);
    await ctx.setRules(p.rules, p.id); engine.prefill(ctx.rules, () => {});
    if (p.unverified) toast('Rules for this game are assumed. Check its info screen.');
    again();
  });
}

function progress(ctx, pool) {
  let done = 0;
  for (const c of pool) if (srs.mastered(srs.get(c.rowKey, c.up, ctx.rules))) done++;
  return { done, n: pool.length };
}
const bar = (p) => `<div class="bar"><div class="fill ${p.n && p.done === p.n ? 'break' : ''}" style="width:${p.n ? Math.round((p.done / p.n) * 100) : 0}%"></div></div><div class="small dim num">${p.done} of ${p.n} mastered</div>`;

async function resetPool(ctx, pool) {
  for (const p of pool) { const c = srs.get(p.rowKey, p.up, ctx.rules); if (c && c.streak) { c.streak = 0; await store.putCell(c); } }
}

// This ruleset's cells (for weak/slow lists), from the in-memory cache.
// Always-Rules cells that hold on the active table (cached per ruleset).
let alwaysCache = { key: '', v: null };
async function alwaysPool(ctx) {
  const key = rulesKey(ctx.rules);
  if (alwaysCache.key !== key) alwaysCache = { key, v: await alwaysFor(async (rk, up) => (await engine.cell(ctx.rules, rk, up)).action) };
  return alwaysCache.v;
}
const myCells = (ctx) => { const rk = rulesKey(ctx.rules); return [...srs.cache.values()].filter((c) => c.ruleSetKey === rk && ROW[c.rowKey]); };

// ---- hub ------------------------------------------------------------------------------------------
async function hub(el, ctx) {
  const sessions = await store.allSessions();
  const goal = ctx.profile.settings.dailyGoal || 30;
  const todayN = handsOnDay(sessions), streak = streakDays(sessions);
  const all = ALL();
  const card = (href, title, sub, pool) => `<a class="card link" href="${href}"><h3>${title}</h3><div class="small dim">${sub}</div>${pool ? bar(progress(ctx, pool)) : ''}</a>`;
  const alwCached = alwaysCache.key === rulesKey(ctx.rules);
  const alw = alwCached ? alwaysCache.v : { pool: ALWAYS_RULES.flatMap((r) => r.pool()) };   // exact pool fills in once the engine has the cells
  const cells = myCells(ctx);
  const worst = worstCells(cells), slow = slowSpots(cells), mist = journal.list().length;
  const coachAge = ctx.profile.coach ? Math.floor((Date.now() - ctx.profile.coach.date) / 86400000) : null;
  const welcome = !sessions.length && !ctx.profile.coach;

  // Accuracy by zone from the cell record.
  const zone = {};
  for (const c of cells) { const b = bucketOf(c.rowKey); const z = (zone[b] ||= { a: 0, c: 0 }); z.a += c.attempts; z.c += c.correct; }

  el.innerHTML = `<h1>Strategy Lab</h1>
    ${welcome ? `<div class="card ok"><b>New here?</b><div class="small dim" style="margin-top:4px">The Lab teaches one chart in several ways. Take the 20-hand Coach check below and it will pick where to start. A spot is <b>mastered</b> after ${MASTERED} right in a row.</div></div>` : ''}
    <div class="card row"><div class="grow"><div class="small dim">Today</div><b class="num">${todayN}</b> <span class="dim">of ${goal} hands</span>${bar2(todayN, goal)}</div><div style="text-align:right"><div class="small dim">Streak</div><b class="num ${streak ? 'ok' : 'dim'}">${streak}</b> <span class="dim small">day${streak === 1 ? '' : 's'}</span></div></div>
    <a class="card link ok" href="#/lab/today"><h3>Today's workout</h3><div class="small dim">15 hands: what's due, your weak spots, and a few new ones. The quickest useful session.</div></a>
    ${coachCard(ctx, coachAge)}
    ${presetRow(ctx)}${chipOf(ctx)}
    <div class="card"><b>Overall</b>${bar(progress(ctx, all))}<div id="minimap" style="margin-top:10px"></div>
      <div class="small dim" style="margin-top:6px">Each dot is one hand-versus-upcard spot. Green = mastered, amber = in progress, red = just missed.</div></div>
    ${Object.keys(zone).length ? `<div class="card"><b>Your accuracy by area</b>${Object.entries(zone).map(([b, z]) => `<div class="row small" style="margin-top:6px"><div style="width:150px">${BUCKET_NAME[b]}</div><div class="grow bar"><div class="fill ${z.c / z.a >= 0.9 ? 'break' : ''}" style="width:${Math.round((z.c / z.a) * 100)}%"></div></div><div class="num" style="width:40px;text-align:right">${Math.round((z.c / z.a) * 100)}%</div></div>`).join('')}</div>` : ''}
    ${worst.length ? `<a class="card link due" href="#/lab/worst"><h3>Fix my worst ${worst.length}</h3><div class="small dim">${worst.slice(0, 4).map((c) => labelOf(c.rowKey, c.up)).join(' · ')}…</div></a>` : ''}
    ${slow.length ? `<a class="card link" href="#/lab/slow"><h3>${slow.length} slow spot${slow.length === 1 ? '' : 's'}</h3><div class="small dim">You get these right but take over 5 seconds. Make them reflex.</div></a>` : ''}
    <h2>Start here</h2>
    ${card('#/lab/always', 'Always-Rules', 'Six plays that never change. They cover a big share of every session.', alw.pool)}
    ${card('#/lab/ladder', 'Chunk Ladder', 'Stiff hands, soft hands, pairs, doubling: one chunk at a time.', LADDER.flatMap((s) => s.pool()))}
    ${card('#/lab/shortcut', 'Dealer-Stiff Shortcut', 'Assume the hidden card is a ten: dealer 2–6 is stiff, 7–A is strong. One idea decides most stand/hit calls.', SHORTCUT())}
    ${card('#/lab/lists', 'Rule Lists', 'The chart as short sentences, for your table. Cover and recall, or build a memory palace.', null)}
    <h2>Sharpen</h2>
    ${card('#/lab/gut', 'Gut-Check', 'The 20 spots where the right play feels wrong.', GUT())}
    ${card('#/lab/why', 'Why Mode', 'Pick the play, then pick the reason. Builds understanding, not just memory.', null)}
    ${card('#/lab/audit', 'Spot the Mistake', 'Watch a play and call it right or wrong. Like checking a friend at the table.', null)}
    ${card('#/lab/fade', 'Fade Chart', 'The full chart, with spots fading away as you master them.', all)}
    ${card('#/lab/sprint', 'Sprint', `60 seconds. How many can you get right? Best: ${ctx.profile.bests.sprint || 0}`, null)}
    <h2>Know yourself</h2>
    <a class="card link" href="#/lab/when"><h3>Which method when?</h3><div class="small dim">The best method for each situation: first time, rusty, going to play tonight, and more.</div></a>
    <a class="card link" href="#/lab/insights"><h3>What's working for you</h3><div class="small dim">Accuracy and volume by method, from your own sessions.</div></a>
    <a class="card link" href="#/lab/journal"><h3>Mistake journal</h3><div class="small dim">${mist ? `Your last ${mist} mistake${mist === 1 ? '' : 's'}, grouped by spot.` : 'Nothing yet. Mistakes you make in any drill land here.'}</div></a>
    <h2>Also in the Dojo</h2>
    <a class="card link" href="#/play/practice"><h3>Rewind Play</h3><div class="small dim">Play whole hands, then rewind to the decision where you slipped (Practice Table).</div></a>
    <a class="card link" href="#/learn"><h3>Classic course</h3><div class="small dim">The original tiered lessons, quizzes and certification.</div></a>
    <a class="card link" href="#/guide"><h3>Guide</h3><div class="small dim">The chart and cheat card for your table, always on hand.</div></a>
    <div class="row" style="margin-top:14px;justify-content:space-between"><span class="small dim">${navigator.serviceWorker && navigator.serviceWorker.controller ? '<span class="ok">●</span> Works offline' : '<span class="dim">●</span> Offline copy not ready yet'}</span><button class="btn small danger" id="rall">Reset all mastery</button></div>`;
  wireChip(el, ctx, () => hub(el, ctx));
  wirePresets(el, ctx, () => hub(el, ctx));
  el.querySelector('#rall').onclick = async () => { if (await confirmSheet('Reset all mastery?', 'Every spot goes back to 0 in a row for this table. Your accuracy history and mistake journal stay.', { ok: 'Reset', danger: true })) { await resetPool(ctx, all); hub(el, ctx); } };
  miniMap(el.querySelector('#minimap'), ctx);
  if (!alwCached) alwaysPool(ctx).then(() => { if (el.querySelector('#rall')) hub(el, ctx); }).catch(() => {});
  ruleDiff(el.querySelector('#diff'), ctx);
}
const bar2 = (v, max) => `<div class="bar"><div class="fill ${v >= max ? 'break' : ''}" style="width:${Math.min(100, Math.round((v / max) * 100))}%"></div></div>`;

function miniMap(box, ctx) {
  const dot = (c) => {
    const s = srs.get(c.rowKey, c.up, ctx.rules);
    const col = srs.mastered(s) ? 'var(--ok)' : !s || !s.attempts ? '#2a2a33' : s.lastCorrect === false ? 'var(--bad)' : (s.streak || 0) > 0 ? 'var(--due)' : '#6b5a2a';
    return `<i style="background:${col}"></i>`;
  };
  box.innerHTML = `<div style="display:grid;grid-template-columns:repeat(10,1fr);gap:2px;max-width:220px">${DRILLABLE.map((r) => UPCARDS.map((u) => dot({ rowKey: r.key, up: u })).join('')).join('')}</div><style>#minimap i{display:block;aspect-ratio:1;border-radius:2px}</style>`;
}

// How many spots this table changes against the reference chart.
async function ruleDiff(node, ctx) {
  const base = normalizeRules(PRESETS[0].rules), cur = ctx.rules;
  if (!node || rulesKey(base) === rulesKey(cur)) return;
  node.textContent = 'Comparing with the reference table…';
  let n = 0;
  for (const r of DRILLABLE) for (const u of UPCARDS) {
    if (!node.isConnected) return;
    const a = await engine.cell(base, r.key, u), b = await engine.cell(cur, r.key, u);
    if (symOf(a) !== symOf(b)) n++;
  }
  if (node.isConnected) node.innerHTML = n ? `This table changes <b>${n}</b> spot${n === 1 ? '' : 's'} from the reference chart. <a href="#/guide">See which</a>.` : 'Same chart as the reference table.';
}

function coachCard(ctx, age) {
  const c = ctx.profile.coach;
  if (!c) return `<a class="card link due" href="#/lab/coach"><h3>Coach: find my best method</h3><div class="small dim">20 mixed hands, then it tells you which method fits you and why.</div></a>`;
  const hist = ctx.profile.coachHistory || [];
  const trend = hist.length > 1 ? ` Last ${hist.length}: ${hist.map((h) => Math.round(h.acc * 100) + '%').join(' → ')}.` : '';
  return `<a class="card link due" href="#/lab/coach"><h3>Coach says: ${esc(c.title)}</h3><div class="small dim">${esc(c.why)}${trend} ${age >= 7 ? `<b class="due">It has been ${age} days. Re-test.</b>` : '<b>Tap to re-test.</b>'}</div></a>`;
}

// ---- generic mastery runner -----------------------------------------------------------------------
class MasterySource {
  constructor(pool, rules) { this.pool = pool; this.rules = rules; this.misses = []; this.recent = []; }
  open() { return this.pool.filter((p) => !srs.mastered(srs.get(p.rowKey, p.up, this.rules))); }
  notifyMiss(item) { this.misses.push({ item, wait: 3 + Math.floor(Math.random() * 2) }); }
  async next() {
    for (const m of this.misses) m.wait--;
    const ready = this.misses.findIndex((m) => m.wait <= 0);
    if (ready >= 0) return this._take(this.misses.splice(ready, 1)[0].item);
    const open = this.open();
    const fresh = open.filter((p) => !this.recent.some((q) => q.rowKey === p.rowKey && q.up === p.up));
    const arr = fresh.length ? fresh : open.length ? open : this.pool;
    arr.sort((a, b) => ((srs.get(a.rowKey, a.up, this.rules)?.streak || 0) - (srs.get(b.rowKey, b.up, this.rules)?.streak || 0)) + (Math.random() - 0.5) * 1.5);
    return this._take(arr[0]);
  }
  _take(p) { const it = { rowKey: p.rowKey, up: p.up }; this.recent.push(it); if (this.recent.length > 4) this.recent.shift(); return it; }
}

// cfg: { id, title, pool, back, blurb, why, hintFn, items (fixed sequence) }
async function run(el, ctx, cfg) {
  const rules = ctx.rules, pool = cfg.pool || cfg.items, back = cfg.back || '#/lab';
  if (!pool.length) { el.innerHTML = `${backBar(back)}<h1>${cfg.title}</h1><div class="card"><div class="dim">Nothing to drill here yet.</div></div>`; return; }
  const open = pool.filter((p) => !srs.mastered(srs.get(p.rowKey, p.up, rules)));
  if (!cfg.items && !open.length && !cfg.why) {
    el.innerHTML = `${backBar(back)}<h1>${cfg.title}</h1><div class="card ok"><b class="ok">All ${pool.length} spots mastered</b><div class="small dim">for these table rules. Reset to drill them again.</div></div><button class="btn block" id="rs">Reset this set</button>`;
    el.querySelector('#rs').onclick = async () => { await resetPool(ctx, pool); run(el, ctx, cfg); };
    return;
  }
  let src, i = 0;
  if (cfg.items) src = { next: () => cfg.items[i++ % cfg.items.length] };
  else src = new MasterySource(pool, rules);
  let whyRight = 0, whyN = 0, ctl = null;
  ctl = startRunner(el, {
    mode: 'lab-' + cfg.id, title: cfg.title, rules, exitHref: back, queue: src.notifyMiss ? src : null, source: src,
    autoAdvanceMs: cfg.why ? 0 : 650, seconds: null,
    total: cfg.why ? 20 : cfg.items ? cfg.items.length : null,
    stopWhen: cfg.why || cfg.items ? null : () => !src.open().length,
    hud: (st) => { const p = progress(ctx, pool); return `<span class="streak ${st.streak >= 5 ? 'ok' : ''}">Streak <span class="num">${st.streak}</span></span><span class="dim num">${cfg.items ? `${st.n}/${cfg.items.length}` : `${p.done}/${p.n} mastered`}</span>`; },
    hint: cfg.hintFn
      ? (item) => { const stiff = isStiffUp(item.up); const wheels = (ctl && ctl.state ? ctl.state.best : 0) < 8; return '<b>' + cfg.title + '</b>' + (wheels ? ' · Dealer shows ' + (item.up === 1 ? 'A' : item.up === 10 ? 'ten' : item.up) + ': <b class="' + (stiff ? 'ok' : 'bad') + '">' + (stiff ? 'STIFF (2–6)' : 'STRONG (7–A)') + '</b>' : ' · Wheels off.'); }
      : cfg.blurb ? () => `<b>${cfg.title}</b> · ${cfg.blurb}` : null,
    onAnswer: cfg.why ? async ({ chosen, res, ranks, item }) => {
      if (!chosen) return;
      const { right, choices } = whyChoices(ranks, item.up, res.action);
      await new Promise((resolve) => {
        const s = openSheet(`<h3>${ACTION_NAME[res.action]} was the play. Why?</h3><div id="wc">${choices.map((k) => `<button class="btn block" data-k="${k}" style="margin-bottom:8px;text-align:left;line-height:1.3;padding:12px 14px;min-height:0">${TAGS[k]}</button>`).join('')}</div>`, { onClose: resolve });
        s.el.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => {
          const ok = b.dataset.k === right; whyN++; if (ok) whyRight++;
          s.el.querySelectorAll('[data-k]').forEach((x) => { x.disabled = true; if (x.dataset.k === right) x.style.borderColor = 'var(--ok)'; else if (x === b) x.style.borderColor = 'var(--bad)'; });
          s.el.insertAdjacentHTML('beforeend', `<p class="small ${ok ? 'ok' : 'bad'}"><b>${ok ? 'Right.' : 'Not quite.'}</b> ${TAGS[right]}.</p><button class="btn primary block" id="go">Continue</button>`);
          s.el.querySelector('#go').onclick = () => { s.el.closest('.scrim').remove(); resolve(); };
        });
      });
    } : null,
    onFinish: async () => (cfg.why ? `<div class="card">Reasons right: <b>${whyRight}/${whyN}</b></div>` : '') + `<div class="card">${bar(progress(ctx, pool))}</div>`,
    restart: () => run(el, ctx, cfg),
  });
  return () => ctl.stop();
}

// ---- Always-Rules ---------------------------------------------------------------------------------
async function always(el, ctx) {
  const { pool, dropped } = await alwaysPool(ctx);
  const inPool = new Set(pool.map((c) => c.rowKey + c.up));
  el.innerHTML = `${backBar()}<h1>Always-Rules</h1>
    <p class="dim small">Learn these six and you've covered a big share of every session. Then drill them until each spot is mastered.</p>
    ${dropped.length ? `<div class="banner small">On this table ${dropped.length} spot${dropped.length === 1 ? '' : 's'} differ from the rules below (${[...new Set(dropped.map((c) => labelOf(c.rowKey, c.up)))].slice(0, 4).join(', ')}${dropped.length > 4 ? '…' : ''}), so they are left out of the drill. The Guide shows the right play for your table.</div>` : ''}
    ${ALWAYS_RULES.map((r, i) => { const cells = r.pool().filter((c) => inPool.has(c.rowKey + c.up)); return `<div class="card"><b>${i + 1}. ${r.text}</b>${cells.length ? bar(progress(ctx, cells)) : '<div class="small dim">Whenever the dealer shows an Ace, decline insurance. It is a side bet with a house edge.</div>'}</div>`; }).join('')}
    <button class="btn primary block" id="go">Drill these rules</button>`;
  el.querySelector('#go').onclick = () => run(el, ctx, { id: 'always', title: 'Always-Rules', pool, blurb: 'Rules that never change.' });
}

// ---- Chunk Ladder ---------------------------------------------------------------------------------
const ladderStage = (id) => { const s = LADDER.find((x) => x.id === id) || LADDER[0]; return { title: s.label, pool: s.pool(), back: '#/lab/ladder', blurb: s.sub }; };
function ladder(el, ctx) {
  let nextId = null;
  const rows = LADDER.map((s, i) => { const p = progress(ctx, s.pool()); if (!nextId && p.done < p.n) nextId = s.id; return { s, p, i }; });
  el.innerHTML = `${backBar()}<h1>Chunk Ladder</h1>
    <p class="dim small">Work top to bottom. A chunk is done when every spot in it has ${MASTERED} right in a row. You can jump anywhere.</p>
    ${rows.map(({ s, p, i }) => `<a class="card link ${p.done === p.n ? 'ok' : s.id === nextId ? 'due' : ''}" href="#/lab/ladder/${s.id}"><h3>${i + 1}. ${s.label}${s.id === nextId ? ' <span class="pill due">next</span>' : ''}</h3><div class="small dim">${s.sub}</div>${bar(p)}</a>`).join('')}`;
}

// ---- Fade Chart -----------------------------------------------------------------------------------
async function fade(el, ctx) {
  const rules = ctx.rules, alive = { v: true };
  el.innerHTML = `${backBar()}<h1>Fade Chart</h1><div class="small dim" id="fp">Computing the chart for these rules…</div><div id="fg"></div>`;
  const grid = {};
  let n = 0;
  for (const r of DRILLABLE) for (const u of UPCARDS) {
    if (!alive.v) return () => { alive.v = false; };
    grid[`${r.key}|${u}`] = await engine.cell(rules, r.key, u);
    if (++n % 40 === 0) { const e = el.querySelector('#fp'); if (e) e.textContent = `Computing the chart for these rules… ${n}/${DRILLABLE.length * 10}`; }
  }
  const pool = ALL();
  const open = pool.filter((p) => !srs.mastered(srs.get(p.rowKey, p.up, rules)));
  const sec = (title, kind) => `<h2>${title}</h2><div class="grid guide" style="grid-template-columns:48px repeat(10,1fr)"><div class="hd"></div>${UPCARDS.map((u) => `<div class="hd">${upLabel(u)}</div>`).join('')}${DRILLABLE.filter((r) => r.kind === kind).map((r) => `<div class="rl">${r.label.replace('Hard ', '')}</div>${UPCARDS.map((u) => {
    const c = grid[`${r.key}|${u}`], ok = srs.mastered(srs.get(r.key, u, rules));
    return `<button class="c ${ok ? '' : 'act-' + c.action}" data-a="${c.action}" data-m="${ok ? 1 : 0}" aria-label="${labelOf(r.key, u)}" style="border:0;${ok ? 'background:var(--surface2);color:var(--dim)' : ''}">${ok ? '·' : c.action}</button>`;
  }).join('')}`).join('')}</div>`;
  const fp = el.querySelector('#fp'); if (fp) fp.remove();
  el.querySelector('#fg').innerHTML = `<div class="card"><b>${pool.length - open.length} of ${pool.length} spots faded</b><div class="small dim">Colored cells are still on the chart. A cell fades once you've got it right ${MASTERED} times in a row. Tap a faded cell to peek.</div>${bar({ done: pool.length - open.length, n: pool.length })}</div>
    <button class="btn primary block" id="go" ${open.length ? '' : 'disabled'}>Drill what's still visible</button>
    <div class="legend"><span><i class="act-H"></i>Hit</span><span><i class="act-S"></i>Stand</span><span><i class="act-D"></i>Double</span><span><i class="act-P"></i>Split</span><span><i class="act-R"></i>Surrender</span></div>
    ${sec('Hard totals', 'hard')}${sec('Soft totals', 'soft')}${sec('Pairs', 'pair')}`;
  el.querySelectorAll('.c[data-m="1"]').forEach((b) => b.onclick = () => { const t = b.textContent; b.textContent = b.dataset.a; setTimeout(() => { b.textContent = t; }, 1200); });
  el.querySelector('#go').onclick = () => run(el, ctx, { id: 'fade', title: 'Fade Chart', pool: open, back: '#/lab/fade', blurb: 'Drilling the cells still on the chart.' });
  return () => { alive.v = false; };
}

// ---- Coach ----------------------------------------------------------------------------------------
async function coach(el, ctx) {
  const rules = ctx.rules, pool = coachPool(20);
  let i = 0;
  const ctl = startRunner(el, {
    mode: 'lab-coach', title: 'Coach check', rules, exitHref: '#/lab', source: { next: () => pool[i++ % pool.length] }, total: 20, seconds: null, autoAdvanceMs: 500,
    hint: () => '<b>Coach check</b> · 20 mixed hands. Answer as you normally would.',
    onFinish: async (st) => {
      const by = {};
      for (const r of st.results) { const b = bucketOf(r.rowKey); (by[b] ||= { n: 0, c: 0 }); by[b].n++; if (r.correct) by[b].c++; }
      const acc = st.n ? st.correct / st.n : 0, avg = st.times.length ? st.times.reduce((a, b) => a + b, 0) / st.times.length : 0;
      const rec = recommend(by, acc, avg);
      const prev = (ctx.profile.coachHistory || []).slice(-1)[0];
      ctx.profile.coach = { date: Date.now(), acc, title: rec.title, why: rec.why };
      ctx.profile.coachHistory = [...(ctx.profile.coachHistory || []), { date: Date.now(), acc }].slice(-8);
      await ctx.save();
      return `<div class="card due"><b>${rec.title}</b><div class="small dim">${rec.why}</div></div>
        ${prev ? `<div class="card">Last check ${Math.round(prev.acc * 100)}% → now <b class="${acc >= prev.acc ? 'ok' : 'bad'}">${Math.round(acc * 100)}%</b></div>` : ''}
        ${Object.entries(by).map(([b, v]) => `<div class="card row"><div class="grow">${BUCKET_NAME[b]}</div><b class="${v.c === v.n ? 'ok' : v.c / v.n < 0.6 ? 'bad' : ''}">${v.c}/${v.n}</b></div>`).join('')}
        ${rec.links.map(([h, t]) => linkBtn(h, t)).join('')}`;
    },
    restart: () => coach(el, ctx),
  });
  return () => ctl.stop();
}

// ---- Dealer-Stiff Shortcut ------------------------------------------------------------------------
function shortcut(el, ctx) {
  el.innerHTML = `${backBar()}<h1>Dealer-Stiff Shortcut</h1>
    <div class="card"><b>The idea</b><p class="small" style="margin:6px 0 0">Assume the dealer's hidden card is a ten. A dealer showing <b>2–6</b> is <b>stiff</b>: they have to draw and often bust. A dealer showing <b>7–A</b> is <b>strong</b>.</p></div>
    <div class="card"><b>Then, with a hard 13–16</b><p class="small" style="margin:6px 0 0">Dealer stiff: <b>stand</b>, let them bust.<br>Dealer strong: <b>hit</b>, because standing loses too often.</p></div>
    <div class="card"><b>Where it stops</b><p class="small dim" style="margin:6px 0 0">12 against 2 or 3 is the one exception (hit), so it's left to Gut-Check. Surrender spots change 15 and 16 against a ten on some tables.</p></div>
    <button class="btn primary block" id="go">Drill the shortcut</button>`;
  el.querySelector('#go').onclick = async () => {
    // Surrender tables turn some 15s and 16s into "R", which the shortcut doesn't cover: keep only plain hit/stand spots.
    const keep = [];
    for (const c of SHORTCUT()) { const r = await engine.cell(ctx.rules, c.rowKey, c.up); if (r.action === 'H' || r.action === 'S') keep.push(c); }
    run(el, ctx, { id: 'shortcut', title: 'Dealer-Stiff Shortcut', pool: keep, blurb: 'Training wheels: the dealer label fades after a streak of 8.', hintFn: true });
  };
}

// ---- Rule Lists -----------------------------------------------------------------------------------
async function lists(el, ctx) {
  const rules = ctx.rules, alive = { v: true };
  el.innerHTML = `${backBar()}<h1>Rule Lists</h1><div class="small dim" id="fp">Computing for these rules…</div><div id="fg"></div>`;
  const sym = {};
  for (const r of DRILLABLE) { const ks = []; for (const u of UPCARDS) { if (!alive.v) return () => { alive.v = false; }; ks.push(symOf(await engine.cell(rules, r.key, u))); } sym[r.key] = ks; }
  const fp = el.querySelector('#fp'); if (fp) fp.remove();
  const merge = (rs) => { const out = []; for (const r of rs) { const sig = sym[r.key].join(); const l = out[out.length - 1]; if (l && l.sig === sig && r.kind !== 'pair') l.rows.push(r); else out.push({ sig, rows: [r] }); } return out; };
  const name = (g) => { const a = g.rows[0], b = g.rows[g.rows.length - 1]; return g.rows.length === 1 ? (a.kind === 'hard' ? `Hard ${a.total}` : a.label) : a.kind === 'hard' ? `Hard ${a.total}–${b.total}` : `${a.label}–${b.label}`; };
  const groups = { hard: merge(DRILLABLE.filter((r) => r.kind === 'hard')), soft: merge(DRILLABLE.filter((r) => r.kind === 'soft')), pair: merge(DRILLABLE.filter((r) => r.kind === 'pair')) };
  const textOf = () => Object.entries({ 'HARD TOTALS': 'hard', 'SOFT TOTALS': 'soft', PAIRS: 'pair' }).map(([t, k]) => `${t}\n${groups[k].map((g) => `${name(g)}: ${runsText(sym[g.rows[0].key])}`).join('\n')}`).join('\n\n');
  const sec = (title, k) => `<h2>${title}</h2>${groups[k].map((g) => `<div class="card" style="padding:10px 14px"><b>${name(g)}</b><div class="small cv" style="filter:blur(6px);cursor:pointer;margin-top:2px">${runsText(sym[g.rows[0].key])}</div></div>`).join('')}`;
  el.querySelector('#fg').innerHTML = `<p class="dim small">Generated from the chart for your table, not typed in. Tap a line to reveal it: say it first, then check. For a memory palace, give hard totals one room (about 8 spots), soft totals another (5) and pairs a third (6), and put one line in each spot.</p><div class="small dim">${describeRules(rules)}</div>
    <div class="row" style="gap:8px;margin-top:8px"><button class="btn small ghost" id="rv">Reveal all</button><button class="btn small ghost" id="cp">Copy as text</button><button class="btn small ghost" id="pr">Print</button></div>
    ${sec('Hard totals', 'hard')}${sec('Soft totals', 'soft')}${sec('Pairs', 'pair')}`;
  el.querySelectorAll('.cv').forEach((d) => d.onclick = () => { d.style.filter = d.style.filter ? '' : 'blur(6px)'; });
  el.querySelector('#rv').onclick = () => el.querySelectorAll('.cv').forEach((d) => { d.style.filter = ''; });
  el.querySelector('#cp').onclick = async () => { try { await navigator.clipboard.writeText(`${describeRules(rules)}\n\n${textOf()}`); toast('Copied.'); } catch { toast('Copy not available here.'); } };
  el.querySelector('#pr').onclick = () => { el.querySelectorAll('.cv').forEach((d) => { d.style.filter = ''; }); window.print(); };
  return () => { alive.v = false; };
}

// ---- Sprint: 60 seconds ---------------------------------------------------------------------------
function sprint(el, ctx) {
  const rules = ctx.rules, pool = ALL(), SECS = 60;
  const t0 = Date.now();
  let iv = 0, i = 0;
  const left = () => Math.max(0, SECS - (Date.now() - t0) / 1000);
  const src = new MasterySource(pool, rules);
  const ctl = startRunner(el, {
    mode: 'lab-sprint', title: 'Sprint', rules, exitHref: '#/lab', source: { next: () => src._take(pool[Math.floor(Math.random() * pool.length)]) }, seconds: null, autoAdvanceMs: 250,
    stopWhen: () => left() <= 0,
    hud: (st) => `<span class="streak ok">Score <span class="num">${st.correct}</span></span><span class="num" id="sp-t">${Math.ceil(left())}s</span><span class="dim">Best ${ctx.profile.bests.sprint || 0}</span>`,
    onFinish: async (st) => {
      clearInterval(iv);
      const best = ctx.profile.bests.sprint || 0, nb = st.correct > best;
      if (nb) { ctx.profile.bests.sprint = st.correct; await ctx.save(); }
      return `<div class="card ${nb ? 'ok' : ''}">${nb ? '<b class="ok">New best!</b> ' : ''}Score <b>${st.correct}</b> in 60 seconds. Best <b>${ctx.profile.bests.sprint || 0}</b>.</div>`;
    },
    restart: () => sprint(el, ctx),
  });
  iv = setInterval(() => { const e = el.querySelector('#sp-t'); if (e) e.textContent = Math.ceil(left()) + 's'; if (left() <= 0 && !ctl.state.stopped) { /* ends after the current answer */ } }, 250);
  return () => { clearInterval(iv); ctl.stop(); };
}

// ---- Spot the Mistake -----------------------------------------------------------------------------
async function audit(el, ctx) {
  const rules = ctx.rules, pool = ALL(), TOTAL = 15;
  let n = 0, right = 0, alive = true;
  el.innerHTML = `<div id="au"></div>`;
  const box = el.querySelector('#au');
  async function round() {
    if (!alive) return;
    if (n >= TOTAL) {
      await store.addSession({ date: Date.now(), mode: 'lab-audit', handsPlayed: n, accuracy: right / n, evLost: 0, bankrollDelta: 0 });
      box.innerHTML = `${backBar()}<h1>Spot the Mistake complete</h1><div class="card ${right >= 13 ? 'ok' : ''}"><b class="num" style="font-size:28px">${right}/${n}</b><div class="small dim">calls judged correctly</div></div><button class="btn primary block" id="again">Go again</button>`;
      box.querySelector('#again').onclick = () => audit(el, ctx);
      return;
    }
    const item = pool[Math.floor(Math.random() * pool.length)];
    const res = await engine.cell(rules, item.rowKey, item.up);
    const ranks = [...randomRanks(item.rowKey)];
    const legalActs = Object.entries({ H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' }).filter(([a, k]) => res.legal[k] && !(ranks.length > 2 && 'DPR'.includes(a))).map(([a]) => a);
    const wrongs = legalActs.filter((a) => a !== res.action);
    const showRight = Math.random() < 0.5 || !wrongs.length;
    const proposed = showRight ? res.action : wrongs[Math.floor(Math.random() * wrongs.length)];
    box.innerHTML = `${backBar()}<div class="row small dim" style="justify-content:space-between"><span>Spot the Mistake</span><span class="num">${n + 1}/${TOTAL} · ${right} right</span></div><div id="tbl"></div>
      <div class="banner" style="font-size:18px">A player here says: <b>${ACTION_NAME[proposed]}</b>. Good call?</div><div id="vd"></div>
      <div class="actionbar" id="bar" style="grid-template-columns:1fr 1fr"><button class="act" data-j="ok">Right call</button><button class="act" data-j="no">Wrong call</button></div>`;
    renderTable(box.querySelector('#tbl'), { dealer: [makeCard(item.up), makeCard(10)], hideHole: true, hands: [{ cards: makeHand(ranks), active: true }] });
    box.querySelectorAll('[data-j]').forEach((b) => b.onclick = async () => {
      box.querySelectorAll('[data-j]').forEach((x) => { x.disabled = true; });
      const said = b.dataset.j === 'ok', ok = said === showRight;
      n++; if (ok) right++;
      cue(ok);
      await srs.record(item.rowKey, item.up, rules, ok, 0);
      if (!ok) await journal.add({ rowKey: item.rowKey, up: item.up, chosen: proposed, right: res.action });
      const resX = ranks.length > 2 ? { ...res, legal: { ...res.legal, double: false, split: false, surrender: false } } : res;
      const fb = await explain(rules, ranks, item.up, resX, proposed);
      box.querySelector('#vd').innerHTML = `<div class="verdict ${ok ? 'ok' : 'bad'}"><div class="head ${ok ? 'ok' : 'bad'}">${ok ? 'Correct' : 'Not quite'}: ${showRight ? 'that was the right play' : `that was a mistake. ${ACTION_NAME[res.action]} is right`}</div><div class="small dim">${esc(fb.reason)}</div></div>`;
      box.querySelector('#bar').innerHTML = `<button class="btn primary block" id="nx" style="grid-column:1/-1">${n >= TOTAL ? 'See results' : 'Next'}</button>`;
      box.querySelector('#nx').onclick = round;
    });
  }
  round();
  return () => { alive = false; };
}

// ---- Today's workout, Fix-my-worst, slow spots ---------------------------------------------------
async function today(el, ctx) {
  const rules = ctx.rules, pick = [], seen = new Set();
  const add = (p) => { const k = p.rowKey + p.up; if (!seen.has(k) && pick.length < 15) { seen.add(k); pick.push({ rowKey: p.rowKey, up: p.up }); } };
  srs.dueCells(rules, ALL()).slice(0, 6).forEach(add);
  worstCells(myCells(ctx), 5).forEach(add);
  const fresh = ALL().filter((p) => !srs.get(p.rowKey, p.up, rules));
  while (pick.length < 15 && fresh.length) add(fresh.splice(Math.floor(Math.random() * fresh.length), 1)[0]);
  const rest = ALL().filter((p) => !srs.mastered(srs.get(p.rowKey, p.up, rules)));
  while (pick.length < 15 && rest.length) add(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
  for (let k = pick.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [pick[k], pick[j]] = [pick[j], pick[k]]; }
  return run(el, ctx, { id: 'today', title: "Today's workout", items: pick, blurb: 'Due, weak and new spots, mixed.' });
}

async function fixList(el, ctx, kind) {
  const cells = myCells(ctx);
  const list = kind === 'worst' ? worstCells(cells) : slowSpots(cells);
  const pool = list.map((c) => ({ rowKey: c.rowKey, up: c.up }));
  if (kind === 'slow') for (const p of pool) { const c = srs.get(p.rowKey, p.up, ctx.rules); if (c) c.streak = 0; }   // make them drillable again
  return run(el, ctx, { id: kind, title: kind === 'worst' ? 'Fix my worst 10' : 'Slow spots', pool, blurb: kind === 'worst' ? 'Your lowest-accuracy spots.' : 'Right but slow. Aim for under 3 seconds.' });
}

// ---- Mistake journal ------------------------------------------------------------------------------
function journalView(el, ctx) {
  const list = journal.list(), sum = mistakeSummary(list);
  const last = (k) => [...list].reverse().find((m) => m.rowKey === k.rowKey && m.up === k.up);
  el.innerHTML = `${backBar()}<h1>Mistake journal</h1>
    ${sum.length ? `<p class="dim small">Your last ${list.length} mistakes, most repeated first.</p>
    ${sum.slice(0, 20).map((s) => { const l = last(s); return `<div class="card row"><div class="grow"><b>${labelOf(s.rowKey, s.up)}</b><div class="small dim">You chose ${ACTION_NAME[l.chosen] || 'nothing (timed out)'}; ${ACTION_NAME[l.right]} was right</div></div><b class="bad num">×${s.n}</b></div>`; }).join('')}
    <button class="btn primary block" id="dr">Drill these spots</button><div class="gap"></div><button class="btn danger block" id="cl">Clear journal</button>`
    : '<div class="card"><div class="dim">No mistakes recorded yet. They will show up here from any drill.</div></div>'}`;
  const dr = el.querySelector('#dr');
  if (dr) {
    dr.onclick = () => { const pool = sum.slice(0, 20).map((s) => ({ rowKey: s.rowKey, up: s.up })); for (const p of pool) { const c = srs.get(p.rowKey, p.up, ctx.rules); if (c) c.streak = 0; } run(el, ctx, { id: 'journal', title: 'Journal spots', pool, back: '#/lab/journal', blurb: 'Spots you have missed.' }); };
    el.querySelector('#cl').onclick = async () => { if (await confirmSheet('Clear the journal?', 'This only removes the list. Your mastery and accuracy stay.', { ok: 'Clear', danger: true })) { await journal.clear(); journalView(el, ctx); } };
  }
}

// ---- Insights -------------------------------------------------------------------------------------
const METHOD_NAME = { always: 'Always-Rules', ladder: 'Chunk Ladder', gut: 'Gut-Check', why: 'Why Mode', fade: 'Fade Chart', coach: 'Coach check', shortcut: 'Dealer-Stiff Shortcut', sprint: 'Sprint', audit: 'Spot the Mistake', today: "Today's workout", worst: 'Fix my worst 10', slow: 'Slow spots', journal: 'Journal spots' };
async function insights(el, ctx) {
  const rows = methodInsights(await store.allSessions());
  const best = rows.filter((r) => r.hands >= 30).sort((a, b) => b.acc - a.acc)[0];
  el.innerHTML = `${backBar()}<h1>What's working for you</h1>
    ${rows.length ? `<p class="dim small">Accuracy is how often you were right <i>during</i> that method, so harder methods score lower. Use it to see where you spend time and where you struggle.</p>
    ${rows.map((r) => `<div class="card row"><div class="grow"><b>${METHOD_NAME[r.id.split('-')[0]] || r.id}</b><div class="small dim">${r.hands} hands · ${r.sessions} session${r.sessions === 1 ? '' : 's'}</div></div><b class="num ${r.acc >= 0.9 ? 'ok' : r.acc < 0.7 ? 'bad' : ''}">${Math.round(r.acc * 100)}%</b></div>`).join('')}
    ${best ? `<div class="card ok">You are strongest in <b>${METHOD_NAME[best.id.split('-')[0]] || best.id}</b>. Spend extra time on the methods with the lowest scores.</div>` : '<div class="small dim">Play at least 30 hands in a method to get a verdict on it.</div>'}`
    : '<div class="card"><div class="dim">No Lab sessions yet. Try Today\'s workout.</div></div>'}`;
}

// ---- Which method when? ---------------------------------------------------------------------------
function when(el) {
  const rows = [
    ['I have never learned the chart', 'Coach check, then Always-Rules, then Chunk Ladder', ['#/lab/coach', '#/lab/always', '#/lab/ladder']],
    ['I know the basics but keep slipping', 'Gut-Check, then Fix my worst 10', ['#/lab/gut', '#/lab/worst']],
    ['I memorize badly with charts', 'Rule Lists (short sentences) and the Dealer-Stiff Shortcut', ['#/lab/lists', '#/lab/shortcut']],
    ['I want to understand, not just memorize', 'Why Mode, then Spot the Mistake', ['#/lab/why', '#/lab/audit']],
    ['I know it but I am slow', 'Sprint and Slow spots', ['#/lab/sprint', '#/lab/slow']],
    ['I am about to play in five minutes', "Today's workout (15 hands)", ['#/lab/today']],
    ['I have been away for a while', 'Coach check, then Fade Chart to find what faded', ['#/lab/coach', '#/lab/fade']],
    ['I want it to feel like real play', 'Rewind Play on the Practice Table', ['#/play/practice']],
    ['My table has different rules', 'Switch the table at the top of the Lab, then re-run Coach', ['#/lab']],
  ];
  el.innerHTML = `${backBar()}<h1>Which method when?</h1><p class="dim small">There is one chart and many ways to learn it. Pick by situation.</p>
    ${rows.map(([q, a, links]) => `<div class="card"><b>${q}</b><div class="small" style="margin-top:4px">${a}</div><div class="row small" style="gap:12px;margin-top:6px">${links.map((l) => `<a href="${l}">Open</a>`).join('')}</div></div>`).join('')}`;
}
