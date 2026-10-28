// Baccarat table: two ways to sit down.
//   table    - place bets with a simulated bankroll, watch the dealer deal, see every result settled.
//   practice - no money: the dealer stops after the first four cards and you call the draws yourself
//              (Natural? Does the Player draw? Does the Banker draw?), with the rule explained each time.

import { Shoe } from '../app/shoe.js';
import { shoeSettings, prepareShoe, shoeLine, openShoeSheet } from '../ui/shoe-settings.js';
import { renderBaccTable } from '../ui/bacc-table.js';
import { beadHTML, bigHTML } from '../ui/roads-view.js';
import { toast } from '../ui/hand.js';
import { openSheet } from '../ui/sheet.js';
import { store } from '../app/store.js';
import { cue, confetti } from '../app/feel.js';
import { normalizeBacc, playerDraws, bankerDraws, bankerReason, total, isNatural, isPair, settle, edges } from '../engine/baccarat.js';
import { longestStreak } from '../app/roads.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (n) => `${n < 0 ? '−' : n > 0 ? '+' : ''}$${Math.abs(n).toFixed(2).replace(/\.00$/, '')}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BET_NAME = { player: 'Player', banker: 'Banker', tie: 'Tie', playerPair: 'Player Pair', bankerPair: 'Banker Pair' };

export const baccCfg = (ctx) => normalizeBacc((ctx.profile.bacc = { variant: 'standard', tiePays: 8, decks: 8, ...(ctx.profile.bacc || {}) }));

const edgeCache = new Map();
export function edgesFor(cfg) {
  const k = `${cfg.decks}|${cfg.variant}|${cfg.tiePays}`;
  if (!edgeCache.has(k)) edgeCache.set(k, edges(cfg.decks, cfg));
  return edgeCache.get(k);
}

export function baccaratTable(el, ctx, mode = 'table') {
  const cfg = baccCfg(ctx), practice = mode === 'practice', s = ctx.profile.settings;
  const SH = new Shoe(cfg.decks, shoeSettings(ctx.profile));
  const units = [s.unit || 5, (s.unit || 5) * 5, (s.unit || 5) * 10, (s.unit || 5) * 25];
  const S = {
    bank: s.bankroll || 500, start: s.bankroll || 500, net: 0, hands: 0, rounds: [], bets: {}, last: {}, chip: units[0], busy: false, alive: true,
    prac: { n: 0, c: 0, streak: 0, best: 0 }, expLoss: 0, wagered: 0, t0: Date.now(),
  };
  const odds = { pair: cfg.pairPays, tie: cfg.tiePays, banker: cfg.variant === 'ez' ? '1:1*' : '19:20' };

  el.innerHTML = `<div class="topbar"><button class="btn small ghost" id="end">End session</button><div class="grow"></div><div class="right small dim">${practice ? 'Practice: call the draws' : 'Table'} · ${cfg.decks} decks${cfg.variant === 'ez' ? ' · EZ' : ''}</div></div>
    <div id="hud" class="small"></div><div id="panel" style="min-height:56px"></div><div id="tbl"></div>
    ${practice ? '' : `<div class="chips-row" id="chips"></div>`}
    <div class="actionbar" id="bar"></div>
    <h2>Scoreboard</h2><div class="small dim" style="margin:0 0 6px">Bead plate (every hand, in order) and Big Road (streaks). They record the past; they do not predict the next hand.</div>
    <div id="roads"></div>
    <p class="small dim" id="edgeline"></p>`;
  const $ = (id) => el.querySelector('#' + id);

  const view = { player: [], banker: [], nf: { p: 99, b: 99 }, winner: null, winning: null, say: 'Place your bets', mood: '', hideTotals: false, betsOpen: !practice };
  const draw = () => {
    renderBaccTable($('tbl'), { variant: practice ? 'practice' : 'live', player: view.player, banker: view.banker, newFrom: view.nf, winner: view.winner, winning: view.winning, say: view.say, mood: view.mood, hideZones: practice, bets: S.bets, betsOpen: view.betsOpen && !S.busy, odds });
    if (!practice) $('tbl').querySelectorAll('.bzone').forEach((b) => b.onclick = () => addBet(b.dataset.bet));
  };
  const totalBet = () => Object.values(S.bets).reduce((a, b) => a + b, 0);

  function hud() {
    const n = S.rounds.length, cnt = (w) => S.rounds.filter((r) => r.winner === w).length;
    $('hud').innerHTML = practice
      ? `<div class="row wrap" style="justify-content:space-between"><span>Hand <b class="num">${S.hands}</b></span><span class="streak ${S.prac.streak >= 5 ? 'ok' : ''}">Streak <span class="num">${S.prac.streak}</span> <span class="dim">best ${S.prac.best}</span></span></div>
         <div class="small">Calls right <b class="num">${S.prac.n ? Math.round(S.prac.c / S.prac.n * 100) : 100}%</b> <span class="dim">(${S.prac.c}/${S.prac.n})</span> · <span class="dim">${shoeLine(SH, ctx.profile)}</span></div>`
      : `<div class="row wrap" style="justify-content:space-between"><span>Bankroll <b class="num">$${S.bank.toFixed(2).replace(/\.00$/, '')}</b> <span class="num ${S.net >= 0 ? 'ok' : 'bad'}">${money(S.net)}</span></span><span>Hand <b class="num">${S.hands}</b></span></div>
         <div class="small dim">B ${cnt('banker')} · P ${cnt('player')} · T ${cnt('tie')} of ${n} · ${shoeLine(SH, ctx.profile)} <button class="btn small ghost" id="shoebtn" style="min-height:28px;padding:0 8px">Shoe</button></div>`;
    const sb = $('shoebtn'); if (sb) sb.onclick = () => openShoeSheet(ctx, SH, { onChange: hud });
    $('roads').innerHTML = `${beadHTML(S.rounds)}<div style="height:8px"></div>${bigHTML(S.rounds)}`;
  }

  function chips() {
    if (practice) return;
    $('chips').innerHTML = units.map((u, i) => `<button class="chipbtn c${i} ${S.chip === u ? 'sel' : ''}" data-u="${u}" aria-label="Chip $${u}">$${u}</button>`).join('');
    $('chips').querySelectorAll('.chipbtn').forEach((b) => b.onclick = () => { S.chip = Number(b.dataset.u); chips(); });
  }

  function addBet(id) {
    if (S.busy || !view.betsOpen) return;
    if (totalBet() + S.chip > S.bank) { toast('Not enough bankroll for that chip.'); return; }
    S.bets[id] = (S.bets[id] || 0) + S.chip;
    cue(true); bar(); draw();
  }

  function bar() {
    const b = $('bar');
    if (S.busy) { b.style.gridTemplateColumns = '1fr'; b.innerHTML = `<button class="btn block" disabled>Dealing…</button>`; return; }
    if (practice) { b.style.gridTemplateColumns = '1fr'; b.innerHTML = `<button class="btn primary block" id="deal">Deal next hand</button>`; b.querySelector('#deal').onclick = () => round(); return; }
    const has = totalBet() > 0, canRebet = Object.keys(S.last).length > 0;
    b.style.gridTemplateColumns = '1fr 1fr 2fr';
    b.innerHTML = `<button class="act" id="clr">Clear</button><button class="act" id="rb" ${canRebet ? '' : 'disabled'}>Rebet</button><button class="btn primary" id="deal" ${has ? '' : 'disabled'} style="min-height:58px">Deal${has ? ` $${totalBet()}` : ''}</button>`;
    b.querySelector('#clr').onclick = () => { S.bets = {}; bar(); draw(); };
    b.querySelector('#rb').onclick = () => { const t = Object.values(S.last).reduce((a, c) => a + c, 0); if (t > S.bank) { toast('Not enough bankroll to repeat that.'); return; } S.bets = { ...S.last }; bar(); draw(); };
    b.querySelector('#deal').onclick = () => round();
  }

  // Practice: the question sits above the table, the answers are the action bar (always in reach).
  function ask(title, options, rightId, why) {
    return new Promise((resolve) => {
      $('panel').innerHTML = `<div class="banner"><b>${esc(title)}</b></div>`;
      const b = $('bar');
      b.style.gridTemplateColumns = `repeat(${options.length}, 1fr)`;
      b.innerHTML = options.map(([id, t]) => `<button class="act" data-id="${id}" style="font-size:14px">${esc(t)}</button>`).join('');
      b.querySelectorAll('button').forEach((x) => x.onclick = () => {
        const ok = x.dataset.id === rightId;
        S.prac.n++; if (ok) { S.prac.c++; S.prac.streak++; S.prac.best = Math.max(S.prac.best, S.prac.streak); } else S.prac.streak = 0;
        cue(ok); hud();
        b.querySelectorAll('button').forEach((y) => { y.disabled = true; if (y.dataset.id === rightId) y.classList.add('picked-ok'); else if (y === x) y.classList.add('picked-bad'); });
        $('panel').innerHTML = `<div class="verdict ${ok ? 'ok' : 'bad'} pop"><div class="head ${ok ? 'ok' : 'bad'}">${ok ? 'Correct' : 'Not quite'}</div><div class="small dim">${esc(why)}</div></div>`;
        b.style.gridTemplateColumns = '1fr';
        b.innerHTML = '<button class="btn primary block" id="go">Continue</button>';
        b.querySelector('#go').onclick = () => { $('panel').innerHTML = ''; bar(); resolve(); };
      });
    });
  }

  async function round() {
    if (S.busy || !S.alive) return;
    if (!practice) {
      if (!totalBet()) return;
      if (S.net <= -(s.lossLimit || 100)) { toast('Session loss limit reached. End the session.', 3500); return; }
    }
    S.busy = true; view.betsOpen = false; S.last = { ...S.bets };
    prepareShoe(SH, ctx.profile);
    view.player = []; view.banker = []; view.winner = null; view.winning = null; view.mood = ''; view.hideTotals = false;
    $('panel').innerHTML = ''; bar();
    const P = [], B = [];
    const deal = async (side, say, wait = 520) => {
      const c = SH.draw();
      const nfp = P.length, nfb = B.length;
      (side === 'p' ? P : B).push(c);
      view.player = P.slice(); view.banker = B.slice(); view.nf = { p: nfp, b: nfb }; view.say = say;
      draw();
      await sleep(wait);
      return c;
    };
    await deal('p', 'Player card'); await deal('b', 'Banker card'); await deal('p', 'Player card'); await deal('b', 'Banker card', 650);
    if (!S.alive) return;
    const pT0 = total(P.map((c) => c.v)), bT0 = total(B.map((c) => c.v));
    let p3 = null;
    if (isNatural(pT0, bT0)) {
      view.say = `<b>Natural ${Math.max(pT0, bT0)}</b>`; draw();
      if (practice) await ask('What happens next?', [['nat', 'Natural: no more cards'], ['draw', 'Player draws'], ['stand', 'Player stands']], 'nat', `Player ${pT0}, Banker ${bT0}. A total of 8 or 9 on either side is a natural: both hands stop and no third cards are drawn.`);
      else await sleep(900);
    } else {
      view.say = `Player ${pT0}`; draw();
      if (practice) await ask(`Player has ${pT0}, Banker ${bT0}. What happens next?`, [['nat', 'Natural: no more cards'], ['draw', 'Player draws'], ['stand', 'Player stands']], playerDraws(pT0) ? 'draw' : 'stand', playerDraws(pT0) ? `The Player always draws on 0–5. ${pT0} is in that range, so the Player draws a third card.` : `The Player stands on 6 or 7. ${pT0} stands, and the Banker then follows the Player-stood rule (draws on 0–5).`);
      else { view.say = `Player ${pT0}: ${playerDraws(pT0) ? 'draws' : 'stands'}`; draw(); await sleep(900); }
      if (playerDraws(pT0)) { const c = await deal('p', 'Player draws', 700); p3 = c.v; }
      const bT1 = bT0, drawsB = bankerDraws(bT1, p3);
      if (practice) await ask(`Banker has ${bT1}${p3 === null ? ' and the Player stood' : `; the Player’s third card was worth ${p3 >= 10 ? 0 : p3}`}. Banker?`, [['draw', 'Banker draws'], ['stand', 'Banker stands']], drawsB ? 'draw' : 'stand', bankerReason(bT1, p3));
      else { view.say = `Banker ${bT1}: ${drawsB ? 'draws' : 'stands'}`; draw(); await sleep(900); }
      if (drawsB) await deal('b', 'Banker draws', 700);
    }
    if (!S.alive) return;
    // Result
    const pT = total(P.map((c) => c.v)), bT = total(B.map((c) => c.v));
    const winner = pT > bT ? 'player' : bT > pT ? 'banker' : 'tie';
    const round1 = { winner, player: P.map((c) => c.v), banker: B.map((c) => c.v), pTotal: pT, bTotal: bT };
    const pairs = { player: isPair(P), banker: isPair(B) };
    view.winner = winner; view.nf = { p: 99, b: 99 }; view.mood = '';
    const winning = [winner]; if (pairs.player) winning.push('playerPair'); if (pairs.banker) winning.push('bankerPair'); view.winning = winning;
    let delta = 0; const lines = [];
    const ed = practice ? null : edgesFor(cfg);
    for (const [k, amt] of Object.entries(S.bets)) {
      const r = settle(amt, k, round1, cfg, pairs); delta += r;
      lines.push(`${BET_NAME[k]} $${amt}: ${r > 0 ? `<b class="ok">${money(r)}</b>` : r < 0 ? `<b class="bad">${money(r)}</b>` : '<b>push</b>'}`);
      const e = k === 'player' ? ed.player : k === 'banker' ? ed.banker : k === 'tie' ? ed.tie : ed.pair;
      S.expLoss += amt * -e; S.wagered += amt;
    }
    S.bank = +(S.bank + delta).toFixed(2); S.net = +(S.net + delta).toFixed(2); S.hands++;
    S.rounds.push({ winner, pPair: pairs.player, bPair: pairs.banker, pTotal: pT, bTotal: bT });
    view.say = winner === 'tie' ? 'Tie' : `${winner === 'player' ? 'Player' : 'Banker'} wins`;
    view.hideTotals = false; S.bets = {}; view.betsOpen = !practice; S.busy = false;
    draw(); hud(); bar();
    const head = winner === 'tie' ? `Tie ${pT}–${bT}` : `${winner === 'player' ? 'Player' : 'Banker'} wins ${winner === 'player' ? pT : bT}–${winner === 'player' ? bT : pT}`;
    $('panel').innerHTML = `<div class="card ${practice ? '' : delta > 0 ? 'ok' : delta < 0 ? 'bad' : ''}"><b>${head}${pairs.player ? ' · Player pair' : ''}${pairs.banker ? ' · Banker pair' : ''}</b>${lines.length ? `<div class="small" style="margin-top:4px">${lines.join('<br>')}<br><b>Net ${money(delta)}</b></div>` : ''}</div>`;
    if (!practice && S.net <= -(s.lossLimit || 100)) $('panel').insertAdjacentHTML('beforeend', `<div class="banner due"><b>You've hit your session loss limit ($${s.lossLimit || 100}).</b> Stop here. The table is closed for this session.</div>`);
  }

  async function finish() {
    S.alive = false;
    const n = S.rounds.length;
    if (n) await store.addSession({ date: Date.now(), mode: practice ? 'bacc-practice' : 'bacc-table', handsPlayed: n, accuracy: practice ? (S.prac.n ? S.prac.c / S.prac.n : 1) : 1, evLost: S.wagered ? S.expLoss / n : 0, bankrollDelta: S.net });
    const cnt = (w) => S.rounds.filter((r) => r.winner === w).length;
    const e = edgesFor(cfg).odds;
    el.innerHTML = `<h1>${practice ? 'Practice' : 'Table'} complete</h1>
      <div class="stat3"><div class="card"><div class="v">${n}</div><div class="k">Hands</div></div>
      ${practice ? `<div class="card"><div class="v ${S.prac.n && S.prac.c / S.prac.n >= 0.9 ? 'ok' : ''}">${S.prac.n ? Math.round(S.prac.c / S.prac.n * 100) : 0}%</div><div class="k">Calls right</div></div><div class="card"><div class="v">${S.prac.best}</div><div class="k">Best streak</div></div>`
        : `<div class="card"><div class="v ${S.net >= 0 ? 'ok' : 'bad'}">${money(S.net)}</div><div class="k">Net</div></div><div class="card"><div class="v">$${S.wagered}</div><div class="k">Wagered</div></div>`}</div>
      ${!practice && S.wagered ? `<div class="card">At these bets the house takes about <b>$${S.expLoss.toFixed(2)}</b> on average over the long run. You finished ${S.net >= 0 ? 'ahead' : 'behind'} by <b>${money(S.net)}</b>. Short sessions swing far from the average in either direction.</div>` : ''}
      ${n ? `<div class="card"><b>What the shoe did</b><div class="small dim" style="margin-top:4px">Banker ${cnt('banker')} (${Math.round(cnt('banker') / n * 100)}%, expected ${(e.banker * 100).toFixed(1)}%) · Player ${cnt('player')} (${Math.round(cnt('player') / n * 100)}%, expected ${(e.player * 100).toFixed(1)}%) · Tie ${cnt('tie')} (${Math.round(cnt('tie') / n * 100)}%, expected ${(e.tie * 100).toFixed(1)}%). Longest Banker run ${longestStreak(S.rounds.map((r) => r.winner), 'banker')}, Player run ${longestStreak(S.rounds.map((r) => r.winner), 'player')}.</div></div>` : ''}
      <a class="btn primary block" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="#/play/baccarat">Done</a>`;
    if (practice && S.prac.n >= 8 && S.prac.c / S.prac.n >= 0.95) confetti();
  }

  $('end').onclick = () => { if (S.alive) finish(); };
  draw(); hud(); chips(); bar();
  setTimeout(() => { if (S.alive) { const ed = edgesFor(cfg); const l = $('edgeline'); if (l) l.innerHTML = `House edge on each bet: Banker <b>${(-ed.banker * 100).toFixed(2)}%</b> · Player <b>${(-ed.player * 100).toFixed(2)}%</b> · Tie <b class="bad">${(-ed.tie * 100).toFixed(2)}%</b> · Pair <b class="bad">${(-ed.pair * 100).toFixed(2)}%</b>${cfg.variant === 'ez' ? '<br>*EZ Baccarat: no commission, but a Banker win with three cards totalling 7 pushes.' : ''}`; } }, 50);
  return () => { S.alive = false; };
}
