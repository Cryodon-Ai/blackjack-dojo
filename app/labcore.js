// Pure Strategy Lab logic (no DOM), so it can be unit-tested in node: tools/lab-test.mjs.

import { UPCARDS, upLabel } from '../engine/rules.js';

export const BUCKET_NAME = { stiff: 'stiff hands (12–16)', soft: 'soft hands', pairs: 'pair splitting', doubles: 'doubling (9–11)', other: 'basic hit/stand calls' };
export const BUCKET_LINK = {
  stiff: ['#/lab/shortcut', 'Dealer-Stiff Shortcut'], soft: ['#/lab/ladder/soft', 'Chunk Ladder: soft hands'], pairs: ['#/lab/ladder/pairs', 'Chunk Ladder: pairs'],
  doubles: ['#/lab/ladder/doubles', 'Chunk Ladder: doubling'], other: ['#/lab/always', 'Always-Rules'],
};

// byBucket: { bucket: {n, c} }. Returns the method to use next and why.
export function recommend(byBucket, acc, avgMs) {
  const entries = Object.entries(byBucket).filter(([, v]) => v.n);
  const weakest = entries.sort((a, b) => a[1].c / a[1].n - b[1].c / b[1].n)[0];
  const links = [];
  let title, why;
  if (acc < 0.6) {
    title = 'Start with the Always-Rules';
    why = `You got ${Math.round(acc * 100)}%. The six always-rules are the fastest way up, then climb the Chunk Ladder.`;
    links.push(['#/lab/always', 'Always-Rules'], ['#/lab/ladder', 'Chunk Ladder']);
  } else if (acc < 0.85 && weakest) {
    const [b, v] = weakest;
    title = `Fix ${BUCKET_NAME[b]}`;
    why = `You got ${Math.round(acc * 100)}%. Weakest area: ${BUCKET_NAME[b]} at ${Math.round((v.c / v.n) * 100)}%.`;
    links.push(BUCKET_LINK[b], ['#/lab/why', 'Why Mode']);
  } else if (avgMs > 6000) {
    title = 'Build speed with Sprint and Fade Chart';
    why = `${Math.round(acc * 100)}% accurate but ${(avgMs / 1000).toFixed(1)}s a hand. Speed work turns knowing into reflex.`;
    links.push(['#/lab/sprint', 'Sprint'], ['#/lab/fade', 'Fade Chart']);
  } else {
    title = 'Lock it in: Gut-Check, then Rewind Play';
    why = `${Math.round(acc * 100)}% and fast. Test the counter-intuitive spots, then play whole hands.`;
    links.push(['#/lab/gut', 'Gut-Check'], ['#/play/practice', 'Rewind Play']);
  }
  return { title, why, links };
}

// ---- Rule Lists text ------------------------------------------------------------------------------
const actName = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' };
export function symOf(c) {
  const e = c.ev, fb = e.hit !== undefined && e.hit >= (e.stand ?? -9) ? 'h' : 's';
  return c.action === 'D' || c.action === 'R' ? c.action + fb : c.action;
}
export const phrase = (k) => (k.length === 2 ? `${k[0] === 'D' ? 'double' : 'surrender'} (else ${k[1] === 'h' ? 'hit' : 'stand'})` : actName[k]);
export function runsText(keys) {
  const runs = [];
  keys.forEach((k, i) => { const last = runs[runs.length - 1]; if (last && last.k === k) last.to = i; else runs.push({ k, from: i, to: i }); });
  const span = (r) => (r.from === r.to ? upLabel(UPCARDS[r.from]) : `${upLabel(UPCARDS[r.from])}–${upLabel(UPCARDS[r.to])}`);
  if (runs.length === 1) return `${phrase(runs[0].k)} always`;
  const count = {};
  for (const k of keys) count[k] = (count[k] || 0) + 1;
  const other = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
  const rest = runs.filter((r) => r.k !== other).map((r) => `${phrase(r.k)} vs ${span(r)}`);
  return `${rest.join('; ')}; otherwise ${phrase(other)}`;
}

// ---- progress / insight helpers -------------------------------------------------------------------
const DAY = 86400000;
export const dayKey = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };

// Consecutive days (ending today, or yesterday if nothing yet today) with any practice.
export function streakDays(sessions, now = Date.now()) {
  const days = new Set(sessions.map((s) => dayKey(s.date)));
  let d = now, n = 0;
  if (!days.has(dayKey(d))) d -= DAY;
  while (days.has(dayKey(d))) { n++; d -= DAY; }
  return n;
}
export const handsOnDay = (sessions, now = Date.now()) => sessions.filter((s) => dayKey(s.date) === dayKey(now)).reduce((a, s) => a + (s.handsPlayed || 0), 0);

// Per-method accuracy and volume from saved sessions (mode starts with 'lab-').
export function methodInsights(sessions) {
  const m = {};
  for (const s of sessions) {
    if (!s.mode || !s.mode.startsWith('lab-') || !s.handsPlayed) continue;
    const k = s.mode.slice(4);
    const o = (m[k] ||= { id: k, hands: 0, correct: 0, sessions: 0 });
    o.hands += s.handsPlayed; o.correct += Math.round((s.accuracy || 0) * s.handsPlayed); o.sessions++;
  }
  return Object.values(m).map((o) => ({ ...o, acc: o.hands ? o.correct / o.hands : 0 })).sort((a, b) => b.hands - a.hands);
}

// Cells you know but answer slowly (>= 3 attempts, accuracy >= 80%, average over `ms`).
export function slowSpots(cells, ms = 5000) {
  return cells.filter((c) => c.attempts >= 3 && c.correct / c.attempts >= 0.8 && (c.msTotal || 0) / c.attempts > ms)
    .sort((a, b) => b.msTotal / b.attempts - a.msTotal / a.attempts);
}

// The ten weakest cells (lowest accuracy, at least 2 attempts) for "Fix my worst 10".
export function worstCells(cells, n = 10) {
  return cells.filter((c) => c.attempts >= 2 && c.correct < c.attempts)
    .sort((a, b) => a.correct / a.attempts - b.correct / b.attempts || b.attempts - a.attempts).slice(0, n);
}

export function mistakeSummary(list) {
  const by = {};
  for (const m of list) { const k = `${m.rowKey}|${m.up}`; (by[k] ||= { rowKey: m.rowKey, up: m.up, n: 0, last: 0 }); by[k].n++; by[k].last = Math.max(by[k].last, m.at); }
  return Object.values(by).sort((a, b) => b.n - a.n || b.last - a.last);
}
