// Guide tab: the basic-strategy chart for the table you actually play, always visible.
//   Chart      — classic Hard / Soft / Pairs grids, Dh / Ds / Rh notation, rows merged where identical,
//                cells that differ from a standard 6-deck online table outlined, tap a cell for the why
//   Cheat card — rules of thumb, each checked live against the chart for the current rules
//   Shoe       — what deck count costs, 5 vs 6 decks, and how the cut card works
// Every cell is computed by the verified solver for the active rules; nothing is a stored chart.

import { ROWS, UPCARDS } from '../curriculum/cells.js';
import { upLabel, normalizeRules } from '../engine/rules.js';
import { engine } from '../app/engine-client.js';
import { describeRules, PRESETS, presetById } from '../app/presets.js';
import { openRulesEditor } from '../ui/rules-editor.js';
import { openSheet } from '../ui/sheet.js';
import { houseEdge } from '../app/edges.js';
import { explain, ACTION_NAME, signed, usd100 } from '../app/feedback.js';
import { chartRows } from '../engine/strategy.js';

const VIEWS = [['chart', 'Chart'], ['cheat', 'Cheat card'], ['shoe', 'Shoe & decks']];
const BASELINE = () => normalizeRules(presetById('typical-online').rules);
const REPS = Object.fromEntries(chartRows().map((r) => [r.key, r.cards]));
const ROWS_ALL = ROWS.filter((r) => !(r.kind === 'hard' && (r.total === 21)));

export default async function guide(el, parts, ctx) {
  const view = VIEWS.some((v) => v[0] === parts[0]) ? parts[0] : 'chart';
  el.innerHTML = `<h1>Strategy Guide</h1>
    <div class="card row"><div class="grow"><div class="small dim">Your table</div><div class="small" id="rd"></div></div><button class="btn small ghost" id="chg">Change</button></div>
    <div class="seg" id="seg">${VIEWS.map(([k, n]) => `<button data-v="${k}" class="${k === view ? 'on' : ''}">${n}</button>`).join('')}</div><div id="body" style="margin-top:14px"></div>`;
  const rules = ctx.rules, preset = PRESETS.find((p) => p.id === ctx.profile.activePresetId);
  el.querySelector('#rd').innerHTML = `${preset ? `<b>${preset.name}</b>${preset.unverified ? ' <span class="pill due">rules assumed</span>' : ''}<br>` : ''}${describeRules(rules)}`;
  el.querySelector('#chg').onclick = () => openRulesEditor(rules, { title: 'Table rules', onSave: async (r, id) => { await ctx.setRules(r, id); engine.prefill(ctx.rules, () => {}); guide(el, parts, ctx); } });
  el.querySelectorAll('#seg button').forEach((b) => b.onclick = () => { location.hash = `#/guide/${b.dataset.v}`; });
  const body = el.querySelector('#body');
  const state = { alive: true };
  const fn = { chart, cheat, shoe }[view];
  fn(body, ctx, rules, state);
  return () => { state.alive = false; };
}

// ---- data -----------------------------------------------------------------------------------
async function loadGrid(rules, state, onProgress) {
  const g = {};
  let n = 0;
  for (const r of ROWS_ALL) {
    for (const u of UPCARDS) {
      if (!state.alive) return null;
      g[`${r.key}|${u}`] = await engine.cell(rules, r.key, u);
      if (onProgress && ++n % 25 === 0) onProgress(n, ROWS_ALL.length * 10);
    }
  }
  return g;
}

// Chart notation: D/R carry the fallback play (Dh = double, otherwise hit).
function sym(c) {
  const e = c.ev;
  const fb = () => (c.ev.hit !== undefined && e.hit >= (e.stand ?? -9) ? 'h' : 's');
  if (c.action === 'D') return { a: 'D', sub: fb() };
  if (c.action === 'R') return { a: 'R', sub: fb() };
  return { a: c.action, sub: '' };
}
const symKey = (c) => { const s = sym(c); return s.a + s.sub; };

// Merge adjacent rows whose actions are identical in every column.
function mergeRows(kindRows, grid) {
  const out = [];
  for (const r of kindRows) {
    const sig = UPCARDS.map((u) => symKey(grid[`${r.key}|${u}`])).join('');
    const last = out[out.length - 1];
    if (last && last.sig === sig && r.kind !== 'pair') last.rows.push(r);
    else out.push({ sig, rows: [r] });
  }
  return out;
}
function labelOf(rows) {
  const a = rows[0], b = rows[rows.length - 1];
  if (rows.length === 1) return a.label.replace('Hard ', '');
  if (a.kind === 'hard') return `${a.total}–${b.total}`;
  return `${a.label}–${b.label.replace('A,', '')}`;
}

// ---- chart ----------------------------------------------------------------------------------
async function chart(body, ctx, rules, state) {
  body.innerHTML = `<div class="small dim" id="prog">Computing every cell for these rules…</div><div id="gchart"></div>`;
  const grid = await loadGrid(rules, state, (n, t) => { const e = body.querySelector('#prog'); if (e) e.textContent = `Computing every cell for these rules… ${n}/${t}`; });
  if (!grid) return;
  const prog = body.querySelector('#prog'); if (prog) prog.remove();

  const same = JSON.stringify(rules) === JSON.stringify(BASELINE());
  const diffs = new Set();
  const section = (title, kind) => {
    const rs = ROWS_ALL.filter((r) => r.kind === kind);
    const groups = mergeRows(rs, grid);
    const head = `<div class="hd"></div>${UPCARDS.map((u) => `<div class="hd">${upLabel(u)}</div>`).join('')}`;
    const rowsHTML = groups.map((gr) => {
      const label = labelOf(gr.rows);
      const cells = UPCARDS.map((u) => {
        const c = grid[`${gr.rows[0].key}|${u}`], s = sym(c);
        return `<button class="c act-${s.a}" data-r="${gr.rows[0].key}" data-u="${u}" data-g="${gr.rows.map((x) => x.key).join(',')}" style="border:0"><span>${s.a}${s.sub ? `<small>${s.sub}</small>` : ''}</span></button>`;
      }).join('');
      return `<div class="rl">${label}</div>${cells}`;
    }).join('');
    return `<h2>${title}</h2><div class="grid guide" style="grid-template-columns:48px repeat(10,1fr)" data-kind="${kind}">${head}${rowsHTML}</div>`;
  };
  body.querySelector('#gchart').innerHTML = `
    <div class="legend"><span><i class="act-H"></i>Hit</span><span><i class="act-S"></i>Stand</span><span><i class="act-D"></i>Double</span><span><i class="act-P"></i>Split</span>${rules.surrender === 'late' ? '<span><i class="act-R"></i>Surrender</span>' : ''}</div>
    <p class="small dim" style="margin:0 0 6px">Dealer's upcard across the top. <b>D<small>h</small></b> = double, or hit if you can't double; <b>D<small>s</small></b> = double, or stand. ${rules.surrender === 'late' ? '<b>R<small>h</small></b> = surrender, otherwise hit. ' : ''}Tap any cell for the numbers and the reason.</p>
    <div id="diffnote"></div>
    ${section('Hard totals', 'hard')}${section('Soft totals (with an Ace)', 'soft')}${section('Pairs', 'pair')}
    <p class="small dim">Computed live by the verified solver for exactly these rules (${rules.decks} deck${rules.decks === 1 ? '' : 's'}). Hard totals show the total-dependent play, so a few edge cells can differ from a printed card by composition.</p>`;
  body.querySelectorAll('.guide .c').forEach((b) => b.onclick = () => cellSheet(rules, b.dataset.r, Number(b.dataset.u), grid));

  // Outline the cells that differ from a standard online table, so rule changes are visible.
  if (!same) {
    const note = body.querySelector('#diffnote');
    note.innerHTML = `<div class="small dim" id="dn">Comparing with a standard 6-deck online table…</div>`;
    const base = BASELINE();
    let changed = 0;
    for (const r of ROWS_ALL) for (const u of UPCARDS) {
      if (!state.alive) return;
      const bc = await engine.cell(base, r.key, u), c = grid[`${r.key}|${u}`];
      if (symKey(bc) !== symKey(c)) {
        changed++;
        body.querySelectorAll(`.guide .c[data-u="${u}"]`).forEach((b) => { if (b.dataset.g.split(',').includes(r.key)) b.classList.add('chg'); });
      }
    }
    if (state.alive) note.innerHTML = changed
      ? `<div class="card" style="padding:10px 12px"><b>${changed} cell${changed === 1 ? '' : 's'}</b> play differently from a standard 6-deck table (S17, DAS, no surrender). They are outlined in white.</div>`
      : `<div class="small dim">Identical to a standard 6-deck online table.</div>`;
  }
}

async function cellSheet(rules, rowKey, up, grid) {
  const r = ROWS.find((x) => x.key === rowKey);
  const c = grid[`${rowKey}|${up}`];
  const T = { stand: 'S', hit: 'H', double: 'D', split: 'P', surrender: 'R' };
  const order = ['stand', 'hit', 'double', 'split', 'surrender'].filter((k) => c.ev[k] !== undefined).sort((a, b) => c.ev[b] - c.ev[a]);
  const hand = REPS[rowKey];
  let reason = '';
  try { reason = (await explain(rules, hand, up, { ev: c.ev, legal: c.legal, action: c.action }, null)).reason; } catch { /* reason is a nicety */ }
  const s = sym(c);
  const sh = openSheet(`<h3>${r.label} vs ${upLabel(up)}: <span class="ok">${ACTION_NAME[c.action]}${s.sub ? ` <span class="dim small">(else ${s.sub === 'h' ? 'hit' : 'stand'})</span>` : ''}</span></h3>
    ${reason ? `<p>${reason.replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]))}</p>` : ''}
    <table class="evtable">${order.map((k) => `<tr class="${T[k] === c.action ? 'best' : ''} ${c.legal[k] ? '' : 'illegal'}"><td>${ACTION_NAME[T[k]]}${c.legal[k] ? '' : ' — n/a'}</td><td class="num">${signed(c.ev[k], 2)}</td></tr>`).join('')}</table>
    <p class="small dim">Expected result per $1 bet. Margin to the runner-up: ${c.margin === null ? '—' : usd100(c.margin) + ' per $100'}.</p><button class="btn block ghost" id="x">Close</button>`);
  sh.el.querySelector('#x').onclick = sh.close;
}

// ---- cheat card -----------------------------------------------------------------------------
const runs = (g, rowKey) => {
  const out = [];
  for (const u of UPCARDS) {
    const k = sym(g[`${rowKey}|${u}`]).a;
    const last = out[out.length - 1];
    if (last && last.k === k) last.ups.push(u); else out.push({ k, ups: [u] });
  }
  return out;
};
const rng = (ups) => {
  const nums = ups.filter((u) => u !== 1), hasA = ups.includes(1);
  const parts = [];
  if (nums.length) parts.push(nums.length === 1 ? upLabel(nums[0]) : `${upLabel(nums[0])}–${upLabel(nums[nums.length - 1])}`);
  if (hasA) parts.push('A');
  return parts.join(', ');
};
const NAME = { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split', R: 'Surrender' };

async function cheat(body, ctx, rules, state) {
  body.innerHTML = '<div class="small dim">Checking the rules of thumb against your table…</div>';
  const g = await loadGrid(rules, state);
  if (!g) return;
  const A = (row, up) => sym(g[`${row}|${up}`]).a;
  const all = (rowsArr, ups, set) => rowsArr.every((r) => ups.every((u) => set.includes(A(r, u))));
  const H = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => `H${a + i}`);
  const D2_6 = [2, 3, 4, 5, 6], D7_A = [7, 8, 9, 10, 1], ALL = UPCARDS;
  const hooks = [
    ['Never take insurance or even money.', () => true, 'A losing bet every time (about 7% against you).'],
    ['Hard 17 or more: always stand.', () => all(H(17, 20), ALL, ['S', 'R']), ''],
    ['Hard 8 or less: always hit.', () => all(H(5, 8), ALL, ['H']), ''],
    ['Dealer shows 2–6 (weak): stand on 13–16.', () => all(H(13, 16), D2_6, ['S']), 'The dealer is likely to bust; let them.'],
    ['Dealer shows 7–A (strong): hit 12–16.', () => all(H(12, 16), D7_A, ['H', 'R']), 'You have to assume the dealer makes a hand.'],
    ['Hard 12: stand only against 4, 5, 6.', () => all(['H12'], [4, 5, 6], ['S']) && all(['H12'], [2, 3, 7, 8, 9, 10, 1], ['H', 'R']), ''],
    ['Hard 11: double against everything but an Ace.', () => all(['H11'], [2, 3, 4, 5, 6, 7, 8, 9, 10], ['D']) && A('H11', 1) !== 'D', ''],
    ['Hard 11: double against everything.', () => all(['H11'], ALL, ['D']), 'Dealer hits soft 17, so even the Ace is a double.'],
    ['Hard 10: double against 2–9.', () => all(['H10'], [2, 3, 4, 5, 6, 7, 8, 9], ['D']), ''],
    ['Hard 9: double against 3–6.', () => all(['H9'], [3, 4, 5, 6], ['D']), ''],
    ['Always split Aces and 8s.', () => ['AA', '88'].every((r) => ALL.every((u) => ['P', 'R'].includes(A(r, u)))), 'Exception: with surrender, 8,8 against a strong card may be surrendered instead.'],
    ['Never split 10s or 5s.', () => ALL.every((u) => A('TT', u) === 'S') && ALL.every((u) => A('55', u) !== 'P'), 'Twenty is too good to break up; 5,5 is a hard 10 and plays as one.'],
    ['Soft 19 and 20 (A,8 / A,9): stand.', () => all(['A8', 'A9'], ALL, ['S', 'D']), ''],
    ['Soft 17 or less (A,2–A,6): never stand.', () => all(['A2', 'A3', 'A4', 'A5', 'A6'], ALL, ['H', 'D']), 'An Ace can\'t bust you in one card, so keep drawing.'],
    ['Pairs of 2s, 3s, 6s, 7s: split against weak dealer cards only.', () => ['22', '33', '66', '77'].every((r) => [2, 3, 4, 5, 6].some((u) => A(r, u) === 'P') && A(r, 10) !== 'P'), ''],
  ];
  const ok = hooks.filter(([, t]) => { try { return t(); } catch { return false; } });
  const rowNotes = (kind, title) => {
    const rs = ROWS_ALL.filter((r) => r.kind === kind);
    return `<h2>${title}</h2><div class="card">${rs.map((r) => {
      const rr = runs(g, r.key);
      return `<div style="padding:5px 0;border-bottom:1px solid var(--line)"><b>${r.label.replace('Hard ', '')}</b> <span class="small dim">${rr.map((x) => `${NAME[x.k]} ${rng(x.ups)}`).join(' · ')}</span></div>`;
    }).join('')}</div>`;
  };
  body.innerHTML = `<div class="card"><b>Rules of thumb that hold at your table</b><ul style="margin:8px 0 0;padding-left:20px">${ok.map(([t, , note]) => `<li style="margin:6px 0">${t}${note ? `<div class="small dim">${note}</div>` : ''}</li>`).join('')}</ul></div>
    <p class="small dim">Each line above is tested against the chart for your exact rules before it appears; a rule that stops being true when you change tables disappears.</p>
    ${rowNotes('hard', 'Hard totals, row by row')}${rowNotes('soft', 'Soft totals, row by row')}${rowNotes('pair', 'Pairs, row by row')}`;
}

// ---- shoe & decks ---------------------------------------------------------------------------
async function shoe(body, ctx, rules) {
  const rows = [];
  for (const d of [1, 2, 3, 4, 5, 6, 7, 8]) rows.push([d, await houseEdge({ ...rules, decks: d })]);
  const cur = rows.find((r) => r[0] === rules.decks);
  const six = rows.find((r) => r[0] === 6)[1], five = rows.find((r) => r[0] === 5)[1];
  body.innerHTML = `<div class="card"><b>What the number of decks costs</b>
    <p class="small dim" style="margin-top:4px">House edge at your other rules, by deck count. More decks = slightly worse for you, because blackjacks are rarer and doubling is slightly weaker.</p>
    <table class="evtable">${rows.map(([d, e]) => `<tr class="${d === rules.decks ? 'best' : ''}"><td>${d} deck${d === 1 ? '' : 's'}${d === rules.decks ? ' (yours)' : ''}</td><td class="num">${e === null ? '—' : e.toFixed(2) + '%'}</td></tr>`).join('')}</table>
    ${five !== null && six !== null ? `<p>5 decks vs 6 decks: <b class="num">${(six - five).toFixed(2)}</b> percentage points — about <b>$${((six - five)).toFixed(2)} per $100</b> wagered. Not something you can feel.</p>` : ''}
    <p class="small dim">${cur && cur[1] !== null ? 'Deck counts of 3, 5 and 7 are interpolated between exactly-solved sizes.' : ''}</p></div>
    <div class="card"><b>Does the strategy change with the number of decks?</b><p class="small dim" style="margin-top:4px">Almost not at all. Between 4 and 8 decks the basic-strategy chart is the same; the chart and cheat card on the other tabs will show any cell that moves if you change the deck count. The Dojo uses 6 decks as the default because that is what most online tables deal.</p></div>
    <div class="card"><b>How the shoe works in the Dojo</b><ul style="padding-left:20px;margin:8px 0 0">
      <li>The Live Table, Gravity Blackjack and the Practice Table deal from one shoe that carries over from hand to hand, like a live dealer.</li>
      <li>A cut card sits at 75% by default (50–85% in the Shoe settings). When it comes out, the shoe is reshuffled before the next hand.</li>
      <li>Want a fresh shuffle every hand (RNG style)? Shoe settings → Every hand. <b>Reshuffle now</b> is there too.</li>
      <li>The hole card is kept out of the count until it is turned over.</li></ul></div>
    <a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:10px" href="#/play/practice">Open the Practice Table</a>`;
}
