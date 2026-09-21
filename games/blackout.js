// Chart Blackout: rebuild the strategy grid from memory, cell by cell, painting actions onto an empty grid.
// Nothing is revealed until you press Check. Scored on accuracy and time; every cell feeds the SRS.
import { ROWS, UPCARDS } from '../curriculum/cells.js';
import { upLabel } from '../engine/rules.js';
import { engine } from '../app/engine-client.js';
import { srs } from '../app/srs.js';
import { store } from '../app/store.js';
import { evKey, usd100 } from '../app/feedback.js';
import { confirmSheet } from '../ui/sheet.js';

const SCOPES = { hard: (r) => r.kind === 'hard' && r.total <= 20, soft: (r) => r.kind === 'soft', pairs: (r) => r.kind === 'pair', all: (r) => !(r.kind === 'hard' && r.total === 21) };
const LABEL = { hard: 'Hard totals', soft: 'Soft totals', pairs: 'Pairs', all: 'Whole chart' };

export function blackout(el, ctx, scope = null) {
  if (!scope) {
    el.innerHTML = `<div class="topbar"><a class="back" href="#/drill">‹ Drill</a></div><h1>Chart Blackout</h1>
      <p class="dim">An empty grid. Paint the correct action into every cell from memory. You only see answers after you press Check — producing the chart is how it gets memorized.</p>
      ${Object.keys(SCOPES).map((k) => `<button class="btn block" data-s="${k}" style="margin:8px 0">${LABEL[k]}</button>`).join('')}`;
    el.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => blackout(el, ctx, b.dataset.s));
    return;
  }
  const rules = ctx.rules;
  const rows = ROWS.filter(SCOPES[scope]);
  const cells = rows.flatMap((r) => UPCARDS.map((u) => ({ row: r, up: u, val: null })));
  let cur = 0, checked = false;
  const t0 = performance.now();
  let timer = 0;
  const legalLetters = ['H', 'S', 'D', 'P', 'R'];

  const draw = () => {
    let html = `<div class="grid" id="g"><div class="hd"></div>${UPCARDS.map((u) => `<div class="hd">${upLabel(u)}</div>`).join('')}`;
    rows.forEach((r, ri) => {
      html += `<div class="rl">${r.label}</div>`;
      UPCARDS.forEach((u, ci) => {
        const i = ri * 10 + ci, c = cells[i];
        const bad = checked && c.wrong;
        html += `<button class="c ${c.val ? 'act-' + c.val : 'none'}" data-i="${i}" style="${i === cur && !checked ? 'outline:2px solid var(--info);' : ''}${bad ? 'outline:2px solid var(--bad);' : ''}border:0;position:relative">${c.val || ''}${bad ? `<span style="position:absolute;right:1px;bottom:0;font-size:8px;color:#fff;background:#000a;border-radius:3px;padding:0 2px">${c.right}</span>` : ''}</button>`;
      });
    });
    html += '</div>';
    el.querySelector('#gridbox').innerHTML = html;
    el.querySelectorAll('#g .c').forEach((b) => b.onclick = () => { if (!checked) { cur = Number(b.dataset.i); draw(); } });
    const filled = cells.filter((c) => c.val).length;
    el.querySelector('#prog').textContent = `${filled}/${cells.length} painted`;
  };
  const paint = (k) => { if (checked) return; cells[cur].val = k; do { cur = (cur + 1) % cells.length; } while (cells[cur].val && cells.some((c) => !c.val)); draw(); };

  el.innerHTML = `<div class="topbar"><a class="back" href="#/drill/blackout">‹ Scope</a><div class="grow"></div><span class="num dim" id="clock">0:00</span></div>
    <h1 style="font-size:24px">Blackout · ${LABEL[scope]}</h1><div class="row small dim" style="justify-content:space-between"><span id="prog"></span><span>Tap a cell, then paint an action</span></div>
    <div id="gridbox" style="margin-top:8px"></div><div id="result"></div>
    <div class="legend"><span><i class="act-H"></i>Hit</span><span><i class="act-S"></i>Stand</span><span><i class="act-D"></i>Double</span><span><i class="act-P"></i>Split</span><span><i class="act-R"></i>Surrender</span></div>
    <div class="actionbar" id="bar" style="grid-template-columns:repeat(5,1fr)">${legalLetters.map((k) => `<button class="act ${k}" data-k="${k}">${{ H: 'Hit', S: 'Stand', D: 'Double', P: 'Split', R: 'Surr.' }[k]}<small>${k}</small></button>`).join('')}</div>
    <div class="row" style="margin-top:6px"><button class="btn ghost grow" id="clear">Clear cell</button><button class="btn primary grow" id="check">Check my chart</button></div>`;
  el.querySelectorAll('#bar .act').forEach((b) => b.onclick = () => paint(b.dataset.k));
  el.querySelector('#clear').onclick = () => { if (!checked) { cells[cur].val = null; draw(); } };
  timer = setInterval(() => { if (!checked) { const s = Math.floor((performance.now() - t0) / 1000); el.querySelector('#clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; } }, 500);
  draw();

  el.querySelector('#check').onclick = async () => {
    if (checked) return;
    const blanks = cells.filter((c) => !c.val).length;
    if (blanks && !(await confirmSheet('Blank cells', `${blanks} cells are still blank and will count as wrong.`, { ok: 'Check anyway', cancel: 'Keep painting' }))) return;
    checked = true; clearInterval(timer);
    const secs = Math.round((performance.now() - t0) / 1000);
    const res = el.querySelector('#result');
    res.innerHTML = `<div class="card">Checking against the engine… <span id="cp" class="dim"></span></div>`;
    let done = 0, ok = 0, evLost = 0;
    for (const c of cells) {
      const cell = await engine.cell(rules, c.row.key, c.up);
      c.right = cell.action; c.wrong = c.val !== cell.action;
      const loss = c.wrong && c.val ? Math.max(0, cell.ev[evKey(cell.action)] - (cell.ev[evKey(c.val)] ?? cell.ev[evKey(cell.action)])) : 0;
      if (!c.wrong) ok++; else evLost += loss;
      await srs.record(c.row.key, c.up, rules, !c.wrong, loss);
      if (++done % 10 === 0) res.querySelector('#cp').textContent = `${done}/${cells.length}`;
    }
    const acc = ok / cells.length;
    await store.addSession({ date: Date.now(), mode: 'blackout-' + scope, handsPlayed: cells.length, accuracy: acc, evLost, bankrollDelta: 0 });
    const p = ctx.profile; p.bests = p.bests || {};
    const key = 'blackout-' + scope, prev = p.bests[key];
    const better = !prev || acc > prev.acc || (acc === prev.acc && secs < prev.secs);
    if (better) { p.bests[key] = { acc, secs }; await ctx.save(); }
    draw();
    res.innerHTML = `<div class="stat3"><div class="card"><div class="v ${acc >= 0.95 ? 'ok' : acc < 0.8 ? 'bad' : ''}">${(acc * 100).toFixed(0)}%</div><div class="k">Accuracy</div></div><div class="card"><div class="v">${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</div><div class="k">Time</div></div><div class="card"><div class="v">${cells.length - ok}</div><div class="k">Wrong</div></div></div>
      <div class="card">Red cells show the right action in the corner.${cells.length - ok ? ` On average each wrong cell costs <b class="bad">${usd100(evLost / (cells.length - ok))}</b> per $100 wagered on that hand.` : ''}${better ? ' <span class="ok">New personal best for this scope.</span>' : ''}</div>
      <button class="btn primary block" id="again">Try again</button>`;
    res.querySelector('#again').onclick = () => blackout(el, ctx, scope);
    el.querySelector('#bar').style.display = 'none';
    res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return () => clearInterval(timer);
}
