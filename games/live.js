// Live Table: real rounds against the engine, with bankroll, EV tracker, cost-of-mistakes readout,
// an enforced session loss limit, and optional coach mode. Fresh shuffle every round (online-RNG style).

import { Round } from '../engine/round.js';
import { freshShoe, makeCard } from '../ui/cards.js';
import { renderTable, renderActionBar, illegalReason, renderVerdict, toast } from '../ui/hand.js';
import { engine } from '../app/engine-client.js';
import { explain, ACTION_NAME, evKey, usd100, signed } from '../app/feedback.js';
import { describeRules } from '../app/presets.js';
import { houseEdge } from '../app/edges.js';
import { insuranceEdge } from '../engine/sidebets.js';
import { store } from '../app/store.js';
import { handsToday } from '../app/ctx.js';
import { openRulesEditor } from '../ui/rules-editor.js';
import { openSheet } from '../ui/sheet.js';

const $money = (x) => `${x < 0 ? '−' : ''}$${Math.abs(x).toFixed(2)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEYS = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' };

export function liveTable(el, ctx) {
  const s = ctx.profile.settings;
  let rules = ctx.rules;

  function setup() {
    el.innerHTML = `<div class="topbar"><a class="back" href="#/play">‹ Play</a></div><h1>Live Table</h1>
      <p class="dim" style="margin-top:0">Real play against the engine. Every decision is graded; the cost of your mistakes is shown in dollars.</p>
      <div class="card row"><div class="grow"><div class="small dim">Table rules</div><div class="small">${describeRules(rules)}</div></div><button class="btn small ghost" id="chg">Change</button></div>
      <div class="card"><h3>Before you sit down</h3>
        <label class="field">Session bankroll ($)<input id="bk" type="number" inputmode="decimal" value="${s.bankroll}"></label>
        <label class="field">Unit bet ($)<input id="ub" type="number" inputmode="decimal" value="${s.unit}"></label>
        <label class="field"><b>Session loss limit ($)</b> — the stop-rule you commit to now<input id="ll" type="number" inputmode="decimal" value="${s.lossLimit}"></label>
        <div class="toggle"><span>Coach mode (blocks wrong moves and explains)</span><input type="checkbox" id="coach" ${s.coach ? 'checked' : ''}></div>
        <p class="small dim">This is practice with a simulated bankroll. The table below computes what this game costs; nothing here is a way to win money.</p></div>
      <button class="btn primary block" id="go">Sit down</button>`;
    el.querySelector('#chg').onclick = () => openRulesEditor(rules, { onSave: async (r, id) => { await ctx.setRules(r, id); rules = ctx.rules; setup(); } });
    el.querySelector('#go').onclick = () => {
      const bk = Number(el.querySelector('#bk').value), ub = Number(el.querySelector('#ub').value), ll = Number(el.querySelector('#ll').value);
      if (!(bk > 0 && ub > 0 && ll > 0)) return toast('Set a bankroll, a unit bet and a loss limit first.');
      if (ub * 2 > bk) return toast('Unit bet is too large for that bankroll.');
      s.bankroll = bk; s.unit = ub; s.lossLimit = ll; s.coach = el.querySelector('#coach').checked; ctx.save();
      play({ bankroll: bk, unit: ub, limit: ll, coach: s.coach });
    };
  }

  let stopped = false;
  async function play(cfg) {
    const app = document.getElementById('app');
    app.classList.add('focus');
    const edge = await houseEdge(rules);
    const before = await handsToday();
    const S = { bank: cfg.bankroll, start: cfg.bankroll, bet: cfg.unit, hands: 0, decisions: 0, right: 0, leaked: 0, wagered: 0, pnl: 0, expected: 0, insCost: 0, overridden: false, t0: Date.now() };

    el.innerHTML = `<div class="topbar"><button class="btn small ghost" id="end">End session</button><div class="grow"></div><div class="right small dim" id="hd1"></div></div>
      <div id="hud" class="small"></div><div id="tbl"></div><div id="panel"></div><div class="actionbar" id="bar"></div>`;
    const $ = (id) => el.querySelector('#' + id);
    const shoeFor = () => freshShoe(rules.decks);

    const hud = () => {
      const exp = edge === null ? null : S.wagered * edge / 100;
      $('hd1').innerHTML = `Bankroll <b class="num" style="color:var(--text);font-size:18px">${$money(S.bank)}</b>`;
      $('hud').innerHTML = `<div class="row wrap" style="justify-content:space-between"><span>Hands <b class="num">${S.hands}</b> <span class="dim">(${before + S.hands} today)</span></span><span>Session <b class="num ${S.pnl >= 0 ? 'ok' : 'bad'}">${$money(S.pnl)}</b></span></div>
        <div class="card" style="padding:8px 12px;margin:6px 0"><div class="row wrap" style="justify-content:space-between">
          <span class="small">Cost of your mistakes: <b class="num ${S.leaked + S.insCost > 0.004 ? 'bad' : 'ok'}">$${(S.leaked + S.insCost).toFixed(2)}</b></span>
          <span class="small dim">Accuracy <b class="num">${S.decisions ? Math.round(S.right / S.decisions * 100) : 100}%</b></span></div>
          <div class="small dim" style="margin-top:2px">This table's price: ~${$money(-(exp || 0))} expected on $${S.wagered.toFixed(0)} wagered (${edge === null ? '—' : edge.toFixed(2)}% edge). Expected result of the hands dealt: <span class="num">${$money(S.expected)}</span>.</div></div>`;
    };

    async function betPhase() {
      hud();
      $('tbl').innerHTML = `<div class="table"><div class="seat"><div class="who">Place your bet</div><div class="big num" id="bv">${$money(S.bet)}</div><div class="small dim" id="bp"></div></div></div>`;
      $('panel').innerHTML = '';
      const upd = () => {
        $('bv').textContent = $money(S.bet);
        const pctBank = S.bet / Math.max(S.bank, 0.01) * 100;
        $('bp').textContent = `${pctBank.toFixed(1)}% of bankroll${pctBank > 5 ? ' — big' : pctBank <= 2 ? ' — sensible' : ''}`;
        $('bp').className = 'small ' + (pctBank > 5 ? 'due' : 'dim');
      };
      upd();
      return new Promise((resolve) => {
        $('bar').style.gridTemplateColumns = '1fr 2fr 1fr';
        $('bar').innerHTML = `<button class="btn" id="m">−</button><button class="btn primary" id="d">Deal</button><button class="btn" id="p">+</button>`;
        $('bar').querySelector('#m').onclick = () => { S.bet = Math.max(cfg.unit, S.bet - cfg.unit); upd(); };
        $('bar').querySelector('#p').onclick = () => { if (S.bet + cfg.unit <= S.bank / 1) { S.bet += cfg.unit; upd(); } };
        $('bar').querySelector('#d').onclick = () => { if (S.bet * 2 > S.bank && S.bank < S.bet) return toast('Not enough bankroll for that bet.'); resolve(); };
      });
    }

    const showTable = (r, { hide, active = -1, newFrom } = {}) => renderTable($('tbl'), {
      dealer: r.dealer, hideHole: hide, newFrom,
      hands: r.hands.map((h, i) => ({ cards: h.cards, active: i === active, note: h.doubled ? 'doubled' : h.surrendered ? 'surrendered' : '' })),
    });

    async function askOffer(html, title) {
      $('panel').innerHTML = `<div class="banner"><b>${title}</b><br>${html}</div>`;
      $('bar').style.gridTemplateColumns = '1fr 1fr';
      $('bar').innerHTML = `<button class="act" data-a="decline" style="border-color:var(--ok)">Decline</button><button class="act" data-a="accept">Accept</button>`;
      return new Promise((res) => $('bar').querySelectorAll('.act').forEach((b) => b.onclick = () => res(b.dataset.a === 'accept')));
    }

    async function round() {
      await betPhase();
      if (stopped) return;
      const bet = S.bet;
      const shoe = shoeFor();
      const r = new Round(rules, () => shoe.draw()).deal();
      S.hands++; S.wagered += bet;
      const up = r.up.v;
      const ranks0 = r.hands[0].cards.map((c) => c.v);
      const dec0P = engine.decide(rules, ranks0, up);      // for the EV tracker; resolves while the player thinks
      showTable(r, { hide: true, active: 0, newFrom: { dealer: 0, hands: [0] } });
      hud();
      let insuranceNet = 0, evenMoney = false;

      // Offers (never correct for you). Offered before the dealer's hole card is resolved.
      if (up === 1) {
        if (r.hands[0].bj) {
          const acc = await askOffer(`You have blackjack; the dealer shows an Ace. Take <b>even money</b> (${$money(bet)})?`, 'Even money?');
          if (acc) {
            const p = 95 / 309, play = (1 - p) * 1.5;
            S.insCost += Math.max(0, (play - 1) * bet); evenMoney = true;
            toast(`Even money taken — that gave up ~${$money((play - 1) * bet)} of expected value.`, 3800);
          }
        } else {
          const stake = bet / 2;
          const acc = await askOffer(`The dealer shows an Ace. Insurance costs ${$money(stake)} and pays 2:1.`, 'Insurance?');
          if (acc) {
            S.insCost += insuranceEdge(rules.decks) * stake;
            insuranceNet = r.dealerBJ ? stake * 2 : -stake;
            toast(`Insurance taken — expected cost ${$money(insuranceEdge(rules.decks) * stake)}. It is a losing bet.`, 3800);
          }
        }
        $('panel').innerHTML = '';
      }

      // Player decisions
      const firstDec = await dec0P;
      let ev0 = firstDec.blackjack ? (rules.peek ? (1 - firstDec.pBJ) * rules.blackjackPays : firstDec.ev.stand)
        : (() => { let b = -Infinity; for (const k of Object.keys(firstDec.ev)) if (firstDec.legal[k] && firstDec.ev[k] > b) b = firstDec.ev[k]; return rules.peek ? (1 - firstDec.pBJ) * b - firstDec.pBJ : b; })();
      S.expected += ev0 * bet;

      while (r.phase === 'player' && !stopped) {
        const hi = r.active;
        if (hi < 0) break;
        const h = r.hands[hi];
        const ranks = h.cards.map((c) => c.v);
        showTable(r, { hide: true, active: hi });
        const L = r.legal(hi);
        const decP = engine.decide(rules, ranks, up);
        const ctxL = { cards: h.cards.length, pair: h.cards.length === 2 && h.cards[0].v === h.cards[1].v ? h.cards[0].v : 0, handsCount: r.hands.length, afterSplit: h.fromSplit, afterSplitAces: h.splitAces };
        const reasons = { D: illegalReason(rules, ctxL, 'D'), P: illegalReason(rules, ctxL, 'P'), R: illegalReason(rules, ctxL, 'R'), H: illegalReason(rules, ctxL, 'H') };
        const dec = await decP;
        // best legal action per the engine, restricted to what this table allows right now
        let best = null, bestEV = -Infinity;
        for (const a of ['S', 'H', 'D', 'P', 'R']) { const v = dec.ev[KEYS[a]]; if (L[a] && v !== undefined && v > bestEV) { best = a; bestEV = v; } }
        $('bar').style.gridTemplateColumns = '';
        let chosen = null;
        for (;;) {
          chosen = await new Promise((res) => renderActionBar($('bar'), { legal: L, reasons, onAct: res }));
          if (chosen === best || !cfg.coach) break;
          const fb = await explain(rules, ranks, up, { ...dec, action: best, legal: Object.fromEntries(Object.entries(KEYS).map(([a, k]) => [k, !!L[a]])) }, chosen);
          renderVerdict($('panel'), fb, { upcard: up, compact: true });
          toast('Coach: that is not the best play — try again.', 2200);
        }
        S.decisions++;
        const loss = chosen === best ? 0 : Math.max(0, bestEV - (dec.ev[KEYS[chosen]] ?? bestEV)) * bet;
        if (chosen === best) { S.right++; $('panel').innerHTML = `<div class="small ok" style="text-align:center">✓ ${ACTION_NAME[chosen]}</div>`; }
        else {
          S.leaked += loss;
          const fb = await explain(rules, ranks, up, { ...dec, action: best, legal: Object.fromEntries(Object.entries(KEYS).map(([a, k]) => [k, !!L[a]])) }, chosen);
          renderVerdict($('panel'), fb, { upcard: up, compact: true });
        }
        const nBefore = r.hands.length;
        r.act(hi, chosen);
        hud();
        showTable(r, { hide: true, active: r.active, newFrom: { dealer: 1, hands: r.hands.map((x, i) => (chosen === 'P' ? (i >= hi && i < hi + 2 ? 1 : x.cards.length) : (i === hi ? x.cards.length - 1 : x.cards.length))) } });
        await sleep(chosen === best ? 250 : 450);
        if (r.hands.length !== nBefore) { /* split: table already shows both hands */ }
      }
      if (stopped) return;
      if (r.phase !== 'over') { showTable(r, { hide: false, newFrom: { dealer: 1, hands: r.hands.map((x) => x.cards.length) } }); }
      if (r.phase === 'dealer') {
        const upCount = r.dealer.length;
        r.playDealer();
        for (let k = upCount; k <= r.dealer.length; k++) {
          renderTable($('tbl'), { dealer: r.dealer.slice(0, Math.max(2, k)), hideHole: false, hands: r.hands.map((h) => ({ cards: h.cards })), newFrom: { dealer: k - 1, hands: r.hands.map((h) => h.cards.length) } });
          if (k < r.dealer.length) await sleep(520);
        }
      }
      // settle
      const res = r.settle();
      let net = res.net * bet;
      if (evenMoney) net = bet;                               // even money: flat 1:1, round over
      net += insuranceNet;
      showTable(r, { hide: false, newFrom: { dealer: 99, hands: r.hands.map((x) => x.cards.length) } });
      S.bank += net; S.pnl += net;
      hud();
      const lines = res.hands.map((x, i) => `<div class="row" style="justify-content:space-between"><span>${res.hands.length > 1 ? `Hand ${i + 1}: ` : ''}${{ win: 'Win', lose: 'Lose', push: 'Push', blackjack: 'Blackjack', surrender: 'Surrendered' }[x.res]}${x.total > 0 && x.res !== 'blackjack' ? ` (${x.total} vs ${res.dealerBJ ? 'blackjack' : res.dealerTotal})` : ''}</span><b class="num ${x.net > 0 ? 'ok' : x.net < 0 ? 'bad' : ''}">${$money(x.net * bet)}</b></div>`).join('');
      $('panel').innerHTML = `<div class="verdict ${net > 0 ? 'ok' : net < 0 ? 'bad' : ''}"><div class="head ${net > 0 ? 'ok' : net < 0 ? 'bad' : ''}">${net > 0 ? 'You win ' : net < 0 ? 'You lose ' : 'Push '}${net === 0 ? '' : $money(Math.abs(net))}</div>${lines}${insuranceNet ? `<div class="small dim">Insurance ${$money(insuranceNet)}</div>` : ''}${evenMoney ? '<div class="small dim">Even money paid 1:1 — blackjack would have paid more on average.</div>' : ''}</div>`;

      // stop-rule
      if (S.start - S.bank >= cfg.limit && !S.overridden) {
        const stop = await stopRule(S, cfg);
        if (stop) return endSession(S, cfg, 'limit');
        S.overridden = true;
      }
      if (S.bank < cfg.unit) return endSession(S, cfg, 'broke');
      $('bar').style.gridTemplateColumns = '1fr';
      $('bar').innerHTML = `<button class="btn primary block" id="nx">Next hand</button>`;
      await new Promise((res) => { $('bar').querySelector('#nx').onclick = res; });
      $('panel').innerHTML = '';
      return round();
    }

    function stopRule(S2, c) {
      return new Promise((resolve) => {
        const sh = openSheet(`<h3>Stop-rule reached</h3><p>You set a session loss limit of <b>${$money(c.limit)}</b> before you started, and you're down <b class="bad">${$money(S2.start - S2.bank)}</b>.</p><p class="dim">The limit exists because your judgment is worst exactly when you're behind. Ending the session is the professional move.</p>
          <button class="btn primary block" id="stop">End the session</button><div class="gap"></div><button class="btn danger block small" id="go">Override my own limit</button>`, { onClose: () => resolve(true) });
        sh.el.querySelector('#stop').onclick = () => { sh.el.closest('.scrim').remove(); resolve(true); };
        sh.el.querySelector('#go').onclick = () => { sh.el.closest('.scrim').remove(); toast('Limit overridden — this is logged in your session.', 3000); resolve(false); };
      });
    }

    async function endSession(S2, c, why) {
      stopped = true; app.classList.remove('focus');
      const acc = S2.decisions ? S2.right / S2.decisions : 1;
      if (S2.hands) await store.addSession({ date: Date.now(), mode: 'live', handsPlayed: S2.hands, accuracy: acc, evLost: S2.wagered ? (S2.leaked + S2.insCost) / S2.wagered : 0, bankrollDelta: S2.pnl, overrode: S2.overridden });
      const price = edge === null ? 0 : S2.wagered * edge / 100;
      el.innerHTML = `<h1>Session over</h1>${why === 'limit' ? '<div class="banner">You stopped at your own limit. That is the discipline working.</div>' : ''}${why === 'broke' ? '<div class="banner">Bankroll below one unit — session ends.</div>' : ''}
        <div class="stat3"><div class="card"><div class="v ${S2.pnl >= 0 ? 'ok' : 'bad'}">${$money(S2.pnl)}</div><div class="k">Result</div></div><div class="card"><div class="v">${S2.hands}</div><div class="k">Hands</div></div><div class="card"><div class="v ${acc >= 0.95 ? 'ok' : ''}">${Math.round(acc * 100)}%</div><div class="k">Accuracy</div></div></div>
        <div class="card"><b>The math of this session</b><table class="evtable">
          <tr><td>Wagered</td><td class="num">$${S2.wagered.toFixed(2)}</td></tr>
          <tr><td>Table price (${edge === null ? '—' : edge.toFixed(2)}% edge)</td><td class="num">${$money(-price)}</td></tr>
          <tr><td>Expected result of the hands dealt</td><td class="num">${$money(S2.expected)}</td></tr>
          <tr><td>Cost of your mistakes</td><td class="num bad">${$money(-(S2.leaked + S2.insCost))}</td></tr>
          <tr><td>Actual result</td><td class="num">${$money(S2.pnl)}</td></tr></table>
          <p class="small dim">The gap between expected and actual is variance — luck. Perfect play does not remove it and does not turn the table price positive.</p></div>
        <button class="btn primary block" id="again">New session</button><div class="gap"></div><a class="btn block ghost" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="#/play">Done</a>`;
      el.querySelector('#again').onclick = () => { stopped = false; setup(); };
    }

    $('end').onclick = () => { stopped = true; endSession(S, cfg, 'manual'); };
    round().catch((e) => { if (!stopped) { console.error(e); el.innerHTML = `<h1>Something broke</h1><p class="dim">${ctx.esc(e.message || e)}</p><a class="btn block" href="#/play">Back</a>`; } });
  }

  setup();
  return () => { stopped = true; document.getElementById('app').classList.remove('focus'); };
}
