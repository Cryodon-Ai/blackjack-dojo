// Learn tab: progress spine -> tier page -> lessons -> guided hands -> gated drill.

import { TIERS, TIER } from '../curriculum/tiers.js';
import { resolveTokens } from '../curriculum/tokens.js';
import { LEARN_RULES, POOLS } from '../curriculum/cells.js';
import { TRAP_KINDS } from '../curriculum/traps.js';
import { srs, DrillQueue, pushGate, gateState, GATE } from '../app/srs.js';
import { startRunner } from '../games/runner.js';
import { startQuiz } from '../games/quiz.js';
import { houseEdge } from '../app/edges.js';
import { describeRules } from '../app/presets.js';
import { engine } from '../app/engine-client.js';
import { store } from '../app/store.js';
import { openRulesEditor } from '../ui/rules-editor.js';

const tierProg = (p, id) => (p.tierProgress && p.tierProgress[id]) || null;
const isPassed = (p, id) => !!(tierProg(p, id) && tierProg(p, id).passed);
const isUnlocked = (p, id) => id <= 1 || isPassed(p, id - 1) || p.tierUnlocked >= id;

export default async function learn(el, parts, ctx) {
  const [sub, n, view] = parts;
  if (sub === 't' && TIER[Number(n)]) {
    const tier = TIER[Number(n)];
    if (!isUnlocked(ctx.profile, tier.id)) { location.hash = '#/learn'; return; }
    if (view === 'lessons') return lessonViewer(el, tier, ctx);
    if (view === 'guided') return guided(el, tier, ctx);
    if (view === 'gate') return gate(el, tier, ctx);
    return tierPage(el, tier, ctx);
  }
  return home(el, ctx);
}

// ---- home ---------------------------------------------------------------------------------
async function home(el, ctx) {
  const p = ctx.profile;
  const refEdge = await houseEdge(LEARN_RULES);
  const due = srs.dueCount(LEARN_RULES, POOLS.all());
  const certs = await store.allCerts();
  const lastCert = certs.length ? certs[certs.length - 1] : null;
  const stale = lastCert && Date.now() - lastCert.date > 30 * 86400000;
  const firstOpen = TIERS.find((t) => t.id !== 0 && isUnlocked(p, t.id) && !isPassed(p, t.id));

  el.innerHTML = `<h1>Blackjack Dojo</h1>
    <p class="dim" style="margin-top:0">Learn the decisions. Know the real odds.</p>
    <div class="card"><div class="small dim">The honest claim</div>
      <p style="margin:6px 0">Basic strategy <b>minimizes</b> the house edge — it does not remove it. Perfect play at the Reference table costs about <b class="num">${refEdge === null ? '0.33' : refEdge.toFixed(2)}%</b> of what you wager; casual play is commonly put around 2% <span class="pill">estimate</span>. Blackjack stays a losing game online. The skill here is losing less, choosing better tables, and doing the math on bonuses.</p></div>
    ${due ? `<a class="card due link" href="#/drill/due"><b class="due">${due} card${due === 1 ? '' : 's'} due for review</b><div class="small dim">Spaced repetition: review before you forget.</div></a>` : ''}
    ${stale ? `<div class="banner"><b>Certification is ${Math.floor((Date.now() - lastCert.date) / 86400000)} days old.</b> Skills fade — re-test to keep your certificate current. <a href="#/cert">Re-test</a></div>` : ''}
    <h2>Your path</h2><div class="spine" id="spine"></div>
    <h2>Learning game</h2>
    <div class="card"><div class="small dim">Tiers 2–5 teach on the Reference game</div><div class="small" style="margin-top:4px">${describeRules(LEARN_RULES)}</div></div>`;
  const spine = el.querySelector('#spine');
  spine.innerHTML = TIERS.map((t) => {
    const done = isPassed(p, t.id), open = isUnlocked(p, t.id), cur = firstOpen && firstOpen.id === t.id;
    const g = gateState(tierProg(p, t.id));
    const inner = `<div class="row"><div class="grow"><div class="small dim">Tier ${t.id}</div><h3>${t.title}</h3><div class="small dim">${t.sub}</div>${open && !done && t.kind !== 'cert' && g.n ? `<div class="small due" style="margin-top:4px">Gate: ${g.correct}/${g.n} in your last ${g.n}</div>` : ''}</div>
      <div>${done ? '<span class="pill ok">passed</span>' : open ? (cur ? '<span class="pill due">next</span>' : t.id === 0 ? '<span class="pill">optional</span>' : '') : '<span class="pill">locked</span>'}</div></div>`;
    return `<div class="node ${done ? 'done' : ''} ${cur ? 'cur' : ''}">${open ? `<a class="card link ${done ? 'ok' : cur ? 'due' : ''}" href="${t.kind === 'cert' ? '#/cert' : `#/learn/t/${t.id}`}">${inner}</a>` : `<div class="card locked">${inner}</div>`}</div>`;
  }).join('');
}

// ---- tier page ----------------------------------------------------------------------------
async function tierPage(el, tier, ctx) {
  const p = ctx.profile, prog = tierProg(p, tier.id), g = gateState(prog);
  const passed = isPassed(p, tier.id);
  const hasGuided = tier.guided && tier.guided.length;
  el.innerHTML = `<div class="topbar"><a class="back" href="#/learn">‹ Path</a></div>
    <div class="small dim">Tier ${tier.id}</div><h1>${tier.title}</h1><p class="dim" style="margin-top:0">${tier.sub}</p>
    <div class="card"><div class="small dim">Outcome</div><div>${tier.outcome}</div></div>
    ${passed ? `<div class="card ok"><b class="ok">Gate passed</b> · best run ${prog.best}</div>` : ''}
    <a class="btn block" href="#/learn/t/${tier.id}/lessons" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin:10px 0">1 · Lessons (${tier.lessons.length} cards)</a>
    ${hasGuided ? `<a class="btn block" href="#/learn/t/${tier.id}/guided" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin:10px 0">2 · Guided hands ${p.guided && p.guided[tier.id] ? '✓' : ''}</a>` : ''}
    <a class="btn primary block" href="#/learn/t/${tier.id}/gate" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin:10px 0">${hasGuided ? '3' : '2'} · ${passed ? 'Practice again' : 'Drill to the gate'}</a>
    <h2>The gate</h2>
    <div class="card"><div>Get <b>${GATE.needed} of ${GATE.window}</b> consecutive decisions right (≥ 95%). Mastery, not time, unlocks the next tier.</div>
      <div class="bars" style="margin-top:10px"><div class="bar"><span class="lbl"></span><span class="track"><span class="fill ${g.correct >= GATE.needed ? 'break' : ''}" style="width:${(g.correct / GATE.window * 100).toFixed(0)}%"></span></span><span class="num small">${g.correct}/${g.n}</span></div></div>
      <div class="small dim" style="margin-top:6px">Rolling window: your last ${GATE.window} answers in this tier.</div></div>`;
}

// ---- lessons ------------------------------------------------------------------------------
async function lessonViewer(el, tier, ctx) {
  let i = 0;
  const cards = tier.lessons;
  async function draw() {
    const l = cards[i];
    const html = await resolveTokens(l.html);
    el.innerHTML = `<div class="topbar"><a class="back" href="#/learn/t/${tier.id}">‹ Tier ${tier.id}</a><div class="grow"></div><span class="small dim">${i + 1} / ${cards.length}</span></div>
      <h1 style="font-size:26px">${l.t}</h1><div class="lesson">${html}</div>
      <div class="dots">${cards.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="actionbar" style="grid-template-columns:1fr 2fr"><button class="btn" id="prev" ${i === 0 ? 'disabled' : ''}>Back</button><button class="btn primary" id="next">${i === cards.length - 1 ? (tier.guided && tier.guided.length ? 'Guided hands' : 'Start drill') : 'Next'}</button></div>`;
    el.querySelector('#prev').onclick = () => { i--; draw(); };
    el.querySelector('#next').onclick = async () => {
      if (i < cards.length - 1) { i++; draw(); return; }
      ctx.profile.lessonSeen = { ...(ctx.profile.lessonSeen || {}), [tier.id]: true }; await ctx.save();
      location.hash = `#/learn/t/${tier.id}/${tier.guided && tier.guided.length ? 'guided' : 'gate'}`;
    };
    if (el.querySelector('#rulecosts')) fillRuleCosts(el.querySelector('#rulecosts'));
    el.scrollTop = 0;
  }
  await draw();
}

async function fillRuleCosts(box) {
  const base = await houseEdge(LEARN_RULES);
  const rows = [
    ['Blackjack pays 6:5', { blackjackPays: 1.2 }], ['Dealer hits soft 17', { dealerHitsSoft17: true }], ['No double after split', { doubleAfterSplit: false }],
    ['No hole card (European)', { peekOn: 'none', surrender: 'none' }], ['Double on 9–11 only', { doubleRestriction: '9-11' }], ['No late surrender', { surrender: 'none' }],
    ['Resplit aces allowed', { resplitAces: true }], ['1 deck (vs 6)', { decks: 1 }], ['2 decks (vs 6)', { decks: 2 }], ['8 decks (vs 6)', { decks: 8 }],
  ];
  const out = [];
  for (const [name, change] of rows) {
    const e = await houseEdge({ ...LEARN_RULES, ...change });
    if (e !== null) out.push([name, e - base]);
  }
  out.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  box.className = '';
  box.innerHTML = `<p>Each row: how many <b>percentage points</b> of your action the rule change adds to (or removes from) the house edge, starting from the Reference game (${base.toFixed(2)}%). <span class="pill">computed</span></p>
    <table class="evtable">${out.map(([n, d]) => `<tr class="${d < 0 ? 'best' : ''}"><td>${n}</td><td class="num">${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)} pp<br><span class="small dim">$${Math.abs(d).toFixed(2)} per $100</span></td></tr>`).join('')}</table>
    <p class="small dim">Red-flag ranking: 6:5 blackjack alone costs more than every other rule here. Deck effects are relative to 6 decks. "${describeRules(LEARN_RULES)}"</p>`;
}

// ---- guided hands --------------------------------------------------------------------------
async function guided(el, tier, ctx) {
  const list = tier.guided || [];
  if (!list.length) { location.hash = `#/learn/t/${tier.id}/gate`; return; }
  const hints = await Promise.all(list.map((g) => resolveTokens(g.hint)));
  let idx = 0;
  const ctl = startRunner(el, {
    mode: 'guided', title: `Tier ${tier.id} guided hands`, rules: LEARN_RULES, exitHref: `#/learn/t/${tier.id}`, recordSession: false,
    source: { next: () => { const gi = idx++ % list.length; return { rowKey: list[gi].rowKey, up: list[gi].up, gi }; } },
    total: list.length, seconds: null,
    hint: (item) => `<b>Hint</b> — ${hints[item.gi]}`,
    hud: (st) => `<span class="dim">Guided hand ${Math.min(st.n + 1, list.length)} of ${list.length}</span>`,
    onFinish: async () => {
      ctx.profile.guided = { ...(ctx.profile.guided || {}), [tier.id]: true }; await ctx.save();
      return `<a class="btn primary block" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:10px" href="#/learn/t/${tier.id}/gate">On to the gate</a>`;
    },
    restart: () => guided(el, tier, ctx),
  });
  return () => ctl.stop();
}

// ---- gated drill ---------------------------------------------------------------------------
async function recordGate(ctx, tier, ok) {
  const p = ctx.profile;
  p.tierProgress = p.tierProgress || {};
  const was = !!(p.tierProgress[tier.id] && p.tierProgress[tier.id].passed);
  p.tierProgress[tier.id] = pushGate(p.tierProgress[tier.id], ok);
  const nowPassed = !!p.tierProgress[tier.id].passed;
  if (nowPassed) p.tierUnlocked = Math.max(p.tierUnlocked || 0, tier.id + 1);
  await ctx.save();
  return { was, nowPassed };
}

const gateHud = (ctx, tier) => (st) => {
  const g = gateState(tierProg(ctx.profile, tier.id));
  const left = GATE.window - g.n;
  return `<span class="${g.correct >= GATE.needed && g.n >= GATE.window ? 'ok' : 'due'}">Gate ${g.correct}/${g.n}${g.n < GATE.window ? ` · ${left} to fill` : ''} · need ${GATE.needed}/${GATE.window}</span><span class="streak">Streak ${st.streak}</span>`;
};
const finishNote = (ctx, tier) => async () => {
  const passed = isPassed(ctx.profile, tier.id);
  const next = TIER[tier.id + 1];
  return passed
    ? `<div class="card ok"><b class="ok">Gate passed.</b> ${next ? `Tier ${next.id} — ${next.title} is unlocked.` : ''}</div>${next ? `<a class="btn primary block" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin:10px 0" href="#/learn/t/${next.id}">Continue to Tier ${next.id}</a>` : ''}`
    : `<div class="card due">Not yet — the gate needs ${GATE.needed} of the last ${GATE.window} right. Keep going; the drill resumes where you left off.</div>`;
};

async function gate(el, tier, ctx) {
  if (tier.kind === 'quiz') {
    const ctl = startQuiz(el, {
      gen: tier.gen, mode: `tier${tier.id}`, title: `Tier ${tier.id} · ${tier.title}`, exitHref: `#/learn/t/${tier.id}`, secs: tier.secs || null,
      hud: gateHud(ctx, tier),
      onAnswer: async (ok, st) => { const r = await recordGate(ctx, tier, ok); if (r.nowPassed && !r.was) st._justPassed = true; },
      stopWhen: (st) => !!st._justPassed,
      onFinish: finishNote(ctx, tier),
      restart: () => gate(el, tier, ctx),
    });
    return () => ctl.stop();
  }
  const pool = POOLS[tier.pool]();
  const queue = new DrillQueue(pool, LEARN_RULES);
  const mixed = tier.kind === 'mixed';
  const ctl = startRunner(el, {
    mode: `tier${tier.id}`, title: `Tier ${tier.id} · ${tier.title}`, rules: LEARN_RULES, exitHref: `#/learn/t/${tier.id}`, queue,
    source: { next: () => (mixed && Math.random() < 0.22 ? { trap: Math.random() < 0.5 ? TRAP_KINDS.insurance() : TRAP_KINDS.evenMoney() } : queue.next()) },
    autoAdvanceMs: 650, seconds: null,
    hud: gateHud(ctx, tier),
    onAnswer: async (a, st) => { const r = await recordGate(ctx, tier, a.correct); if (r.nowPassed && !r.was) st._justPassed = true; },
    stopWhen: (st) => !!st._justPassed,
    onFinish: finishNote(ctx, tier),
    restart: () => gate(el, tier, ctx),
  });
  return () => ctl.stop();
}
