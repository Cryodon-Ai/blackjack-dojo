// Play tab: Live Table, Trap Mode, Rules Panel Reader, and the money tools.
import { liveTable } from '../games/live.js';
import { gravityTable } from '../games/gravity.js';
import { startRunner } from '../games/runner.js';
import { startQuiz } from '../games/quiz.js';
import { variance, martingale, bonus } from '../money/tools.js';
import { randomTrap } from '../curriculum/traps.js';
import { describeRules, PRESETS } from '../app/presets.js';
import { handsToday } from '../app/ctx.js';

export default async function play(el, parts, ctx) {
  const [g] = parts;
  if (g === 'live') return liveTable(el, ctx);
  if (g === 'gravity') return gravityTable(el, ctx);
  if (g === 'trap') return trap(el, ctx);
  if (g === 'rules') return rulesReader(el, ctx);
  if (g === 'variance') return variance(el, ctx);
  if (g === 'martingale') return martingale(el, ctx);
  if (g === 'bonus') return bonus(el, ctx);
  return hub(el, ctx);
}

async function hub(el, ctx) {
  const today = await handsToday();
  const s = ctx.profile.settings, best = ctx.profile.bests || {};
  const preset = PRESETS.find((p) => p.id === ctx.profile.activePresetId);
  el.innerHTML = `<h1>Play</h1>
    <div class="card"><div class="row"><div class="grow"><div class="small dim">Hands today</div><div class="big num">${today}</div></div><div class="grow"><div class="small dim">Session loss limit</div><div class="big num">$${s.lossLimit}</div></div></div>
      <div class="small dim" style="margin-top:6px">${preset ? preset.name + ' · ' : ''}${describeRules(ctx.rules)}${preset && preset.unverified ? ' <span class="pill due">rules unverified</span>' : ''}</div></div>
    <a class="card link" href="#/play/live"><h3>Live Table</h3><div class="small dim">Real rounds with a simulated bankroll. Every decision graded; cost of your mistakes in dollars; the stop-rule is enforced.</div></a>
    <a class="card link" href="#/play/gravity"><h3>Gravity Blackjack</h3><div class="small dim">The real ICONIC21 game: all four side bets, real multiplier drops, and Practice + Rewind on the main hand.</div></a>
    <a class="card link" href="#/play/trap"><h3>Trap Mode</h3><div class="small dim">Insurance, even money, multiplier-drop side bets. The only way to win is to decline every one. Best run: <b>${best.trap || 0}</b></div></a>
    <a class="card link" href="#/play/rules"><h3>Rules Panel Reader</h3><div class="small dim">Two tables, five seconds: which one is better, and what does the wrong choice cost per $100?</div></a>
    <h2>Money & Mind</h2>
    <a class="card link" href="#/play/variance"><h3>10,000 perfect hands</h3><div class="small dim">See why a losing session is not a strategy failure.</div></a>
    <a class="card link" href="#/play/martingale"><h3>Martingale ruin</h3><div class="small dim">The doubling system, simulated.</div></a>
    <a class="card link" href="#/play/bonus"><h3>Bonus playthrough calculator</h3><div class="small dim">Contribution rate decides whether a bonus is worth touching.</div></a>
    <div class="card"><b>Honest reminder.</b> Perfect play lowers the house edge; it never makes blackjack a winning game. These tools exist to put a price on the game, not to beat it.</div>`;
}

async function trap(el, ctx) {
  const ctl = startRunner(el, {
    mode: 'trap', title: 'Trap Mode', exitHref: '#/play', rules: ctx.rules,
    source: { next: () => ({ trap: randomTrap({ multipliers: true }) }) },
    strikes: 1, seconds: 4, autoAdvanceMs: 2200,
    hud: (st) => `<span class="streak ok">Declined <span class="num">${st.correct}</span> in a row</span><span class="dim">Best ${ctx.profile.bests.trap || 0}</span>`,
    onFinish: async (st) => {
      const p = ctx.profile; p.bests = p.bests || {};
      const nb = st.correct > (p.bests.trap || 0);
      if (nb) { p.bests.trap = st.correct; await ctx.save(); }
      return `<div class="card ${nb ? 'ok' : ''}">${nb ? '<b class="ok">New best.</b> ' : ''}You declined <b>${st.correct}</b> in a row before accepting one. Refusal is a reflex you build by repetition.</div>`;
    },
    restart: () => trap(el, ctx),
  });
  return () => ctl.stop();
}

async function rulesReader(el, ctx) {
  const ctl = startQuiz(el, { gen: 't6', mode: 'rules', title: 'Rules Panel Reader', exitHref: '#/play', total: 20, secs: 5, restart: () => rulesReader(el, ctx) });
  return () => ctl.stop();
}
