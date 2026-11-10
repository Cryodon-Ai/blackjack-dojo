// Counting Pro: the part of card counting that is actually hard. Keeping the count is easy; playing
// perfect basic strategy, adding the index plays, sizing bets, and doing it all at table speed is the work.
//   #/play/counting            hub
//   #/play/counting/learn      roadmap, in the order that works
//   #/play/counting/dev        index-play flashcards (Illustrious 18, Fab 4)
//   #/play/counting/ramp       bet-sizing drill
//   #/play/counting/table      Count & Play: a real shoe, other players, bets, indices, count checks
//   #/play/counting/sim        does it pay? simulation on your table rules

import { countingTable } from '../games/countpro.js';
import { countSystems } from '../games/countsystems.js';
import { INDEX_RULES, activeRules, idxOf, tierName, RAMPS, rampUnits, edgeAtTC } from '../engine/indices.js';
import { cardSVG, makeCard } from '../ui/cards.js';
import { engine } from '../app/engine-client.js';
import { describeRules } from '../app/presets.js';
import { toast } from '../ui/hand.js';
import { rec } from '../app/weak.js';
import { say } from '../app/voice.js';

const sgn = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const upL = (u) => (u === 1 ? 'A' : String(u));
const ACT = { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split', R: 'Surrender' };
const back = (to = '#/play/counting', label = 'Counting Pro') => `<div class="topbar"><a class="back" href="${to}">‹ ${label}</a></div>`;
const link = (href, text) => `<a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:8px" href="${href}">${text}</a>`;

export default async function counting(el, parts, ctx) {
  const [sub] = parts;
  if (sub === 'learn') return learn(el);
  if (sub === 'dev') return devDrill(el, ctx);
  if (sub === 'ramp') return rampDrill(el, ctx);
  if (sub === 'table') return countingTable(el, ctx);
  if (sub === 'systems') return countSystems(el, ctx, 'systems');
  if (sub === 'aces') return countSystems(el, ctx, 'aces');
  if (sub === 'decks') return countSystems(el, ctx, 'decks');
  if (sub === 'sim') return simScreen(el, ctx);
  return hub(el, ctx);
}

// ---- hub ----------------------------------------------------------------------------------------------
function hub(el, ctx) {
  const st = (ctx.profile.counting ||= {}), d = st.dev, r = st.ramp, t = st.table;
  const pc = (s) => (s && s.n ? Math.round(s.c / s.n * 100) + '%' : '—');
  el.innerHTML = `${back('#/play', 'Play')}<h1>Counting Pro</h1>
    <p class="dim small" style="margin-top:0">Counting cards is the easy part: +1, 0, −1. What is hard is playing perfect basic strategy <i>and</i> the index plays, sizing your bets from the true count, and doing all of it at the speed of a real table while looking relaxed. This is the practice for that, in the order that works.</p>
    <a class="card link ok" href="#/play/counting/learn"><h3>The roadmap</h3><div class="small dim">What to learn first, what to ignore, how to practise, and what counting can and cannot do at the games you actually play.</div></a>
    <h2>Drills</h2>
    <a class="card link" href="#/play/counting/dev"><h3>Index plays <span class="dim num" style="float:right">${pc(d)}</span></h3><div class="small dim">The Illustrious 18 and Fab 4: given the hand and the true count, what is the play? Learn them in order of value.</div></a>
    <a class="card link" href="#/play/counting/ramp"><h3>Bet sizing <span class="dim num" style="float:right">${pc(r)}</span></h3><div class="small dim">True count in, bet out. The ramp is what actually makes the money; practise it until it is automatic.</div></a>
    <a class="card link" href="#/play/count"><h3>Count trainer</h3><div class="small dim">Card values, speed counting, a full-deck run, true-count conversion.</div></a>
    <a class="card link" href="#/play/counting/systems"><h3>Other counting systems</h3><div class="small dim">KO, Hi-Opt I, Zen, Omega II and Wong Halves: values, deck runs, and how each trades ease for accuracy.</div></a>
    <a class="card link" href="#/play/counting/decks"><h3>Deck estimation</h3><div class="small dim">Look at the discard tray and say how many decks are left. A bad estimate wrecks the true count.</div></a>
    <a class="card link" href="#/play/counting/aces"><h3>Ace side count</h3><div class="small dim">Track aces separately to sharpen your bets and insurance decisions.</div></a>
    <h2>Put it together</h2>
    <a class="card link" href="#/play/counting/table"><h3>Count & Play <span class="dim num" style="float:right">${t && t.hands ? t.hands + ' hands' : ''}</span></h3><div class="small dim">A real shoe with a cut card and other players. Size your bet before each hand, play it with the index plays, and get count checks as you go. Everything is graded.</div></a>
    <a class="card link" href="#/play/counting/sim"><h3>Does it pay?</h3><div class="small dim">Simulate hundreds of thousands of hands on your table rules, with and without a count, and see the edge, the swings and the risk of ruin. The honest answer, in numbers.</div></a>
    <div class="card"><b>Honest reminder.</b> Counting only helps at a real shoe that is dealt deep. A random-number (RNG) table or a continuous shuffler gives a counter nothing. At a live studio shoe with a shallow cut card the edge is small and the swings are big. Check the simulator before you believe any of it.</div>`;
}

// ---- roadmap -------------------------------------------------------------------------------------------
function learn(el) {
  const step = (n, title, body) => `<div class="card"><div class="row" style="gap:10px;align-items:flex-start"><div class="big num" style="min-width:34px;color:var(--ok)">${n}</div><div class="grow"><h3 style="margin:0 0 4px">${title}</h3><div class="small">${body}</div></div></div></div>`;
  el.innerHTML = `${back()}<h1>The roadmap</h1>
    <p class="dim small" style="margin-top:0">The most-liked advice from people who have done this: <i>“The counting is easy. It's playing perfect basic strategy, learning the deviations, and doing it all casually while you count that's super tough.”</i> So the order matters: do the hard part first, while it is still cheap to practise.</p>
    ${step(1, 'Perfect basic strategy, automatic', 'Not “mostly right”: automatic, in under a second. Every index play is a departure from a basic-strategy play you must already know cold. If you hesitate on 12 vs 3 you will never make 12 vs 3 at +2. Use the Lab and Drill until your accuracy is stuck above 98%.')}
    ${step(2, 'The Hi-Lo count', '2–6 are +1, 7–9 are 0, 10 J Q K A are −1. Drill card values until it is reflex, then the full-deck run: a deck always counts to 0, and under about 30 seconds is a good pace. Then count <b>pairs</b> of cards that cancel (a 5 and a King is zero, a 3 and a 4 is +2): faster than one at a time.')}
    ${step(3, 'Running count to true count', 'The running count means different things at different depths. A +6 with two decks left is a true count of +3. Divide by decks <i>left</i> (estimate to the nearest half deck from the discard tray). Floor it the same way every time.')}
    ${step(4, 'Bet sizing: the ramp', 'This is where the money is: you win by betting more when the count is high, not by playing differently. Common ramps are 1–4, 1–8, 1–12 units. Your bet at each true count is fixed in advance; the bet-sizing drill makes it automatic. Small bankroll rule of thumb: 200+ units for a 1–8 spread.')}
    ${step(5, 'Index plays, in order of value', 'Insurance at +3, 16 vs 10 stand at 0 or more, 15 vs 10 stand at +4, then the rest. The list is ranked: the first few carry most of the value. Learn four first, then add. The negative ones (13 vs 2, 12 vs 4/5/6, 13 vs 3) are the ones people forget: at low counts you hit hands basic strategy stands on.')}
    ${step(6, 'Speed and cover', 'A real table deals every card, including all the other players\' hands and hits, in seconds. You count those too. Practise with other players in Count & Play. “Casual” means: talk, bet naturally, keep a steady pace, never stare at the discard tray, and never act on a count when you are not sure of it. A wrong count with a big bet loses faster than no count.')}
    <h2>Where counting works (and where it does not)</h2>
    <div class="card small">
      <p style="margin-top:0"><b>Does not work:</b> any RNG table (every hand is a fresh shuffle), and any live game with a continuous shuffling machine (cards go back in constantly). The count tells you nothing.</p>
      <p><b>Can work, a little:</b> a live studio shoe that is dealt to a cut card. The edge depends on <b>penetration</b>: how much of the shoe is dealt before the shuffle. At 50% you can barely break even even with perfect play; at 75–85% you may get an edge of half a percent to one percent with a spread. Use the simulator to see your table's numbers.</p>
      <p><b>Also real:</b> the operator can refuse or limit you, many live tables reshuffle early, and the game may have rules that cost more than the count earns (6:5, no surrender, reduced doubles). Side bets are not helped by the Hi-Lo count.</p>
      <p style="margin-bottom:0"><b>The sober version:</b> counting is a skill worth learning for understanding the game and for live shoe games when the conditions are right. It is not income, and it is never a reason to raise your stakes beyond a bankroll you can afford to lose.</p></div>
    <h2>Practice plan</h2>
    <div class="card small"><b>Week 1:</b> card values and the deck run daily, 10 minutes; basic strategy stays above 98%.<br><b>Week 2:</b> true count conversions, bet sizing drill, Count & Play with no other players and the count shown.<br><b>Week 3:</b> index plays: insurance, 16 v 10, 15 v 10, 12 v 3, then the rest. Hide the count.<br><b>Week 4:</b> Count & Play with 3 other players, fast pace, count checks on. Aim to stay within ±1 at every check for a full shoe.</div>
    ${link('#/play/counting/dev', 'Drill the index plays')}${link('#/play/counting/table', 'Open Count & Play')}`;
}

// ---- index-play flashcards ---------------------------------------------------------------------------------
function devDrill(el, ctx) {
  const st = (ctx.profile.counting ||= {});
  const dv = (st.devCards ||= {});                    // rule id -> { n, c }
  let tiers = ['i18'], rules = ctx.rules, q = null, n = 0, ok = 0, streak = 0, busy = false;

  const pool = () => activeRules(rules, { tiers });
  function setup() {
    const surr = rules.surrender === 'late';
    el.innerHTML = `${back()}<h1>Index plays</h1>
      <p class="dim small" style="margin-top:0">A hand, the dealer's upcard and the <b>true count</b>. Pick the play. ${describeRules(rules)}</p>
      <div class="small dim">Which set</div>
      <div class="seg" id="t" style="margin:6px 0 10px"><button data-v="i18" class="${tiers.length === 1 && tiers[0] === 'i18' ? 'on' : ''}">Illustrious 18</button><button data-v="all" class="${tiers.length > 1 ? 'on' : ''}">+ Fab 4 &amp; extras</button></div>
      ${surr ? '' : '<p class="small dim">This table has no surrender, so the Fab 4 are left out. Change the rules in the Play tab to include them.</p>'}
      <div class="card"><b>The ${pool().length} plays in this set</b><div class="small dim" style="margin-top:6px">${pool().map((r) => `<span style="display:inline-block;margin:2px 8px 2px 0">${r.label} <b class="num">${sgn(idxOf(r, rules))}</b></span>`).join('')}</div>
        <p class="small dim" style="margin-bottom:0">Make the play when the true count is <b>at or above</b> the number; below it, play basic strategy (or, for the negative ones, hit).</p></div>
      <button class="btn primary block" id="go">Start</button>`;
    el.querySelectorAll('#t button').forEach((b) => b.onclick = () => { tiers = b.dataset.v === 'i18' ? ['i18'] : ['i18', 'fab4', 'x']; setup(); });
    el.querySelector('#go').onclick = () => { n = ok = streak = 0; next(); };
  }

  // Questions are drawn weighted toward the rules you miss.
  function make() {
    const list = pool();
    const w = list.map((r) => { const s = dv[r.id]; return s && s.n ? 1 + 3 * (1 - s.c / s.n) : 2; });
    let k = Math.random() * w.reduce((a, b) => a + b, 0), rule = list[0];
    for (let i = 0; i < list.length; i++) { k -= w[i]; if (k < 0) { rule = list[i]; break; } }
    const idx = idxOf(rule, rules);
    // True count near the index, often one either side, sometimes far
    const tc = idx + pick([-3, -2, -1, -1, 0, 0, 1, 1, 2, 3]);
    const cards = rule.kind === 'tt' ? [10, 10] : twoCards(rule.total);
    return { rule, idx, tc, cards, up: rule.up };
  }
  function twoCards(total) {
    const opts = [];
    for (let a = 2; a <= 10; a++) { const b = total - a; if (b > a && b <= 10) opts.push([a, b]); }
    return pick(opts).sort(() => Math.random() - 0.5);
  }

  function next() {
    q = make(); busy = false;
    const acts = [...new Set([q.rule.play, q.rule.below, 'H', 'S'])].filter((a) => !(a === 'D' && q.rule.play !== 'D' && false));
    const order = ['H', 'S', 'D', 'P', 'R'].filter((a) => acts.includes(a));
    el.innerHTML = `${back()}<div class="row" style="justify-content:flex-end"><span class="small dim num">${ok}/${n} · streak ${streak}</span></div>
      <div class="card" style="text-align:center"><div class="small dim">Dealer shows</div><div style="display:flex;justify-content:center;height:96px">${cardSVG(makeCard(q.up))}</div>
        <div class="small dim" style="margin-top:8px">You have</div><div style="display:flex;justify-content:center;height:96px">${q.cards.map((v) => cardSVG(makeCard(v))).join('')}</div>
        <div class="small dim" style="margin-top:8px">True count</div><div class="big num ${q.tc > 0 ? 'ok' : q.tc < 0 ? 'bad' : ''}">${sgn(q.tc) || '0'}</div></div>
      <div id="fb" style="min-height:70px"></div>
      <div class="actionbar" style="grid-template-columns:repeat(${order.length},1fr)">${order.map((a) => `<button class="act" data-a="${a}">${ACT[a]}</button>`).join('')}</div>`;
    el.querySelectorAll('.act').forEach((b) => b.onclick = () => answer(b.dataset.a));
  }

  async function answer(a) {
    if (busy) return; busy = true;
    const good = q.tc >= q.idx ? q.rule.play : q.rule.below;
    const right = a === good;
    n++; if (right) { ok++; streak++; } else streak = 0;
    const s = (dv[q.rule.id] ||= { n: 0, c: 0 }); s.n++; if (right) s.c++;
    const d = (st.dev ||= { n: 0, c: 0 }); d.n++; if (right) d.c++; rec(ctx, 'count:dev', q.rule.label, right); say(right ? 'Correct' : ACT[good]);
    ctx.save();
    el.querySelectorAll('.act').forEach((b) => { b.disabled = true; if (b.dataset.a === good) b.classList.add('was-right'); else if (b.dataset.a === a) b.classList.add('picked-bad'); });
    const why = q.tc >= q.idx ? `At ${sgn(q.tc) || '0'}, at or above the index of <b>${sgn(q.idx) || '0'}</b>: ${ACT[q.rule.play]}.` : `At ${sgn(q.tc) || '0'}, below the index of <b>${sgn(q.idx) || '0'}</b>: ${ACT[q.rule.below]}.`;
    el.querySelector('#fb').innerHTML = `<div class="verdict ${right ? 'ok' : 'bad'}"><div class="head ${right ? 'ok' : 'bad'}">${right ? 'Correct' : ACT[good] + ' — not ' + ACT[a]}</div><div class="small">${q.rule.label} (${tierName[q.rule.tier]}). ${why}</div></div>`;
    setTimeout(() => { if (el.isConnected) next(); }, right ? 700 : 2600);
  }

  setup();
  return () => { busy = true; };
}

// ---- bet-sizing drill -------------------------------------------------------------------------------------------
function rampDrill(el, ctx) {
  const st = (ctx.profile.counting ||= {});
  let ramp = st.ramp_id || '1-8', n = 0, ok = 0, streak = 0, q = null, busy = false;
  function setup() {
    el.innerHTML = `${back()}<h1>Bet sizing</h1>
      <p class="dim small" style="margin-top:0">Your bet is decided by the true count, before the cards come out. Pick a spread, then bet the right number of units for each count. <b>Counts of +1 or below are one unit.</b></p>
      <div class="seg" id="r" style="margin:6px 0 12px">${Object.entries(RAMPS).map(([k, v]) => `<button data-v="${k}" class="${ramp === k ? 'on' : ''}">${v.name}</button>`).join('')}</div>
      <div class="card"><b>Your ramp</b><table class="evtable" style="margin-top:6px"><tr><td>True count</td>${[1, 2, 3, 4, 5, 6, 7].map((t) => `<td class="num">${t === 1 ? '≤1' : t === 7 ? '7+' : t}</td>`).join('')}</tr><tr><td>Units</td>${[1, 2, 3, 4, 5, 6, 7].map((t) => `<td class="num"><b>${rampUnits(ramp, t)}</b></td>`).join('')}</tr></table>
        <p class="small dim" style="margin-bottom:0">Why it works: each +1 of true count is worth about <b>+0.5%</b> to the player. With a house edge near 0.5% the game is even at about +1, and every count above that is an edge you bet into.</p></div>
      <button class="btn primary block" id="go">Start</button>`;
    el.querySelectorAll('#r button').forEach((b) => b.onclick = () => { ramp = b.dataset.v; st.ramp_id = ramp; ctx.save(); setup(); });
    el.querySelector('#go').onclick = () => { n = ok = streak = 0; next(); };
  }
  function next() {
    busy = false;
    const tc = pick([-3, -2, -1, 0, 0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8]);
    q = { tc, units: rampUnits(ramp, tc) };
    const max = RAMPS[ramp].max;
    const opts = [...new Set([1, 2, 3, 4, 5, 6, 8, 10, 12].filter((u) => u <= max))];
    el.innerHTML = `${back()}<div class="row" style="justify-content:flex-end"><span class="small dim num">${ok}/${n} · streak ${streak}</span></div>
      <div class="card" style="text-align:center"><div class="small dim">True count</div><div class="big num ${tc > 0 ? 'ok' : tc < 0 ? 'bad' : ''}" style="font-size:54px">${sgn(tc) || '0'}</div><div class="small dim">${RAMPS[ramp].name} spread · how many units?</div></div>
      <div id="fb" style="min-height:60px"></div>
      <div class="actionbar" style="grid-template-columns:repeat(${Math.min(opts.length, 5)},1fr);gap:6px">${opts.map((u) => `<button class="act" data-u="${u}">${u}</button>`).join('')}</div>`;
    el.querySelectorAll('.act').forEach((b) => b.onclick = () => {
      if (busy) return; busy = true;
      const u = Number(b.dataset.u), right = u === q.units;
      n++; if (right) { ok++; streak++; } else streak = 0;
      const s = (st.ramp ||= { n: 0, c: 0 }); s.n++; if (right) s.c++; rec(ctx, 'count:ramp', 'TC ' + sgn(q.tc), right); ctx.save();
      el.querySelectorAll('.act').forEach((x) => { x.disabled = true; if (Number(x.dataset.u) === q.units) x.classList.add('was-right'); else if (x === b) x.classList.add('picked-bad'); });
      const edge = edgeAtTC(0.5, q.tc);
      el.querySelector('#fb').innerHTML = `<div class="verdict ${right ? 'ok' : 'bad'}"><div class="head ${right ? 'ok' : 'bad'}">${right ? 'Correct' : `${q.units} unit${q.units > 1 ? 's' : ''}`}</div><div class="small">At a true count of ${sgn(q.tc) || '0'} you hold roughly <b>${edge >= 0 ? '+' : '−'}${Math.abs(edge).toFixed(1)}%</b> against a 0.5% house edge. ${q.units === 1 ? (q.tc >= 2 ? '' : 'No edge: stay at the minimum.') : 'An edge: bet up.'}</div></div>`;
      setTimeout(() => { if (el.isConnected) next(); }, right ? 600 : 2200);
    });
  }
  setup();
  return () => { busy = true; };
}

// ---- does it pay? simulation ------------------------------------------------------------------------------------------
function simScreen(el, ctx) {
  let ramp = '1-8', pen = 0.75, dev = true, running = false;
  const rules = ctx.rules;
  function draw(res, err) {
    const fmt = (x, d = 2) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d);
    el.innerHTML = `${back()}<h1>Does it pay?</h1>
      <p class="dim small" style="margin-top:0">${describeRules(rules)}. One player, heads-up, a persistent shoe dealt to the cut card. 1,000,000 hands per run, using the same cards for a flat bettor and the counter.</p>
      <div class="small dim">Bet spread</div><div class="seg" id="r" style="margin:6px 0 10px">${Object.entries(RAMPS).map(([k, v]) => `<button data-v="${k}" class="${ramp === k ? 'on' : ''}">${v.name}</button>`).join('')}<button data-v="flat" class="${ramp === 'flat' ? 'on' : ''}">Flat</button></div>
      <div class="small dim">Penetration (shoe dealt before the shuffle)</div><div class="seg" id="p" style="margin:6px 0 10px">${[0.5, 0.65, 0.75, 0.85].map((v) => `<button data-v="${v}" class="${pen === v ? 'on' : ''}">${Math.round(v * 100)}%</button>`).join('')}</div>
      <div class="small dim">Index plays</div><div class="seg" id="d" style="margin:6px 0 10px"><button data-v="1" class="${dev ? 'on' : ''}">Illustrious 18 + Fab 4</button><button data-v="0" class="${!dev ? 'on' : ''}">Basic strategy only</button></div>
      <button class="btn primary block" id="go" ${running ? 'disabled' : ''}>${running ? 'Simulating…' : 'Run simulation'}</button>
      ${err ? `<p class="bad">${err}</p>` : ''}${res ? result(res) : ''}`;
    el.querySelectorAll('#r button').forEach((b) => b.onclick = () => { ramp = b.dataset.v; draw(res); });
    el.querySelectorAll('#p button').forEach((b) => b.onclick = () => { pen = Number(b.dataset.v); draw(res); });
    el.querySelectorAll('#d button').forEach((b) => b.onclick = () => { dev = b.dataset.v === '1'; draw(res); });
    el.querySelector('#go').onclick = run;

    function result(r) {
      const c = r.counter, f = r.flat, ci = 1.96 * c.se / Math.max(0.0001, r.avgUnits) * 100;
      const hrs = (r.hands / 100);   // hands per hour at ~100/hr heads-up pace is 200+, keep it simple: units per 100 hands
      const per100 = c.perHand * 100;
      const sig = c.edgePct - ci > 0 ? 'ok' : c.edgePct + ci < 0 ? 'bad' : 'due';
      const verdict = c.edgePct - ci > 0 ? 'A real edge in this simulation.' : c.edgePct + ci < 0 ? 'The house still wins here.' : 'Too close to call: within the noise at this many hands. A gain, if any, is tiny.';
      return `<div class="card" style="margin-top:12px"><h3>Result · ${r.params.ramp === 'flat' ? 'flat bet' : r.params.ramp + ' spread'}, ${Math.round(r.params.pen * 100)}% penetration</h3>
        <div class="row" style="gap:10px;flex-wrap:wrap"><div class="grow"><div class="small dim">Your edge</div><div class="big num ${sig}">${fmt(c.edgePct)}%</div><div class="small dim">±${ci.toFixed(2)}% (95%)</div></div>
          <div class="grow"><div class="small dim">Flat bettor, same cards and plays</div><div class="big num">${fmt(f.edgePct)}%</div></div></div>
        <p class="small"><b>${verdict}</b></p>
        <table class="evtable"><tr><td>Average bet</td><td class="num">${r.avgUnits.toFixed(2)} units</td></tr><tr><td>Hands where you bet above the minimum</td><td class="num">${Math.round(r.pctRaised * 100)}%</td></tr><tr><td>Expected per 100 hands</td><td class="num">${fmt(per100, 1)} units</td></tr><tr><td>Std deviation per hand</td><td class="num">${c.sd.toFixed(2)} units</td></tr><tr><td>Shuffles</td><td class="num">${r.shuffles}</td></tr><tr><td>Index plays made</td><td class="num">${r.devUsed.toLocaleString()}</td></tr></table></div>
        <div class="card"><h3>Risk of ruin</h3><p class="small dim" style="margin-top:0">Chance of losing the whole bankroll within 20,000 hands, by bankroll size (in units of your minimum bet):</p>
          <table class="evtable">${[50, 100, 200, 400].map((b) => `<tr><td>${b} units</td><td class="num ${r.ror[b] > 0.25 ? 'bad' : r.ror[b] < 0.05 ? 'ok' : ''}">${Math.round(r.ror[b] * 100)}%</td></tr>`).join('')}</table></div>
        <div class="card"><h3>Edge by true count</h3><p class="small dim" style="margin-top:0">The flat-bet result at each true count (when the hand started), the reason the ramp works:</p>
          <table class="evtable">${Object.keys(r.byTC).map(Number).sort((a, b) => a - b).map((k) => { const b = r.byTC[k], e = b.net / b.n * 100; return `<tr><td>TC ${k <= -6 ? '≤−6' : k >= 8 ? '≥+8' : sgn(k) || '0'} <span class="dim">(${(b.n / r.hands * 100).toFixed(0)}% of hands)</span></td><td class="num ${e > 0 ? 'ok' : 'bad'}">${fmt(e)}%</td></tr>`; }).join('')}</table></div>`;
    }
  }
  async function run() {
    running = true; draw(null);
    try {
      const res = await engine.countSim({ rules, hands: 1000000, pen, ramp, deviations: dev, seed: (Date.now() % 100000) + 1 });
      running = false; if (el.isConnected) draw(res);
    } catch (e) { running = false; if (el.isConnected) draw(null, 'Simulation failed: ' + (e.message || e)); }
  }
  draw(null);
  return () => { running = false; };
}
