// Stats tab: error heatmap (default), live chart (unlocked at Tier 6), sessions, certificates, data, settings.
import { ROWS, UPCARDS, POOLS } from '../curriculum/cells.js';
import { upLabel } from '../engine/rules.js';
import { srs } from '../app/srs.js';
import { store } from '../app/store.js';
import { engine } from '../app/engine-client.js';
import { describeRules, PRESETS } from '../app/presets.js';
import { openRulesEditor } from '../ui/rules-editor.js';
import { openSheet, confirmSheet } from '../ui/sheet.js';
import { toast } from '../ui/hand.js';
import { signed, ACTION_NAME, usd100, pct } from '../app/feedback.js';
import { handsToday } from '../app/ctx.js';

const VIEWS = [['heat', 'Heatmap'], ['chart', 'Chart'], ['sessions', 'Sessions'], ['certs', 'Certs'], ['data', 'Data'], ['settings', 'Settings']];
const STAT_ROWS = ROWS.filter((r) => !(r.kind === 'hard' && r.total === 21));
const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default async function stats(el, parts, ctx) {
  const view = VIEWS.some((v) => v[0] === parts[0]) ? parts[0] : 'heat';
  el.innerHTML = `<h1>Stats</h1><div class="seg" id="seg" style="overflow-x:auto">${VIEWS.map(([k, n]) => `<button data-v="${k}" class="${k === view ? 'on' : ''}" style="min-width:76px">${n}</button>`).join('')}</div><div id="body" style="margin-top:14px"></div>`;
  el.querySelectorAll('#seg button').forEach((b) => b.onclick = () => { location.hash = `#/stats/${b.dataset.v}`; });
  const body = el.querySelector('#body');
  const fn = { heat, chart, sessions, certs, data, settings }[view];
  return fn(body, ctx);
}

// ---- heatmap ------------------------------------------------------------------------------
const tint = (c, rules) => {
  const s = srs.get(c.rowKey, c.up, rules);
  if (!s || !s.attempts) return { bg: '#17171c', fg: '#4a4a55', txt: '', s: null };
  const a = s.correct / s.attempts;
  const hue = Math.round(a * 125);
  const light = 30 + Math.min(s.attempts, 6) * 2;
  return { bg: `hsl(${hue} 70% ${light}%)`, fg: '#fff', txt: s.attempts >= 10 ? Math.round(a * 100) : '', s };
};

async function heat(body, ctx) {
  const rules = ctx.rules, now = Date.now();
  let att = 0, cor = 0, seen = 0, mastered = 0, dueN = 0, lost = 0;
  const all = STAT_ROWS.flatMap((r) => UPCARDS.map((u) => ({ rowKey: r.key, up: u })));
  for (const c of all) {
    const s = srs.get(c.rowKey, c.up, rules);
    if (!s || !s.attempts) continue;
    seen++; att += s.attempts; cor += s.correct; lost += s.evLostTotal || 0;
    if (s.attempts >= 3 && s.correct / s.attempts >= 0.9) mastered++;
    if (s.due <= now) dueN++;
  }
  let html = `<div class="stat3"><div class="card"><div class="v ${att && cor / att >= 0.9 ? 'ok' : ''}">${att ? Math.round(cor / att * 100) + '%' : '—'}</div><div class="k">Accuracy</div></div>
    <div class="card"><div class="v">${mastered}</div><div class="k">Mastered</div></div><div class="card"><div class="v ${dueN ? 'due' : ''}">${dueN}</div><div class="k">Due</div></div></div>
    <p class="small dim">Each square is <b>your</b> accuracy on that decision — not the right answer. Red = you miss it. Green = you own it. Gray = not seen. Amber outline = due for review. Tap a square for detail.</p>
    <div class="grid" id="hm"><div class="hd"></div>${UPCARDS.map((u) => `<div class="hd">${upLabel(u)}</div>`).join('')}`;
  let lastKind = '';
  for (const r of STAT_ROWS) {
    if (r.kind !== lastKind) { html += `<div class="sep"></div>`; lastKind = r.kind; }
    html += `<div class="rl">${r.label}</div>`;
    for (const u of UPCARDS) {
      const t = tint({ rowKey: r.key, up: u }, rules);
      const isDue = t.s && t.s.due <= now;
      html += `<button class="c" data-r="${r.key}" data-u="${u}" style="background:${t.bg};color:${t.fg};border:0;${isDue ? 'outline:2px solid var(--due);outline-offset:-2px;' : ''}">${t.txt}</button>`;
    }
  }
  html += `</div><div class="legend"><span><i style="background:hsl(0 70% 32%)"></i>0%</span><span><i style="background:hsl(60 70% 34%)"></i>50%</span><span><i style="background:hsl(125 70% 36%)"></i>100%</span><span><i style="background:#17171c;border:1px solid #333"></i>unseen</span><span><i style="outline:2px solid var(--due);outline-offset:-2px"></i>due</span></div>
    <p class="small dim">${seen} of ${all.length} decisions seen · your mistakes have averaged <b>${att - cor ? usd100(lost / (att - cor)) : '$0.00'}</b> per $100 wagered on the hand each time (${att - cor} errors) · ${describeRules(rules)}</p>`;
  body.innerHTML = html;
  body.querySelectorAll('#hm .c').forEach((b) => b.onclick = () => cellSheet(ctx, b.dataset.r, Number(b.dataset.u)));
}

function cellSheet(ctx, rowKey, up) {
  const rules = ctx.rules, r = ROWS.find((x) => x.key === rowKey), s = srs.get(rowKey, up, rules);
  const dueTxt = !s ? 'not seen yet' : s.due <= Date.now() ? '<b class="due">due now</b>' : `due ${new Date(s.due).toLocaleDateString()}`;
  const sh = openSheet(`<h3>${r.label} vs ${upLabel(up)}</h3>
    ${s ? `<div class="stat3"><div class="card"><div class="v">${s.attempts}</div><div class="k">Attempts</div></div><div class="card"><div class="v ${s.correct / s.attempts >= 0.9 ? 'ok' : s.correct / s.attempts < 0.7 ? 'bad' : ''}">${Math.round(s.correct / s.attempts * 100)}%</div><div class="k">Accuracy</div></div><div class="card"><div class="v">${s.attempts - s.correct ? usd100((s.evLostTotal || 0) / (s.attempts - s.correct)) : '$0.00'}</div><div class="k">per miss /$100</div></div></div>
      <p class="small dim">Review interval ${s.interval} day${s.interval === 1 ? '' : 's'} · ${dueTxt}</p>` : '<p class="dim">You have not been asked this one yet.</p>'}
    <button class="btn block" id="pin">Add to My Deck</button><div class="gap"></div><button class="btn block ghost" id="x">Close</button>`);
  sh.el.querySelector('#x').onclick = sh.close;
  sh.el.querySelector('#pin').onclick = async () => {
    const p = ctx.profile; p.deck = p.deck || [];
    if (!p.deck.some((d) => d.rowKey === rowKey && d.up === up)) p.deck.push({ rowKey, up });
    await ctx.save(); toast('Added to My Deck.'); sh.close();
  };
}

// ---- live chart ---------------------------------------------------------------------------
async function chart(body, ctx) {
  const p = ctx.profile, unlocked = p.tierUnlocked >= 6 || p.settings.reveal;
  if (!unlocked) {
    body.innerHTML = `<div class="card"><h3>The chart unlocks in Tier 6</h3><p class="dim">The premise of the Dojo: the chart is the <i>output</i> of understanding, not the input. You reach it by passing Tier 5; until then, learn the reasons and prove them in the drills.</p>
      <a class="btn primary block" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="#/learn">Continue the path</a>
      <div class="gap"></div><button class="btn block ghost" id="rv">Reveal it anyway</button></div>`;
    body.querySelector('#rv').onclick = async () => { if (await confirmSheet('Reveal the chart?', 'You will be able to memorize instead of understand. The drills and gates work the same either way.', { ok: 'Reveal it' })) { p.settings.reveal = true; await ctx.save(); chart(body, ctx); } };
    return;
  }
  const rules = ctx.rules;
  body.innerHTML = `<div class="card row"><div class="grow small">${describeRules(rules)}</div><button class="btn small ghost" id="chg">Change</button></div>
    <div class="small dim" id="cp">Generating from the engine…</div><div class="grid" id="cg"></div>
    <div class="legend"><span><i class="act-H"></i>Hit</span><span><i class="act-S"></i>Stand</span><span><i class="act-D"></i>Double</span><span><i class="act-P"></i>Split</span><span><i class="act-R"></i>Surrender</span></div>
    <p class="small dim">Every cell is computed live by the verified engine for these rules; nothing here is a stored chart. Hard totals show the total-dependent action. Tap a cell for the expected value of each choice.</p>`;
  body.querySelector('#chg').onclick = () => openRulesEditor(rules, { title: 'Chart rules', onSave: async (r, id) => { await ctx.setRules(r, id); engine.prefill(ctx.rules, () => {}); chart(body, ctx); } });
  const grid = body.querySelector('#cg');
  let html = `<div class="hd"></div>${UPCARDS.map((u) => `<div class="hd">${upLabel(u)}</div>`).join('')}`;
  let lastKind = '';
  for (const r of STAT_ROWS) {
    if (r.kind !== lastKind) { html += `<div class="sep"></div>`; lastKind = r.kind; }
    html += `<div class="rl">${r.label}</div>` + UPCARDS.map((u) => `<button class="c none" id="c-${r.key}-${u}" data-r="${r.key}" data-u="${u}" style="border:0"></button>`).join('');
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.c').forEach((b) => b.onclick = () => chartSheet(rules, b.dataset.r, Number(b.dataset.u)));
  let n = 0;
  const total = STAT_ROWS.length * 10;
  let alive = true;
  (async () => {
    for (const r of STAT_ROWS) for (const u of UPCARDS) {
      if (!alive || !body.isConnected) return;
      const c = await engine.cell(rules, r.key, u);
      const b = grid.querySelector(`#c-${r.key}-${u}`);
      if (b) { b.className = `c act-${c.action}`; b.textContent = c.action; }
      if (++n % 20 === 0) { const e = body.querySelector('#cp'); if (e) e.textContent = `Generating from the engine… ${n}/${total}`; }
    }
    const e = body.querySelector('#cp'); if (e) e.textContent = `${total} cells generated.`;
  })();
  return () => { alive = false; };
}

async function chartSheet(rules, rowKey, up) {
  const r = ROWS.find((x) => x.key === rowKey);
  const c = await engine.cell(rules, rowKey, up);
  const order = ['stand', 'hit', 'double', 'split', 'surrender'].filter((k) => c.ev[k] !== undefined).sort((a, b) => c.ev[b] - c.ev[a]);
  const T = { stand: 'S', hit: 'H', double: 'D', split: 'P', surrender: 'R' };
  const sh = openSheet(`<h3>${r.label} vs ${upLabel(up)}: <span class="ok">${ACTION_NAME[c.action]}</span></h3>
    <table class="evtable">${order.map((k) => `<tr class="${T[k] === c.action ? 'best' : ''} ${c.legal[k] ? '' : 'illegal'}"><td>${ACTION_NAME[T[k]]}${c.legal[k] ? '' : ' — n/a'}</td><td class="num">${signed(c.ev[k], 2)}</td></tr>`).join('')}</table>
    <p class="small dim">Expected result per $1 bet. Margin to the runner-up: ${c.margin === null ? '—' : usd100(c.margin) + ' per $100'}.</p><button class="btn block ghost" id="x">Close</button>`);
  sh.el.querySelector('#x').onclick = sh.close;
}

// ---- sessions / certificates ---------------------------------------------------------------
async function sessions(body) {
  const all = (await store.allSessions()).slice().reverse();
  const today = await handsToday();
  body.innerHTML = `<div class="card"><div class="small dim">Hands played today</div><div class="big num">${today}</div></div>
    ${all.length ? all.slice(0, 60).map((s) => `<div class="card row"><div class="grow"><b>${s.mode}</b><div class="small dim">${fmtDate(s.date)} · ${s.handsPlayed} hands${s.evLost ? ` · leaked ${usd100(s.evLost)}/100` : ''}${s.bankrollDelta ? ` · ${s.bankrollDelta >= 0 ? '+' : '−'}$${Math.abs(s.bankrollDelta).toFixed(2)}` : ''}</div></div><div class="num ${s.accuracy >= 0.95 ? 'ok' : s.accuracy < 0.8 ? 'bad' : ''}" style="font-size:20px;font-weight:800">${Math.round((s.accuracy || 0) * 100)}%</div></div>`).join('') : '<p class="dim">No sessions yet.</p>'}`;
}

async function certs(body) {
  const all = (await store.allCerts()).slice().reverse();
  body.innerHTML = all.length ? all.map((c) => certCard(c)).join('') + '' : `<div class="card"><p class="dim">No certificate yet. Pass Tier 8, then take the Certification.</p><a class="btn primary block" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="#/cert">Certification</a></div>`;
}
export function certCard(c) {
  const age = Math.floor((Date.now() - c.date) / 86400000);
  return `<div class="card ok"><div class="small dim">Blackjack Dojo · Certified decisions</div><div class="big num ok" style="margin:6px 0">${Math.round(c.score * 100)}%</div>
    <div>${new Date(c.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    <div class="small dim">${c.hands} hands · ${c.ruleSetRandomized ? 'randomized rule sets' : 'fixed rules'} · 3 s clock · no chart</div>
    <div class="small" style="margin-top:6px">Per-hand error cost: <b>${usd100(c.perHandErrorCost)}</b> per $100 wagered${c.errors ? ` (${c.errors} error${c.errors === 1 ? '' : 's'})` : ' (zero errors)'}</div>
    <div class="small ${age > 30 ? 'due' : 'dim'}" style="margin-top:4px">${age > 30 ? `${age} days old — re-test to refresh` : `${age} day${age === 1 ? '' : 's'} old`}</div></div>`;
}

// ---- data (export / import) ----------------------------------------------------------------
async function data(body, ctx) {
  const cells = (await store.allCells()).length;
  body.innerHTML = `<div class="card"><h3>Your progress lives on this phone</h3><p class="dim small">${store.usingFallback ? 'Using localStorage fallback (IndexedDB unavailable).' : 'Stored in IndexedDB.'} ${cells} decision cells tracked. On iPhone, a home-screen app has its own storage — export regularly so an iOS storage reset never costs you your progress.</p>
    <button class="btn primary block" id="exp">Export to a JSON file</button><div class="gap"></div>
    <button class="btn block" id="imp">Import from a JSON file</button><input type="file" id="file" accept="application/json,.json" style="display:none">
    <div class="gap"></div><button class="btn block ghost" id="paste">Paste JSON instead</button></div>
    <div class="card"><h3>Reset</h3><p class="dim small">Erase everything on this device. Export first.</p><button class="btn danger block" id="wipe">Erase all progress</button></div>`;
  body.querySelector('#exp').onclick = async () => {
    const obj = await store.exportAll();
    const json = JSON.stringify(obj, null, 1);
    const name = `blackjack-dojo-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Blackjack Dojo backup' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
    catch { /* fall through to copy sheet */ }
    const sh = openSheet(`<h3>Copy your backup</h3><p class="small dim">If no file was saved, copy this text and keep it somewhere safe (Notes, email to yourself). Import it later with "Paste JSON".</p><textarea id="t" rows="8" readonly>${json.replace(/</g, '&lt;')}</textarea><div class="gap"></div><button class="btn primary block" id="cp">Copy</button><div class="gap"></div><button class="btn block ghost" id="x">Close</button>`);
    sh.el.querySelector('#cp').onclick = async () => { try { await navigator.clipboard.writeText(json); toast('Copied.'); } catch { sh.el.querySelector('#t').select(); toast('Select all and copy.'); } };
    sh.el.querySelector('#x').onclick = sh.close;
  };
  const doImport = async (text) => {
    try {
      const obj = JSON.parse(text);
      if (!(await confirmSheet('Replace all progress?', `This device's progress will be replaced by the backup (${(obj.cells || []).length} cells, ${(obj.sessions || []).length} sessions).`, { ok: 'Import', danger: true }))) return;
      await store.importAll(obj); await ctx.load(); await srs.load(); srs.cache.clear(); for (const c of await store.allCells()) srs.cache.set(c.key, c);
      toast('Imported.'); data(body, ctx);
    } catch (e) { toast('Import failed: ' + (e.message || e), 4200); }
  };
  body.querySelector('#imp').onclick = () => body.querySelector('#file').click();
  body.querySelector('#file').onchange = async (e) => { const f = e.target.files[0]; if (f) doImport(await f.text()); };
  body.querySelector('#paste').onclick = () => {
    const sh = openSheet(`<h3>Paste backup JSON</h3><textarea id="t" rows="8" placeholder='{"app":"blackjack-dojo", …}'></textarea><div class="gap"></div><button class="btn primary block" id="go">Import</button><div class="gap"></div><button class="btn block ghost" id="x">Cancel</button>`);
    sh.el.querySelector('#go').onclick = () => { const t = sh.el.querySelector('#t').value; sh.close(); doImport(t); };
    sh.el.querySelector('#x').onclick = sh.close;
  };
  body.querySelector('#wipe').onclick = async () => {
    if (await confirmSheet('Erase everything?', 'Progress, cells, sessions and certificates on this device will be deleted. This cannot be undone.', { ok: 'Erase', danger: true })) {
      await store.wipe(); await ctx.load(); srs.cache.clear(); toast('Erased.'); data(body, ctx);
    }
  };
}

// ---- settings ------------------------------------------------------------------------------
async function settings(body, ctx) {
  const s = ctx.profile.settings, rules = ctx.rules;
  const preset = PRESETS.find((p) => p.id === ctx.profile.activePresetId);
  body.innerHTML = `<div class="card"><div class="small dim">Table rules (drills, chart, live table)</div><div style="margin:4px 0">${preset ? `<b>${preset.name}</b>${preset.unverified ? ' <span class="pill due">rules unverified</span>' : ''}<br>` : ''}<span class="small">${describeRules(rules)}</span></div><button class="btn block" id="rules">Change table rules</button></div>
    <div class="card"><h3>Guardrails</h3>
      <label class="field">Session loss limit ($) — set before you play, enforced in Live Table<input type="number" id="ll" inputmode="decimal" value="${s.lossLimit}"></label>
      <label class="field">Session bankroll ($)<input type="number" id="bk" inputmode="decimal" value="${s.bankroll}"></label>
      <label class="field">Unit bet ($)<input type="number" id="ub" inputmode="decimal" value="${s.unit}"></label></div>
    <div class="card"><h3>Drills</h3>
      <label class="field">Flash Drill starting clock: <b id="fsv">${s.flashSeconds.toFixed(1)}s</b> (tightens to 1.2s as you improve)<input type="range" id="fs" min="1.2" max="4" step="0.1" value="${s.flashSeconds}"></label>
      <label class="field">Live Table feedback mode<select id="mode">
        <option value="off" ${s.mode === 'off' ? 'selected' : ''}>Off — no feedback</option>
        <option value="coach" ${s.mode === 'coach' ? 'selected' : ''}>Coach — blocks wrong moves and explains</option>
        <option value="rewind" ${s.mode === 'rewind' ? 'selected' : ''}>Practice + Rewind — play freely, then replay mistakes</option>
      </select></label>
      <div class="toggle"><span>Show the chart before Tier 6</span><input type="checkbox" id="rv" ${s.reveal ? 'checked' : ''}></div></div>
    <div class="card"><h3>About the numbers</h3><p class="small dim">House edges and EVs are computed by an exact solver that is verified against published tables (see engine/verify.js). Everything else — including whatever a casino's marketing says about side bets — is marked as unverified when I cannot check it.</p></div>`;
  body.querySelector('#rules').onclick = () => openRulesEditor(rules, { onSave: async (r, id) => { await ctx.setRules(r, id); engine.prefill(ctx.rules, () => {}); settings(body, ctx); } });
  const num = (id, key, min = 0) => body.querySelector('#' + id).onchange = async (e) => { const v = Number(e.target.value); if (v >= min) { s[key] = v; await ctx.save(); } };
  num('ll', 'lossLimit', 1); num('bk', 'bankroll', 1); num('ub', 'unit', 0.01);
  body.querySelector('#fs').oninput = async (e) => { s.flashSeconds = Number(e.target.value); body.querySelector('#fsv').textContent = s.flashSeconds.toFixed(1) + 's'; await ctx.save(); };
  body.querySelector('#mode').onchange = async (e) => { s.mode = e.target.value; s.coach = s.mode === 'coach'; await ctx.save(); };
  body.querySelector('#rv').onchange = async (e) => { s.reveal = e.target.checked; await ctx.save(); };
}
