// Count & Play: a real shoe, other players, and every skill a counter needs at once.
//   - size your bet from the (hidden) true count before each hand, graded against your ramp
//   - play the hand with basic strategy + the index plays, graded; mistakes play out so you feel them
//   - other players' cards come off the same shoe, in seat order, so you count what a real table shows
//   - count checks every few hands; insurance / even money graded against the +3 index
// Results are in units of your minimum bet. No money is involved.

import { Round } from '../engine/round.js';
import { upLabel } from '../engine/rules.js';
import { cardSVG, handLabel } from '../ui/cards.js';
import { Shoe } from '../app/shoe.js';
import { shoeSettings, prepareShoe, askCount } from '../ui/shoe-settings.js';
import { renderTable, renderActionBar, illegalReason, renderVerdict, toast } from '../ui/hand.js';
import { engine } from '../app/engine-client.js';
import { explain, ACTION_NAME } from '../app/feedback.js';
import { describeRules } from '../app/presets.js';
import { indexPlay, insuranceTaken, RAMPS, rampUnits, idxOf } from '../engine/indices.js';
import { openRulesEditor } from '../ui/rules-editor.js';

const KEYS = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sgn = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
const f1 = (n) => (Math.round(n * 10) / 10);
const PACE = { none: 0, fast: 160, normal: 380, slow: 800 };

// How a casual player at the table plays: hit/stand only, mostly by the book.
function otherAct(cards, up) {
  let hard = 0, ace = false;
  for (const c of cards) { hard += c.v; if (c.v === 1) ace = true; }
  const soft = ace && hard <= 11, t = soft ? hard + 10 : hard;
  if (hard > 21) return 'S';
  if (soft) return t >= 19 ? 'S' : t === 18 ? (up >= 9 || up === 1 ? 'H' : 'S') : 'H';
  if (t >= 17) return 'S';
  if (t >= 13) return up >= 2 && up <= 6 ? 'S' : 'H';
  if (t === 12) return up >= 4 && up <= 6 ? 'S' : 'H';
  return 'H';
}

export function countingTable(el, ctx) {
  const st = (ctx.profile.counting ||= {});
  const cfg = (st.tableCfg ||= { others: 2, ramp: '1-8', aid: 'hidden', pace: 'normal', quizEvery: 4 });
  let rules = ctx.rules, stopped = false;

  function setup() {
    const seg = (id, items, cur) => `<div class="seg" id="${id}" style="margin:6px 0 10px">${items.map(([v, t]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    const sh = shoeSettings(ctx.profile);
    el.innerHTML = `<div class="topbar"><a class="back" href="#/play/counting">‹ Counting Pro</a></div><h1>Count & Play</h1>
      <p class="dim small" style="margin-top:0">A persistent shoe with a cut card. Before each hand, bet the number of units your ramp says for the true count. Then play it with basic strategy and the index plays. Everything is graded; mistakes play out so you feel them.</p>
      <div class="card row"><div class="grow"><div class="small dim">Table rules</div><div class="small">${describeRules(rules)}</div></div><button class="btn small ghost" id="chg">Change</button></div>
      <div class="small dim">Other players at the table</div>${seg('o', [[0, 'None'], [1, '1'], [2, '2'], [3, '3'], [4, '4']], cfg.others)}
      <div class="small dim">Bet spread</div>${seg('r', Object.entries(RAMPS).map(([k, v]) => [k, v.name]), cfg.ramp)}
      <div class="small dim">Cut card</div>${seg('p', [[0.5, '50%'], [0.65, '65%'], [0.75, '75%'], [0.85, '85%']], sh.pen)}
      <div class="small dim">Dealing pace</div>${seg('s', [['none', 'Instant'], ['fast', 'Fast'], ['normal', 'Normal'], ['slow', 'Slow']], cfg.pace)}
      <div class="small dim">Count on screen</div>${seg('a', [['hidden', 'Hidden'], ['running', 'Running'], ['full', 'Running + true']], cfg.aid)}
      <div class="small dim">Count check every</div>${seg('q', [[0, 'Never'], [2, '2 hands'], [4, '4 hands'], [8, '8 hands']], cfg.quizEvery)}
      <p class="small dim">Start with the count shown, then hide it. The goal is to bet and play correctly with it hidden. On this table: ${rules.surrender === 'late' ? 'late surrender is offered, so the Fab 4 apply' : 'no surrender, so the Fab 4 are not used'}.</p>
      <button class="btn primary block" id="go">Sit down</button>`;
    el.querySelector('#chg').onclick = () => openRulesEditor(rules, { onSave: async (r, id) => { await ctx.setRules(r, id); rules = ctx.rules; setup(); } });
    const bind = (id, fn) => el.querySelectorAll(`#${id} button`).forEach((b) => b.onclick = () => { fn(b.dataset.v); ctx.save(); setup(); });
    bind('o', (v) => { cfg.others = Number(v); }); bind('r', (v) => { cfg.ramp = v; }); bind('p', (v) => { sh.pen = Number(v); });
    bind('s', (v) => { cfg.pace = v; }); bind('a', (v) => { cfg.aid = v; }); bind('q', (v) => { cfg.quizEvery = Number(v); });
    el.querySelector('#go').onclick = play;
  }

  async function play() {
    document.getElementById('app').classList.add('focus');
    const SH = new Shoe(rules.decks, { ...shoeSettings(ctx.profile), mode: 'shoe' });
    const ramp = RAMPS[cfg.ramp], delay = PACE[cfg.pace];
    const S = { hands: 0, units: 0, wag: 0, bet: { n: 0, c: 0 }, dec: { n: 0, c: 0 }, idx: { n: 0, c: 0 }, ins: { n: 0, c: 0 }, cnt: { asked: 0, right: 0 }, missed: [], t0: Date.now() };
    el.innerHTML = `<div class="topbar"><button class="btn small ghost" id="end">End session</button><div class="grow"></div><div class="right small dim" id="hd1"></div></div>
      <div id="hud" class="small"></div><div id="tbl"></div><div id="oth"></div><div id="panel"></div><div class="actionbar" id="bar"></div>`;
    const $ = (id) => el.querySelector('#' + id);
    let endNow = false, others = [], heroSeat = 0;
    $('end').onclick = () => { endNow = true; document.getElementById('bar').dispatchEvent(new Event('abort')); finish(); };

    const countText = () => (cfg.aid === 'hidden' ? '<span class="dim">count hidden</span>' : `count <b class="num">${sgn(SH.seenCount) || '0'}</b>${cfg.aid === 'full' ? ` · true <b class="num">${sgn(Math.floor(SH.trueCount)) || '0'}</b> <span class="dim">(${SH.decksLeft.toFixed(1)} decks left)</span>` : ''}`);
    const hud = () => {
      $('hd1').innerHTML = `Units <b class="num ${S.units >= 0 ? 'ok' : 'bad'}" style="font-size:18px">${S.units >= 0 ? '+' : '−'}${Math.abs(S.units).toFixed(1)}</b>`;
      const pc = (o) => (o.n ? Math.round(o.c / o.n * 100) + '%' : '—');
      $('hud').innerHTML = `<div class="row wrap" style="justify-content:space-between"><span>Hand <b class="num">${S.hands}</b> · ${RAMPS[cfg.ramp].name} · ${cfg.others} other${cfg.others === 1 ? '' : 's'}</span><span>${countText()} <button class="btn small ghost" id="aid">${cfg.aid === 'hidden' ? 'Peek' : 'Hide'}</button></span></div>
        <div class="row wrap" style="justify-content:space-between;margin:4px 0"><span class="small">Bets <b class="num">${pc(S.bet)}</b> · plays <b class="num">${pc(S.dec)}</b> · index <b class="num">${pc(S.idx)}</b> · count <b class="num">${S.cnt.asked ? Math.round(S.cnt.right / S.cnt.asked * 100) + '%' : '—'}</b></span><span class="small dim">${SH.n} cards · cut in ${SH.cardsToCut}</span></div>`;
      $('aid').onclick = () => { cfg.aid = cfg.aid === 'hidden' ? 'full' : 'hidden'; ctx.save(); hud(); };
    };
    const showTable = (r, { hide, active = -1, newFrom } = {}) => (hide ? 0 : SH.revealHole(), renderTable($('tbl'), {
      dealer: r.dealer, hideHole: hide, newFrom, variant: 'practice',
      hands: r.hands.map((h, i) => ({ cards: h.cards, active: i === active, note: h.doubled ? 'doubled' : h.surrendered ? 'surrendered' : '' })) }));
    const seats = () => {
      if (!others.length) { $('oth').innerHTML = ''; return; }
      $('oth').innerHTML = `<div class="small dim" style="text-align:center">Other players${others.length > 1 ? ` — you are seat ${heroSeat + 1} of ${others.length + 1}` : ''}</div><div class="row wrap" style="gap:8px;justify-content:center;margin:4px 0">${others.map((o, i) => `<div class="card" style="padding:4px 8px;text-align:center;min-width:70px"><div class="small dim">Seat ${(i < heroSeat ? i : i + 1) + 1}${o.bust ? ' · bust' : ''}</div><span class="minihand" style="margin:0">${o.cards.map((c) => cardSVG(c)).join('')}</span></div>`).join('')}</div>`;
    };

    const ask = (html, title, yes, no) => {
      $('panel').innerHTML = `<div class="banner"><b>${title}</b><br>${html}</div>`;
      $('bar').style.gridTemplateColumns = '1fr 1fr';
      $('bar').innerHTML = `<button class="act" data-a="no">${no}</button><button class="act" data-a="yes">${yes}</button>`;
      return new Promise((res) => $('bar').querySelectorAll('.act').forEach((b) => b.onclick = () => res(b.dataset.a === 'yes')));
    };

    async function betPhase() {
      hud();
      $('tbl').innerHTML = `<div class="table"><div class="seat"><div class="who">Place your bet</div><div class="small dim">What does the true count say? Tap the number of units.</div></div></div>`;
      $('oth').innerHTML = ''; $('panel').innerHTML = '';
      const opts = [...new Set([1, 2, 3, 4, 5, 6, 8, 10, 12].filter((u) => u <= ramp.max))];
      $('bar').style.gridTemplateColumns = `repeat(${Math.min(opts.length, 6)}, 1fr)`;
      $('bar').innerHTML = opts.map((u) => `<button class="act" data-u="${u}">${u}<small>unit${u > 1 ? 's' : ''}</small></button>`).join('');
      return new Promise((res) => $('bar').querySelectorAll('.act').forEach((b) => b.onclick = () => res(Number(b.dataset.u))));
    }

    // Draw cards for a seat and show them, honouring the dealing pace.
    async function seatHit(o) {
      const c = SH.draw(); o.cards.push(c);
      let h = 0; for (const x of o.cards) h += x.v; if (h > 21) o.bust = true;
      seats(); hud(); await sleep(delay);
    }
    async function playSeats(list, up) {
      for (const o of list) {
        while (!endNow && !o.bust && otherAct(o.cards, up) === 'H') await seatHit(o);
      }
    }

    async function round() {
      prepareShoe(SH, { settings: { shoe: { ...shoeSettings(ctx.profile), mode: 'shoe' } } });
      const units = await betPhase();
      if (endNow) return;
      const trueNow = SH.trueCount, want = rampUnits(cfg.ramp, trueNow), betOK = units === want;
      S.bet.n++; if (betOK) S.bet.c++;
      S.hands++;
      // deal: other players' first cards, you + dealer, then their second cards
      heroSeat = Math.floor(Math.random() * (cfg.others + 1));
      others = Array.from({ length: cfg.others }, () => ({ cards: [], bust: false }));
      for (const o of others) o.cards.push(SH.draw());
      const r = new Round(rules, () => SH.draw()).deal();
      SH.hideHole(r.dealer[1].v);
      for (const o of others) o.cards.push(SH.draw());
      const up = r.up.v;
      showTable(r, { hide: true, active: 0, newFrom: { dealer: 0, hands: [0] } }); seats(); hud();
      await sleep(delay);
      const before = others.slice(0, heroSeat), after = others.slice(heroSeat);
      let insNet = 0, evenMoney = false, note = '';

      // Insurance / even money: the index says take it at +3 or more
      if (up === 1) {
        const tcNow = SH.trueCount, should = insuranceTaken(Math.floor(tcNow));
        const bj = r.hands[0].bj;
        const took = await ask(bj ? 'You have blackjack and the dealer shows an Ace. Take <b>even money</b>?' : 'The dealer shows an Ace. Take <b>insurance</b>? (costs half your bet, pays 2 to 1)', bj ? 'Even money?' : 'Insurance?', 'Take it', 'Decline');
        S.ins.n++; if (took === should) S.ins.c++;
        note += `${bj ? 'Even money' : 'Insurance'}: ${took === should ? '✓' : `✗ ${should ? 'take it at +3 or more' : 'decline below +3'} (true count ${sgn(Math.floor(tcNow)) || '0'})`}. `;
        if (took) { if (bj) evenMoney = true; else insNet = r.dealerBJ ? 1 : -0.5; }
        $('panel').innerHTML = '';
      }
      await playSeats(before, up);

      // Your decisions
      while (r.phase === 'player' && !endNow) {
        const hi = r.active; if (hi < 0) break;
        const h = r.hands[hi], ranks = h.cards.map((c) => c.v);
        showTable(r, { hide: true, active: hi }); seats();
        const L = r.legal(hi);
        const decP = engine.decide(rules, ranks, up);
        const ctxL = { cards: h.cards.length, pair: h.cards.length === 2 && h.cards[0].v === h.cards[1].v ? h.cards[0].v : 0, handsCount: r.hands.length, afterSplit: h.fromSplit, afterSplitAces: h.splitAces, up };
        const reasons = { D: illegalReason(rules, ctxL, 'D'), P: illegalReason(rules, ctxL, 'P'), R: illegalReason(rules, ctxL, 'R'), H: illegalReason(rules, ctxL, 'H') };
        const dec = await decP;
        let best = null, bestEV = -Infinity;
        for (const a of ['S', 'H', 'D', 'P', 'R']) { const v = dec.ev[KEYS[a]]; if (L[a] && v !== undefined && v > bestEV) { best = a; bestEV = v; } }
        const tc = SH.trueCount, ftc = Math.floor(tc);
        const ix = indexPlay(rules, ranks, up, ftc, best, L);
        $('bar').style.gridTemplateColumns = '';
        $('panel').innerHTML = '';
        const chosen = await new Promise((res) => renderActionBar($('bar'), { legal: L, reasons, onAct: res }));
        if (endNow) return;
        const right = chosen === ix.action;
        S.dec.n++; if (right) S.dec.c++;
        if (ix.rule) { S.idx.n++; if (right) S.idx.c++; }
        if (right) {
          $('panel').innerHTML = `<div class="small ok" style="text-align:center">✓ ${ACTION_NAME[chosen]}${ix.rule && ix.deviated ? ` — index play (${ix.rule.label} at ${sgn(ftc) || '0'})` : ''}</div>`;
        } else {
          if (ix.rule) {
            const why = ix.above ? `at or above the index (${sgn(ix.index) || '0'})` : `below the index (${sgn(ix.index) || '0'})`;
            $('panel').innerHTML = `<div class="verdict bad"><div class="head bad">${ACTION_NAME[ix.action]} — not ${ACTION_NAME[chosen]}</div><div class="reason">${ix.rule.label}: the true count is <b>${sgn(ftc) || '0'}</b>, ${why}. Basic strategy says ${ACTION_NAME[best]}${ix.deviated ? `, but the count changes it to ${ACTION_NAME[ix.action]}` : ''}.</div></div>`;
            S.missed.push(`${handLabel(ranks)} v ${upLabel(up)} at ${sgn(ftc) || '0'}`);
          } else {
            const fb = await explain(rules, ranks, up, { ...dec, action: best, legal: Object.fromEntries(Object.entries(KEYS).map(([a, k]) => [k, !!L[a]])) }, chosen);
            renderVerdict($('panel'), fb, { upcard: up, compact: true });
            S.missed.push(`${handLabel(ranks)} v ${upLabel(up)} (basic)`);
          }
        }
        const nBefore = r.hands.length;
        r.act(hi, chosen);
        hud();
        showTable(r, { hide: true, active: r.active, newFrom: { dealer: 1, hands: r.hands.map((x, i) => (chosen === 'P' ? (i >= hi && i < hi + 2 ? 1 : x.cards.length) : (i === hi ? x.cards.length - 1 : x.cards.length))) } });
        await sleep(right ? Math.max(200, delay) : 900);
        if (r.hands.length !== nBefore) { /* split shown by the table */ }
      }
      if (endNow) return;
      await playSeats(after, up);
      showTable(r, { hide: false, newFrom: { dealer: 1, hands: r.hands.map((x) => x.cards.length) } });
      if (r.phase === 'dealer') {
        const upCount = r.dealer.length;
        r.playDealer();
        for (let k = upCount; k <= r.dealer.length; k++) {
          renderTable($('tbl'), { dealer: r.dealer.slice(0, Math.max(2, k)), hideHole: false, variant: 'practice', hands: r.hands.map((h) => ({ cards: h.cards })), newFrom: { dealer: k - 1, hands: r.hands.map((h) => h.cards.length) } });
          if (k < r.dealer.length) await sleep(Math.max(150, delay));
        }
      }
      const res = r.settle();
      let net = res.net * units + insNet * units;
      if (evenMoney) net = units;
      S.units += net; S.wag += units;
      showTable(r, { hide: false, newFrom: { dealer: 99, hands: r.hands.map((x) => x.cards.length) } });
      hud();
      const betMsg = betOK ? `Bet ✓ ${units} unit${units > 1 ? 's' : ''}` : `Bet ✗ you bet ${units}, the ramp says <b>${want}</b> at a true count of ${sgn(Math.floor(trueNow)) || '0'}`;
      $('panel').innerHTML = `<div class="verdict ${net > 0 ? 'ok' : net < 0 ? 'bad' : ''}"><div class="head ${net > 0 ? 'ok' : net < 0 ? 'bad' : ''}">${net > 0 ? 'Win ' : net < 0 ? 'Loss ' : 'Push '}${net === 0 ? '' : Math.abs(net).toFixed(1) + ' units'}</div><div class="small ${betOK ? 'ok' : 'bad'}">${betMsg}</div>${note ? `<div class="small">${note}</div>` : ''}</div>`;
      seats();
      // count check
      if (cfg.quizEvery && S.hands % cfg.quizEvery === 0) {
        await new Promise((res) => { $('bar').style.gridTemplateColumns = '1fr'; $('bar').innerHTML = '<button class="btn primary" id="cc">Count check</button>'; $('bar').querySelector('#cc').onclick = res; });
        await askCount(SH, S.cnt);
        hud();
      }
      await new Promise((res) => { $('bar').style.gridTemplateColumns = '1fr'; $('bar').innerHTML = '<button class="btn primary" id="nx">Next hand</button>'; $('bar').querySelector('#nx').onclick = res; });
    }

    function finish() {
      stopped = true;
      document.getElementById('app').classList.remove('focus');
      const pc = (o) => (o.n ? `${Math.round(o.c / o.n * 100)}% <span class="dim">(${o.c}/${o.n})</span>` : '—');
      const t = (st.table ||= { hands: 0 }); t.hands += S.hands; ctx.save();
      const mins = Math.max(1, Math.round((Date.now() - S.t0) / 60000));
      el.innerHTML = `<h1>Session over</h1>
        <div class="card"><table class="evtable"><tr><td>Hands</td><td class="num">${S.hands} (${mins} min)</td></tr><tr><td>Result</td><td class="num ${S.units >= 0 ? 'ok' : 'bad'}">${S.units >= 0 ? '+' : '−'}${Math.abs(S.units).toFixed(1)} units on ${S.wag.toFixed(0)} wagered</td></tr>
          <tr><td>Bet sizing</td><td class="num">${pc(S.bet)}</td></tr><tr><td>Plays (basic + index)</td><td class="num">${pc(S.dec)}</td></tr><tr><td>Index decisions only</td><td class="num">${pc(S.idx)}</td></tr><tr><td>Insurance / even money</td><td class="num">${pc(S.ins)}</td></tr><tr><td>Count checks</td><td class="num">${pc({ n: S.cnt.asked, c: S.cnt.right })}</td></tr></table></div>
        ${S.missed.length ? `<div class="card"><b>Mistakes to review</b><div class="small dim" style="margin-top:6px">${[...new Set(S.missed)].slice(0, 12).join('<br>')}</div></div>` : ''}
        <div class="card small dim">A short session is mostly luck: the units result tells you nothing. The accuracy numbers are what you are training. The target is above 95% on bets, plays and count checks with the count hidden.</div>
        <button class="btn primary block" id="again">Another session</button><div class="gap"></div><a class="btn ghost block" style="display:block;text-align:center;text-decoration:none" href="#/play/counting">Back to Counting Pro</a>`;
      el.querySelector('#again').onclick = () => { stopped = false; setup(); };
    }

    try { while (!endNow && !stopped) await round(); } catch (e) { if (!endNow) { console.error(e); toast('Something went wrong: ' + (e.message || e), 4000); } }
  }

  setup();
  return () => { stopped = true; document.getElementById('app').classList.remove('focus'); };
}
