// Practice Table: deliberate practice on a real, persistent shoe. No bankroll — the point is reps.
//   · Focus: deal only the hand types you want (weak spots, stiffs, soft hands, pairs, doubles, surrender spots)
//   · Instant feedback with the reason, and a take-back so you can retry a wrong decision, or play it on
//   · Silent mode: play the whole hand, then get a decision-by-decision review
// Hands come off the same shoe as the Live Table (cut card, reshuffle, Hi-Lo count).

import { Round } from '../engine/round.js';
import { peeksOnUp, upLabel } from '../engine/rules.js';
import { handLabel } from '../ui/cards.js';
import { Shoe } from '../app/shoe.js';
import { renderTable, renderActionBar, illegalReason, renderVerdict, toast } from '../ui/hand.js';
import { shoeSettings, shoeLine, prepareShoe, openShoeSheet, askCount } from '../ui/shoe-settings.js';
import { engine } from '../app/engine-client.js';
import { explain, ACTION_NAME, usd100 } from '../app/feedback.js';
import { describeRules } from '../app/presets.js';
import { insuranceEdge } from '../engine/sidebets.js';
import { openRulesEditor } from '../ui/rules-editor.js';
import { ROW, POOLS } from '../curriculum/cells.js';
import { srs } from '../app/srs.js';
import { store } from '../app/store.js';

const KEYS = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const FOCI = [
  { id: 'all', name: 'Everything', sub: 'Normal play, any hand' },
  { id: 'weak', name: 'My weak spots', sub: 'Hands you have missed before' },
  { id: 'stiff', name: 'Stiff hands', sub: 'Hard 12–16 — hit or stand?' },
  { id: 'soft', name: 'Soft hands', sub: 'Ace + 2 through 9' },
  { id: 'pairs', name: 'Pairs', sub: 'Split or not' },
  { id: 'doubles', name: 'Double spots', sub: 'Hard 9–11 and soft 13–18' },
  { id: 'surrender', name: 'Tough spots', sub: '14–17 against a 7, 8, 9, 10 or Ace; 8,8 and 9,9 against strong cards' },
];

// Row key for a two-card player hand (engine ranks).
export function rowKeyOf([a, b]) {
  if (a === b) return a === 10 ? 'TT' : a === 1 ? 'AA' : `${a}${a}`;
  if (a === 1 || b === 1) return `A${a === 1 ? b : a}`;
  return `H${a + b}`;
}

function focusTest(focus, rules) {
  const weak = new Set();
  if (focus === 'weak') {
    for (const p of POOLS.all()) {
      const c = srs.get(p.rowKey, p.up, rules);
      if (c && c.attempts && (c.correct / c.attempts < 0.9 || c.lastCorrect === false)) weak.add(`${p.rowKey}|${p.up}`);
    }
    if (!weak.size) return { test: () => true, note: 'No weak spots recorded yet — dealing everything.' };
  }
  const surr = new Set(POOLS.surrender().map((p) => `${p.rowKey}|${p.up}`));
  const test = (rowKey, up) => {
    const row = ROW[rowKey];
    switch (focus) {
      case 'weak': return weak.has(`${rowKey}|${up}`);
      case 'stiff': return row.kind === 'hard' && row.total >= 12 && row.total <= 16;
      case 'soft': return row.kind === 'soft';
      case 'pairs': return row.kind === 'pair';
      case 'doubles': return (row.kind === 'hard' && row.total >= 9 && row.total <= 11) || (row.kind === 'soft' && row.total >= 13 && row.total <= 18);
      case 'surrender': return surr.has(`${rowKey}|${up}`);
      default: return true;
    }
  };
  return { test, note: '' };
}

export function practiceTable(el, ctx) {
  const s = ctx.profile.settings;
  let rules = ctx.rules, stopped = false, keyHandler = null;
  const prac = () => (s.practice = { focus: 'all', feedback: 'instant', ...(s.practice || {}) });

  function setup() {
    const p = prac();
    const SH = new Shoe(rules.decks, shoeSettings(ctx.profile));
    el.innerHTML = `<div class="topbar"><a class="back" href="#/play">‹ Play</a></div><h1>Practice Table</h1>
      <p class="dim" style="margin-top:0">Reps with no money on the line. Pick the kind of hand you want to get better at; the shoe, cut card and count work like the real table.</p>
      <div class="card row"><div class="grow"><div class="small dim">Table rules</div><div class="small">${describeRules(rules)}</div></div><button class="btn small ghost" id="chg">Change</button></div>
      <h2>Focus</h2>
      ${FOCI.map((f) => `<label class="card row" style="cursor:pointer"><div class="grow"><b>${f.name}</b><div class="small dim">${f.sub}</div></div><input type="radio" name="focus" value="${f.id}" ${p.focus === f.id ? 'checked' : ''}></label>`).join('')}
      <h2>Feedback</h2>
      <div class="seg" id="fb"><button data-v="instant" class="${p.feedback === 'instant' ? 'on' : ''}">After each decision</button><button data-v="silent" class="${p.feedback === 'silent' ? 'on' : ''}">Review after the hand</button></div>
      <p class="small dim">After each decision: see why instantly, and take back a wrong move to retry it. Review: play the whole hand uninterrupted, then see every decision graded.</p>
      <div class="card row"><div class="grow"><div class="small dim">Shoe</div><div class="small">${shoeLine(SH, ctx.profile)}</div></div><button class="btn small ghost" id="shoe">Shoe settings</button></div>
      <button class="btn primary block" id="go">Deal</button>`;
    el.querySelector('#chg').onclick = () => openRulesEditor(rules, { onSave: async (r, id) => { await ctx.setRules(r, id); rules = ctx.rules; engine.prefill(rules, () => {}); setup(); } });
    el.querySelector('#shoe').onclick = () => openShoeSheet(ctx, SH, { onChange: setup });
    el.querySelectorAll('#fb button').forEach((b) => b.onclick = () => { p.feedback = b.dataset.v; ctx.save(); setup(); });
    el.querySelector('#go').onclick = () => { p.focus = el.querySelector('input[name=focus]:checked').value; ctx.save(); play(p); };
  }

  async function play(cfg) {
    const app = document.getElementById('app');
    app.classList.add('focus');
    const SH = new Shoe(rules.decks, shoeSettings(ctx.profile));
    const { test, note } = focusTest(cfg.focus, rules);
    const focusName = FOCI.find((f) => f.id === cfg.focus).name;
    const S = { hands: 0, decisions: 0, right: 0, leaked: 0, units: 0, w: 0, l: 0, p: 0, streak: 0, best: 0, retries: 0, mistakes: [], cnt: { asked: 0, right: 0 }, t0: Date.now() };

    el.innerHTML = `<div class="topbar"><button class="btn small ghost" id="end">End session</button><div class="grow"></div><div class="right small dim">${focusName}</div></div>
      <div id="hud" class="small"></div><div id="tbl"></div><div id="panel"></div><div class="actionbar" id="bar"></div>`;
    const $ = (id) => el.querySelector('#' + id);
    if (note) toast(note, 3200);

    const hud = () => {
      $('hud').innerHTML = `<div class="row wrap" style="justify-content:space-between"><span>Hand <b class="num">${S.hands}</b> · <span class="ok num">${S.w}W</span> <span class="bad num">${S.l}L</span> <span class="dim num">${S.p}P</span></span>
        <span class="streak ${S.streak >= 5 ? 'ok' : ''}">Streak <span class="num">${S.streak}</span> <span class="dim">best ${S.best}</span></span></div>
        <div class="row wrap" style="justify-content:space-between;margin:4px 0"><span class="small">Accuracy <b class="num">${S.decisions ? Math.round(S.right / S.decisions * 100) : 100}%</b> <span class="dim">· leaked ${usd100(S.leaked / Math.max(1, S.hands))} per $100</span></span><span class="small dim">${shoeLine(SH, ctx.profile)}</span></div>
        <div class="row" style="justify-content:flex-end"><button class="btn small ghost" id="shoebtn">Shoe</button></div>`;
      $('shoebtn').onclick = () => openShoeSheet(ctx, SH, { onChange: hud });
    };

    const show = (r, { hide, active = -1, newFrom } = {}) => {
      if (!hide) SH.revealHole();
      renderTable($('tbl'), { dealer: r.dealer, hideHole: hide, newFrom,
        hands: r.hands.map((h, i) => ({ cards: h.cards, active: i === active, note: h.doubled ? 'doubled' : h.surrendered ? 'surrendered' : h.charlie ? 'Charlie' : '' })) });
    };

    // Deal a hand of the chosen type without consuming the cards we reject: look ahead on a copy of the
    // shoe, then deal the matching cards for real.
    function dealFocused() {
      const tries = cfg.focus === 'all' ? 1 : 800;
      for (let t = 0; t < tries; t++) {
        const trial = SH.clone(), drawn = [];
        const rr = new Round(rules, () => { const c = trial.draw(); drawn.push(c.v); return c; }).deal();
        const ok = cfg.focus === 'all' || (rr.phase === 'player' && test(rowKeyOf(rr.hands[0].cards.map((c) => c.v)), rr.up.v));
        if (ok) { const q = drawn.slice(); return new Round(rules, () => SH.draw(q.length ? q.shift() : undefined)).deal(); }
      }
      return new Round(rules, () => SH.draw()).deal();
    }

    const ask = (html, title) => {
      $('panel').innerHTML = `<div class="banner"><b>${title}</b><br>${html}</div>`;
      $('bar').style.gridTemplateColumns = '1fr 1fr';
      $('bar').innerHTML = `<button class="act" data-a="decline" style="border-color:var(--ok)">Decline</button><button class="act" data-a="accept">Accept</button>`;
      return new Promise((res) => $('bar').querySelectorAll('.act').forEach((b) => b.onclick = () => res(b.dataset.a === 'accept')));
    };

    // Keyboard: H S D P R (desktop practice).
    let pendingAct = null;
    keyHandler = (e) => {
      const k = e.key.toUpperCase();
      if (pendingAct && 'HSDPR'.includes(k) && k.length === 1) {
        const b = $('bar').querySelector(`.act[data-a="${k}"]`);
        if (b) b.click();
      }
    };
    window.addEventListener('keydown', keyHandler);

    function chooseAction(L, reasons) {
      $('bar').style.gridTemplateColumns = '';
      return new Promise((res) => renderActionBar($('bar'), { legal: L, reasons, onAct: (a) => { pendingAct = null; res(a); } })).finally(() => { pendingAct = null; });
    }

    async function hand() {
      if (stopped) return;
      prepareShoe(SH, ctx.profile);
      const r = dealFocused();
      SH.hideHole(r.dealer[1].v);
      S.hands++;
      const up = r.up.v;
      const review = [];
      const startKey = r.phase === 'player' ? rowKeyOf(r.hands[0].cards.map((c) => c.v)) : null;
      show(r, { hide: true, active: 0, newFrom: { dealer: 0, hands: [0] } });
      hud();
      let insNote = '';

      if (up === 1) {
        if (r.hands[0].bj) {
          const acc = await ask('You have blackjack; the dealer shows an Ace. Take <b>even money</b>?', 'Even money?');
          if (acc) { S.decisions++; S.leaked += 0.05; S.streak = 0; insNote = 'Even money gives up a little on average — decline it.'; } else { S.decisions++; S.right++; S.streak++; }
        } else {
          const acc = await ask('The dealer shows an Ace. <b>Insurance</b> costs half your bet and pays 2:1.', 'Insurance?');
          S.decisions++;
          if (acc) { S.leaked += insuranceEdge(rules.decks) * 0.5; S.streak = 0; insNote = 'Insurance is a losing bet — decline it.'; } else { S.right++; S.streak++; }
        }
        S.best = Math.max(S.best, S.streak);
        $('panel').innerHTML = insNote ? `<div class="banner">${insNote}</div>` : '';
      }

      let first = true;
      while (r.phase === 'player' && !stopped) {
        const hi = r.active; if (hi < 0) break;
        const h = r.hands[hi];
        const ranks = h.cards.map((c) => c.v);
        show(r, { hide: true, active: hi });
        const L = r.legal(hi);
        const ctxL = { cards: h.cards.length, pair: h.cards.length === 2 && h.cards[0].v === h.cards[1].v ? h.cards[0].v : 0, handsCount: r.hands.length, afterSplit: h.fromSplit, afterSplitAces: h.splitAces, up };
        const reasons = { D: illegalReason(rules, ctxL, 'D'), P: illegalReason(rules, ctxL, 'P'), R: illegalReason(rules, ctxL, 'R'), H: illegalReason(rules, ctxL, 'H') };
        const decP = engine.decide(rules, ranks, up);      // resolves while the player thinks
        let dec = null, best = null, bestEV = -Infinity, legalFull = null;
        const resolve = async () => {
          if (dec) return;
          dec = await decP;
          for (const a of ['S', 'H', 'D', 'P', 'R']) { const v = dec.ev[KEYS[a]]; if (L[a] && v !== undefined && v > bestEV) { best = a; bestEV = v; } }
          legalFull = Object.fromEntries(Object.entries(KEYS).map(([a, k]) => [k, !!L[a]]));
        };

        let counted = false;
        for (;;) {
          pendingAct = true;
          const chosen = await chooseAction(L, reasons);
          await resolve();
          const loss = chosen === best ? 0 : Math.max(0, bestEV - (dec.ev[KEYS[chosen]] ?? bestEV));
          if (!counted) {
            counted = true;
            S.decisions++;
            if (chosen === best) { S.right++; S.streak++; S.best = Math.max(S.best, S.streak); } else { S.streak = 0; S.leaked += loss; }
            if (first && startKey) srs.record(startKey, up, rules, chosen === best, loss);
            review.push({ label: `${handLabel(ranks)} vs ${upLabel(up)}`, chosen, best, loss });
            if (chosen !== best) S.mistakes.push({ label: `${handLabel(ranks)} vs ${upLabel(up)}`, chosen, best, loss });
          }
          first = false;
          if (cfg.feedback === 'instant') {
            const fb = await explain(rules, ranks, up, { ...dec, action: best, legal: legalFull }, chosen);
            renderVerdict($('panel'), fb, { upcard: up, compact: true });
            if (chosen !== best) {
              $('bar').style.gridTemplateColumns = '1fr 1fr';
              $('bar').innerHTML = `<button class="btn" id="undo">Take it back</button><button class="btn primary" id="on">Play it on</button>`;
              const redo = await new Promise((res) => { $('bar').querySelector('#undo').onclick = () => res(true); $('bar').querySelector('#on').onclick = () => res(false); });
              if (redo) { S.retries++; continue; }
            }
          }
          hud();
          r.act(hi, chosen);
          show(r, { hide: true, active: r.active, newFrom: { dealer: 1, hands: r.hands.map((x, i) => (chosen === 'P' ? (i >= hi && i < hi + 2 ? 1 : x.cards.length) : (i === hi ? x.cards.length - 1 : x.cards.length))) } });
          await sleep(chosen === best ? 250 : 400);
          break;
        }
      }
      if (stopped) return;
      if (r.phase !== 'over') show(r, { hide: false, newFrom: { dealer: 1, hands: r.hands.map((x) => x.cards.length) } });
      if (r.phase === 'dealer') {
        r.playDealer();
        show(r, { hide: false, newFrom: { dealer: 99, hands: r.hands.map((x) => x.cards.length) } });
        await sleep(500);
      }
      show(r, { hide: false, newFrom: { dealer: 99, hands: r.hands.map((x) => x.cards.length) } });
      const res = r.settle();
      S.units += res.net;
      if (res.net > 0) S.w++; else if (res.net < 0) S.l++; else S.p++;
      hud();
      const head = res.net > 0 ? 'ok' : res.net < 0 ? 'bad' : '';
      const reviewHTML = cfg.feedback === 'silent' && review.length
        ? `<div class="card" style="margin-top:8px"><h3>Your decisions</h3>${review.map((x) => `<div class="row" style="justify-content:space-between"><span class="small">${x.label}: ${ACTION_NAME[x.chosen]}</span><b class="${x.chosen === x.best ? 'ok' : 'bad'}">${x.chosen === x.best ? '✓' : `✕ ${ACTION_NAME[x.best]} (−${usd100(x.loss)}/100)`}</b></div>`).join('')}</div>` : '';
      $('panel').innerHTML = `<div class="verdict ${head}"><div class="head ${head}">${res.net > 0 ? 'Won' : res.net < 0 ? 'Lost' : 'Push'} ${res.net === 0 ? '' : Math.abs(res.net).toFixed(res.net % 1 ? 1 : 0) + (Math.abs(res.net) === 1 ? ' unit' : ' units')}</div>
        <div class="small dim">${res.hands.map((x) => ({ win: 'Win', lose: 'Lose', push: 'Push', blackjack: 'Blackjack', charlie: 'Charlie', surrender: 'Surrender' }[x.res])).join(' · ')} · dealer ${res.dealerBJ ? 'blackjack' : res.dealerTotal}</div></div>${reviewHTML}`;
      $('bar').style.gridTemplateColumns = '1fr';
      $('bar').innerHTML = `<button class="btn primary" id="nx">Next hand</button>`;
      await new Promise((res2) => { $('bar').querySelector('#nx').onclick = res2; });
      if (shoeSettings(ctx.profile).count === 'quiz' && S.hands % 3 === 0) await askCount(SH, S.cnt);
      $('panel').innerHTML = '';
      return hand();
    }

    async function end() {
      stopped = true; app.classList.remove('focus');
      if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
      const acc = S.decisions ? S.right / S.decisions : 1;
      if (S.hands) await store.addSession({ date: Date.now(), mode: 'practice', handsPlayed: S.hands, accuracy: acc, evLost: S.leaked / Math.max(1, S.hands), bankrollDelta: 0 });
      const worst = S.mistakes.slice().sort((a, b) => b.loss - a.loss).slice(0, 6);
      el.innerHTML = `<h1>Practice done</h1>
        <div class="stat3"><div class="card"><div class="v">${S.hands}</div><div class="k">Hands</div></div><div class="card"><div class="v ${acc >= 0.95 ? 'ok' : ''}">${Math.round(acc * 100)}%</div><div class="k">Accuracy</div></div><div class="card"><div class="v">${S.best}</div><div class="k">Best streak</div></div></div>
        <div class="card"><b>${focusName}</b><div class="small dim">${S.decisions} decisions · ${S.retries} take-backs · cost of mistakes ${usd100(S.leaked / Math.max(1, S.hands))} per $100 bet${S.cnt.asked ? ` · count checks ${S.cnt.right}/${S.cnt.asked}` : ''}</div></div>
        ${worst.length ? `<div class="card"><h3>Your costliest mistakes</h3>${worst.map((m) => `<div class="row" style="justify-content:space-between"><span class="small">${m.label}: you ${ACTION_NAME[m.chosen]}, best ${ACTION_NAME[m.best]}</span><b class="bad">−${usd100(m.loss)}</b></div>`).join('')}<div class="small dim" style="margin-top:6px">They are now in your weak-spot list. Choose "My weak spots" next time.</div></div>` : S.decisions ? '<div class="card ok"><b class="ok">Clean session.</b></div>' : ''}
        <button class="btn primary block" id="again">Another session</button><div class="gap"></div><a class="btn block ghost" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="#/play">Done</a>`;
      el.querySelector('#again').onclick = () => { stopped = false; setup(); };
    }

    $('end').onclick = () => end();
    hand().catch((e) => { if (!stopped) { console.error(e); el.innerHTML = `<h1>Something broke</h1><p class="dim">${esc(e.message || e)}</p><a class="btn block" href="#/play">Back</a>`; } });
  }

  setup();
  return () => { stopped = true; if (keyHandler) window.removeEventListener('keydown', keyHandler); document.getElementById('app').classList.remove('focus'); };
}
