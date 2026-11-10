// Poker drills: each is a 15-question multiple-choice round with an explanation after every answer.
// Every correct answer is computed by engine/poker.js (evaluator, equity, ranges); nothing is typed in by hand.

import { evaluate, describeHand, categoryName, categoryOf, freshDeck, shuffle, equity, outs, classLabel, RFI, RANKS, rangePct, openAction, facingRaise, parseCards, cardStr, rankOf, suitOf, potOddsNeeded, POSITIONS, ALL_CLASSES, classCombos, parseRange } from '../engine/poker.js';
import { pcards, ensurePokerCSS } from '../ui/pokercards.js';
import { cue, confetti } from '../app/feel.js';
import { store } from '../app/store.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const pct = (x) => `${Math.round(x * 100)}%`;
const deal = (n, exclude = []) => shuffle(freshDeck(exclude)).slice(0, n);
const SUITSYM = ['♠', '♥', '♦', '♣'];
const shuf = (a) => a.sort(() => Math.random() - 0.5);

function near(truth, step, spread) {
  const base = Math.round(truth / step) * step, set = new Set([base]);
  let k = 1;
  while (set.size < 4) { const d = k * step; if (base + d <= 99) set.add(base + d); if (set.size < 4 && base - d >= 1) set.add(base - d); k++; }
  return shuf([...set]);
}

export const DRILLS = {
  rank: {
    title: 'Who wins?', sub: 'Two hands, one board. Which hand wins, or is it a split?', cols: 3,
    make: () => {
      for (;;) {
        const c = deal(9), board = c.slice(0, 5), a = c.slice(5, 7), b = c.slice(7, 9);
        const sa = evaluate([...a, ...board]), sb = evaluate([...b, ...board]);
        if (Math.random() < 0.2 && sa !== sb) continue;   // keep some ties out; ties arise naturally rarely
        const right = sa > sb ? 'a' : sb > sa ? 'b' : 'tie';
        return { html: `<div class="small dim">Board</div>${pcards(board)}<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:8px"><div><div class="small dim">Hand A</div>${pcards(a)}</div><div><div class="small dim">Hand B</div>${pcards(b)}</div></div><div style="margin-top:8px"><b>Which hand wins?</b></div>`, opts: [['a', 'Hand A'], ['b', 'Hand B'], ['tie', 'Split']], right, why: `A makes <b>${describeHand(sa)}</b>; B makes <b>${describeHand(sb)}</b>. ${right === 'tie' ? 'The same five cards: split pot.' : (right === 'a' ? 'A' : 'B') + ' wins.'}` };
      }
    },
  },
  name: {
    title: 'Name your hand', sub: 'Seven cards: what is the best hand you can make?', cols: 2,
    make: () => {
      const c = deal(7), hole = c.slice(0, 2), board = c.slice(2), s = evaluate(c), cat = categoryOf(s);
      const names = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
      const set = new Set([names[cat]]); while (set.size < 4) set.add(pick(names.slice(0, 7)));
      return { html: `<div class="small dim">Your cards</div>${pcards(hole)}<div class="small dim" style="margin-top:6px">Board</div>${pcards(board)}<div style="margin-top:8px"><b>Your best five-card hand is…</b></div>`, opts: shuf([...set]).map((n) => [n, n]), right: names[cat], why: `${describeHand(s)}.` };
    },
  },
  outs: {
    title: 'Count your outs', sub: 'How many cards make you two pair or better (or a straight or flush)?', cols: 4,
    make: () => {
      for (let i = 0; i < 3000; i++) {
        const c = deal(5), hole = c.slice(0, 2), board = c.slice(2);
        const o = outs(hole, board);
        const big = o.outs.filter((x) => categoryOf(evaluate([...hole, ...board, x])) >= 4).length;
        if (big < 4 || o.count > 15 || categoryOf(evaluate([...hole, ...board])) > 1) continue;
        const groups = {};
        for (const x of o.outs) { const n = categoryName(evaluate([...hole, ...board, x])); (groups[n] ||= []).push(x); }
        const why = Object.entries(groups).map(([n, a]) => `${n}: ${a.length} (${a.slice(0, 9).map((x) => RANKS[rankOf(x) - 2] + SUITSYM[suitOf(x)]).join(' ')}${a.length > 9 ? ' …' : ''})`).join('<br>');
        return { html: `<div class="small dim">Your cards</div>${pcards(hole)}<div class="small dim" style="margin-top:6px">Flop</div>${pcards(board)}<div style="margin-top:8px"><b>How many outs?</b></div>`, opts: near(o.count, 1).map((n) => [n, String(n)]), right: o.count, why: `Currently ${o.now}. ${o.count} outs:<br>${why}<br><span class="dim">Rule of 4: about ${Math.min(99, o.count * 4)}% to hit by the river.</span>` };
      }
      return DRILLS.outs.make();
    },
  },
  odds: {
    title: 'Pot odds', sub: 'The price of a call, and whether it is worth it.', cols: 2,
    make: () => {
      if (Math.random() < 0.5) {
        const P = pick([6, 8, 10, 12, 15, 20, 24, 30, 40]), f = pick([1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 1.5, 2]), B = P * f, need = B / (P + 2 * B);
        return { html: `<div>The pot is <b>${P}</b> big blinds. Your opponent bets <b>${Math.round(B * 10) / 10}</b>.</div><div style="margin-top:8px"><b>What equity do you need to call?</b></div>`, opts: near(need * 100, 5).map((n) => [n, n + '%']), right: Math.round(need * 100 / 5) * 5, why: `You call ${Math.round(B * 10) / 10} to win ${P} + ${Math.round(B * 10) / 10} = ${Math.round((P + B) * 10) / 10}. The total pot would be ${Math.round((P + 2 * B) * 10) / 10}, so you need ${Math.round(B * 10) / 10} ÷ ${Math.round((P + 2 * B) * 10) / 10} = <b>${(need * 100).toFixed(1)}%</b>.` };
      }
      for (;;) {
        const flop = Math.random() < 0.6, o = pick([4, 6, 8, 9, 12, 15]), P = pick([10, 12, 16, 20, 30]), f = pick([1 / 3, 1 / 2, 2 / 3, 1]), B = P * f, need = B / (P + 2 * B);
        const eq = flop ? 1 - ((47 - o) * (46 - o)) / (47 * 46) : o / 46;
        if (Math.abs(eq - need) < 0.035) continue;
        const call = eq > need;
        return { html: `<div>You have <b>${o} outs</b> on the <b>${flop ? 'flop' : 'turn'}</b>. The pot is ${P}, they bet ${Math.round(B * 10) / 10}. <span class="dim">(No implied odds: judge by the numbers.)</span></div><div style="margin-top:8px"><b>Call or fold?</b></div>`, opts: [['call', 'Call'], ['fold', 'Fold']], right: call ? 'call' : 'fold', why: `You need ${(need * 100).toFixed(0)}%. ${o} outs ${flop ? '×4 ≈ ' + Math.min(99, o * 4) : '×2 ≈ ' + o * 2}% (exactly ${(eq * 100).toFixed(0)}%). ${call ? 'You have enough equity: call.' : 'Not enough: fold.'}` };
      }
    },
  },
  preflop: {
    title: 'Preflop: raise or fold', sub: 'Unopened pot, 100bb. Standard opening ranges by seat.', cols: 2,
    make: () => {
      const pos = pick(['UTG', 'HJ', 'CO', 'BTN', 'SB']), order = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];
      const next = order[Math.min(order.length - 1, order.indexOf(pos) + 1)], prev = order[Math.max(0, order.indexOf(pos) - 1)];
      const pool = Math.random() < 0.7 ? [...new Set([...RFI[pos], ...RFI[next]].filter((l) => !(RFI[prev].has(l) && RFI[pos].has(l) && Math.random() < 0.7)))] : ALL_CLASSES;
      const label = pick(pool), ok = openAction(label, pos) === 'raise';
      const hole = pick(classCombos(label));
      const lead = ['UTG', 'HJ', 'CO', 'BTN', 'SB'].indexOf(pos);
      return { html: `<div>You are in the <b>${pos}</b>. Everyone folds to you.</div><div style="margin:8px 0">${pcards(hole)}<b style="margin-left:6px">${label}</b></div><div><b>Raise or fold?</b></div>`, opts: [['raise', 'Raise'], ['fold', 'Fold']], right: ok ? 'raise' : 'fold', why: `${label} ${ok ? 'is inside' : 'is outside'} the standard ${pos} range of about ${pct(rangePct(RFI[pos]))} of hands. ${ok ? '' : RFI[order[Math.min(4, lead + 1)]].has(label) && pos !== 'SB' ? `It becomes a raise one seat later (${next}).` : ''}` };
    },
  },
  vsraise: {
    title: 'Preflop: facing a raise', sub: 'Someone raised. 3-bet, call or fold?', cols: 3,
    make: () => {
      const pos = pick(['CO', 'BTN', 'SB', 'BB', 'BB']), openers = { CO: ['UTG', 'HJ'], BTN: ['UTG', 'HJ', 'CO'], SB: ['UTG', 'HJ', 'CO', 'BTN'], BB: ['UTG', 'HJ', 'CO', 'BTN', 'SB'] }[pos], op = pick(openers);
      const label = pick(ALL_CLASSES.filter((l) => facingRaise(l, pos, op) !== 'fold' || Math.random() < 0.25));
      const a = facingRaise(label, pos, op), hole = pick(classCombos(label));
      const nm = { '3bet': '3-bet (re-raise)', call: 'Call', fold: 'Fold' };
      return { html: `<div>${op} raises to 3bb. You are in the <b>${pos}</b>.</div><div style="margin:8px 0">${pcards(hole)}<b style="margin-left:6px">${label}</b></div><div><b>What do you do?</b></div>`, opts: [['3bet', '3-bet'], ['call', 'Call'], ['fold', 'Fold']], right: a, why: `${label} against a raise from ${op}: <b>${nm[a]}</b>. ${a === '3bet' ? 'A premium hand (or a suited-ace bluff): re-raise.' : a === 'call' ? 'Good enough to call, not strong enough to re-raise.' : 'Too weak to continue against this raise.'}` };
    },
  },
  equity: {
    title: 'Estimate your equity', sub: 'How often does your hand win? (Computed by simulation.)', cols: 4,
    make: () => {
      const preflop = Math.random() < 0.55, opps = [['a random hand', null], ['a pair of kings', 'KK'], ['A-K', 'AKo'], ['a pair of sevens', '77'], ['K-Q suited', 'KQs']];
      const [oname, olab] = pick(opps), heroL = pick(['AA', 'QQ', 'JJ', '99', '55', 'AKs', 'AQo', 'KQs', 'JTs', '76s', 'A5s', 'KJo', 'T9o', '22']);
      let hero, opp, board = [];
      for (let i = 0; i < 50; i++) {
        hero = pick(classCombos(heroL)); opp = olab ? pick(classCombos(olab)) : null;
        if (opp && opp.some((c) => hero.includes(c))) continue;
        break;
      }
      if (opp && opp.some((c) => hero.includes(c))) return DRILLS.equity.make();
      if (!preflop) board = deal(3, [...hero, ...(opp || [])]);
      const e = equity(hero, board, [opp || null], 5000).equity * 100;
      return { html: `<div class="small dim">You</div>${pcards(hero)}${board.length ? `<div class="small dim" style="margin-top:6px">Flop</div>${pcards(board)}` : ''}<div style="margin-top:8px">Against <b>${oname}</b>${opp ? ` ${pcards(opp)}` : ''}${board.length ? '' : ' (before the flop)'}: <b>about what percent do you win?</b> <span class="dim">(split pots count half)</span></div>`, opts: near(e, 10).map((n) => [n, n + '%']), right: Math.round(e / 10) * 10, why: `About <b>${e.toFixed(0)}%</b>. Heads-up, a pair against two overcards is a coin flip (about 55–45); a dominated hand like A-Q against A-K has only about 25%.` };
    },
  },
  position: {
    title: 'Positions', sub: 'Seats, order of action and why it matters.', cols: 2,
    make: () => {
      const Q = [
        { q: 'Who acts <b>last</b> after the flop?', a: 'Button', o: ['Button', 'Big blind', 'Small blind', 'Under the gun'], w: 'The button acts last on the flop, turn and river: the best seat.' },
        { q: 'Who acts <b>first</b> on the flop (when everyone is still in)?', a: 'Small blind', o: ['Small blind', 'Button', 'Big blind', 'Cutoff'], w: 'The first live player left of the button: the small blind.' },
        { q: 'Who acts <b>first</b> preflop at a six-player table?', a: 'Under the gun', o: ['Under the gun', 'Small blind', 'Big blind', 'Button'], w: 'Preflop, action starts left of the big blind: under the gun.' },
        { q: 'Which seat is the <b>cutoff</b>?', a: 'Right of the button', o: ['Right of the button', 'Left of the button', 'Left of the big blind', 'Left of the small blind'], w: 'The cutoff is one seat to the right of the button, so it acts just before it.' },
        { q: 'You are on the button. Everyone folds to you. The seats left to act are…', a: 'Small blind and big blind', o: ['Small blind and big blind', 'Nobody', 'Only the big blind', 'Under the gun'], w: 'Only the two blinds remain, which is why the button opens so wide.' },
        { q: 'Which seat should play the <b>tightest</b> range?', a: 'Under the gun', o: ['Under the gun', 'Button', 'Cutoff', 'Big blind'], w: 'Five players still act behind under-the-gun, and you will be out of position after the flop.' },
        { q: 'Who acts <b>last preflop</b> (when nobody raises)?', a: 'Big blind', o: ['Big blind', 'Button', 'Small blind', 'Cutoff'], w: 'The big blind acts last preflop: they get the option to check or raise.' },
        { q: 'Why is the button the most profitable seat?', a: 'You act last after the flop', o: ['You act last after the flop', 'You pay no blind and get better cards', 'You act first preflop', 'The dealer chooses your cards'], w: 'Acting last gives you information before every decision on every street.' },
      ];
      const x = pick(Q);
      return { html: `<div>${x.q}</div>`, opts: shuf([...x.o]).map((n) => [n, n]), right: x.a, why: x.w };
    },
  },
};

export function pokerDrill(el, ctx, id) {
  ensurePokerCSS();
  const D = DRILLS[id], TOTAL = 15;
  let n = 0, c = 0, streak = 0, best = 0, done = false;
  const next = () => {
    if (done) return;
    if (n >= TOTAL) return finish();
    const q = D.make();
    el.innerHTML = `<div class="topbar"><a class="back" href="#/play/poker/drills">‹ Drills</a></div><div class="row small dim" style="justify-content:space-between"><span>${D.title}</span><span class="num">${n + 1}/${TOTAL} · ${c} right · streak ${streak}</span></div>
      <div class="card" style="min-height:110px">${q.html}</div>
      <div class="qa-opts ${D.cols === 2 ? 'two' : D.cols === 3 ? 'three' : ''}" id="opts">${q.opts.map(([v, t]) => `<button data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div><div id="fb"></div>`;
    el.querySelectorAll('#opts button').forEach((b) => b.onclick = () => {
      const ok = b.dataset.v === String(q.right);
      n++; if (ok) { c++; streak++; best = Math.max(best, streak); } else streak = 0;
      cue(ok);
      el.querySelectorAll('#opts button').forEach((x) => { x.disabled = true; if (x.dataset.v === String(q.right)) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
      el.querySelector('#fb').innerHTML = `<div class="verdict ${ok ? 'ok' : 'bad'} pop"><div class="head ${ok ? 'ok' : 'bad'}">${ok ? 'Correct' : 'Not quite'}</div><div class="small dim">${q.why}</div></div><button class="btn primary block" id="nx" style="margin-top:8px">${n >= TOTAL ? 'See results' : 'Next'}</button>`;
      el.querySelector('#nx').onclick = next;
    });
  };
  async function finish() {
    done = true;
    const p = (ctx.profile.poker ||= {}), stt = (p.stats ||= {}), s = (stt[id] ||= { n: 0, c: 0 }); s.n += n; s.c += c;
    await ctx.save();
    await store.addSession({ date: Date.now(), mode: 'poker-' + id, handsPlayed: n, accuracy: c / n, evLost: 0, bankrollDelta: 0 });
    el.innerHTML = `<h1>${D.title}</h1><div class="stat3"><div class="card"><div class="v ${c / n >= 0.9 ? 'ok' : ''}">${Math.round(c / n * 100)}%</div><div class="k">Accuracy</div></div><div class="card"><div class="v">${best}</div><div class="k">Best streak</div></div><div class="card"><div class="v">${c}/${n}</div><div class="k">Right</div></div></div>
      <button class="btn primary block" id="again">Go again</button><div class="gap"></div><a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="#/play/poker/drills">Done</a>`;
    el.querySelector('#again').onclick = () => pokerDrill(el, ctx, id);
    if (n >= 10 && c / n >= 0.95) confetti();
  }
  next();
  return () => { done = true; };
}
