// Generic hand-decision runner: powers Flash Drill, Three Strikes, Boss Hands, tier drills and
// certification. One hand at a time: deal -> (timer) -> pick -> reason-first verdict -> next.

import { engine } from '../app/engine-client.js';
import { explain, ACTION_NAME, evKey } from '../app/feedback.js';
import { renderTable, renderActionBar, markActions, renderVerdict, illegalReason, toast } from '../ui/hand.js';
import { makeCard, makeHand } from '../ui/cards.js';
import { randomRanks } from '../curriculum/cells.js';
import { srs } from '../app/srs.js';
import { store } from '../app/store.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function ringHTML() {
  return `<div class="ring"><svg width="64" height="64" viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="27"/><circle class="fg" cx="32" cy="32" r="27" stroke-dasharray="169.6" stroke-dashoffset="0"/></svg><div class="t num"></div></div>`;
}

export function startRunner(root, opts) {
  const o = { seconds: null, strikes: null, total: null, autoAdvanceMs: 0, exitHref: '#/drill', mode: 'drill', recordSession: true, ...opts };
  const app = document.getElementById('app');
  app.classList.add('focus');
  const st = { n: 0, correct: 0, streak: 0, best: 0, evLost: 0, strikes: o.strikes, times: [], results: [], stopped: false, startedAt: Date.now() };
  let timerRaf = 0, timerEnd = 0, cur = null, nextP = null, answered = false;

  root.innerHTML = `<div class="topbar"><a class="back" id="exit" href="${o.exitHref}">‹ Exit</a><div class="grow"></div><div id="ringbox"></div></div>
    <div id="hud" class="row wrap small" style="justify-content:space-between"></div>
    <div id="hint"></div><div id="tbl"></div><div id="verdict"></div><div id="misc"></div>
    <div class="actionbar" id="bar"></div>`;
  const $ = (id) => root.querySelector('#' + id);

  const rulesOf = (item) => item.rules || o.rules;
  const secondsNow = () => (typeof o.seconds === 'function' ? o.seconds(st) : o.seconds);

  function hud() {
    const parts = [];
    if (o.hud) parts.push(o.hud(st));
    else {
      parts.push(`<span class="streak ${st.streak >= 5 ? 'ok' : ''}">Streak <span class="num">${st.streak}</span></span>`);
      parts.push(`<span class="dim num">${st.correct}/${st.n}${o.total ? ` of ${o.total}` : ''}</span>`);
      if (st.strikes !== null) parts.push(`<span class="bad">${'✕'.repeat(o.strikes - st.strikes)}<span class="dim">${'✕'.repeat(st.strikes)}</span></span>`);
    }
    $('hud').innerHTML = parts.join('');
  }

  async function prep() {
    const item = await o.source.next();
    if (item.trap) return { item, trap: item.trap, rules: rulesOf(item), ranks: item.trap.hand.player };
    const rules = rulesOf(item);
    const res = await engine.cell(rules, item.rowKey, item.up);
    const ranks = item.ranks || randomRanks(item.rowKey);
    return { item, rules, res, ranks };
  }

  function stopTimer() { cancelAnimationFrame(timerRaf); $('ringbox').innerHTML = ''; }
  function startTimer(seconds, onTimeout) {
    if (!seconds) return;
    $('ringbox').innerHTML = ringHTML();
    const fg = $('ringbox').querySelector('.fg'), tx = $('ringbox').querySelector('.t');
    const t0 = performance.now(), total = seconds * 1000;
    timerEnd = t0 + total;
    const tick = (now) => {
      const left = Math.max(0, timerEnd - now);
      fg.style.strokeDashoffset = String(169.6 * (1 - left / total));
      fg.style.stroke = left < total * 0.3 ? 'var(--bad)' : left < total * 0.6 ? 'var(--due)' : 'var(--ok)';
      tx.textContent = (left / 1000).toFixed(1);
      if (left <= 0) { onTimeout(); return; }
      timerRaf = requestAnimationFrame(tick);
    };
    timerRaf = requestAnimationFrame(tick);
  }

  async function show() {
    if (st.stopped) return;
    answered = false;
    $('verdict').innerHTML = ''; $('misc').innerHTML = '';
    { const pre = nextP ? await nextP : null; cur = pre || await prep(); nextP = null; }
    if (st.stopped) return;
    if (cur.trap) return showTrap();
    const { item, rules, res, ranks } = cur;
    const cards = makeHand(ranks);
    const up = makeCard(item.up);
    const hole = makeCard(Math.random() < 0.5 ? 10 : 2 + Math.floor(Math.random() * 8));
    cur.cards = cards; cur.dealer = [up, hole];
    renderTable($('tbl'), { dealer: cur.dealer, hideHole: true, hands: [{ cards, active: true }], newFrom: { dealer: 0, hands: [0] } });
    $('hint').innerHTML = o.hint ? `<div class="banner small">${o.hint(item, cur)}</div>` : '';
    setBar(false);
    hud();
    cur.shownAt = performance.now();
    const secs = secondsNow();
    if (secs) startTimer(secs, () => answer(null));
    nextP = prep().catch(() => null);
  }

  function legalFor(c) {
    const three = c.ranks.length > 2;
    const l = c.res.legal;
    return { H: true, S: true, D: !three && !!l.double, P: !three && !!l.split, R: !three && !!l.surrender };
  }
  function reasonsFor(c) {
    const ctx = { cards: c.ranks.length, pair: c.ranks.length === 2 && c.ranks[0] === c.ranks[1] ? c.ranks[0] : 0, handsCount: 1, up: c.item && (c.item.up ?? (c.item.trap && c.item.trap.hand && c.item.trap.hand.up)) };
    return { D: illegalReason(c.rules, ctx, 'D'), P: illegalReason(c.rules, ctx, 'P'), R: illegalReason(c.rules, ctx, 'R') };
  }
  function setBar(disabled) {
    $('bar').style.display = '';
    renderActionBar($('bar'), { legal: legalFor(cur), reasons: reasonsFor(cur), disabled, onAct: answer });
  }

  async function answer(chosen, { replay = false } = {}) {
    if (answered) return;
    answered = true;
    stopTimer();
    const { item, rules, res, ranks } = cur;
    const timeout = chosen === null;
    const correct = !timeout && chosen === res.action;
    const ms = Math.round(performance.now() - cur.shownAt);
    const key = chosen ? evKey(chosen) : null;
    const evLoss = correct || timeout ? 0 : Math.max(0, res.ev[evKey(res.action)] - (res.ev[key] ?? res.ev[evKey(res.action)]));
    renderTable($('tbl'), { dealer: cur.dealer, hideHole: false, hands: [{ cards: cur.cards, active: true }], newFrom: { dealer: 1, hands: [cur.cards.length] } });
    markActions($('bar'), chosen, res.action);
    $('bar').querySelectorAll('.act').forEach((b) => b.classList.add('off'));

    if (!replay) {
      st.n++; st.times.push(ms);
      if (correct) { st.correct++; st.streak++; st.best = Math.max(st.best, st.streak); }
      else { st.streak = 0; st.evLost += evLoss; if (st.strikes !== null) st.strikes--; }
      st.results.push({ rowKey: item.rowKey, up: item.up, correct, ms, evLoss });
      await srs.record(item.rowKey, item.up, rules, correct, evLoss);
      if (!correct && o.queue) o.queue.notifyMiss(item);
      if (o.onAnswer) await o.onAnswer({ item, correct, chosen, ms, evLoss, res, rules }, st);
      hud();
    }

    const resX = ranks.length > 2 ? { ...res, legal: { ...res.legal, double: false, split: false, surrender: false } } : res;
    const fb = await explain(rules, ranks, item.up, resX, chosen, { timeout });
    const over = (st.strikes !== null && st.strikes <= 0) || (o.total && st.n >= o.total) || (o.stopWhen && o.stopWhen(st));

    if (correct && o.autoAdvanceMs && !over && !replay) {
      $('verdict').innerHTML = `<div class="verdict ok"><div class="head ok">Correct</div><div class="small dim">${esc(fb.reason)}</div></div>`;
      setTimeout(() => { if (!st.stopped) show(); }, o.autoAdvanceMs);
      return;
    }
    renderVerdict($('verdict'), fb, { upcard: item.up });
    $('verdict').insertAdjacentHTML('beforeend', `<div class="linkbtns"><button class="btn small ghost" id="replay">Replay this hand</button><button class="btn small ghost" id="adddeck">Add to my drill deck</button></div>`);
    $('verdict').querySelector('#replay').onclick = () => replayHand();
    $('verdict').querySelector('#adddeck').onclick = async () => {
      const p = await store.getProfile();
      p.deck = p.deck || [];
      if (!p.deck.some((d) => d.rowKey === item.rowKey && d.up === item.up)) p.deck.push({ rowKey: item.rowKey, up: item.up });
      await store.saveProfile(p);
      toast('Added to My Deck (Drill tab).');
    };
    $('bar').innerHTML = over
      ? `<button class="btn primary block" id="fin" style="grid-column:1/-1">See results</button>`
      : `<button class="btn primary block" id="nx" style="grid-column:1/-1">Next</button>`;
    $('bar').style.gridTemplateColumns = '1fr';
    const go = $('bar').querySelector('#nx') || $('bar').querySelector('#fin');
    go.onclick = () => (over ? finish() : show());
    setTimeout(() => $('verdict').scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
  }


  // ---- decline-or-accept prompts (insurance, even money, side bets) -------------------------
  function showTrap() {
    const t = cur.trap;
    const cards = makeHand(t.hand.player);
    const dealer = [makeCard(t.hand.up), makeCard(10)];
    cur.cards = cards; cur.dealer = dealer;
    renderTable($('tbl'), { dealer, hideHole: true, hands: [{ cards, active: true }], newFrom: { dealer: 0, hands: [0] } });
    $('hint').innerHTML = `<div class="banner ${t.tempt ? 'due' : ''}">${t.tempt ? `<div class="due" style="font-weight:800;font-size:18px;margin-bottom:4px">${esc(t.tempt)}</div>` : ''}<b>${esc(t.title)}</b><br>${t.html}</div>`;
    $('bar').style.gridTemplateColumns = '1fr 1fr';
    $('bar').innerHTML = `<button class="act" data-a="decline" style="border-color:var(--ok)">Decline</button><button class="act" data-a="accept">Accept</button>`;
    $('bar').querySelectorAll('.act').forEach((b) => b.onclick = () => answerTrap(b.dataset.a));
    hud();
    cur.shownAt = performance.now();
    const secs = secondsNow();
    if (secs) startTimer(secs, () => answerTrap(null));
    nextP = prep().catch(() => null);
  }

  async function answerTrap(choice) {
    if (answered) return;
    answered = true; stopTimer();
    const t = cur.trap, timeout = choice === null, correct = choice === 'decline';
    const ms = Math.round(performance.now() - cur.shownAt);
    st.n++; st.times.push(ms);
    const cost = correct ? 0 : Math.max(0, t.edge || 0);
    if (correct) { st.correct++; st.streak++; st.best = Math.max(st.best, st.streak); }
    else { st.streak = 0; st.evLost += cost; if (st.strikes !== null) st.strikes--; }
    st.results.push({ trap: t.id, correct, ms, evLoss: cost });
    if (o.onAnswer) await o.onAnswer({ item: cur.item, trap: t, correct, chosen: choice, ms, evLoss: cost }, st);
    hud();
    const over = (st.strikes !== null && st.strikes <= 0) || (o.total && st.n >= o.total) || (o.stopWhen && o.stopWhen(st));
    renderTable($('tbl'), { dealer: cur.dealer, hideHole: false, hands: [{ cards: cur.cards, active: true }], newFrom: { dealer: 1, hands: [cur.cards.length] } });
    $('verdict').innerHTML = `<div class="verdict ${correct ? 'ok' : 'bad'} pop"><div class="head ${correct ? 'ok' : 'bad'}">${correct ? 'Declined — correct' : timeout ? "Time's up — decline is the answer" : 'Never accept this'}</div>
      <div class="reason">${esc(t.why)}</div>${!correct && cost > 0 ? `<p class="small">Accepting costs about <b class="bad">$${(cost * 100).toFixed(2)}</b> per $100 bet on this offer.</p>` : ''}</div>`;
    if (correct && o.autoAdvanceMs && !over) { setTimeout(() => { if (!st.stopped) show(); }, o.autoAdvanceMs); return; }
    $('bar').style.gridTemplateColumns = '1fr';
    $('bar').innerHTML = over ? `<button class="btn primary block" id="fin">See results</button>` : `<button class="btn primary block" id="nx">Next</button>`;
    const go = $('bar').querySelector('#nx') || $('bar').querySelector('#fin');
    go.onclick = () => (over ? finish() : show());
    setTimeout(() => $('verdict').scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
  }

  function replayHand() {
    answered = false;
    $('verdict').innerHTML = '';
    renderTable($('tbl'), { dealer: cur.dealer, hideHole: true, hands: [{ cards: cur.cards, active: true }], newFrom: { dealer: 0, hands: [0] } });
    $('bar').style.gridTemplateColumns = '';
    renderActionBar($('bar'), { legal: legalFor(cur), reasons: reasonsFor(cur), onAct: (k) => answer(k, { replay: true }) });
    cur.shownAt = performance.now();
    toast('Replay — this attempt is not scored.');
  }

  async function finish() {
    if (st.stopped) return;
    st.stopped = true;
    stopTimer();
    app.classList.remove('focus');
    const acc = st.n ? st.correct / st.n : 0;
    const avg = st.times.length ? st.times.reduce((a, b) => a + b, 0) / st.times.length : 0;
    if (o.recordSession && st.n) await store.addSession({ date: Date.now(), mode: o.mode, handsPlayed: st.n, accuracy: acc, evLost: st.evLost, bankrollDelta: 0 });
    let extra = '';
    if (o.onFinish) extra = (await o.onFinish(st)) || '';
    root.innerHTML = `<h1>${esc(o.title || 'Session')} complete</h1>
      <div class="stat3"><div class="card"><div class="v ${acc >= 0.95 ? 'ok' : acc < 0.8 ? 'bad' : ''}">${(acc * 100).toFixed(0)}%</div><div class="k">Accuracy</div></div>
      <div class="card"><div class="v">${st.best}</div><div class="k">Best streak</div></div>
      <div class="card"><div class="v">${(avg / 1000).toFixed(1)}s</div><div class="k">Avg time</div></div></div>
      <div class="card">${st.n - st.correct ? `<b>Your ${st.n - st.correct} mistake${st.n - st.correct === 1 ? '' : 's'} leaked $${(st.evLost / st.n * 100).toFixed(2)} for every $100 wagered</b> across these ${st.n} hands.` : `<b class="ok">No mistakes</b> in these ${st.n} hands.`}</div>
      ${extra}
      <div class="gap"></div><button class="btn primary block" id="again">Go again</button><div class="gap"></div><a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="${o.exitHref}">Done</a>`;
    root.querySelector('#again').onclick = () => { if (o.restart) o.restart(); else location.reload(); };
  }

  $('exit').addEventListener('click', () => { st.stopped = true; stopTimer(); app.classList.remove('focus'); });
  show();
  return { stop() { st.stopped = true; stopTimer(); app.classList.remove('focus'); }, state: st, finish };
}
