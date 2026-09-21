// Drill tab: due queue, zone drills, and the mini-games built on the runner.
import { startRunner } from '../games/runner.js';
import { startQuiz } from '../games/quiz.js';
import { blackout } from '../games/blackout.js';
import { POOLS, ZONES, BOSS_LABELS, ROW, zoneOfRow } from '../curriculum/cells.js';
import { srs, DrillQueue } from '../app/srs.js';
import { store } from '../app/store.js';
import { describeRules } from '../app/presets.js';
import { openRulesEditor } from '../ui/rules-editor.js';
import { engine } from '../app/engine-client.js';
import { QUIZ } from '../curriculum/quizgen.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export default async function drill(el, parts, ctx) {
  const [game, arg] = parts;
  if (game === 'flash') return flash(el, ctx);
  if (game === 'strikes') return strikes(el, ctx);
  if (game === 'boss') return boss(el, ctx);
  if (game === 'blackout') return blackout(el, ctx);
  if (game === 'eye') return eye(el, ctx);
  if (game === 'zone') return zone(el, ctx, arg);
  if (game === 'due') return due(el, ctx);
  if (game === 'deck') return deck(el, ctx);
  return hub(el, ctx);
}

const btnLink = 'display:flex;align-items:center;justify-content:center;text-decoration:none';

async function hub(el, ctx) {
  const rules = ctx.rules, p = ctx.profile;
  const all = POOLS.all();
  const due = srs.dueCount(rules, all);
  const deckN = (p.deck || []).length;
  const best = p.bests || {};
  const zones = ZONES.map((z) => {
    const pool = z.pool();
    let att = 0, cor = 0;
    for (const c of pool) { const s = srs.get(c.rowKey, c.up, rules); if (s) { att += s.attempts; cor += s.correct; } }
    return { ...z, n: pool.length, acc: att ? cor / att : null, due: srs.dueCount(rules, pool) };
  });
  const prog = engine.cachedCount(rules);
  el.innerHTML = `<h1>Drill</h1>
    <div class="card row" id="rulechip"><div class="grow"><div class="small dim">Table rules for drills</div><div class="small">${describeRules(rules)}</div></div><button class="btn small ghost" id="chg">Change</button></div>
    ${prog < 350 ? `<div class="small dim" id="prefill">Warming up the engine for these rules… <span class="num">${prog}/350</span> cells ready. Drills work while it fills.</div>` : ''}
    ${due ? `<a class="card due link" href="#/drill/due"><b class="due">${due} due for review</b><div class="small dim">Spaced repetition queue — oldest first.</div></a>` : `<div class="card"><div class="dim small">Nothing due right now.</div></div>`}
    <h2>Mini-games</h2>
    <a class="card link" href="#/drill/flash"><h3>Flash Drill</h3><div class="small dim">Hand appears, ring counts down from 2.0 s, tap the action. Timer tightens as you improve.</div></a>
    <a class="card link" href="#/drill/strikes"><h3>Three Strikes</h3><div class="small dim">Endless hands. Three errors ends the run. Best: <b>${best.strikes || 0}</b></div></a>
    <a class="card link" href="#/drill/blackout"><h3>Chart Blackout</h3><div class="small dim">Rebuild the strategy grid from memory. Scored on accuracy and time.</div></a>
    <a class="card link" href="#/drill/eye"><h3>Dealer's Eye</h3><div class="small dim">Given only the upcard, predict the bust percentage.</div></a>
    <a class="card link" href="#/drill/boss"><h3>Boss Hands</h3><div class="small dim">The 12 most-misplayed decisions in a row. Clear all 12. Best: <b>${best.boss || 0}/12</b></div></a>
    <h2>Zones</h2>
    ${zones.map((z) => `<a class="card link row" href="#/drill/zone/${z.id}"><div class="grow"><h3>${z.label}</h3><div class="small dim">${z.n} cells${z.due ? ` · <span class="due">${z.due} due</span>` : ''}</div></div><div class="num ${z.acc === null ? 'dim' : z.acc >= 0.9 ? 'ok' : z.acc < 0.75 ? 'bad' : ''}" style="font-size:22px;font-weight:800">${z.acc === null ? '—' : Math.round(z.acc * 100) + '%'}</div></a>`).join('')}
    ${deckN ? `<a class="card link" href="#/drill/deck"><h3>My Deck</h3><div class="small dim">${deckN} pinned cell${deckN === 1 ? '' : 's'}</div></a>` : ''}`;
  el.querySelector('#chg').onclick = () => openRulesEditor(ctx.rules, { title: 'Drill table rules', onSave: async (r, id) => { await ctx.setRules(r, id); engine.prefill(ctx.rules, () => {}); hub(el, ctx); } });
  const iv = setInterval(() => { const n = engine.cachedCount(rules); const e = el.querySelector('#prefill'); if (e) e.innerHTML = n >= 350 ? '' : `Warming up the engine for these rules… <span class="num">${n}/350</span> cells ready. Drills work while it fills.`; }, 1500);
  return () => clearInterval(iv);
}

function queueFor(rules, pool) { const q = new DrillQueue(pool, rules); return { q, source: { next: () => q.next() } }; }

async function flash(el, ctx) {
  const rules = ctx.rules, base = ctx.profile.settings.flashSeconds || 2.0;
  const { q, source } = queueFor(rules, POOLS.all());
  const ctl = startRunner(el, {
    mode: 'flash', title: 'Flash Drill', rules, queue: q, source, autoAdvanceMs: 550, total: 25,
    seconds: (st) => { if (st.n < 5) return base; const acc = st.correct / st.n; return +(base - (base - 1.2) * clamp((acc - 0.75) / 0.2, 0, 1)).toFixed(2); },
    restart: () => flash(el, ctx),
  });
  return () => ctl.stop();
}

async function strikes(el, ctx) {
  const rules = ctx.rules;
  const { q, source } = queueFor(rules, POOLS.all());
  const ctl = startRunner(el, {
    mode: 'strikes', title: 'Three Strikes', rules, queue: q, source, strikes: 3, autoAdvanceMs: 600, seconds: null,
    hud: (st) => `<span class="streak ok">Score <span class="num">${st.correct}</span></span><span class="bad">${'✕'.repeat(3 - st.strikes)}<span class="dim">${'✕'.repeat(st.strikes)}</span></span><span class="dim">Best ${ctx.profile.bests.strikes || 0}</span>`,
    onFinish: async (st) => {
      const p = ctx.profile; p.bests = p.bests || {};
      const nb = st.correct > (p.bests.strikes || 0);
      if (nb) { p.bests.strikes = st.correct; await ctx.save(); }
      return `<div class="card ${nb ? 'ok' : ''}">${nb ? '<b class="ok">New personal best!</b> ' : ''}Run score <b>${st.correct}</b> · best <b>${p.bests.strikes || 0}</b></div>`;
    },
    restart: () => strikes(el, ctx),
  });
  return () => ctl.stop();
}

async function boss(el, ctx) {
  const rules = ctx.rules, pool = POOLS.boss();
  let idx = 0;
  const ctl = startRunner(el, {
    mode: 'boss', title: 'Boss Hands', rules, strikes: 1, total: 12, seconds: null,
    source: { next: () => pool[idx++ % pool.length] },
    hint: (item) => `<b>Boss hand ${pool.findIndex((c) => c.rowKey === item.rowKey && c.up === item.up) + 1} of 12</b> · ${BOSS_LABELS[pool.findIndex((c) => c.rowKey === item.rowKey && c.up === item.up)]}`,
    hud: (st) => `<span class="streak ok">Cleared ${st.correct}/12</span><span class="dim">one miss ends the run</span>`,
    onFinish: async (st) => {
      const p = ctx.profile; p.bests = p.bests || {};
      if (st.correct > (p.bests.boss || 0)) { p.bests.boss = st.correct; await ctx.save(); }
      return st.correct === 12 ? `<div class="card ok"><b class="ok">Gauntlet cleared — all 12 in a row.</b></div>` : `<div class="card due">Down at hand ${st.n}. The gauntlet restarts from the top: <b>${BOSS_LABELS.join(' · ')}</b></div>`;
    },
    restart: () => boss(el, ctx),
  });
  return () => ctl.stop();
}

async function eye(el, ctx) {
  QUIZ.eye = [QUIZ.t1[0]];
  const ctl = startQuiz(el, { gen: 'eye', mode: 'eye', title: "Dealer's Eye", exitHref: '#/drill', total: 20, secs: 6, restart: () => eye(el, ctx) });
  return () => ctl.stop();
}

async function zone(el, ctx, id) {
  const z = ZONES.find((x) => x.id === id) || ZONES[4];
  const rules = ctx.rules;
  const { q, source } = queueFor(rules, z.pool());
  const ctl = startRunner(el, { mode: 'zone-' + z.id, title: z.label, rules, queue: q, source, autoAdvanceMs: 650, total: 30, seconds: null, restart: () => zone(el, ctx, id) });
  return () => ctl.stop();
}

async function due(el, ctx) {
  const rules = ctx.rules, pool = srs.dueCells(rules, POOLS.all()).map(({ rowKey, up }) => ({ rowKey, up }));
  if (!pool.length) { el.innerHTML = `<div class="topbar"><a class="back" href="#/drill">‹ Drill</a></div><h1>All caught up</h1><p class="dim">Nothing is due. Come back later, or drill a zone.</p>`; return; }
  const { q, source } = queueFor(rules, pool);
  const ctl = startRunner(el, { mode: 'due', title: 'Due for review', rules, queue: q, source, autoAdvanceMs: 650, total: Math.min(30, Math.max(pool.length, 10)), seconds: null, restart: () => due(el, ctx) });
  return () => ctl.stop();
}

async function deck(el, ctx) {
  const pool = (ctx.profile.deck || []).map(({ rowKey, up }) => ({ rowKey, up }));
  if (!pool.length) { location.hash = '#/drill'; return; }
  const { q, source } = queueFor(ctx.rules, pool);
  const ctl = startRunner(el, { mode: 'deck', title: 'My Deck', rules: ctx.rules, queue: q, source, autoAdvanceMs: 650, total: Math.max(10, pool.length), seconds: null, restart: () => deck(el, ctx) });
  return () => ctl.stop();
}
