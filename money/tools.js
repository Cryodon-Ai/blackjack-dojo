// Money & Mind tools: variance simulation, Martingale ruin, bonus playthrough math.
// Simulations play real rounds through engine/round.js with a total-dependent perfect-play policy.

import { makePolicy, playRounds, mulberry32 } from '../engine/sim.js';
import { houseEdge } from '../app/edges.js';
import { describeRules } from '../app/presets.js';
import { normalizeRules } from '../engine/rules.js';

const $money = (x) => `${x < 0 ? '−' : ''}$${Math.abs(x).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const $money2 = (x) => `${x < 0 ? '−' : ''}$${Math.abs(x).toFixed(2)}`;
const tick = () => new Promise((r) => setTimeout(r, 0));
const quant = (arr, q) => { const a = Float64Array.from(arr).sort(); return a[Math.min(a.length - 1, Math.max(0, Math.floor(q * (a.length - 1))))]; };
const head = (title, back = '#/play') => `<div class="topbar"><a class="back" href="${back}">‹ Play</a></div><h1>${title}</h1>`;

function histogramSVG(values, { bins = 26, unit = '$' } = {}) {
  const min = Math.min(...values), max = Math.max(...values);
  const w = (max - min) / bins || 1;
  const counts = Array(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.floor((v - min) / w))]++;
  const top = Math.max(...counts);
  const W = 340, H = 130, bw = W / bins;
  const zeroX = ((0 - min) / (max - min || 1)) * W;
  const bars = counts.map((c, i) => {
    const mid = min + (i + 0.5) * w;
    const h = (c / top) * (H - 18);
    return `<rect x="${(i * bw + 1).toFixed(1)}" y="${(H - 16 - h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${mid < 0 ? 'var(--bad)' : 'var(--ok)'}" opacity=".85"/>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribution of session results"><line x1="${zeroX}" x2="${zeroX}" y1="0" y2="${H - 16}" stroke="var(--dim)" stroke-dasharray="3 3"/>${bars}
    <text x="2" y="${H - 3}" fill="var(--dim)" font-size="10">${$money(min)}</text><text x="${W / 2}" y="${H - 3}" fill="var(--dim)" font-size="10" text-anchor="middle">0 = break even</text><text x="${W - 2}" y="${H - 3}" fill="var(--dim)" font-size="10" text-anchor="end">${$money(max)}</text></svg>`;
}

function pathSVG(path) {
  const W = 340, H = 110, min = Math.min(0, ...path), max = Math.max(0, ...path), span = max - min || 1;
  const pts = path.map((v, i) => `${(i / (path.length - 1) * W).toFixed(1)},${(H - 6 - ((v - min) / span) * (H - 12)).toFixed(1)}`).join(' ');
  const zy = H - 6 - ((0 - min) / span) * (H - 12);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><line x1="0" x2="${W}" y1="${zy}" y2="${zy}" stroke="var(--dim)" stroke-dasharray="3 3"/><polyline points="${pts}" fill="none" stroke="var(--info)" stroke-width="2"/></svg>`;
}

// ---- 10,000 hands at perfect play ---------------------------------------------------------
export function variance(el, ctx) {
  const rules = ctx.rules;
  el.innerHTML = `${head('10,000 perfect hands')}
    <p class="dim" style="margin-top:0">${describeRules(rules)}</p>
    <div class="card"><label class="field">Bet per hand ($)<input id="bet" type="number" inputmode="decimal" value="${ctx.profile.settings.unit || 10}"></label>
      <label class="field">Hands per session<input id="hands" type="number" inputmode="numeric" value="10000"></label>
      <label class="field">Sessions simulated<input id="sess" type="number" inputmode="numeric" value="200"></label>
      <button class="btn primary block" id="run">Simulate</button></div><div id="out"></div>`;
  let cancel = false;
  el.querySelector('#run').onclick = async () => {
    const bet = Number(el.querySelector('#bet').value) || 10, hands = Math.min(50000, Number(el.querySelector('#hands').value) || 10000), sess = Math.min(600, Number(el.querySelector('#sess').value) || 200);
    const out = el.querySelector('#out');
    const pol = makePolicy(rules), edge = await houseEdge(rules);
    const results = [], t0 = performance.now();
    let path = null;
    for (let i = 0; i < sess && !cancel; i++) {
      const r = playRounds(rules, hands, 1000 + i, pol, { keepNets: i === 0 });
      results.push(r.net * bet);
      if (i === 0) { path = []; let c = 0; const step = Math.max(1, Math.floor(hands / 120)); for (let k = 0; k < hands; k++) { c += r.nets[k] * bet; if (k % step === 0) path.push(c); } }
      if (i % 5 === 0) { out.innerHTML = `<div class="card">Simulating… ${i + 1}/${sess} sessions</div>`; await tick(); }
    }
    if (cancel) return;
    const mean = results.reduce((a, b) => a + b, 0) / results.length;
    const sd = Math.sqrt(results.reduce((a, b) => a + (b - mean) ** 2, 0) / results.length);
    const ahead = results.filter((x) => x > 0).length / results.length;
    const expected = edge === null ? null : -hands * bet * edge / 100;
    out.innerHTML = `<h2>Where ${sess} sessions of ${hands.toLocaleString()} hands ended</h2>
      <div class="card">${histogramSVG(results)}</div>
      <div class="stat3"><div class="card"><div class="v ${mean >= 0 ? 'ok' : 'bad'}">${$money(mean)}</div><div class="k">Average</div></div><div class="card"><div class="v ${ahead >= 0.5 ? 'ok' : ''}">${Math.round(ahead * 100)}%</div><div class="k">Finished ahead</div></div><div class="card"><div class="v">${$money(sd)}</div><div class="k">Std. swing</div></div></div>
      <div class="card"><table class="evtable"><tr><td>Expected result (exact edge ${edge === null ? '—' : edge.toFixed(2) + '%'} × $${(hands * bet).toLocaleString()} wagered)</td><td class="num">${expected === null ? '—' : $money(expected)}</td></tr>
        <tr><td>Best / worst session</td><td class="num">${$money(Math.max(...results))} / ${$money(Math.min(...results))}</td></tr>
        <tr><td>Middle 90% of sessions</td><td class="num">${$money(quant(results, 0.05))} to ${$money(quant(results, 0.95))}</td></tr></table></div>
      ${path ? `<h2>One session, hand by hand</h2><div class="card">${pathSVG(path)}</div>` : ''}
      <div class="card"><b>What this shows.</b> Perfect basic strategy is still a losing game on average — but the swing (${$money(sd)} here) is much larger than the expected loss, so a big share of sessions finish <i>ahead</i> and a big share finish far behind. A losing session is not a strategy failure, and a winning one is not evidence you can beat the table.</div>
      <p class="small dim">Simulated by playing real rounds (${(sess * hands).toLocaleString()} total, fresh shuffle each, ${((performance.now() - t0) / 1000).toFixed(1)}s) with total-dependent basic strategy.</p>`;
  };
  return () => { cancel = true; };
}

// ---- Martingale ruin ----------------------------------------------------------------------
export function martingale(el, ctx) {
  const rules = ctx.rules;
  el.innerHTML = `${head('Martingale: the ruin math')}
    <p class="dim" style="margin-top:0">Double after every loss, return to base after a win. Same cards, same table — only the bet sizing changes.</p>
    <div class="card"><label class="field">Base bet ($)<input id="base" type="number" value="10"></label>
      <label class="field">Session bankroll ($)<input id="bank" type="number" value="500"></label>
      <label class="field">Table maximum bet ($)<input id="max" type="number" value="500"></label>
      <label class="field">Hands per session<input id="hands" type="number" value="300"></label>
      <button class="btn primary block" id="run">Simulate 1,000 sessions</button></div><div id="out"></div>`;
  el.querySelector('#run').onclick = async () => {
    const base = Number(el.querySelector('#base').value) || 10, bank0 = Number(el.querySelector('#bank').value) || 500, tmax = Number(el.querySelector('#max').value) || 500, hands = Math.min(2000, Number(el.querySelector('#hands').value) || 300);
    const out = el.querySelector('#out'), pol = makePolicy(rules), N = 1000;
    let ruined = 0; const marti = [], flat = [];
    let maxBetSeen = 0, wageredM = 0, wageredF = 0;
    for (let i = 0; i < N; i++) {
      const nets = playRounds(rules, hands, 5000 + i, pol, { keepNets: true }).nets;
      // flat
      let f = 0; for (let k = 0; k < hands; k++) f += nets[k] * base;
      flat.push(f); wageredF += hands * base;
      // martingale
      let bank = bank0, bet = base, over = false;
      for (let k = 0; k < hands; k++) {
        bet = Math.min(bet, tmax);
        if (bet > bank) { over = true; break; }
        maxBetSeen = Math.max(maxBetSeen, bet); wageredM += bet;
        const n = nets[k] * bet; bank += n;
        bet = n < 0 ? bet * 2 : n > 0 ? base : bet;
      }
      if (over) ruined++;
      marti.push(bank - bank0);
      if (i % 100 === 0) { out.innerHTML = `<div class="card">Simulating… ${i}/${N}</div>`; await tick(); }
    }
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const aheadM = marti.filter((x) => x > 0).length / N, aheadF = flat.filter((x) => x > 0).length / N;
    out.innerHTML = `<h2>Martingale</h2>
      <div class="stat3"><div class="card"><div class="v bad">${(ruined / N * 100).toFixed(0)}%</div><div class="k">Hit the wall</div></div><div class="card"><div class="v ${avg(marti) >= 0 ? 'ok' : 'bad'}">${$money(avg(marti))}</div><div class="k">Average result</div></div><div class="card"><div class="v">${Math.round(aheadM * 100)}%</div><div class="k">Finished ahead</div></div></div>
      <div class="card">${histogramSVG(marti)}</div>
      <h2>Same hands, flat $${base} bets</h2>
      <div class="stat3"><div class="card"><div class="v">0%</div><div class="k">Hit the wall</div></div><div class="card"><div class="v ${avg(flat) >= 0 ? 'ok' : 'bad'}">${$money(avg(flat))}</div><div class="k">Average result</div></div><div class="card"><div class="v">${Math.round(aheadF * 100)}%</div><div class="k">Finished ahead</div></div></div>
      <div class="card"><table class="evtable"><tr><td>Total wagered per session (Martingale vs flat)</td><td class="num">${$money(wageredM / N)} vs ${$money(wageredF / N)}</td></tr><tr><td>Biggest single bet you'd have to place</td><td class="num">${$money(maxBetSeen)}</td></tr></table></div>
      <div class="card"><b>The trap.</b> Martingale wins small amounts most of the time (${Math.round(aheadM * 100)}% of sessions finish ahead) and loses big when a losing streak arrives — a streak of just ${(() => { let lost = 0, b = base, k = 0; while (lost + b <= bank0) { lost += b; b *= 2; k++; } return k; })()} losses in a row leaves you unable to afford the next bet. It does not change the price per dollar wagered; it makes you wager <b>more</b> dollars, so the expected loss grows. The average line above is the honest number.</div>`;
  };
}

// ---- Bonus playthrough --------------------------------------------------------------------
export async function bonus(el, ctx) {
  const rules = ctx.rules;
  const edge0 = await houseEdge(rules);
  el.innerHTML = `${head('Bonus playthrough math')}
    <p class="dim" style="margin-top:0">Is a bonus worth clearing with blackjack? The answer is one number: the <b>game contribution</b> rate.</p>
    <div class="card"><label class="field">Bonus amount ($ or coin value)<input id="B" type="number" inputmode="decimal" value="20"></label>
      <label class="field">Playthrough (× bonus)<input id="P" type="number" inputmode="decimal" value="1"></label>
      <label class="field">Blackjack contribution (%) — table games are often 10–20%, or excluded (0)<input id="C" type="number" inputmode="decimal" value="10"></label>
      <label class="field">House edge (%) at your table<input id="E" type="number" inputmode="decimal" step="0.01" value="${edge0 === null ? 0.5 : edge0.toFixed(2)}"></label>
      <label class="field">Max bet while clearing (% of bonus)<input id="U" type="number" inputmode="decimal" value="5"></label></div><div id="out"></div>`;
  const out = el.querySelector('#out');
  let timer = 0;
  const calc = async () => {
    const B = Number(el.querySelector('#B').value) || 0, P = Number(el.querySelector('#P').value) || 0, C = (Number(el.querySelector('#C').value) || 0) / 100, E = (Number(el.querySelector('#E').value) || 0) / 100, Upct = (Number(el.querySelector('#U').value) || 5) / 100;
    if (C <= 0) { out.innerHTML = `<div class="card bad"><b class="bad">Excluded.</b> At 0% contribution, blackjack wagers do not count toward the playthrough. This bonus cannot be cleared here.</div>`; return; }
    const W = B * P / C, loss = W * E, ev = B - loss, be = P * E;
    out.innerHTML = `<div class="card ${ev > 0 ? 'ok' : 'bad'}"><div class="small dim">Expected value of clearing it</div><div class="big num ${ev > 0 ? 'ok' : 'bad'}">${ev >= 0 ? '+' : ''}${$money2(ev)}</div>
      <div class="small dim">= bonus ${$money2(B)} − expected loss ${$money2(loss)}</div></div>
      <div class="card"><table class="evtable"><tr><td>Wagering required (bonus × playthrough ÷ contribution)</td><td class="num">${$money(W)}</td></tr><tr><td>Expected loss (wagering × ${(E * 100).toFixed(2)}%)</td><td class="num">${$money2(loss)}</td></tr>
        <tr><td>Break-even contribution (playthrough × edge)</td><td class="num">${(be * 100).toFixed(2)}%</td></tr></table>
        <p class="small dim">Break-even is where clearing is worth exactly zero on average. Below it, the bonus costs you money; above it, the average is positive — before the risk of going broke while clearing.</p></div>
      <div class="card" id="mc">Estimating the chance of clearing before you go broke…</div>`;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      // Random walk with per-hand mean -edge and sd 1.14 bets, stepped in chunks. Starts with the bonus as the bankroll.
      const u = Math.max(0.01, B * Upct), hands = Math.ceil(W / u), chunk = 25, steps = Math.ceil(hands / chunk), N = 1500;
      const rand = mulberry32(99), gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return (s - 3) / Math.sqrt(0.5); };
      let clear = 0, sum = 0;
      for (let i = 0; i < N; i++) {
        let bal = B, ok = true;
        for (let k = 0; k < steps; k++) { bal += u * (-E * chunk + 1.14 * Math.sqrt(chunk) * gauss()); if (bal <= 0) { ok = false; bal = 0; break; } }
        if (ok) clear++; sum += bal;
      }
      const box = el.querySelector('#mc'); if (!box) return;
      box.innerHTML = `<b>Risk while clearing</b><br>Betting ${$money2(u)} a hand (${(Upct * 100).toFixed(0)}% of the bonus) for ~${hands.toLocaleString()} hands, about <b class="${clear / N > 0.7 ? 'ok' : 'due'}">${Math.round(clear / N * 100)}%</b> of runs clear the playthrough before the balance hits zero; the average ending balance is <b>${$money2(sum / N)}</b> across all runs.<p class="small dim">Normal-approximation simulation (per-hand swing ≈ 1.14 bets). It ignores withdrawal minimums, bet caps and any terms I can't see — read the bonus terms.</p>`;
    }, 50);
  };
  el.querySelectorAll('input').forEach((i) => i.oninput = calc);
  calc();
}
