// Counting Pro extras: the bankroll / Kelly tool and the table scout log.
//   #/play/counting/bankroll   how big a bankroll a spread needs, Kelly bet sizes, risk of ruin
//   #/play/counting/scout      rate the tables you actually see: rules, penetration, shuffle, verdict

import { RAMPS, rampUnits, edgeAtTC, solvedActive } from '../engine/indices.js';
import { engine } from '../app/engine-client.js';
import { describeRules } from '../app/presets.js';
import { houseEdge } from '../app/edges.js';
import { normalizeRules } from '../engine/rules.js';

const sgn = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
const money = (n) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const back = () => '<div class="topbar"><a class="back" href="#/play/counting">‹ Counting Pro</a></div>';
const VAR = 1.3;     // variance of one blackjack hand, in units² (a flat 1-unit bet)

// ---- bankroll / Kelly --------------------------------------------------------------------------------------
export async function bankroll(el, ctx) {
  const st = (ctx.profile.counting ||= {});
  const s = (st.bank ||= { bankroll: 5000, unit: 25, ramp: '1-8', pen: 0.75, hph: 100 });
  const rules = ctx.rules;
  let he = await houseEdge(rules);
  if (!Number.isFinite(he)) he = 0.5;
  s.he = Number.isFinite(s.he) ? s.he : +he.toFixed(2);
  let sim = null, running = false, err = '';

  function table() {
    const B = s.bankroll / s.unit, rows = [];
    for (let tc = -1; tc <= 8; tc++) {
      const e = edgeAtTC(s.he, tc) / 100, u = rampUnits(s.ramp, tc);
      const full = Math.max(0, e / VAR * B), half = full / 2;
      const over = u > Math.max(1, half) * 1.0001 && e > 0 ? u > full : false;
      rows.push(`<tr><td class="num">${sgn(tc) || '0'}</td><td class="num ${e > 0 ? 'ok' : 'bad'}">${(e * 100 >= 0 ? '+' : '−') + Math.abs(e * 100).toFixed(2)}%</td>
        <td class="num"><b>${u}</b> <span class="dim">${money(u * s.unit)}</span></td><td class="num">${e > 0 ? money(half * s.unit) : '—'}</td><td class="num ${over ? 'bad' : ''}">${e > 0 ? money(full * s.unit) : '—'}</td></tr>`);
    }
    return rows.join('');
  }

  function draw() {
    const B = Math.round(s.bankroll / s.unit);
    el.innerHTML = `${back()}<h1>Bankroll &amp; Kelly</h1>
      <p class="dim small" style="margin-top:0">How much money a spread really needs. ${describeRules(rules)}${solvedActive(rules) ? ' · solved index tables on' : ''}.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap"><label class="field grow">Bankroll ($)<input id="bk" type="number" inputmode="decimal" value="${s.bankroll}"></label><label class="field grow">Minimum bet ($)<input id="un" type="number" inputmode="decimal" value="${s.unit}"></label></div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px"><label class="field grow">House edge at TC 0 (%)<input id="he" type="number" step="0.01" inputmode="decimal" value="${s.he}"></label><label class="field grow">Hands per hour<input id="hph" type="number" inputmode="numeric" value="${s.hph}"></label></div>
      <div class="small dim" style="margin-top:10px">Bet spread</div><div class="seg" id="r" style="margin:6px 0 10px">${Object.entries(RAMPS).map(([k, v]) => `<button data-v="${k}" class="${s.ramp === k ? 'on' : ''}">${v.name}</button>`).join('')}</div>
      <div class="small dim">Penetration</div><div class="seg" id="p" style="margin:6px 0 10px">${[0.5, 0.65, 0.75, 0.85].map((v) => `<button data-v="${v}" class="${s.pen === v ? 'on' : ''}">${Math.round(v * 100)}%</button>`).join('')}</div>
      <div class="card"><h3>Your bankroll is ${B} units</h3><p class="small dim" style="margin-top:0">A “unit” is your minimum bet. The usual guidance for a real spread is 200 to 400 units, because the swings are large even when the edge is real. Kelly is the mathematically optimal bet; almost everyone bets <b>half or quarter Kelly</b> because full Kelly is a rollercoaster and the edge estimate is never exact.</p>
        <table class="evtable"><tr><td class="small dim">True count</td><td class="small dim">Your edge</td><td class="small dim">Your ramp</td><td class="small dim">½ Kelly</td><td class="small dim">Full Kelly</td></tr>${table()}</table>
        <p class="small dim" style="margin-bottom:0">Each +1 of true count is worth about +0.5%. Red means your ramp bets more than full Kelly at that count: you would be over-betting your bankroll there.</p></div>
      <button class="btn primary block" id="go" ${running ? 'disabled' : ''}>${running ? 'Simulating…' : 'Check it with a simulation'}</button>
      ${err ? `<p class="bad">${err}</p>` : ''}${sim ? result() : ''}`;
    const num = (id, key) => { el.querySelector(id).onchange = (e) => { const v = Number(e.target.value); if (v > 0) { s[key] = v; ctx.save(); sim = null; draw(); } }; };
    num('#bk', 'bankroll'); num('#un', 'unit'); num('#he', 'he'); num('#hph', 'hph');
    el.querySelectorAll('#r button').forEach((b) => b.onclick = () => { s.ramp = b.dataset.v; ctx.save(); sim = null; draw(); });
    el.querySelectorAll('#p button').forEach((b) => b.onclick = () => { s.pen = Number(b.dataset.v); ctx.save(); sim = null; draw(); });
    el.querySelector('#go').onclick = run;
  }

  function result() {
    const c = sim.counter, perHr = c.perHand * s.hph * s.unit, sdHr = c.sd * Math.sqrt(s.hph) * s.unit;
    const B = Math.round(s.bankroll / s.unit), ror = sim.ror[B];
    const verdict = ror < 0.05 ? 'ok' : ror > 0.25 ? 'bad' : 'due';
    return `<div class="card" style="margin-top:12px"><h3>Simulated: ${RAMPS[s.ramp].name} spread, ${Math.round(s.pen * 100)}% penetration</h3>
      <table class="evtable"><tr><td>Your edge on money wagered</td><td class="num">${(c.edgePct >= 0 ? '+' : '−') + Math.abs(c.edgePct).toFixed(2)}% ± ${(1.96 * c.se / Math.max(0.0001, sim.avgUnits) * 100).toFixed(2)}%</td></tr>
        <tr><td>Expected per hour (${s.hph} hands)</td><td class="num ${perHr > 0 ? 'ok' : 'bad'}">${money(perHr)}</td></tr>
        <tr><td>Typical swing per hour (1 std dev)</td><td class="num">±${money(sdHr)}</td></tr>
        <tr><td>Risk of ruin, ${B} units, 20,000 hands</td><td class="num ${verdict}"><b>${Math.round(ror * 100)}%</b></td></tr></table>
      <p class="small" style="margin-bottom:0"><b>${c.edgePct <= 0 ? 'No edge here: more bankroll does not fix a game you do not beat.' : ror > 0.25 ? 'Under-bankrolled for this spread. Drop the spread or raise the bankroll.' : ror < 0.05 ? 'Well funded for this spread.' : 'Playable but bumpy; a smaller spread would be safer.'}</b> One run is a sample, not a promise. ${sim.hands.toLocaleString()} hands simulated.</p></div>`;
  }

  async function run() {
    running = true; err = ''; draw();
    try {
      sim = await engine.countSim({ rules, solved: solvedActive(rules) ? await engine.cachedIdx(rules) : null, hands: 400000, pen: s.pen, ramp: s.ramp, deviations: true, bankrolls: [Math.max(1, Math.round(s.bankroll / s.unit))], seed: (Date.now() % 100000) + 1 });
    } catch (e) { err = 'Simulation failed: ' + (e.message || e); }
    running = false; if (el.isConnected) draw();
  }
  draw();
  return () => { running = false; };
}

// ---- table scout log ---------------------------------------------------------------------------------------
// Grade a table you looked at. Counting needs a dealt-deep shoe; rules and the shuffle matter more than anything.
export function gradeTable(t, he) {
  const notes = [];
  let score = 100;
  if (t.shuffle === 'csm') { return { grade: 'F', score: 0, label: 'Unbeatable by counting', notes: ['A continuous shuffler puts cards back constantly: the count carries no information.'] }; }
  if (t.shuffle === 'rng') { return { grade: 'F', score: 0, label: 'Unbeatable by counting', notes: ['An RNG table reshuffles every hand: nothing to count.'] }; }
  if (t.bj === 1.2) { score -= 55; notes.push('6:5 blackjack costs about 1.4% — a count will not cover that.'); }
  if (t.bj === 1) { score -= 70; notes.push('Even-money blackjack is a disaster for the player.'); }
  if (t.pen < 0.6) { score -= 35; notes.push('Under 60% penetration: very little of the edge is reachable.'); }
  else if (t.pen < 0.7) { score -= 18; notes.push('Penetration is modest; fine for learning, thin for profit.'); }
  else if (t.pen >= 0.8) { score += 6; notes.push('Deep penetration: this is what makes counting pay.'); }
  if (t.hit17) { score -= 6; notes.push('Dealer hits soft 17 (costs about 0.2%).'); }
  if (!t.das) { score -= 5; notes.push('No double after split.'); }
  if (t.surr) { score += 4; notes.push('Late surrender helps, and unlocks the Fab 4.'); }
  if (t.decks <= 2) { score += 4; notes.push('Few decks: a higher base edge and bigger swings in the count.'); }
  if (t.decks >= 8) { score -= 6; notes.push('Eight decks dilutes every count.'); }
  if (t.spread && t.minBet && t.maxBet && t.maxBet / t.minBet < 8) { score -= 12; notes.push(`Table limits allow only a ${Math.round(t.maxBet / t.minBet)}:1 spread, which caps the ramp.`); }
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : score >= 30 ? 'D' : 'F';
  const label = { A: 'Good for a counter', B: 'Decent', C: 'Marginal', D: 'Poor', F: 'Avoid' }[grade];
  if (Number.isFinite(he)) notes.push(`Base house edge about ${he.toFixed(2)}% with basic strategy.`);
  return { grade, score, label, notes };
}

const toRules = (t) => normalizeRules({ decks: t.decks, dealerHitsSoft17: t.hit17, doubleAfterSplit: t.das, surrender: t.surr ? 'late' : 'none', blackjackPays: t.bj });

export function scout(el, ctx) {
  const st = (ctx.profile.counting ||= {});
  const log = (st.scout ||= []);
  let draft = { place: '', decks: 6, hit17: false, das: true, surr: false, bj: 1.5, pen: 0.75, shuffle: 'shoe', minBet: 25, maxBet: 500, note: '' };

  const gradeColor = { A: 'ok', B: 'ok', C: 'due', D: 'bad', F: 'bad' };
  async function draw() {
    const rated = await Promise.all(log.map(async (t) => { let he = null; try { he = await houseEdge(toRules(t)); } catch { /* ignore */ } return { t, g: gradeTable({ ...t, spread: true }, he) }; }));
    rated.sort((a, b) => b.g.score - a.g.score);
    const seg = (id, opts, cur) => `<div class="seg" id="${id}" style="margin:4px 0 8px">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    el.innerHTML = `${back()}<h1>Table scout</h1>
      <p class="dim small" style="margin-top:0">Rate each table before you sit. The rules and the shuffle decide whether counting can ever pay, long before your skill does. Your saved tables are ranked best first.</p>
      <div class="card"><label class="field">Where / which table<input id="pl" type="text" value="${ctx.esc(draft.place)}" placeholder="e.g. Studio shoe, table 3"></label>
        <div class="small dim">Decks</div>${seg('dk', [[1, '1'], [2, '2'], [4, '4'], [6, '6'], [8, '8']], draft.decks)}
        <div class="small dim">Blackjack pays</div>${seg('bj', [[1.5, '3:2'], [1.2, '6:5'], [1, '1:1']], draft.bj)}
        <div class="small dim">Shuffle</div>${seg('sh', [['shoe', 'Shoe to cut card'], ['hand', 'Hand shuffled'], ['csm', 'Continuous (CSM)'], ['rng', 'RNG']], draft.shuffle)}
        <div class="small dim">Penetration (how deep before the shuffle)</div>${seg('pn', [[0.4, '40%'], [0.5, '50%'], [0.65, '65%'], [0.75, '75%'], [0.85, '85%']], draft.pen)}
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px"><label class="toggle"><input type="checkbox" id="h17" ${draft.hit17 ? 'checked' : ''}> Dealer hits soft 17</label><label class="toggle"><input type="checkbox" id="das" ${draft.das ? 'checked' : ''}> Double after split</label><label class="toggle"><input type="checkbox" id="sur" ${draft.surr ? 'checked' : ''}> Late surrender</label></div>
        <div class="row" style="gap:8px"><label class="field grow">Min bet<input id="mn" type="number" inputmode="decimal" value="${draft.minBet}"></label><label class="field grow">Max bet<input id="mx" type="number" inputmode="decimal" value="${draft.maxBet}"></label></div>
        <label class="field">Notes<input id="nt" type="text" value="${ctx.esc(draft.note)}" placeholder="dealer, cut card depth, heat…"></label>
        <button class="btn primary block" id="add">Rate &amp; save this table</button></div>
      ${rated.length ? '<h2>Your tables</h2>' : ''}
      ${rated.map(({ t, g }, i) => `<div class="card"><div class="row" style="gap:10px;align-items:flex-start"><div class="big num ${gradeColor[g.grade]}" style="min-width:34px">${g.grade}</div><div class="grow"><b>${ctx.esc(t.place || 'Table')}</b> <span class="small dim">${describeRules(toRules(t))} · ${t.shuffle === 'csm' ? 'CSM' : t.shuffle === 'rng' ? 'RNG' : Math.round(t.pen * 100) + '% pen'} · $${t.minBet}–$${t.maxBet}</span>
        <div class="small"><b>${g.label}.</b> ${g.notes.map(ctx.esc).join(' ')}</div>${t.note ? `<div class="small dim">${ctx.esc(t.note)}</div>` : ''}</div><button class="btn ghost" data-del="${log.indexOf(t)}" aria-label="Delete">✕</button></div></div>`).join('')}`;
    const sel = (id, key, cast) => el.querySelectorAll(`#${id} button`).forEach((b) => b.onclick = () => { draft[key] = cast(b.dataset.v); readText(); draw(); });
    sel('dk', 'decks', Number); sel('bj', 'bj', Number); sel('sh', 'shuffle', String); sel('pn', 'pen', Number);
    const readText = () => { draft.place = el.querySelector('#pl').value; draft.note = el.querySelector('#nt').value; draft.minBet = Number(el.querySelector('#mn').value) || draft.minBet; draft.maxBet = Number(el.querySelector('#mx').value) || draft.maxBet; draft.hit17 = el.querySelector('#h17').checked; draft.das = el.querySelector('#das').checked; draft.surr = el.querySelector('#sur').checked; };
    el.querySelector('#add').onclick = async () => { readText(); log.unshift({ ...draft, at: Date.now() }); if (log.length > 40) log.length = 40; await ctx.save(); draft = { ...draft, place: '', note: '' }; draw(); };
    el.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { log.splice(Number(b.dataset.del), 1); await ctx.save(); draw(); });
  }
  draw();
}
