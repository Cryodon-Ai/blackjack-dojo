// Poker practice table: 6-max no-limit cash game against bots with different styles, with a coach.
// Stacks are 100 big blinds and reset every hand. Results are in big blinds (bb). No money involved.

import { Hand, botAction, coach, grade, STYLES, POS_NAMES } from '../engine/holdem.js';
import { describeHand, evaluate, cardStr, classLabel, potOddsNeeded } from '../engine/poker.js';
import { pcard, back, ensurePokerCSS } from '../ui/pokercards.js';
import { toast } from '../ui/hand.js';
import { store } from '../app/store.js';
import { rec } from '../app/weak.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bb1 = (x) => (Math.round(x * 10) / 10).toString().replace(/\.0$/, '');
const sgn = (x) => (x >= 0 ? '+' : '−') + Math.abs(Math.round(x * 10) / 10);
const POS = [[50, 90], [12, 70], [14, 27], [50, 15], [86, 27], [88, 70]];   // seat positions relative to the hero (clockwise)
const FIRST = ['Ana', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jon', 'Kit', 'Lou', 'Max', 'Nia', 'Oz'];
const TABLES = {
  soft: { name: 'Soft table', sub: 'Calling stations and nits: value-bet a lot, bluff little.', mix: ['station', 'nit', 'station', 'tag', 'nit'] },
  mixed: { name: 'Mixed table', sub: 'A bit of everything, like a real micro-stakes table.', mix: ['tag', 'station', 'lag', 'nit', 'maniac'] },
  tough: { name: 'Tough table', sub: 'Mostly solid regulars. Fundamentals only.', mix: ['tag', 'tag', 'lag', 'tag', 'nit'] },
};

export function pokerTable(el, ctx) {
  ensurePokerCSS();
  const st = (ctx.profile.poker ||= {});
  const cfg = (st.tableCfg ||= { table: 'mixed', advice: 'after', types: true });
  let stopped = false, endNow = false;

  function setup() {
    const seg = (id, items, cur) => `<div class="seg" id="${id}" style="margin:6px 0 10px">${items.map(([v, t]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    el.innerHTML = `<div class="topbar"><a class="back" href="#/play/poker">‹ Poker</a></div><h1>Practice table</h1>
      <p class="dim small" style="margin-top:0">Six-handed Texas Hold'em, 100 big blinds each, stacks reset every hand. You rotate through every seat so you learn every position. A coach grades each decision with equity, pot odds and position.</p>
      <div class="small dim">The table</div>${seg('t', Object.entries(TABLES).map(([k, v]) => [k, v.name]), cfg.table)}<div class="small dim" style="margin:-4px 0 10px">${TABLES[cfg.table].sub}</div>
      <div class="small dim">Coach</div>${seg('a', [['after', 'Feedback after each action'], ['before', 'Show advice first']], cfg.advice)}
      <div class="small dim">Player types</div>${seg('p', [[1, 'Shown'], [0, 'Hidden (read them)']], cfg.types ? 1 : 0)}
      <button class="btn primary block" id="go">Deal</button>`;
    const bind = (id, fn) => el.querySelectorAll(`#${id} button`).forEach((b) => b.onclick = () => { fn(b.dataset.v); ctx.save(); setup(); });
    bind('t', (v) => { cfg.table = v; }); bind('a', (v) => { cfg.advice = v; }); bind('p', (v) => { cfg.types = v === '1'; });
    el.querySelector('#go').onclick = play;
  }

  async function play() {
    document.getElementById('app').classList.add('focus');
    const names = ['You', ...[...FIRST].sort(() => Math.random() - 0.5).slice(0, 5)];
    const styles = ['tag', ...TABLES[cfg.table].mix.slice().sort(() => Math.random() - 0.5)];
    const S = { hands: 0, bb: 0, dec: 0, good: 0, ok: 0, leak: 0, vpip: 0, leaks: [], t0: Date.now() };
    let button = Math.floor(Math.random() * 6), h = null;
    el.innerHTML = `<div class="topbar"><button class="btn small ghost" id="end">End session</button><div class="grow"></div><div class="right small dim" id="hd1"></div></div>
      <div id="hud" class="small"></div><div class="pk-felt" id="felt"></div><div id="hero" class="pk-hero" style="text-align:center"></div><div id="panel"></div><div class="actionbar" id="bar"></div>`;
    const $ = (id) => el.querySelector('#' + id);
    $('end').onclick = () => { endNow = true; finish(); };

    const hud = () => {
      $('hd1').innerHTML = `<b class="num ${S.bb >= 0 ? 'ok' : 'bad'}" style="font-size:18px">${sgn(S.bb)} bb</b>`;
      const pc = S.dec ? Math.round((S.good + S.ok * 0.5) / S.dec * 100) : null;
      $('hud').innerHTML = `<div class="row wrap" style="justify-content:space-between"><span>Hand <b class="num">${S.hands}</b> · you are <b>${h ? h.posOf(0) : ''}</b></span><span class="small">Decisions <b class="num ${pc >= 80 ? 'ok' : ''}">${pc === null ? '—' : pc + '%'}</b> <span class="dim">(${S.good} good · ${S.ok} close · ${S.leak} leaks)</span></span></div>`;
    };

    function draw(reveal = false, active = -1) {
      const seatHTML = [];
      for (let k = 0; k < 6; k++) {
        const s = k; const [x, y] = POS[k];
        const isHero = s === 0, folded = h.folded[s];
        const showCards = (reveal && h.showdown && !folded) || isHero;
        const cards = folded ? '' : showCards ? h.hole[s].map((c) => pcard(c)).join('') : back() + back();
        const tag = cfg.types && !isHero ? `<span class="dim" style="font-size:9px">${STYLES[h.styles[s]].label}</span>` : '';
        if (isHero) continue;
        seatHTML.push(`<div class="pk-seat ${folded ? 'out' : ''} ${active === s ? 'turn' : ''}" style="left:${x}%;top:${y}%">${h.button === s ? '<div class="bt">D</div>' : ''}<div class="cards">${cards}</div><div class="nm"><b>${names[s]}</b>${h.posOf(s)} · ${bb1(h.stack[s])}${tag ? '<br>' + tag : ''}</div>${h.bet[s] > 0 ? `<div class="betchip">${bb1(h.bet[s])}</div>` : ''}${h.done && h.showdown && !folded ? `<div class="small" style="color:#fff">${describeHand(h.scores[s])}</div>` : ''}</div>`);
      }
      $('felt').innerHTML = seatHTML.join('') + `<div class="pk-board"><div class="pot">Pot ${bb1(h.pot)}</div><div style="display:flex;justify-content:center;min-height:55px">${h.board.map((c) => pcard(c)).join('')}</div></div>`;
      $('hero').innerHTML = `<div style="display:flex;justify-content:center">${h.hole[0].map((c) => pcard(c)).join('')}</div>
        <div class="small" style="margin-top:4px">${h.button === 0 ? '<b>D</b> ' : ''}<b>${h.posOf(0)}</b> · stack ${bb1(h.stack[0])} bb${h.bet[0] > 0 ? ` · bet ${bb1(h.bet[0])}` : ''}${h.board.length ? ` · <span class="dim">${describeHand(evaluate([...h.hole[0], ...h.board]))}</span>` : ''}</div>`;
    }

    async function botsUntilHero() {
      while (!h.done && h.toAct !== 0 && !endNow) {
        const s = h.toAct;
        draw(false, s); await sleep(650);
        const a = botAction(h, s);
        h.act(s, a);
        draw();
        const rec = h.log[h.log.length - 1];
        if (rec && rec.seat === s) $('panel').innerHTML = `<div class="small dim" style="text-align:center">${names[s]} (${rec.pos}) ${rec.type === 'raise' ? (h.raises > 1 && rec.street === 'preflop' ? 'raises' : 'bets/raises') + ' to ' + bb1(rec.to) : rec.type === 'call' ? 'calls ' + bb1(rec.amount) : rec.type === 'check' ? 'checks' : 'folds'}</div>`;
      }
    }

    function heroInfo(c) {
      if (c.preflop) return `<div class="small dim">${c.label} · ${c.pos}</div>`;
      const need = c.need != null ? ` · need <b>${Math.round(c.need * 100)}%</b> to call` : '';
      return `<div class="small dim">${c.hand} · equity ≈ <b>${Math.round(c.equity * 100)}%</b>${need}${c.outs >= 4 ? ` · ${c.outs} outs` : ''}</div>`;
    }

    const actLabel = { fold: 'Fold', check: 'Check', call: 'Call', raise: 'Raise' };
    async function heroTurn() {
      const L = h.legal(0), c = coach(h, 0);
      draw(false, 0);
      const pot = h.pot, pre = h.street === 'preflop';
      let hint = cfg.advice === 'before';
      const barMain = () => {
        $('bar').style.gridTemplateColumns = `repeat(${L.canRaise ? 3 : 2}, 1fr)`;
        $('bar').innerHTML = `<button class="act" data-a="fold" ${L.check ? 'style="opacity:.5"' : ''}>Fold</button><button class="act" data-a="${L.call > 0 ? 'call' : 'check'}">${L.call > 0 ? 'Call ' + bb1(L.call) : 'Check'}</button>${L.canRaise ? '<button class="act" data-a="raise">Raise</button>' : ''}`;
        return new Promise((res) => $('bar').querySelectorAll('.act').forEach((b) => b.onclick = () => {
          const a = b.dataset.a;
          if (a === 'raise') return res(sizing());
          if (a === 'fold' && L.check) { toast('You can check for free — never fold when checking costs nothing.', 2400); return; }
          res({ type: a });
        }));
      };
      const sizing = () => {
        const opts = pre
          ? [['2.5x', Math.max(L.minTo, (h.current || 1) * 2.5)], ['3x', Math.max(L.minTo, (h.current || 1) * 3)], ['4x', Math.max(L.minTo, (h.current || 1) * 4)], ['Pot', h.bet[0] + L.call + (pot + L.call)], ['All-in', L.maxTo]]
          : [['⅓ pot', h.current + pot / 3], ['½ pot', h.current + pot / 2], ['¾ pot', h.current + pot * 0.75], ['Pot', h.current + pot], ['All-in', L.maxTo]];
        const clean = opts.map(([n, to]) => [n, Math.round(Math.max(L.minTo, Math.min(L.maxTo, to)) * 10) / 10]);
        $('bar').style.gridTemplateColumns = 'repeat(3, 1fr)';
        $('bar').innerHTML = clean.map(([n, to]) => `<button class="act" data-to="${to}">${n}<small>${bb1(to)}</small></button>`).join('') + '<button class="act" id="bk">Back</button>';
        return new Promise((res) => {
          $('bar').querySelectorAll('[data-to]').forEach((b) => b.onclick = () => res({ type: 'raise', to: Number(b.dataset.to) }));
          $('bar').querySelector('#bk').onclick = () => res(barMain().then((x) => x));
        });
      };
      $('panel').innerHTML = (hint ? `<div class="banner"><b>Coach:</b> ${c.why}</div>` : '') + `<div style="text-align:center">${heroInfo(c)}</div>`
        + (cfg.advice === 'after' ? '<div style="text-align:center"><button class="btn small ghost" id="hintb">Hint</button></div>' : '');
      const hb = $('panel').querySelector('#hintb');
      if (hb) hb.onclick = () => { $('panel').innerHTML = `<div class="banner"><b>Coach:</b> ${c.why}</div><div style="text-align:center">${heroInfo(c)}</div>`; };
      let choice = await barMain();
      while (choice && typeof choice.then === 'function') choice = await choice;
      if (endNow) return null;
      // grade
      const g = grade(c.rec, choice.type);
      S.dec++; S[g === 'good' ? 'good' : g === 'ok' ? 'ok' : 'leak']++;
      rec(ctx, 'poker:table', c.preflop ? `${c.label} ${c.pos} (${h.raises ? 'vs raise' : 'open'})` : `${h.street} ${c.rec}`, g !== 'leak');
      if (h.street === 'preflop' && choice.type !== 'fold' && !(h.legal(0).check)) S.vpip++;
      if (g === 'leak') S.leaks.push(`${h.street === 'preflop' ? c.label + ' from ' + c.pos : c.hand + ' on the ' + h.street}: you ${actLabel[choice.type].toLowerCase()}ed, better was ${actLabel[c.rec].toLowerCase()}`);
      const mark = g === 'good' ? '<span class="ok">✓ Good</span>' : g === 'ok' ? '<span class="due">~ Close</span>' : '<span class="bad">✗ Leak</span>';
      $('panel').innerHTML = `<div class="verdict ${g === 'good' ? 'ok' : g === 'leak' ? 'bad' : ''}"><div class="head">${mark} <span class="small dim">you ${choice.type === 'raise' ? 'raise to ' + bb1(choice.to) : choice.type}${g !== 'good' ? ' · coach: ' + actLabel[c.rec].toLowerCase() : ''}</span></div>${g !== 'good' || cfg.advice === 'after' ? `<div class="small">${c.why}</div>` : ''}</div>`;
      return choice;
    }

    async function oneHand() {
      h = new Hand({ names, styles, button, rand: Math.random });
      S.hands++; hud();
      $('panel').innerHTML = '';
      while (!h.done && !endNow) {
        await botsUntilHero();
        if (h.done || endNow) break;
        const choice = await heroTurn();
        if (!choice) return;
        h.act(0, choice);
        draw(false, -1); hud();
        await sleep(450);
      }
      if (endNow) return;
      draw(true);
      const win = h.net[0]; S.bb += win; hud();
      const w = h.winners.map((s) => names[s]).join(' & ');
      const how = h.showdown ? `${w} win${h.winners.length > 1 && !h.winners.includes(0) ? '' : h.winners.length > 1 ? '' : 's'} with ${describeHand(h.scores[h.winners[0]])}` : `${w} wins; everyone else folded`;
      $('panel').insertAdjacentHTML('beforeend', `<div class="verdict ${win > 0 ? 'ok' : win < 0 ? 'bad' : ''}" style="margin-top:6px"><div class="head ${win > 0 ? 'ok' : win < 0 ? 'bad' : ''}">${win > 0 ? 'You win ' : win < 0 ? 'You lose ' : 'Break even '}${win ? bb1(Math.abs(win)) + ' bb' : ''}</div><div class="small">${how}.</div></div>`);
      await new Promise((res) => { $('bar').style.gridTemplateColumns = '1fr'; $('bar').innerHTML = '<button class="btn primary" id="nx">Next hand</button>'; $('bar').querySelector('#nx').onclick = res; });
      button = (button + 1) % 6;
    }

    function finish() {
      stopped = true;
      document.getElementById('app').classList.remove('focus');
      const t = (st.table ||= { hands: 0, good: 0, dec: 0 }); t.hands += S.hands; t.good += S.good; t.dec += S.dec; ctx.save();
      if (S.hands) store.addSession({ date: Date.now(), mode: 'poker-table', handsPlayed: S.hands, accuracy: S.dec ? (S.good + S.ok * 0.5) / S.dec : 1, evLost: 0, bankrollDelta: 0 });
      const pc = S.dec ? Math.round((S.good + S.ok * 0.5) / S.dec * 100) : 0;
      el.innerHTML = `<h1>Session over</h1><div class="card"><table class="evtable"><tr><td>Hands</td><td class="num">${S.hands}</td></tr><tr><td>Result</td><td class="num ${S.bb >= 0 ? 'ok' : 'bad'}">${sgn(S.bb)} bb (${S.hands ? sgn(S.bb / S.hands * 100) : 0} bb/100)</td></tr><tr><td>Decision quality</td><td class="num">${pc}% <span class="dim">(${S.good} good, ${S.ok} close, ${S.leak} leaks)</span></td></tr><tr><td>Hands played (VPIP)</td><td class="num">${S.hands ? Math.round(S.vpip / S.hands * 100) : 0}% <span class="dim">(solid range: 20–28%)</span></td></tr></table></div>
        ${S.leaks.length ? `<div class="card"><b>Leaks to review</b><div class="small dim" style="margin-top:6px">${[...new Set(S.leaks)].slice(0, 10).join('<br>')}</div></div>` : ''}
        <div class="card small dim">A few hundred hands is mostly luck: even the best players lose for weeks. The decision-quality number is what you are training, not the bb result.</div>
        <button class="btn primary block" id="again">Another session</button><div class="gap"></div><a class="btn ghost block" style="display:block;text-align:center;text-decoration:none" href="#/play/poker">Back to Poker</a>`;
      el.querySelector('#again').onclick = () => { stopped = false; endNow = false; setup(); };
    }

    try { while (!endNow && !stopped) await oneHand(); } catch (e) { if (!endNow) { console.error(e); toast('Something went wrong: ' + (e.message || e), 4000); } }
  }

  setup();
  return () => { stopped = true; endNow = true; document.getElementById('app').classList.remove('focus'); };
}
