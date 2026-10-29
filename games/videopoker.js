// Video Poker inside the Play tab: Jacks or Better, 9/6 pay table. Credits are practice chips.
// Every pay and every coach number comes from engine/videopoker.js; the coach counts every possible draw.
import { cardSVG, SUITS } from '../ui/cards.js';
import { PAY_96, HAND_NAME, shuffledDeck, categoryOf, evaluateHolds, describeHold, rankOf, suitOf } from '../engine/videopoker.js';
import { cue, deal as dealSound } from '../app/feel.js';

const START = 1000;
const BETS = [1, 2, 3, 4, 5];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const back = (to = '#/play', label = 'Play') => `<div class="topbar"><a class="back" href="${to}">‹ ${label}</a></div>`;
const EPS = 1e-9;

// Engine card (int) -> the card model ui/cards.js draws. Ten-valued faces keep their true label.
const artFor = (c) => {
  const r = rankOf(c);
  const label = r === 14 ? 'A' : r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : String(r);
  return { v: r === 14 ? 1 : Math.min(r, 10), label, suit: SUITS[suitOf(c)] };
};
const bitsOf = (held) => held.reduce((m, h, i) => (h ? m | (1 << i) : m), 0);
const fmtCoins = (x) => (Math.round(x * 100) / 100).toLocaleString();

export function videoPokerTable(el, ctx) {
  const vp = (ctx.profile.videoPoker ||= { credits: START, bet: 5, coach: true, hands: 0, optimal: 0, lost: 0 });
  const st = { phase: 'idle', hand: [], rest: [], held: [false, false, false, false, false], heldAtDraw: null, grade: null };
  const save = () => ctx.save();

  function paint() {
    const canDeal = vp.credits >= vp.bet;
    const cat = st.grade ? st.grade.cat : null;
    const cardRow = st.phase === 'idle'
      ? [0, 1, 2, 3, 4].map(() => `<div class="vpcell">${cardSVG(null, { faceDown: true })}</div>`).join('')
      : st.hand.map((c, i) => {
        const live = st.phase === 'hold';
        const tag = st.phase === 'done' ? (st.heldAtDraw[i] ? 'held' : 'new') : (st.held[i] ? 'HOLD' : '&nbsp;');
        return `<button class="vpcell${live && st.held[i] ? ' held' : ''}" data-i="${i}" ${live ? '' : 'disabled'} aria-pressed="${st.held[i]}">${cardSVG(artFor(c))}<div class="vptag">${tag}</div></button>`;
      }).join('');

    let action;
    if (st.phase === 'hold') action = `<button class="btn primary block" id="draw">Draw</button>`;
    else if (st.phase === 'checking') action = `<button class="btn primary block" disabled>Checking every draw…</button>`;
    else if (canDeal) action = `<button class="btn primary block" id="deal">${st.phase === 'done' ? 'Deal again' : 'Deal'} · bet ${vp.bet}</button>`;
    else action = `<button class="btn primary block" id="reset">Start over with ${START} credits</button><div class="small dim" style="margin-top:6px">Your hand history is kept.</div>`;
    const locked = st.phase === 'hold' || st.phase === 'checking';

    let result = '';
    if (st.grade) {
      const g = st.grade;
      result = `<div class="card ${g.won ? 'ok' : ''}"><b>${g.won ? HAND_NAME[cat] : 'No winning hand'}</b>
        <div class="small dim" style="margin-top:4px">${g.won ? `${PAY_96[cat]} × ${vp.bet} bet = <b class="num">${g.won}</b> credits` : 'Nothing paid on this hand.'}</div></div>`;
      if (vp.coach) {
        const diff = g.evs[g.best] - g.evs[g.mask];
        result += `<div class="card ${g.optimal ? 'ok' : 'bad'}"><b>${g.optimal ? 'You held the best cards' : 'Not the best hold'}</b>
          <div class="small" style="margin-top:6px">You: <b>${esc(describeHold(g.initial, g.mask))}</b> · expected return ${g.evs[g.mask].toFixed(3)} per coin</div>
          ${g.optimal ? '' : `<div class="small" style="margin-top:4px">Best: <b>${esc(describeHold(g.initial, g.best))}</b> · expected return ${g.evs[g.best].toFixed(3)} per coin</div>
          <div class="small" style="margin-top:6px">That mistake costs about <b class="num">${fmtCoins(diff * vp.bet)}</b> credits in the long run at this bet.</div>`}
          <div class="small dim" style="margin-top:6px">Exact: every possible draw is counted, not estimated.</div></div>`;
      }
    }

    const rows = [['royal', 'Royal flush'], ['straightFlush', 'Straight flush'], ['four', 'Four of a kind'], ['fullHouse', 'Full house'], ['flush', 'Flush'], ['straight', 'Straight'], ['three', 'Three of a kind'], ['twoPair', 'Two pair'], ['jacksOrBetter', 'Jacks or better']];
    const paytable = `<div class="card"><div class="vpgrid-head small dim"><span>Hand</span><span class="num">Per coin</span><span class="num">At ${vp.bet}</span></div>
      ${rows.map(([k, name]) => `<div class="vprow ${cat === k ? 'hit' : ''}"><span>${name}</span><span class="num">${PAY_96[k]}</span><span class="num">${PAY_96[k] * vp.bet}</span></div>`).join('')}
      <div class="small dim" style="margin-top:6px">Jacks or Better, 9/6. Lower pairs pay nothing.</div></div>`;

    const made = vp.hands;
    const pctOpt = made ? Math.round((vp.optimal / made) * 100) + '%' : '—';
    el.innerHTML = `${back()}<h1>Video Poker</h1>
      <p class="dim small" style="margin-top:0">Jacks or Better on a 9/6 pay table. Tap the cards you want to keep, then draw. The coach shows the exact best hold after every draw.</p>
      <div class="card row"><div class="grow"><div class="small dim">Credits</div><div class="big num">${vp.credits}</div></div><div class="grow"><div class="small dim">Bet</div><div class="big num">${vp.bet}</div></div></div>
      <div class="seg" id="bet" style="margin:6px 0 10px">${BETS.map((b) => `<button data-v="${b}" class="${vp.bet === b ? 'on' : ''}" ${locked ? 'disabled' : ''}>${b}</button>`).join('')}</div>
      <div class="vpgrid">${cardRow}</div>
      <div style="margin:12px 0">${action}</div>
      ${result}
      <div class="seg" id="coach" style="margin:6px 0 10px"><button data-v="on" class="${vp.coach ? 'on' : ''}">Coach on</button><button data-v="off" class="${vp.coach ? '' : 'on'}">Coach off</button></div>
      ${paytable}
      <div class="card"><b>Your record</b><div class="small dim" style="margin-top:6px">Hands ${made} · best holds ${pctOpt}${vp.lost ? ` · mistakes have cost about ${fmtCoins(vp.lost)} credits` : ''}</div></div>
      <div class="card"><b>Honest reminder.</b> Perfect play brings this game to about 99.5%. It never makes a positive return for you. Credits here are practice chips, not money.</div>`;
    bind();
  }

  function bind() {
    el.querySelectorAll('.vpcell[data-i]').forEach((b) => b.onclick = () => {
      if (st.phase !== 'hold') return;
      const i = Number(b.dataset.i);
      st.held[i] = !st.held[i];
      paint();
    });
    el.querySelector('#deal')?.addEventListener('click', deal);
    el.querySelector('#draw')?.addEventListener('click', draw);
    el.querySelector('#reset')?.addEventListener('click', async () => { vp.credits = START; await save(); st.phase = 'idle'; st.grade = null; paint(); });
    el.querySelectorAll('#bet button').forEach((b) => b.onclick = async () => { if (st.phase === 'hold' || st.phase === 'checking') return; vp.bet = Number(b.dataset.v); await save(); paint(); });
    el.querySelectorAll('#coach button').forEach((b) => b.onclick = async () => { vp.coach = b.dataset.v === 'on'; await save(); paint(); });
  }

  async function deal() {
    if (vp.credits < vp.bet) return;
    vp.credits -= vp.bet;
    const deck = shuffledDeck();
    st.hand = deck.slice(0, 5);
    st.rest = deck.slice(5);
    st.held = [false, false, false, false, false];
    st.heldAtDraw = null;
    st.grade = null;
    st.phase = 'hold';
    dealSound(5);
    await save();
    paint();
  }

  function draw() {
    const initial = st.hand.slice();
    const held = st.held.slice();
    st.phase = 'checking';
    paint();
    // Let the "checking" state paint before the exact hold values are computed (about 0.3 s).
    setTimeout(async () => {
      const mask = bitsOf(held);
      const { best, evs } = evaluateHolds(initial);
      const hand = initial.slice();
      for (let i = 0; i < 5; i++) if (!held[i]) hand[i] = st.rest.shift();
      const cat = categoryOf(hand);
      const won = PAY_96[cat] * vp.bet;
      const optimal = evs[best] - evs[mask] < EPS;
      vp.credits += won;
      vp.hands += 1;
      if (optimal) vp.optimal = (vp.optimal || 0) + 1;
      else vp.lost = (vp.lost || 0) + (evs[best] - evs[mask]) * vp.bet;
      st.hand = hand;
      st.heldAtDraw = held;
      st.grade = { mask, best, evs, cat, won, optimal, initial };
      st.phase = 'done';
      cue(optimal);
      await save();
      paint();
    }, 30);
  }

  paint();
  return () => {};
}
