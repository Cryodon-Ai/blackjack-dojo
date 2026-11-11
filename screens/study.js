// Coach memory: the questions the offline brain could not answer, what it has learned, and how to study them.
//   - Claude Code study session (no key): copy the questions, have Claude Code answer them, paste the result back.
//   - Claude API researcher (your own key, optional): "Study now" works the queue while the app is open and online.
// Learned answers are saved on this phone and searched by Ask the Coach, offline, from then on.

import { brainOf, topQueue, dropQuestion, exportQueue, importEntries, removeEntry, studyQueue, RESEARCHERS, getKey, setKey } from '../app/brain/memory.js';
import { addKnowledge } from '../app/brain/brain.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BADGE = { verified: ['ok', 'checked against the solvers'], sourced: ['info', 'sourced'], unverified: ['due', 'unverified'] };
const when = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default async function study(el, parts, ctx) {
  const b = brainOf(ctx);
  let msg = '', busy = false;
  function draw() {
    const q = topQueue(ctx), lib = b.library, hasKey = !!getKey();
    el.innerHTML = `<div class="topbar"><a class="back" href="#/coach">‹ Coach</a></div><h1>Coach memory</h1>
      <p class="dim small" style="margin-top:0">When Ask the Coach cannot answer, it keeps the question. A study session answers them, and from then on the coach knows the answer <b>offline</b>. Everything is stored on this phone.</p>
      ${msg ? `<div class="card small">${msg}</div>` : ''}
      <h2>Questions waiting (${q.length})</h2>
      ${q.length ? q.map((x) => `<div class="card row" style="gap:8px"><div class="grow small">${esc(x.q)}${x.n > 1 ? ` <span class="dim">· asked ${x.n}×</span>` : ''}</div><button class="btn small ghost" data-drop="${esc(x.q)}" aria-label="Remove">✕</button></div>`).join('') : '<div class="card small dim">Nothing waiting. Ask the Coach something it does not know and it will land here.</div>'}
      <div class="card"><h3>Study session</h3>
        ${hasKey ? `<button class="btn primary block" id="now" ${busy || !q.length ? 'disabled' : ''}>${busy ? 'Studying…' : 'Study now (uses your API key)'}</button><p class="small dim">Works up to 5 questions, one short answer each. API answers are labelled <i>unverified</i>; any number should be checked against the solvers.</p>` : ''}
        <button class="btn block" id="copy" ${q.length ? '' : 'disabled'} style="margin-top:8px">Copy the questions for Claude Code</button>
        <p class="small dim" style="margin:6px 0">Paste them into a Claude Code session in the Dojo project and ask it to research them. It writes the answers into <code>data/learned.json</code>, which ships with the app, or gives you JSON to paste here:</p>
        <textarea id="imp" rows="4" placeholder='{"entries":[{"title":"…","standard":"…"}]}'></textarea>
        <button class="btn block" id="imp-go" style="margin-top:6px">Import answers</button></div>
      <h2>What I have learned (${lib.length})</h2>
      ${lib.length ? lib.slice(0, 40).map((e) => { const [cls, txt] = BADGE[e.status] || BADGE.unverified; return `<div class="card"><div class="row" style="gap:8px"><div class="grow"><b>${esc(e.title)}</b> <span class="small ${cls}">· ${txt}</span><div class="small dim">${esc(e.standard).slice(0, 160)}${e.standard.length > 160 ? '…' : ''}</div><div class="small dim">${when(e.t)} · from ${e.src === 'api' ? 'the API' : e.src === 'study' ? 'a study session' : 'you'}${(e.sources || []).length ? ' · ' + e.sources.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">source</a>`).join(' ') : ''}</div></div><button class="btn small ghost" data-rm="${esc(e.id)}" aria-label="Forget">✕</button></div></div>`; }).join('') : '<div class="card small dim">Nothing learned yet.</div>'}
      <h2>Settings</h2>
      <div class="card"><b>Claude API key (optional)</b><p class="small dim" style="margin:4px 0 8px">Lets the coach research its own questions while the app is open and online. Get a key at console.anthropic.com (separate from a Claude.ai plan; set a monthly spend limit there). The key stays on this phone only and is not included in backups.</p>
        <input id="key" type="password" placeholder="${hasKey ? 'A key is saved (paste to replace)' : 'sk-ant-…'}" autocomplete="off">
        <div class="row" style="gap:8px;margin-top:8px"><button class="btn" id="key-save">Save key</button>${hasKey ? '<button class="btn ghost" id="key-clear">Remove key</button>' : ''}</div></div>`;
    el.querySelectorAll('[data-drop]').forEach((x) => x.onclick = () => { dropQuestion(ctx, x.dataset.drop); ctx.save(); draw(); });
    el.querySelectorAll('[data-rm]').forEach((x) => x.onclick = () => { removeEntry(ctx, x.dataset.rm); ctx.save(); draw(); });
    el.querySelector('#copy').onclick = async () => { const t = exportQueue(ctx); try { await navigator.clipboard.writeText(t); msg = 'Copied. Paste it into Claude Code.'; } catch { el.querySelector('#imp').value = t; msg = 'Could not copy automatically; the text is in the box below. Select it and copy.'; } draw2(); };
    el.querySelector('#imp-go').onclick = () => { try { const got = importEntries(ctx, el.querySelector('#imp').value); ctx.save(); msg = `Learned ${got.length} thing${got.length > 1 ? 's' : ''}. Ask the Coach about ${esc(got[0].title)}.`; } catch (e) { msg = `<span class="bad">${esc(e.message)}</span>`; } draw(); };
    el.querySelector('#key-save').onclick = () => { const v = el.querySelector('#key').value.trim(); if (v) { setKey(v); msg = 'Key saved on this phone.'; } draw(); };
    const kc = el.querySelector('#key-clear'); if (kc) kc.onclick = () => { setKey(''); msg = 'Key removed.'; draw(); };
    const now = el.querySelector('#now'); if (now) now.onclick = run;
  }
  const draw2 = () => { const keep = el.querySelector('#imp') ? el.querySelector('#imp').value : ''; draw(); if (keep) el.querySelector('#imp').value = keep; };
  async function run() {
    if (busy) return; busy = true; msg = ''; draw();
    if (!RESEARCHERS.anthropic.available()) { busy = false; msg = '<span class="bad">No connection, or no key.</span>'; return draw(); }
    try {
      const r = await studyQueue(ctx, RESEARCHERS.anthropic, { max: 5 });
      await ctx.save(); msg = `Studied ${r.done} question${r.done === 1 ? '' : 's'}${r.failed ? `, ${r.failed} failed (check the key and billing)` : ''}. They are unverified until checked.`;
    } catch (e) { msg = `<span class="bad">${esc(e.message || e)}</span>`; }
    busy = false; if (el.isConnected) draw();
  }
  draw();
  return () => { busy = true; };
}
