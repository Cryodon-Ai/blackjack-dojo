// The coach's memory: questions it could not answer, things it has learned, and a pluggable "researcher".
//   queue    : questions the offline brain could not answer (merged, counted)       -> profile.brain.queue
//   library  : answers learned from study sessions (yours, Claude Code's, or an API researcher) -> profile.brain.library
//   shipped  : data/learned.json, written by a study session in Claude Code and committed with the app
// Everything is local. A researcher turns a queued question into a library entry; today the "manual" researcher
// (export the queue, have Claude Code answer it, import the result) is the only one that needs no key. The
// "anthropic" researcher is ready for a key pasted into Study > Settings; the key lives in localStorage, never in
// the profile (so it never ends up in a backup export).

import { addKnowledge } from './brain.js';

const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
export const brainOf = (ctx) => (ctx.profile.brain ||= { queue: [], library: [], topics: {} });
const STOPW = new Set('what the for how does and are should can you with about explain tell why when which who this that from into have has was were your'.split(' '));
const STATUS = new Set(['verified', 'sourced', 'unverified']);

// ---- question queue --------------------------------------------------------------------------------------------
export function logQuestion(ctx, text, reason = 'no answer') {
  const b = brainOf(ctx), k = norm(text);
  if (!k || k.length < 4) return null;
  let e = b.queue.find((x) => norm(x.q) === k || similar(norm(x.q), k));
  if (e) { e.n++; e.t = Date.now(); }
  else { e = { q: String(text).trim().slice(0, 300), n: 1, t: Date.now(), reason }; b.queue.unshift(e); if (b.queue.length > 200) b.queue.length = 200; }
  return e;
}
function similar(a, b) {                                   // same words in any order, 85% overlap
  const A = new Set(a.split(' ')), B = new Set(b.split(' ')); let i = 0;
  for (const w of A) if (B.has(w)) i++;
  return i / Math.max(A.size, B.size) >= 0.85;
}
export const topQueue = (ctx, n = 50) => brainOf(ctx).queue.slice().sort((a, b) => b.n - a.n || b.t - a.t).slice(0, n);
export function dropQuestion(ctx, q) { const b = brainOf(ctx); b.queue = b.queue.filter((x) => x.q !== q); }

// ---- library ------------------------------------------------------------------------------------------------------------
// entry: { id, title, tags, simple, standard, deep, links?, status, sources?, src, t }
export function addEntry(ctx, e) {
  const b = brainOf(ctx);
  if (!e || !e.title || !e.standard) throw new Error('an entry needs a title and a standard explanation');
  const entry = {
    id: e.id || 'learned-' + norm(e.title).replace(/ /g, '-').slice(0, 40), title: String(e.title).slice(0, 120), tags: String(e.tags || e.title),
    simple: String(e.simple || e.standard), standard: String(e.standard), deep: String(e.deep || e.standard), links: Array.isArray(e.links) ? e.links : [],
    status: STATUS.has(e.status) ? e.status : 'unverified', sources: Array.isArray(e.sources) ? e.sources.slice(0, 5) : [], src: e.src || 'you', t: Date.now(),
  };
  b.library = b.library.filter((x) => x.id !== entry.id);
  b.library.unshift(entry);
  if (b.library.length > 300) b.library.length = 300;
  // any queued question that this entry answers is now done
  const hay = new Set(norm(entry.title + ' ' + entry.tags).split(' '));
  b.queue = b.queue.filter((x) => { const ws = norm(x.q).split(' ').filter((w) => w.length > 2 && !STOPW.has(w)); return !ws.length || ws.filter((w) => hay.has(w)).length / ws.length < 0.6; });
  addKnowledge([entry]);
  return entry;
}
export function removeEntry(ctx, id) { const b = brainOf(ctx); b.library = b.library.filter((x) => x.id !== id); }

// Load shipped + personal knowledge into the brain at startup (safe to call more than once).
export async function loadKnowledge(ctx) {
  const b = brainOf(ctx);
  let shipped = [];
  try { const r = await fetch('./data/learned.json'); if (r.ok) shipped = (await r.json()).entries || []; } catch { /* offline or missing: fine */ }
  addKnowledge([...shipped.map((e) => ({ ...e, src: 'study' })), ...b.library]);
  return { shipped: shipped.length, mine: b.library.length };
}

// ---- export / import for a study session in Claude Code -----------------------------------------------------------------------
export const exportQueue = (ctx) => JSON.stringify({ about: 'Dojo coach questions to research. Answer each as an entry in the format below.', format: { entries: [{ title: '', tags: 'space separated keywords', simple: '', standard: '', deep: '', status: 'verified | sourced | unverified', sources: ['https://…'], links: [{ href: '#/play/…', text: '' }] }] }, questions: topQueue(ctx).map((x) => ({ q: x.q, asked: x.n })) }, null, 2);
export function importEntries(ctx, text) {
  let data; try { data = JSON.parse(text); } catch { throw new Error('That is not valid JSON.'); }
  const list = Array.isArray(data) ? data : data.entries;
  if (!Array.isArray(list) || !list.length) throw new Error('No entries found. Expect {"entries":[…]}.');
  return list.map((e) => addEntry(ctx, { ...e, src: e.src || 'study' }));
}

// ---- researchers (the slot an API key plugs into) ----------------------------------------------------------------------------------
const KEY = 'dojo-coach-key';
export const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const setKey = (k) => { try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY); } catch { /* ignore */ } };

export const RESEARCHERS = {
  manual: { name: 'Claude Code study session (no key)', available: () => true, auto: false },
  anthropic: {
    name: 'Claude API (your key)', auto: true,
    available: () => !!getKey() && (typeof navigator === 'undefined' || navigator.onLine !== false),
    async research(question, { fetchImpl = fetch, model = 'claude-haiku-5-5' } = {}) {
      const prompt = `You write short, accurate explanations for a blackjack, baccarat, poker and card-counting trainer. Question from the user: "${question}"\nReply with ONLY a JSON object: {"title","tags","simple","standard","deep"} where simple is 1-2 plain sentences, standard a short paragraph, deep adds the maths. Do not claim any betting system beats the house edge. If you are not sure of a fact, say so in the text.`;
      const r = await fetchImpl('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': getKey(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model, max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!r.ok) throw new Error(`The API said ${r.status}. Check the key and your billing.`);
      const j = await r.json(), text = (j.content || []).map((c) => c.text || '').join('');
      const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('The answer was not in the expected format.');
      const e = JSON.parse(m[0]);
      return { ...e, status: 'unverified', src: 'api' };      // never auto-trusted: it is labelled until the numbers are checked
    },
  },
};

// Work the queue with a researcher; returns { done, failed }.
export async function studyQueue(ctx, researcher, { max = 5, onProgress } = {}) {
  const todo = topQueue(ctx, max); let done = 0, failed = 0;
  for (const item of todo) {
    try { const e = await researcher.research(item.q); addEntry(ctx, { ...e, tags: `${e.tags || ''} ${item.q}` }); done++; }
    catch (err) { failed++; if (onProgress) onProgress({ item, err }); }
    if (onProgress) onProgress({ done, failed, total: todo.length });
  }
  return { done, failed };
}
