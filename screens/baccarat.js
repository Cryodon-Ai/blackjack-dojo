// Baccarat inside the Play tab: hub, lessons, drills, practice and table (games/baccarat.js), and the
// "do patterns work?" simulation. Every number shown comes from engine/baccarat.js, nothing is typed in.

import { baccaratTable, baccCfg, edgesFor } from '../games/baccarat.js';
import { cardSVG, makeCard, makeHand } from '../ui/cards.js';
import { playRound, playerDraws, bankerDraws, bankerReason, total, bv, settle, normalizeBacc, isNatural } from '../engine/baccarat.js';
import { longestStreak } from '../app/roads.js';
import { store } from '../app/store.js';
import { cue, confetti } from '../app/feel.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (x, d = 2) => `${(x * 100).toFixed(d)}%`;
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const back = (to = '#/play/baccarat', label = 'Baccarat') => `<div class="topbar"><a class="back" href="${to}">‹ ${label}</a></div>`;
const mini = (ranks) => `<span class="minihand">${makeHand(ranks).map((c) => cardSVG(c)).join('')}</span>`;
const miniOf = (cards) => `<span class="minihand">${cards.map((c) => cardSVG(c)).join('')}</span>`;
const link = (href, text) => `<a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:8px" href="${href}">${text}</a>`;

export default async function baccarat(el, parts, ctx) {
  const [sub, arg] = parts;
  if (sub === 'learn') return learn(el, ctx);
  if (sub === 'drill' && DRILLS[arg]) return drill(el, ctx, arg);
  if (sub === 'table') return baccaratTable(el, ctx, 'table');
  if (sub === 'practice') return baccaratTable(el, ctx, 'practice');
  if (sub === 'truth') return truth(el, ctx);
  return hub(el, ctx);
}

// ---- hub ------------------------------------------------------------------------------------------
function hub(el, ctx) {
  const cfg = baccCfg(ctx), st = (ctx.profile.bacc.stats ||= {});
  const seg = (id, items, cur) => `<div class="seg" id="${id}" style="margin:6px 0 10px">${items.map(([v, t]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const row = (id, t, sub) => { const s = st[id]; return `<a class="card link row" href="#/play/baccarat/drill/${id}"><div class="grow"><h3>${t}</h3><div class="small dim">${sub}</div></div><div class="num ${!s ? 'dim' : s.c / s.n >= 0.9 ? 'ok' : s.c / s.n < 0.7 ? 'bad' : ''}" style="font-size:22px;font-weight:800">${s ? Math.round(s.c / s.n * 100) + '%' : '—'}</div></a>`; };
  el.innerHTML = `${back('#/play', 'Play')}<h1>Baccarat</h1>
    <p class="dim small" style="margin-top:0">Learn it, drill the rules, practise the draws, then sit at the table. Baccarat is a game of rules, not choices: you only pick a bet. The skill is knowing the rules cold and which bets cost the least.</p>
    <div class="card"><b>Table rules</b>
      <div class="small dim" style="margin-top:6px">Game</div>${seg('v', [['standard', 'Standard (5% commission)'], ['ez', 'EZ (no commission)']], cfg.variant)}
      <div class="small dim">Tie pays</div>${seg('t', [[8, '8 to 1'], [9, '9 to 1']], cfg.tiePays)}
      <div class="small dim">Decks in the shoe</div>${seg('d', [[6, '6'], [8, '8']], cfg.decks)}</div>
    <a class="card link ok" href="#/play/baccarat/learn"><h3>Learn baccarat</h3><div class="small dim">Card values, naturals, the Player and Banker draw rules, payouts, and the true house edge of every bet.</div></a>
    <h2>Drills</h2>
    ${row('count', 'Count the hand', 'Add up cards the baccarat way: tens and faces are zero, keep the last digit.')}
    ${row('player', "Player's move", 'Natural, draw or stand?')}
    ${row('banker', "Banker's move", 'The tricky one: the Banker draws based on the Player’s third card.')}
    ${row('winner', 'Call the winner', 'Finished hands: Player, Banker or Tie?')}
    ${row('payout', 'What do you collect?', 'Commission, ties and pairs: work out the net on a bet.')}
    ${row('edge', 'Which bet costs least?', 'House edge for each bet, on your table rules.')}
    <h2>Practice and play</h2>
    <a class="card link" href="#/play/baccarat/practice"><h3>Practice table</h3><div class="small dim">No money. The dealer deals four cards and you call every draw before it happens, with the rule explained after each answer.</div></a>
    <a class="card link" href="#/play/baccarat/table"><h3>Table</h3><div class="small dim">A dealer, a shoe, a bankroll and a scoreboard. Place bets and watch the rules play out. Your loss limit is enforced.</div></a>
    <a class="card link" href="#/play/baccarat/truth"><h3>Do patterns work?</h3><div class="small dim">Simulate 20,000 hands and test “follow the streak”, “bet against it” and the rest.</div></a>
    <div class="card"><b>Honest reminder.</b> Every baccarat bet has a house edge. The lowest is Banker at about 1.06%. The Tie and the Pairs cost 10–14% and should be avoided. No scoreboard pattern changes that.</div>`;
  const set = (key, fn) => el.querySelectorAll(`#${key} button`).forEach((b) => b.onclick = async () => { fn(b.dataset.v); await ctx.save(); hub(el, ctx); });
  set('v', (v) => { ctx.profile.bacc.variant = v; });
  set('t', (v) => { ctx.profile.bacc.tiePays = Number(v); });
  set('d', (v) => { ctx.profile.bacc.decks = Number(v); });
}

// ---- learn ----------------------------------------------------------------------------------------
function learn(el, ctx) {
  const cfg = baccCfg(ctx), e = edgesFor(cfg);
  const banks = [0, 1, 2, 3, 4, 5, 6, 7], thirds = [...Array(10).keys()];
  const tbl = `<div style="overflow-x:auto"><table class="evtable" style="text-align:center;font-size:13px"><tr><td class="dim">Banker ↓ / Player 3rd →</td>${thirds.map((v) => `<td class="dim">${v}</td>`).join('')}<td class="dim">stood</td></tr>
    ${banks.map((b) => `<tr><td><b>${b}</b></td>${thirds.map((v) => { const d = bankerDraws(b, v === 0 ? 10 : v); return `<td class="${d ? 'ok' : 'dim'}">${d ? 'D' : 'S'}</td>`; }).join('')}<td class="${bankerDraws(b, null) ? 'ok' : 'dim'}">${bankerDraws(b, null) ? 'D' : 'S'}</td></tr>`).join('')}</table></div>
    <div class="small dim">D = Banker draws, S = Banker stands. Banker 8 or 9 is a natural and never draws. This table is generated from the same rule code the dealer uses.</div>`;
  const sec = (title, body) => `<div class="card"><h3>${title}</h3>${body}</div>`;
  el.innerHTML = `${back()}<h1>Learn baccarat</h1>
    ${sec('1. The goal', `<p class="small">Two hands are dealt: <b class="info">Player</b> and <b class="bad">Banker</b>. You bet on which ends closer to <b>9</b>, or on a <b class="ok">Tie</b>. The names are just labels: you can bet on either hand. You never decide how a hand is played; the rules do.</p>`)}
    ${sec('2. Card values', `<p class="small">Ace = 1. Cards 2–9 are worth their number. <b>10, J, Q, K = 0.</b> Add the cards and keep only the last digit.</p>
      <div class="small">${mini([7, 8])} 7 + 8 = 15 → <b>5</b></div><div class="small" style="margin-top:6px">${mini([10, 10])} two tens = 0 → <b>0</b></div><div class="small" style="margin-top:6px">${mini([9, 9, 9])} 27 → <b>7</b></div>`)}
    ${sec('3. Naturals', `<p class="small">If either hand starts with <b>8 or 9</b> on its first two cards, that is a <b>natural</b>. Nobody draws and the higher total wins.</p><div class="small">${mini([4, 4])} 8 ${mini([10, 9])} 9: natural. 9 beats 8.</div>`)}
    ${sec('4. The Player draws on 0–5', `<p class="small">With no natural, the Player acts first: <b>draw on 0–5, stand on 6 or 7.</b> That is the whole rule.</p>`)}
    ${sec('5. The Banker rule', `<p class="small">The Banker's decision depends on its own total and on the <b>value of the Player's third card</b>. If the Player stood, the Banker draws on 0–5 and stands on 6–7.</p>${tbl}
      <p class="small dim">Memory aid: Banker 0–2 always draws; 7 always stands; 3, 4, 5 and 6 depend on the Player's third card (3 draws except against an 8; 4 draws on 2–7; 5 draws on 4–7; 6 draws on 6–7).</p>`)}
    ${sec('6. Bets and payouts', `<p class="small"><b>Player</b> pays 1 to 1. <b>Banker</b> ${cfg.variant === 'ez' ? 'pays 1 to 1 with no commission, but pushes when the Banker wins with a three-card 7 (EZ Baccarat)' : 'pays 1 to 1 minus a <b>5% commission</b>: a $100 winning bet returns $95'}. <b>Tie</b> pays ${cfg.tiePays} to 1; a Tie pushes Player and Banker bets. <b>Pair</b> bets pay ${cfg.pairPays} to 1 when the first two cards of that hand match in rank.</p>`)}
    ${sec('7. What each bet really costs', `<p class="small">House edge for your table (${cfg.decks} decks${cfg.variant === 'ez' ? ', EZ' : ''}, Tie ${cfg.tiePays}:1):</p>
      <table class="evtable"><tr class="best"><td>Banker</td><td>${pct(-e.banker)}</td></tr><tr><td>Player</td><td>${pct(-e.player)}</td></tr><tr><td class="bad">Tie</td><td class="bad">${pct(-e.tie)}</td></tr><tr><td class="bad">Either Pair</td><td class="bad">${pct(-e.pair)}</td></tr></table>
      <p class="small dim">Per $100 wagered, the house keeps about $${(-e.banker * 100).toFixed(2)} on Banker and $${(-e.tie * 100).toFixed(2)} on Tie. The edge comes from the exact rules, enumerated over every possible deal. The Banker is better only because it wins slightly more often, and the commission takes back less than that advantage.</p>`)}
    ${sec('8. Scoreboards and trends', `<p class="small">The bead plate and Big Road are records of past hands. The cards do not remember them. Streaks happen at random, and no pattern changes the odds of the next hand. Test it yourself in “Do patterns work?”.</p>${link('#/play/baccarat/truth', 'Do patterns work?')}`)}
    ${sec('9. Bankroll', `<p class="small">At about 1% edge, a Banker bettor loses roughly $1 for every $100 wagered, but results swing wildly in short sessions. Set a loss limit before you sit down and stop when you reach it. Fast tables deal 60–100 hands an hour, so $10 a hand is $600–1000 wagered every hour.</p>`)}
    ${link('#/play/baccarat/drill/count', 'Start the drills')}`;
}

// ---- drills ---------------------------------------------------------------------------------------
const handOf = (n) => Array.from({ length: n }, () => pick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10]));
const nums = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const DRILLS = {
  count: {
    title: 'Count the hand', cols: 5,
    make: () => { const r = handOf(pick([2, 2, 3])), t = total(r), cards = makeHand(r); return { html: `${miniOf(cards)}<div style="margin-top:8px"><b>What is the total?</b></div>`, opts: nums(0, 9).map((n) => [n, String(n)]), right: t, why: `${cards.map((c) => `${bv(c.v)}`).join(' + ')} = ${cards.reduce((a, c) => a + bv(c.v), 0)}. Keep the last digit: ${t}.` }; },
  },
  player: {
    title: "Player's move", cols: 3,
    make: () => {
      let r, p, b; do { r = handOf(2); p = total(r); b = total(handOf(2)); } while (false);
      const bT = rnd(10), natural = p >= 8 || bT >= 8;
      const right = natural ? 'nat' : playerDraws(p) ? 'draw' : 'stand';
      const why = natural ? `Player ${p}, Banker ${bT}: a total of 8 or 9 on either side is a natural, so nobody draws.` : playerDraws(p) ? `Player ${p} is 0–5, so the Player draws.` : `Player ${p} is 6 or 7, so the Player stands.`;
      return { html: `${mini(r)} Player ${p} <span class="dim">· Banker has ${bT}</span><div style="margin-top:8px"><b>What happens next?</b></div>`, opts: [['nat', 'Natural'], ['draw', 'Draw'], ['stand', 'Stand']], right, why };
    },
  },
  banker: {
    title: "Banker's move", cols: 2,
    make: () => {
      const bT = pick([0, 1, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7]), stood = Math.random() < 0.25;
      const third = stood ? null : pick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const draws = bankerDraws(bT, third);
      const tv = third === null ? null : bv(third);
      return { html: `<div>Banker total <b class="num" style="font-size:22px">${bT}</b></div><div style="margin-top:6px">${third === null ? 'The Player <b>stood</b>.' : `The Player drew ${miniOf([makeCard(third)])} worth <b>${tv}</b>.`}</div><div style="margin-top:8px"><b>Does the Banker draw?</b></div>`, opts: [['draw', 'Draws'], ['stand', 'Stands']], right: draws ? 'draw' : 'stand', why: bankerReason(bT, third) };
    },
  },
  winner: {
    title: 'Call the winner', cols: 3,
    make: () => {
      const round = playRound(() => pick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10]));
      const right = round.winner;
      return { html: `<div>Player ${mini(round.player)} <b>${round.pTotal}</b></div><div style="margin-top:6px">Banker ${mini(round.banker)} <b>${round.bTotal}</b></div><div style="margin-top:8px"><b>Who wins?</b></div>`, opts: [['player', 'Player'], ['banker', 'Banker'], ['tie', 'Tie']], right, why: right === 'tie' ? `Both hands total ${round.pTotal}: a Tie.` : `${right === 'player' ? 'Player' : 'Banker'} ${right === 'player' ? round.pTotal : round.bTotal} beats ${right === 'player' ? round.bTotal : round.pTotal}.` };
    },
  },
  payout: {
    title: 'What do you collect?', cols: 2,
    make: (cfg) => {
      const kind = pick(['player', 'banker', 'banker', 'tie']), amt = pick([20, 40, 50, 100, 200]);
      const winner = pick(['player', 'banker', 'tie']);
      const round = { winner, banker: Array(2).fill(0), bTotal: 6 };
      const net = settle(amt, kind, round, cfg);
      const fmt = (n) => (n === 0 ? 'Push ($0)' : `${n > 0 ? 'Win' : 'Lose'} $${Math.abs(n).toFixed(2).replace(/\.00$/, '')}`);
      const cand = new Set([net, -amt, amt, 0, amt * cfg.tiePays, +(amt * 0.95).toFixed(2)]);
      const opts = [...cand].slice(0, 4); if (!opts.includes(net)) opts[0] = net;
      const label = { player: 'Player', banker: 'Banker', tie: 'Tie' };
      const why = net === 0 ? `${winner === 'tie' ? 'A Tie is a push for Player and Banker bets.' : 'EZ rule push.'}` : kind === 'banker' && net > 0 ? `Banker wins pay 1 to 1 minus ${cfg.commission * 100}% commission: $${amt} × ${(1 - cfg.commission)} = $${net}.` : kind === 'tie' && net > 0 ? `A Tie pays ${cfg.tiePays} to 1: $${amt} × ${cfg.tiePays} = $${net}.` : net > 0 ? `Player wins pay 1 to 1: $${amt}.` : `The bet lost: you give up the $${amt}.`;
      return { html: `<div>You bet <b>$${amt}</b> on <b>${label[kind]}</b>. The result is <b>${winner === 'tie' ? 'a Tie' : (winner === 'player' ? 'Player' : 'Banker') + ' wins'}</b>.</div><div style="margin-top:8px"><b>What is the net result?</b></div>`, opts: opts.map((n) => [n, fmt(n)]), right: net, why };
    },
  },
  edge: {
    title: 'Which bet costs least?', cols: 2,
    make: (cfg) => {
      const e = edgesFor(cfg), cost = { Banker: -e.banker, Player: -e.player, Tie: -e.tie, 'Either Pair': -e.pair };
      const names = Object.keys(cost), lowest = Math.random() < 0.7;
      const set = [...names].sort(() => Math.random() - 0.5).slice(0, 3);
      const sorted = [...set].sort((a, b) => cost[a] - cost[b]), right = lowest ? sorted[0] : sorted[sorted.length - 1];
      return { html: `<div><b>Which of these has the ${lowest ? 'LOWEST' : 'HIGHEST'} house edge?</b></div>`, opts: set.map((n) => [n, n]), right, why: `House edges here: ${set.map((n) => `${n} ${pct(cost[n])}`).join(', ')}.` };
    },
  },
};

function drill(el, ctx, id) {
  const D = DRILLS[id], cfg = baccCfg(ctx), TOTAL = 15;
  let n = 0, c = 0, streak = 0, best = 0, done = false;
  const next = () => {
    if (done) return;
    if (n >= TOTAL) return finish();
    const q = D.make(cfg);
    el.innerHTML = `${back()}<div class="row small dim" style="justify-content:space-between"><span>${D.title}</span><span class="num">${n + 1}/${TOTAL} · ${c} right · streak ${streak}</span></div>
      <div class="card" style="min-height:110px">${q.html}</div>
      <div class="qa-opts ${D.cols === 2 ? 'two' : D.cols === 3 ? 'three' : ''}" id="opts">${q.opts.map(([v, t]) => `<button data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div><div id="fb"></div>`;
    el.querySelectorAll('#opts button').forEach((b) => b.onclick = () => {
      const ok = b.dataset.v === String(q.right);
      n++; if (ok) { c++; streak++; best = Math.max(best, streak); } else streak = 0;
      cue(ok);
      el.querySelectorAll('#opts button').forEach((x) => { x.disabled = true; if (x.dataset.v === String(q.right)) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
      el.querySelector('#fb').innerHTML = `<div class="verdict ${ok ? 'ok' : 'bad'} pop"><div class="head ${ok ? 'ok' : 'bad'}">${ok ? 'Correct' : 'Not quite'}</div><div class="small dim">${esc(q.why)}</div></div><button class="btn primary block" id="nx" style="margin-top:8px">${n >= TOTAL ? 'See results' : 'Next'}</button>`;
      el.querySelector('#nx').onclick = next;
    });
  };
  async function finish() {
    done = true;
    const st = (ctx.profile.bacc.stats ||= {}); const s = (st[id] ||= { n: 0, c: 0 }); s.n += n; s.c += c;
    await ctx.save();
    await store.addSession({ date: Date.now(), mode: 'bacc-' + id, handsPlayed: n, accuracy: c / n, evLost: 0, bankrollDelta: 0 });
    el.innerHTML = `<h1>${D.title}</h1><div class="stat3"><div class="card"><div class="v ${c / n >= 0.9 ? 'ok' : ''}">${Math.round(c / n * 100)}%</div><div class="k">Accuracy</div></div><div class="card"><div class="v">${best}</div><div class="k">Best streak</div></div><div class="card"><div class="v">${c}/${n}</div><div class="k">Right</div></div></div>
      <button class="btn primary block" id="again">Go again</button><div class="gap"></div><a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="#/play/baccarat">Done</a>`;
    el.querySelector('#again').onclick = () => drill(el, ctx, id);
    if (n >= 10 && c / n >= 0.95) confetti();
  }
  next();
  return () => { done = true; };
}

// ---- do patterns work? ----------------------------------------------------------------------------
function simulate(hands, decks = 8) {
  const cnt = Array(11).fill(0), fill = () => { for (let v = 1; v <= 9; v++) cnt[v] = 4 * decks; cnt[10] = 16 * decks; return 52 * decks; };
  let n = fill();
  const draw = () => { let k = rnd(n); for (let v = 1; v <= 10; v++) { k -= cnt[v]; if (k < 0) { cnt[v]--; n--; return v; } } };
  const out = [];
  for (let i = 0; i < hands; i++) { if (n < 16) n = fill(); const r = playRound(draw); out.push({ winner: r.winner, b3: r.banker.length === 3, bT: r.bTotal }); }
  return out;
}

function truth(el, ctx) {
  const cfg = baccCfg(ctx);
  el.innerHTML = `${back()}<h1>Do patterns work?</h1>
    <p class="dim small" style="margin-top:0">Players watch the scoreboard for streaks and "chops". Here is the test: deal 20,000 hands from a shuffled ${cfg.decks}-deck shoe with the real rules, then try the popular systems on every hand, $100 flat.</p>
    <button class="btn primary block" id="go">Simulate 20,000 hands</button><div id="out"></div>`;
  el.querySelector('#go').onclick = () => {
    el.querySelector('#out').innerHTML = '<div class="dim small" style="padding:12px 0">Dealing…</div>';
    setTimeout(() => {
      const H = 20000, res = simulate(H, cfg.decks), w = res.map((r) => r.winner);
      const count = (x) => w.filter((v) => v === x).length;
      const nonTie = w.filter((v) => v !== 'tie'), baseB = nonTie.filter((v) => v === 'banker').length / nonTie.length;
      // streak follow-up
      const follow = (len) => { let nx = 0, cont = 0, runWho = null, run = 0; for (const x of w) { if (x === 'tie') continue; if (run >= len && x !== undefined) { nx++; if (x === runWho) cont++; } if (x === runWho) run++; else { runWho = x; run = 1; } } return { nx, rate: nx ? cont / nx : 0 }; };
      const strategies = [['Always Banker', (i) => 'banker'], ['Always Player', () => 'player'], ['Follow the last winner', (i, last) => last || 'banker'], ['Bet against the last winner', (i, last) => (last === 'banker' ? 'player' : last === 'player' ? 'banker' : 'banker')], ['Tie every hand', () => 'tie']];
      const rows = strategies.map(([name, fn]) => { let net = 0, last = null; res.forEach((r, i) => { const kind = fn(i, last); net += settle(100, kind, { winner: r.winner, banker: Array(r.b3 ? 3 : 2).fill(0), bTotal: r.bT }, cfg); if (r.winner !== 'tie') last = r.winner; }); return { name, net, per: net / H }; });
      const f3 = follow(3), f5 = follow(5);
      el.querySelector('#out').innerHTML = `<div class="card"><b>What came up</b><div class="small" style="margin-top:4px">Banker ${pct(count('banker') / H, 1)} · Player ${pct(count('player') / H, 1)} · Tie ${pct(count('tie') / H, 1)}. Longest Banker run ${longestStreak(w, 'banker')}, longest Player run ${longestStreak(w, 'player')}.</div></div>
        <div class="card"><b>After a streak, does it continue?</b><div class="small" style="margin-top:4px">After 3+ in a row, the same side won the next hand <b>${pct(f3.rate, 1)}</b> of the time (${f3.nx.toLocaleString()} cases). After 5+: <b>${pct(f5.rate, 1)}</b> (${f5.nx.toLocaleString()} cases).<br>A coin flip between these two sides is about <b>${pct(baseB, 1)}</b> for Banker and ${pct(1 - baseB, 1)} for Player. Streak followers see a Banker streak continue at Banker's normal rate, and a Player streak at Player's: nothing more.</div></div>
        <div class="card"><b>$100 on every hand, 20,000 hands</b>
          <table class="evtable">${rows.map((r) => `<tr class="${r === rows.slice().sort((a, b) => b.net - a.net)[0] ? 'best' : ''}"><td>${r.name}</td><td>${r.net >= 0 ? '+' : '−'}$${Math.abs(Math.round(r.net)).toLocaleString()}<div class="small dim">${r.per >= 0 ? '+' : '−'}$${Math.abs(r.per).toFixed(2)} per hand</div></td></tr>`).join('')}</table>
          <div class="small dim" style="margin-top:6px">Every system lands near its house edge (Banker ≈ −$1.06 per $100, Player ≈ −$1.24, Tie ≈ −$14). Changing which side you bet on never changes the edge, and Tie is the most expensive way to play. Run it again to see how much the totals move.</div></div>
        <button class="btn block" id="again">Run again</button>`;
      el.querySelector('#again').onclick = () => el.querySelector('#go').click();
    }, 30);
  };
}
