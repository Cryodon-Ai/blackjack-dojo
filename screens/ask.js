// Ask the Coach: a chat that answers questions about blackjack, counting, baccarat, poker and money,
// computing the numbers with the app's own engines. Three explanation levels. Works fully offline.

import { answer, mem, STARTERS, search } from '../app/brain/brain.js';
import { say, voiceOn, stopSpeaking } from '../app/voice.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LEVELS = [['simple', 'Plain'], ['standard', 'Standard'], ['deep', 'Deep']];
let HISTORY = [];       // survives leaving and returning to the screen

export default async function ask(el, parts, ctx) {
  const s = ctx.profile.settings;
  let level = s.askLevel || 'standard', busy = false;
  const q = new URLSearchParams((location.hash.split('?')[1] || '')).get('q');

  el.innerHTML = `<div class="topbar"><a class="back" href="#/coach">‹ Coach</a><div class="grow"></div><button class="btn small ghost" id="clr">Clear</button></div>
    <h1 style="margin-bottom:4px">Ask the Coach</h1>
    <div class="small dim" style="margin-bottom:8px">Ask about any hand, count, bet, poker spot or concept. I work the numbers out with the app's solvers, and I work offline.</div>
    <div class="seg" id="lv" style="margin:0 0 8px">${LEVELS.map(([v, t]) => `<button data-v="${v}" class="${level === v ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div id="chat"></div>
    <div id="starters"></div>
    <div id="bar" style="position:sticky;bottom:0;background:var(--bg);padding:8px 0 4px;display:flex;gap:8px"><input id="q" type="text" placeholder="e.g. what do I do with soft 18 vs 9?" autocomplete="off" enterkeyhint="send" style="flex:1"><button class="btn primary" id="send">Ask</button></div>`;
  const chat = el.querySelector('#chat'), inp = el.querySelector('#q');

  const bubble = (m) => {
    if (m.role === 'me') return `<div style="display:flex;justify-content:flex-end;margin:8px 0"><div class="card" style="margin:0;max-width:85%;background:var(--surface2)">${esc(m.text)}</div></div>`;
    const a = m.a, text = a[m.level] || a.standard;
    return `<div class="card coach-a" data-i="${m.i}" style="margin:8px 0"><div class="small dim" style="margin-bottom:4px">${esc(a.title || 'Coach')}</div><div class="a-text">${text}</div>
      <div class="row wrap" style="gap:6px;margin-top:8px">${m.level !== 'simple' ? '<button class="btn small ghost" data-act="simple">Simpler</button>' : ''}${m.level !== 'deep' ? '<button class="btn small ghost" data-act="deep">Go deeper</button>' : ''}${a.example ? '<button class="btn small ghost" data-act="example">Show an example</button>' : ''}${voiceOn() ? '<button class="btn small ghost" data-act="say">🔊 Read it</button>' : ''}</div>
      ${(a.links || []).length ? `<div class="small" style="margin-top:8px">${a.links.map((l) => `<a href="${l.href}">${esc(l.text)}</a>`).join(' · ')}</div>` : ''}
      ${(a.chips || []).length ? `<div class="row wrap" style="gap:6px;margin-top:8px">${a.chips.map((c) => `<button class="btn small ghost" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}</div>`;
  };
  const draw = () => {
    chat.innerHTML = HISTORY.map(bubble).join('');
    el.querySelector('#starters').innerHTML = HISTORY.length ? '' : `<div class="small dim" style="margin:8px 0 4px">Try one:</div><div class="row wrap" style="gap:6px">${STARTERS.map((t) => `<button class="btn small ghost" data-chip="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
    el.querySelectorAll('[data-chip]').forEach((b) => b.onclick = () => ask1(b.dataset.chip));
    chat.querySelectorAll('.coach-a').forEach((card) => {
      const m = HISTORY[Number(card.dataset.i)];
      card.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => {
        const act = b.dataset.act;
        if (act === 'say') return say(m.a[m.level] || m.a.standard);
        if (act === 'example') { try { const ex = await m.a.example(); if (ex) { push({ role: 'me', text: 'Show me another example' }); pushA(ex); } } catch (e) { console.error(e); } return; }
        m.level = act; draw();
      });
    });
    window.scrollTo(0, document.body.scrollHeight); el.scrollTop = el.scrollHeight;
  };
  const push = (m) => { m.i = HISTORY.length; HISTORY.push(m); draw(); };
  const pushA = (a) => { push({ role: 'coach', a, level }); if (a.mem) mem.last = a.mem; if (voiceOn()) say(a[level] || a.standard); };

  async function ask1(text) {
    text = text.trim(); if (!text || busy) return;
    busy = true; inp.value = ''; push({ role: 'me', text });
    const thinking = { role: 'coach', a: { title: 'Thinking…', simple: '…', standard: '…', deep: '…' }, level }; push(thinking);
    try {
      const a = await answer(text, ctx);
      HISTORY.pop();
      if (a) pushA(a);
      else {
        const near = search(text, 3).map((h) => h.d.title);
        pushA({ title: "I'm not sure", simple: "I did not catch that one.", standard: `I could not work that out. I understand questions about specific hands (“16 vs 10”, “soft 18 against a 9”, “AKs vs QQ”), counts (“true count +3, what do I bet?”), poker spots (“open J9s from UTG?”), pot odds and outs, baccarat draws, and general ideas (“why is Banker the best bet?”). Try rephrasing${near.length ? ', or one of these topics: ' + near.map(esc).join(', ') : ''}.`, deep: null, chips: STARTERS.slice(0, 4) });
      }
    } catch (e) { console.error(e); HISTORY.pop(); pushA({ title: 'Something went wrong', simple: esc(e.message || e), standard: esc(e.message || e) }); }
    busy = false;
  }

  el.querySelector('#send').onclick = () => ask1(inp.value);
  inp.onkeydown = (e) => { if (e.key === 'Enter') ask1(inp.value); };
  el.querySelectorAll('#lv button').forEach((b) => b.onclick = async () => { level = b.dataset.v; s.askLevel = level; await ctx.save(); el.querySelectorAll('#lv button').forEach((x) => x.classList.toggle('on', x === b)); HISTORY.forEach((m) => { if (m.role === 'coach') m.level = level; }); draw(); });
  el.querySelector('#clr').onclick = () => { HISTORY = []; mem.last = null; stopSpeaking(); draw(); };
  draw();
  if (q) ask1(decodeURIComponent(q));
  return () => stopSpeaking();
}
