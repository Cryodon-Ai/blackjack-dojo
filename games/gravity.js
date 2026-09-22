// Gravity Blackjack: the actual ICONIC21 game — 8 decks, S17, DAS, one split, no surrender, peek on
// Ace only, 3:2, 10-card Charlie — with all four of its side bets (Perfect Pairs, 21+3, Lucky
// Ladies, Dealer Bust), a real multiplier-drop mechanic that changes a side-bet payout, and the same
// bankroll/stop-rule/Practice + Rewind machinery as Live Table (games/live.js). New, self-contained
// file rather than a refactor of live.js, so nothing here can regress Live Table.

import { Round } from '../engine/round.js';
import { peeksOnUp, upLabel } from '../engine/rules.js';
import { freshShoe, shoeFromCounts, handLabel } from '../ui/cards.js';
import { renderTable, renderActionBar, illegalReason, renderVerdict, toast } from '../ui/hand.js';
import { engine } from '../app/engine-client.js';
import { explain, ACTION_NAME, signed } from '../app/feedback.js';
import { describeRules, presetById } from '../app/presets.js';
import { houseEdge } from '../app/edges.js';
import {
  insuranceEdge, cardCode, classifyPerfectPairs, classify21plus3, classifyLuckyLadies, dealerBustTier,
  GRAVITY_PP_TABLE, GRAVITY_213_TABLE, LL_TABLE, DB_TABLE,
} from '../engine/sidebets.js';
import { store } from '../app/store.js';
import { handsToday } from '../app/ctx.js';
import { openSheet } from '../ui/sheet.js';

const $money = (x) => `${x < 0 ? '−' : ''}$${Math.abs(x).toFixed(2)}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEYS = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' };

const RULES = presetById('gravity').rules;
const SIDE_LABEL = { pp: 'Perfect Pairs', t213: '21+3', ll: 'Lucky Ladies', bust: 'Dealer Bust' };
const SIDE_PAY = { pp: GRAVITY_PP_TABLE, t213: GRAVITY_213_TABLE, ll: LL_TABLE, bust: DB_TABLE };
const TIER_LABEL = {
  perfect: 'perfect pair', colored: 'colored pair', mixed: 'mixed pair',
  suitedTrips: 'suited trips', straightFlush: 'straight flush', trips: 'three of a kind', straight: 'straight', flush: 'flush',
  qhPair: 'Q♥Q♥', matched20: 'matched 20', suited20: 'suited 20', any20: 'any 20', anyQueen: 'any Queen',
  '3-4': 'bust in 3–4', '5': 'bust in 5', '6': 'bust in 6', '7': 'bust in 7', '8+': 'bust in 8+',
};

// ---- the multiplier feature: ~23% of rounds drop 2x-10x onto one of the four side bets. These
// frequency/weight figures are the same derived estimates already cited in the Tier 7 lesson
// (curriculum/tiers.js) — the operator does not publish them, so this is not claimed as exact.
const MULT_CHANCE = 0.23;
const MULT_TARGETS = { pp: 0.266, t213: 0.213, ll: 0.253, bust: 0.268 };
const MULT_VALUES = { 2: 0.35, 4: 0.25, 6: 0.20, 8: 0.12, 10: 0.08 };
function weightedPick(weights) {
  const r = Math.random();
  let acc = 0;
  for (const k of Object.keys(weights)) { acc += weights[k]; if (r < acc) return k; }
  return Object.keys(weights)[Object.keys(weights).length - 1];
}
function rollMultiplier() {
  if (Math.random() >= MULT_CHANCE) return null;
  return { target: weightedPick(MULT_TARGETS), value: Number(weightedPick(MULT_VALUES)) };
}

function sideResult(id, tier, stake, mult) {
  const m = (mult && mult.target === id) ? mult.value : 1;
  const net = tier ? stake * SIDE_PAY[id][tier] * m : -stake;
  return { id, tier, stake, mult: m, net };
}

export function gravityTable(el, ctx) {
  const s = ctx.profile.settings;
  const rules = RULES;

  function setup() {
    el.innerHTML = `<div class="topbar"><a class="back" href="#/play">‹ Play</a></div><h1>Gravity Blackjack</h1>
      <p class="dim" style="margin-top:0">The real ICONIC21 game: all four side bets, real multiplier drops, and a bankroll on the line. Every main-hand decision is graded.</p>
      <div class="card"><div class="small dim">Table rules</div><div class="small">${describeRules(rules)}</div></div>
      <div class="card"><h3>Before you sit down</h3>
        <label class="field">Session bankroll ($)<input id="bk" type="number" inputmode="decimal" value="${s.bankroll}"></label>
        <label class="field">Unit bet ($)<input id="ub" type="number" inputmode="decimal" value="${s.unit}"></label>
        <label class="field"><b>Session loss limit ($)</b> — the stop-rule you commit to now<input id="ll" type="number" inputmode="decimal" value="${s.lossLimit}"></label>
        <label class="field">Feedback mode<select id="mode">
          <option value="off" ${s.mode === 'off' ? 'selected' : ''}>Off — no feedback</option>
          <option value="coach" ${s.mode === 'coach' ? 'selected' : ''}>Coach — blocks wrong moves and explains</option>
          <option value="rewind" ${s.mode === 'rewind' ? 'selected' : ''}>Practice + Rewind — play the hand freely, mistakes and all, then replay any wrong decision to see how it could have gone</option>
        </select></label>
        <p class="small dim">This is practice with a simulated bankroll. Side bets are toggled at the betting screen, each round. Rewind only ever applies to the main-hand strategy decision — there is no "correct play" for a side bet, just whether to take it (the honest answer is taught in Tier 7: never).</p></div>
      <button class="btn primary block" id="go">Sit down</button>`;
    el.querySelector('#go').onclick = () => {
      const bk = Number(el.querySelector('#bk').value), ub = Number(el.querySelector('#ub').value), ll = Number(el.querySelector('#ll').value);
      if (!(bk > 0 && ub > 0 && ll > 0)) return toast('Set a bankroll, a unit bet and a loss limit first.');
      if (ub * 2 > bk) return toast('Unit bet is too large for that bankroll.');
      s.bankroll = bk; s.unit = ub; s.lossLimit = ll; s.mode = el.querySelector('#mode').value; s.coach = s.mode === 'coach'; ctx.save();
      play({ bankroll: bk, unit: ub, limit: ll, mode: s.mode });
    };
  }

  let stopped = false;
  async function play(cfg) {
    const app = document.getElementById('app');
    app.classList.add('focus');
    const edge = await houseEdge(rules);
    const before = await handsToday();
    const S = {
      bank: cfg.bankroll, start: cfg.bankroll, bet: cfg.unit, hands: 0, decisions: 0, right: 0, leaked: 0, wagered: 0, pnl: 0, expected: 0, insCost: 0,
      side: { pp: false, t213: false, ll: false, bust: false }, sideWagered: 0, sideNet: 0, overridden: false, t0: Date.now(),
    };

    el.innerHTML = `<div class="topbar"><button class="btn small ghost" id="end">End session</button><div class="grow"></div><div class="right small dim" id="hd1"></div></div>
      <div id="hud" class="small"></div><div id="tbl"></div><div id="panel"></div><div class="actionbar" id="bar"></div>`;
    const $ = (id) => el.querySelector('#' + id);

    const hud = () => {
      const exp = edge === null ? null : S.wagered * edge / 100;
      $('hd1').innerHTML = `Bankroll <b class="num" style="color:var(--text);font-size:18px">${$money(S.bank)}</b>`;
      $('hud').innerHTML = `<div class="row wrap" style="justify-content:space-between"><span>Hands <b class="num">${S.hands}</b> <span class="dim">(${before + S.hands} today)</span></span><span>Session <b class="num ${S.pnl >= 0 ? 'ok' : 'bad'}">${$money(S.pnl)}</b></span></div>
        <div class="card" style="padding:8px 12px;margin:6px 0"><div class="row wrap" style="justify-content:space-between">
          <span class="small">Cost of your mistakes: <b class="num ${S.leaked + S.insCost > 0.004 ? 'bad' : 'ok'}">$${(S.leaked + S.insCost).toFixed(2)}</b></span>
          <span class="small dim">Accuracy <b class="num">${S.decisions ? Math.round(S.right / S.decisions * 100) : 100}%</b></span></div>
          <div class="small dim" style="margin-top:2px">Main game price: ~${$money(-(exp || 0))} expected on $${S.wagered.toFixed(0)} wagered (${edge === null ? '—' : edge.toFixed(2)}% edge). Expected result: <span class="num">${$money(S.expected)}</span>.</div>
          ${S.sideWagered ? `<div class="small dim" style="margin-top:2px">Side bets: $${S.sideWagered.toFixed(0)} wagered, net <span class="num ${S.sideNet >= 0 ? 'ok' : 'bad'}">${$money(S.sideNet)}</span>.</div>` : ''}</div>`;
    };

    async function betPhase() {
      hud();
      const sideAmt = (id) => (S.side[id] ? Math.round(S.bet * 0.2 * 100) / 100 : 0);
      const draw = () => {
        $('tbl').innerHTML = `<div class="table"><div class="seat"><div class="who">Place your bet</div><div class="big num" id="bv">${$money(S.bet)}</div><div class="small dim" id="bp"></div>
          <div class="row wrap" id="sidebets" style="margin-top:12px;justify-content:center;gap:6px">
            ${Object.keys(SIDE_LABEL).map((id) => `<button class="btn small ${S.side[id] ? 'primary' : 'ghost'}" data-sb="${id}">${SIDE_LABEL[id]}${S.side[id] ? ` $${sideAmt(id).toFixed(2)}` : ''}</button>`).join('')}
          </div></div></div>`;
        $('tbl').querySelectorAll('[data-sb]').forEach((b) => b.onclick = () => { S.side[b.dataset.sb] = !S.side[b.dataset.sb]; draw(); });
        upd();
      };
      $('panel').innerHTML = '';
      const upd = () => {
        $('bv').textContent = $money(S.bet);
        const pctBank = S.bet / Math.max(S.bank, 0.01) * 100;
        $('bp').textContent = `${pctBank.toFixed(1)}% of bankroll${pctBank > 5 ? ' — big' : pctBank <= 2 ? ' — sensible' : ''}`;
        $('bp').className = 'small ' + (pctBank > 5 ? 'due' : 'dim');
        $('tbl').querySelectorAll('[data-sb]').forEach((b) => { if (S.side[b.dataset.sb]) b.textContent = `${SIDE_LABEL[b.dataset.sb]} $${sideAmt(b.dataset.sb).toFixed(2)}`; });
      };
      draw();
      return new Promise((resolve) => {
        $('bar').style.gridTemplateColumns = '1fr 2fr 1fr';
        $('bar').innerHTML = `<button class="btn" id="m">−</button><button class="btn primary" id="d">Deal</button><button class="btn" id="p">+</button>`;
        $('bar').querySelector('#m').onclick = () => { S.bet = Math.max(cfg.unit, S.bet - cfg.unit); upd(); };
        $('bar').querySelector('#p').onclick = () => { if (S.bet + cfg.unit <= S.bank / 1) { S.bet += cfg.unit; upd(); } };
        $('bar').querySelector('#d').onclick = () => {
          const total = S.bet + Object.keys(SIDE_LABEL).reduce((a, id) => a + sideAmt(id), 0);
          if (total > S.bank) return toast('Not enough bankroll for that bet.');
          resolve({ pp: sideAmt('pp'), t213: sideAmt('t213'), ll: sideAmt('ll'), bust: sideAmt('bust') });
        };
      });
    }

    const showTable = (r, { hide, active = -1, newFrom } = {}) => renderTable($('tbl'), {
      dealer: r.dealer, hideHole: hide, newFrom,
      hands: r.hands.map((h, i) => ({ cards: h.cards, active: i === active, note: h.doubled ? 'doubled' : h.surrendered ? 'surrendered' : h.charlie ? 'Charlie' : '' })),
    });

    async function askOffer(html, title) {
      $('panel').innerHTML = `<div class="banner"><b>${title}</b><br>${html}</div>`;
      $('bar').style.gridTemplateColumns = '1fr 1fr';
      $('bar').innerHTML = `<button class="act" data-a="decline" style="border-color:var(--ok)">Decline</button><button class="act" data-a="accept">Accept</button>`;
      return new Promise((res) => $('bar').querySelectorAll('.act').forEach((b) => b.onclick = () => res(b.dataset.a === 'accept')));
    }

    async function round() {
      const sideAmt = await betPhase();
      if (stopped) return;
      const bet = S.bet;
      const shoe = freshShoe(rules.decks);
      const r = new Round(rules, () => shoe.draw()).deal();
      const checkpoints = [];
      S.hands++; S.wagered += bet;
      const up = r.up.v;

      // Multiplier drop: after bets lock, before the hand is used for anything.
      const mult = rollMultiplier();
      if (mult) {
        const has = sideAmt[mult.target] > 0;
        $('panel').innerHTML = `<div class="banner"><b>×${mult.value} multiplier dropped</b> on ${SIDE_LABEL[mult.target]}${has ? '' : ' — no bet there this round'}</div>`;
        showTable(r, { hide: true, active: -1, newFrom: { dealer: 0, hands: [0] } });
        await sleep(1100);
      } else {
        showTable(r, { hide: true, active: 0, newFrom: { dealer: 0, hands: [0] } });
      }
      hud();

      // Instant side bets: Perfect Pairs / 21+3 / Lucky Ladies settle on the first two cards.
      const [c0, c1] = r.hands[0].cards;
      const sideOut = [];
      if (sideAmt.pp > 0) sideOut.push(sideResult('pp', classifyPerfectPairs(cardCode(c0), cardCode(c1)), sideAmt.pp, mult));
      if (sideAmt.t213 > 0) sideOut.push(sideResult('t213', classify21plus3(cardCode(c0), cardCode(c1), cardCode(r.up)), sideAmt.t213, mult));
      if (sideAmt.ll > 0) sideOut.push(sideResult('ll', classifyLuckyLadies(cardCode(c0), cardCode(c1)), sideAmt.ll, mult));
      if (sideOut.length) {
        const instantNet = sideOut.reduce((a, x) => a + x.net, 0);
        S.sideWagered += sideOut.reduce((a, x) => a + x.stake, 0);
        S.sideNet += instantNet;
        S.bank += instantNet; S.pnl += instantNet;
        $('panel').innerHTML = `<div class="card">${sideOut.map((x) => `<div class="row" style="justify-content:space-between"><span>${SIDE_LABEL[x.id]}${x.mult > 1 ? ` ×${x.mult}` : ''}: ${x.tier ? TIER_LABEL[x.tier] : 'no hit'}</span><b class="num ${x.net > 0 ? 'ok' : 'bad'}">${$money(x.net)}</b></div>`).join('')}</div>`;
        hud();
        await sleep(900);
      }
      $('panel').innerHTML = '';

      let insuranceNet = 0, evenMoney = false;
      if (up === 1) {
        if (r.hands[0].bj) {
          const acc = await askOffer(`You have blackjack; the dealer shows an Ace. Take <b>even money</b> (${$money(bet)})?`, 'Even money?');
          if (acc) {
            const p = (16 * rules.decks - 1) / (52 * rules.decks - 3), play = (1 - p) * 1.5;   // ten among unseen after your A,T + dealer's A
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

      const dec0P = engine.decide(rules, r.hands[0].cards.map((c) => c.v), up);
      const firstDec = await dec0P;
      const peeksHere = peeksOnUp(rules, up);
      let ev0 = firstDec.blackjack ? (peeksHere ? (1 - firstDec.pBJ) * rules.blackjackPays : firstDec.ev.stand)
        : (() => { let b = -Infinity; for (const k of Object.keys(firstDec.ev)) if (firstDec.legal[k] && firstDec.ev[k] > b) b = firstDec.ev[k]; return peeksHere ? (1 - firstDec.pBJ) * b - firstDec.pBJ : b; })();
      S.expected += ev0 * bet;

      while (r.phase === 'player' && !stopped) {
        const hi = r.active;
        if (hi < 0) break;
        const h = r.hands[hi];
        const ranks = h.cards.map((c) => c.v);
        showTable(r, { hide: true, active: hi });
        const L = r.legal(hi);
        const decP = engine.decide(rules, ranks, up);
        const ctxL = { cards: h.cards.length, pair: h.cards.length === 2 && h.cards[0].v === h.cards[1].v ? h.cards[0].v : 0, handsCount: r.hands.length, afterSplit: h.fromSplit, afterSplitAces: h.splitAces, up };
        const reasons = { D: illegalReason(rules, ctxL, 'D'), P: illegalReason(rules, ctxL, 'P'), R: illegalReason(rules, ctxL, 'R'), H: illegalReason(rules, ctxL, 'H') };
        const dec = await decP;
        let best = null, bestEV = -Infinity;
        for (const a of ['S', 'H', 'D', 'P', 'R']) { const v = dec.ev[KEYS[a]]; if (L[a] && v !== undefined && v > bestEV) { best = a; bestEV = v; } }
        $('bar').style.gridTemplateColumns = '';
        let chosen = null;
        for (;;) {
          chosen = await new Promise((res) => renderActionBar($('bar'), { legal: L, reasons, onAct: res }));
          if (chosen === best || cfg.mode !== 'coach') break;
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
        if (cfg.mode === 'rewind' && chosen !== best) {
          checkpoints.push({
            hi, ranks: ranks.slice(), up, chosen, best, bestEV, chosenEV: dec.ev[KEYS[chosen]] ?? bestEV, lossAmt: loss,
            roundSnapshot: { hands: r.hands.map((x) => ({ ...x, cards: x.cards.slice() })), dealer: r.dealer.slice(), phase: r.phase, dealerBJ: r.dealerBJ, peeked: r.peeked },
            shoeCounts: shoe.snapshot(),
          });
        }
        const nBefore = r.hands.length;
        r.act(hi, chosen);
        hud();
        showTable(r, { hide: true, active: r.active, newFrom: { dealer: 1, hands: r.hands.map((x, i) => (chosen === 'P' ? (i >= hi && i < hi + 2 ? 1 : x.cards.length) : (i === hi ? x.cards.length - 1 : x.cards.length))) } });
        await sleep(chosen === best ? 250 : 450);
        if (r.hands.length !== nBefore) { /* split: table already shows both hands */ }
      }
      if (stopped) return;

      // Dealer Bust needs the exact card count, so force a full dealer play even if every player
      // hand already busted/surrendered/took a natural — the dealer otherwise never draws again.
      if (r.dealer.length === 2 && !r.dealerBJ) {
        if (r.phase !== 'over') showTable(r, { hide: false, newFrom: { dealer: 1, hands: r.hands.map((x) => x.cards.length) } });
        const upCount = r.dealer.length;
        r.playDealer(true);
        for (let k = upCount; k <= r.dealer.length; k++) {
          renderTable($('tbl'), { dealer: r.dealer.slice(0, Math.max(2, k)), hideHole: false, hands: r.hands.map((h) => ({ cards: h.cards })), newFrom: { dealer: k - 1, hands: r.hands.map((h) => h.cards.length) } });
          if (k < r.dealer.length) await sleep(520);
        }
      }

      const res = r.settle();
      let net = res.net * bet;
      if (evenMoney) net = bet;
      net += insuranceNet;
      const bustOut = sideAmt.bust > 0 ? (() => {
        const m = (mult && mult.target === 'bust') ? mult.value : 1;
        if (res.dealerBJ || !(res.dealerTotal > 21)) return { id: 'bust', stake: sideAmt.bust, mult: m, net: -sideAmt.bust, tier: null };
        const tier = dealerBustTier(r.dealer.length);
        return { id: 'bust', stake: sideAmt.bust, mult: m, net: sideAmt.bust * DB_TABLE[tier] * m, tier };
      })() : null;
      if (bustOut) { S.sideWagered += bustOut.stake; S.sideNet += bustOut.net; }
      showTable(r, { hide: false, newFrom: { dealer: 99, hands: r.hands.map((x) => x.cards.length) } });
      const handTotal = net + (bustOut ? bustOut.net : 0);   // sideOut's net was already applied to bank/pnl when it settled, earlier
      S.bank += handTotal; S.pnl += handTotal;
      hud();

      const lines = res.hands.map((x, i) => `<div class="row" style="justify-content:space-between"><span>${res.hands.length > 1 ? `Hand ${i + 1}: ` : ''}${{ win: 'Win', lose: 'Lose', push: 'Push', blackjack: 'Blackjack', charlie: 'Charlie win', surrender: 'Surrendered' }[x.res]}${x.total > 0 && x.res !== 'blackjack' ? ` (${x.total} vs ${res.dealerBJ ? 'blackjack' : res.dealerTotal})` : ''}</span><b class="num ${x.net > 0 ? 'ok' : x.net < 0 ? 'bad' : ''}">${$money(x.net * bet)}</b></div>`).join('');
      const sideLines = [...sideOut, ...(bustOut ? [bustOut] : [])].map((x) => `<div class="small dim" style="display:flex;justify-content:space-between"><span>${SIDE_LABEL[x.id]}${x.mult > 1 ? ` ×${x.mult}` : ''}</span><span>${$money(x.net)}</span></div>`).join('');
      const verdictHTML = `<div class="verdict ${net > 0 ? 'ok' : net < 0 ? 'bad' : ''}"><div class="head ${net > 0 ? 'ok' : net < 0 ? 'bad' : ''}">${net > 0 ? 'You win ' : net < 0 ? 'You lose ' : 'Push '}${net === 0 ? '' : $money(Math.abs(net))} <span class="small dim">main hand</span></div>${lines}${insuranceNet ? `<div class="small dim">Insurance ${$money(insuranceNet)}</div>` : ''}${evenMoney ? '<div class="small dim">Even money paid 1:1 — blackjack would have paid more on average.</div>' : ''}${sideLines ? `<div class="gap"></div>${sideLines}` : ''}</div>`;

      function deviationsHTML() {
        if (!checkpoints.length) return '';
        return `<div class="card" style="margin-top:10px"><h3>Decision points</h3><p class="small dim">You played on after these — here's what the correct line would have done instead.</p>
          ${checkpoints.map((c, i) => `<div class="row" style="justify-content:space-between;align-items:center;gap:8px;margin:8px 0">
            <span class="small">${handLabel(c.ranks)} vs ${upLabel(c.up)}: you ${ACTION_NAME[c.chosen]}, best was <b>${ACTION_NAME[c.best]}</b> <span class="dim">(${$money(-c.lossAmt)} EV)</span></span>
            <button class="btn small ghost" data-rw="${i}">Rewind here</button></div>`).join('')}</div>`;
      }
      $('panel').innerHTML = verdictHTML;

      async function summaryLoop() {
        for (;;) {
          showTable(r, { hide: false, newFrom: { dealer: 99, hands: r.hands.map((x) => x.cards.length) } });
          $('panel').innerHTML = verdictHTML + (cfg.mode === 'rewind' ? deviationsHTML() : '');
          $('bar').style.gridTemplateColumns = '1fr';
          $('bar').innerHTML = `<button class="btn primary block" id="nx">Next hand</button>`;
          const action = await new Promise((res) => {
            $('bar').querySelector('#nx').onclick = () => res('next');
            $('panel').querySelectorAll('[data-rw]').forEach((b) => b.onclick = () => res('rw:' + b.dataset.rw));
          });
          if (action === 'next') return;
          await doRewind(checkpoints[Number(action.slice(3))], bet, net);
        }
      }

      if (S.start - S.bank >= cfg.limit && !S.overridden) {
        const stop = await stopRule(S, cfg);
        if (stop) return endSession(S, cfg, 'limit');
        S.overridden = true;
      }
      if (S.bank < cfg.unit) return endSession(S, cfg, 'broke');
      await summaryLoop();
      $('panel').innerHTML = '';
      return round();
    }

    // Practice + Rewind: identical mechanics to games/live.js — replay from a captured decision
    // point with a continuation shoe, purely informational, never touches the session bankroll.
    // Scoped to main-hand strategy only; side bets have no "correct play" to rewind.
    async function doRewind(cp, bet, origNet) {
      const contShoe = shoeFromCounts(cp.shoeCounts);
      const rr = new Round(rules, () => contShoe.draw());
      rr.hands = cp.roundSnapshot.hands.map((x) => ({ ...x, cards: x.cards.slice() }));
      rr.dealer = cp.roundSnapshot.dealer.slice();
      rr.phase = cp.roundSnapshot.phase; rr.dealerBJ = cp.roundSnapshot.dealerBJ; rr.peeked = cp.roundSnapshot.peeked;
      const showRR = (opts) => renderTable($('tbl'), {
        dealer: rr.dealer, hideHole: true, hands: rr.hands.map((h, i) => ({ cards: h.cards, active: i === rr.active, note: h.doubled ? 'doubled' : '' })), ...opts,
      });
      showRR({});

      async function decideAndAct(hi, { showHint }) {
        const h = rr.hands[hi], ranks = h.cards.map((c) => c.v);
        const L = rr.legal(hi);
        const dec = await engine.decide(rules, ranks, cp.up);
        let best = null, bestEV = -Infinity;
        for (const a of ['S', 'H', 'D', 'P', 'R']) { const v = dec.ev[KEYS[a]]; if (L[a] && v !== undefined && v > bestEV) { best = a; bestEV = v; } }
        const ctxL = { cards: h.cards.length, pair: h.cards.length === 2 && h.cards[0].v === h.cards[1].v ? h.cards[0].v : 0, handsCount: rr.hands.length, afterSplit: h.fromSplit, afterSplitAces: h.splitAces, up: cp.up };
        const reasons = { D: illegalReason(rules, ctxL, 'D'), P: illegalReason(rules, ctxL, 'P'), R: illegalReason(rules, ctxL, 'R'), H: illegalReason(rules, ctxL, 'H') };
        if (showHint) {
          const fb = await explain(rules, ranks, cp.up, { ...dec, action: best, legal: Object.fromEntries(Object.entries(KEYS).map(([a, k]) => [k, !!L[a]])) }, best);
          const rows = fb.lines.map((l) => `<tr class="${l.best ? 'best' : ''} ${l.legal ? '' : 'illegal'}"><td>${l.name}${l.best ? ' ✓' : ''}${l.legal ? '' : ' — n/a'}</td><td class="num">${signed(l.ev, 1)}</td></tr>`).join('');
          $('panel').innerHTML = `<div class="verdict pop"><div class="head">Hint — ${ACTION_NAME[best]}</div><div class="reason">${esc(fb.reason)}</div><table class="evtable">${rows}</table></div>`;
        }
        $('bar').style.gridTemplateColumns = '';
        const chosen = await new Promise((res) => renderActionBar($('bar'), { legal: L, reasons, onAct: res }));
        if (!showHint) {
          if (chosen === best) $('panel').innerHTML = `<div class="small ok" style="text-align:center">✓ ${ACTION_NAME[chosen]}</div>`;
          else {
            const fb = await explain(rules, ranks, cp.up, { ...dec, action: best, legal: Object.fromEntries(Object.entries(KEYS).map(([a, k]) => [k, !!L[a]])) }, chosen);
            renderVerdict($('panel'), fb, { upcard: cp.up, compact: true });
          }
        }
        rr.act(hi, chosen);
        showRR({});
        await sleep(300);
      }

      $('panel').innerHTML = `<div class="banner"><b>Rewind</b> — same cards up to here. Try the decision again; what's drawn next will be fresh.</div>`;
      await decideAndAct(cp.hi, { showHint: true });
      while (rr.phase === 'player') {
        const hi = rr.active; if (hi < 0) break;
        await decideAndAct(hi, { showHint: false });
      }
      if (rr.dealer.length === 2 && !rr.dealerBJ) rr.playDealer(true);
      showRR({ hide: false });
      const rres = rr.settle();
      const newNet = rres.net * bet;
      $('panel').innerHTML = `<div class="card"><h3>Original vs. the corrected line</h3>
        <div class="row" style="justify-content:space-between"><span>What actually happened</span><b class="num ${origNet > 0 ? 'ok' : origNet < 0 ? 'bad' : ''}">${$money(origNet)}</b></div>
        <div class="row" style="justify-content:space-between"><span>Playing it correctly from here</span><b class="num ${newNet > 0 ? 'ok' : newNet < 0 ? 'bad' : ''}">${$money(newNet)}</b></div>
        <p class="small dim">One hand is one sample of variance — the correct play doesn't win every replay. What it guarantees is a better result on average, which is the EV gap shown for this decision. (Main hand only — side bets from this round aren't replayed.)</p></div>`;
      $('bar').style.gridTemplateColumns = '1fr';
      $('bar').innerHTML = `<button class="btn block" id="back">Back to hand summary</button>`;
      await new Promise((res) => { $('bar').querySelector('#back').onclick = res; });
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
      if (S2.hands) await store.addSession({ date: Date.now(), mode: c.mode === 'rewind' ? 'gravity-practice' : 'gravity', handsPlayed: S2.hands, accuracy: acc, evLost: S2.wagered ? (S2.leaked + S2.insCost) / S2.wagered : 0, bankrollDelta: S2.pnl, overrode: S2.overridden });
      const price = edge === null ? 0 : S2.wagered * edge / 100;
      el.innerHTML = `<h1>Session over</h1>${why === 'limit' ? '<div class="banner">You stopped at your own limit. That is the discipline working.</div>' : ''}${why === 'broke' ? '<div class="banner">Bankroll below one unit — session ends.</div>' : ''}
        <div class="stat3"><div class="card"><div class="v ${S2.pnl >= 0 ? 'ok' : 'bad'}">${$money(S2.pnl)}</div><div class="k">Result</div></div><div class="card"><div class="v">${S2.hands}</div><div class="k">Hands</div></div><div class="card"><div class="v ${acc >= 0.95 ? 'ok' : ''}">${Math.round(acc * 100)}%</div><div class="k">Main-hand accuracy</div></div></div>
        <div class="card"><b>The math of this session</b><table class="evtable">
          <tr><td>Main game wagered</td><td class="num">$${S2.wagered.toFixed(2)}</td></tr>
          <tr><td>Main game price (${edge === null ? '—' : edge.toFixed(2)}% edge)</td><td class="num">${$money(-price)}</td></tr>
          <tr><td>Expected result of the hands dealt</td><td class="num">${$money(S2.expected)}</td></tr>
          <tr><td>Cost of your mistakes</td><td class="num bad">${$money(-(S2.leaked + S2.insCost))}</td></tr>
          <tr><td>Side bets wagered / net</td><td class="num">$${S2.sideWagered.toFixed(2)} / ${$money(S2.sideNet)}</td></tr>
          <tr><td>Actual result</td><td class="num">${$money(S2.pnl)}</td></tr></table>
          <p class="small dim">The gap between expected and actual is variance — luck. Side bets carry a much steeper edge than the main hand (Tier 7 has the exact numbers); every dollar routed there is a worse price, multiplier or not.</p></div>
        <button class="btn primary block" id="again">New session</button><div class="gap"></div><a class="btn block ghost" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="#/play">Done</a>`;
      el.querySelector('#again').onclick = () => { stopped = false; setup(); };
    }

    $('end').onclick = () => { stopped = true; endSession(S, cfg, 'manual'); };
    round().catch((e) => { if (!stopped) { console.error(e); el.innerHTML = `<h1>Something broke</h1><p class="dim">${ctx.esc(e.message || e)}</p><a class="btn block" href="#/play">Back</a>`; } });
  }

  setup();
  return () => { stopped = true; document.getElementById('app').classList.remove('focus'); };
}
