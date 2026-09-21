// Tier 9 — Certification: 100 random hands, randomized rule sets, 3 s clock, no chart, >= 99%.
import { startRunner } from '../games/runner.js';
import { POOLS } from '../curriculum/cells.js';
import { randomTable } from '../curriculum/quizgen.js';
import { REFERENCE_RULES, normalizeRules } from '../engine/rules.js';
import { describeRules } from '../app/presets.js';
import { engine } from '../app/engine-client.js';
import { store } from '../app/store.js';
import { certCard } from './stats.js';
import { usd100 } from '../app/feedback.js';

const NEEDED = 99, HANDS = 100, BLOCKS = 8;

export default async function cert(el, parts, ctx) {
  const p = ctx.profile;
  const ready = p.tierProgress && p.tierProgress[8] && p.tierProgress[8].passed;
  const certs = await store.allCerts();
  const last = certs.length ? certs[certs.length - 1] : null;
  el.innerHTML = `<div class="topbar"><a class="back" href="#/learn">‹ Path</a></div><div class="small dim">Tier 9</div><h1>Certification</h1>
    <p class="dim" style="margin-top:0">100 random hands · ${BLOCKS} different rule sets · 3 seconds per decision · no chart · ${NEEDED}% or better.</p>
    ${last ? `<h2>Your latest certificate</h2>${certCard(last)}` : ''}
    ${ready ? '' : `<div class="banner">Finish Tiers 0–8 first. The exam assumes you can read a rules panel and price a table.</div>`}
    <div class="card"><b>How it works</b><p class="small dim">The exam is built from ${BLOCKS} randomized tables (about 12 hands each). The rules for each hand are shown above it. At most one error passes. Your certificate records your exact per-hand error cost in EV — what your mistakes would cost per $100 wagered.</p>
      <button class="btn primary block" id="go" ${ready ? '' : 'disabled'}>Start the exam</button>${ready ? '' : '<div class="gap"></div><button class="btn block ghost small" id="prac">Take it as practice (no certificate)</button>'}</div>`;
  const start = (practice) => run(el, ctx, practice);
  el.querySelector('#go').onclick = () => start(false);
  const prac = el.querySelector('#prac'); if (prac) prac.onclick = () => start(true);
}

async function run(el, ctx, practice) {
  el.innerHTML = `<h1>Preparing the exam</h1><div class="card"><div id="pp" class="dim">Building tables…</div><div class="bars" style="margin-top:10px"><div class="bar"><span class="lbl"></span><span class="track"><span class="fill" id="pb" style="width:0%"></span></span><span class="num small" id="pn">0</span></div></div></div>`;
  const pool = POOLS.all().filter((c) => c.rowKey !== 'H21');
  const rulesSets = [normalizeRules({ ...REFERENCE_RULES })];
  const seen = new Set(rulesSets.map((r) => JSON.stringify(r)));
  while (rulesSets.length < BLOCKS) { const r = normalizeRules(randomTable()); const k = JSON.stringify(r); if (!seen.has(k)) { seen.add(k); rulesSets.push(r); } }
  const items = [];
  for (let b = 0; b < BLOCKS; b++) {
    const n = Math.floor(HANDS / BLOCKS) + (b < HANDS % BLOCKS ? 1 : 0);
    for (let i = 0; i < n; i++) { const c = pool[Math.floor(Math.random() * pool.length)]; items.push({ rules: rulesSets[b], rowKey: c.rowKey, up: c.up, block: b, first: i === 0 }); }
  }
  // Compute every cell up front so the 3-second clock never waits on the engine.
  let done = 0;
  for (const it of items) {
    await engine.cell(it.rules, it.rowKey, it.up);
    done++;
    if (done % 2 === 0 || done === items.length) { el.querySelector('#pb').style.width = `${done / items.length * 100}%`; el.querySelector('#pn').textContent = `${done}/${items.length}`; await new Promise((r) => setTimeout(r, 0)); }
  }
  let idx = 0;
  const ctl = startRunner(el, {
    mode: practice ? 'cert-practice' : 'certification', title: 'Certification', exitHref: '#/cert',
    source: { next: () => items[Math.min(idx++, items.length - 1)] }, total: items.length, seconds: 3, autoAdvanceMs: 350,
    hint: (item) => `<b>${item.first ? 'New table' : 'Table'}</b> · ${describeRules(item.rules)}`,
    hud: (st) => `<span class="dim num">Hand ${Math.min(st.n + 1, items.length)}/${items.length}</span><span class="${st.n - st.correct > 1 ? 'bad' : 'ok'} num">${st.n - st.correct} error${st.n - st.correct === 1 ? '' : 's'} <span class="dim">(max 1)</span></span>`,
    onFinish: async (st) => {
      const score = st.correct / st.n, errors = st.n - st.correct;
      const perHand = st.evLost / st.n;
      const passed = st.n >= HANDS && st.correct >= NEEDED;
      if (passed && !practice) {
        const c = { date: Date.now(), score, hands: st.n, errors, ruleSetRandomized: true, perHandErrorCost: perHand };
        await store.addCert(c);
        const p = ctx.profile; p.tierProgress = p.tierProgress || {}; p.tierProgress[9] = { ...(p.tierProgress[9] || {}), passed: true, window: [], best: 0, attempts: ((p.tierProgress[9] || {}).attempts || 0) + 1 }; await ctx.save();
        return `<h2>Certificate issued</h2>${certCard(c)}`;
      }
      return `<div class="card ${passed ? 'ok' : 'due'}">${passed ? 'Passed — but this was practice, so no certificate was issued.' : `Not yet: ${NEEDED} of ${HANDS} needed, you got ${st.correct}.`} Per-hand error cost this run: <b>${usd100(perHand)}</b> per $100 wagered.</div>`;
    },
    restart: () => run(el, ctx, practice),
  });
  return () => ctl.stop();
}
