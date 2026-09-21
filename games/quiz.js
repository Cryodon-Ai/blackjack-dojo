// Multiple-choice runner for quiz-style tiers and the Rules Panel Reader.
import { makeQuestion } from '../curriculum/quizgen.js';
import { srs } from '../app/srs.js';
import { store } from '../app/store.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function startQuiz(root, opts) {
  const o = { total: null, exitHref: '#/learn', title: 'Quiz', mode: 'quiz', secs: null, ...opts };
  const app = document.getElementById('app');
  app.classList.add('focus');
  const st = { n: 0, correct: 0, streak: 0, best: 0, stopped: false, times: [] };
  let raf = 0, cur = null, answered = false, nextP = null;
  root.innerHTML = `<div class="topbar"><a class="back" id="exit" href="${o.exitHref}">‹ Exit</a><div class="grow"></div><div id="ringbox"></div></div>
    <div id="hud" class="row wrap small" style="justify-content:space-between"></div>
    <div id="qbox"></div><div id="verdict"></div><div class="actionbar" id="bar" style="display:block"></div>`;
  const $ = (id) => root.querySelector('#' + id);
  const hud = () => { $('hud').innerHTML = o.hud ? o.hud(st) : `<span class="streak">Streak ${st.streak}</span><span class="dim num">${st.correct}/${st.n}${o.total ? ` of ${o.total}` : ''}</span>`; };
  const stopTimer = () => { cancelAnimationFrame(raf); $('ringbox').innerHTML = ''; };

  function timer(secs, onTimeout) {
    $('ringbox').innerHTML = `<div class="ring"><svg width="64" height="64" viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="27"/><circle class="fg" cx="32" cy="32" r="27" stroke-dasharray="169.6" stroke-dashoffset="0"/></svg><div class="t num"></div></div>`;
    const fg = $('ringbox').querySelector('.fg'), tx = $('ringbox').querySelector('.t');
    const t0 = performance.now(), total = secs * 1000;
    const tick = (now) => {
      const left = Math.max(0, total - (now - t0));
      fg.style.strokeDashoffset = String(169.6 * (1 - left / total));
      fg.style.stroke = left < total * 0.3 ? 'var(--bad)' : left < total * 0.6 ? 'var(--due)' : 'var(--ok)';
      tx.textContent = (left / 1000).toFixed(1);
      if (left <= 0) return onTimeout();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  async function show() {
    if (st.stopped) return;
    answered = false; $('verdict').innerHTML = ''; $('bar').innerHTML = '';
    { const pre = nextP ? await nextP : null; cur = pre || await makeQuestion(o.gen); nextP = null; }
    if (st.stopped) return;
    $('qbox').innerHTML = `<div class="lesson" style="font-size:19px">${cur.q}</div><div class="gap"></div>` +
      cur.opts.map((t, i) => `<button class="btn block" style="margin:8px 0;text-align:left;min-height:56px;font-weight:600" data-i="${i}">${t}</button>`).join('');
    $('qbox').querySelectorAll('button').forEach((b) => b.onclick = () => answer(Number(b.dataset.i)));
    cur.t0 = performance.now();
    hud();
    const secs = cur.secs !== undefined ? cur.secs : o.secs;
    if (secs) timer(secs, () => answer(-1));
    nextP = makeQuestion(o.gen).catch(() => null);
  }

  async function answer(i) {
    if (answered) return;
    answered = true; stopTimer();
    const ok = i === cur.answer, timeout = i < 0;
    st.n++; st.times.push(performance.now() - cur.t0);
    if (ok) { st.correct++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0;
    $('qbox').querySelectorAll('button').forEach((b, j) => {
      b.disabled = true;
      if (j === cur.answer) { b.style.borderColor = 'var(--ok)'; b.style.background = 'color-mix(in srgb, var(--ok) 18%, var(--surface2))'; }
      else if (j === i) { b.style.borderColor = 'var(--bad)'; b.style.background = 'color-mix(in srgb, var(--bad) 18%, var(--surface2))'; }
    });
    if (o.onAnswer) await o.onAnswer(ok, st, cur);
    hud();
    const over = (o.total && st.n >= o.total) || (o.stopWhen && o.stopWhen(st));
    $('verdict').innerHTML = `<div class="verdict ${ok ? 'ok' : 'bad'} pop"><div class="head ${ok ? 'ok' : 'bad'}">${ok ? 'Correct' : timeout ? "Time's up" : 'Not quite'}</div><div class="reason">${cur.why}</div></div>`;
    $('bar').innerHTML = `<button class="btn primary block" id="nx">${over ? 'See results' : 'Next'}</button>`;
    $('bar').querySelector('#nx').onclick = () => (over ? finish() : show());
    setTimeout(() => $('verdict').scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
  }

  async function finish() {
    if (st.stopped) return;
    st.stopped = true; stopTimer(); app.classList.remove('focus');
    const acc = st.n ? st.correct / st.n : 0;
    if (st.n) await store.addSession({ date: Date.now(), mode: o.mode, handsPlayed: st.n, accuracy: acc, evLost: 0, bankrollDelta: 0 });
    const extra = o.onFinish ? (await o.onFinish(st)) || '' : '';
    const avg = st.times.length ? st.times.reduce((a, b) => a + b, 0) / st.times.length / 1000 : 0;
    root.innerHTML = `<h1>${esc(o.title)} — done</h1>
      <div class="stat3"><div class="card"><div class="v ${acc >= 0.95 ? 'ok' : acc < 0.8 ? 'bad' : ''}">${(acc * 100).toFixed(0)}%</div><div class="k">Accuracy</div></div>
      <div class="card"><div class="v">${st.best}</div><div class="k">Best streak</div></div><div class="card"><div class="v">${avg.toFixed(1)}s</div><div class="k">Avg time</div></div></div>${extra}
      <div class="gap"></div><button class="btn primary block" id="again">Go again</button><div class="gap"></div>
      <a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="${o.exitHref}">Done</a>`;
    root.querySelector('#again').onclick = () => (o.restart ? o.restart() : location.reload());
  }

  $('exit').addEventListener('click', () => { st.stopped = true; stopTimer(); app.classList.remove('focus'); });
  show();
  return { stop() { st.stopped = true; stopTimer(); app.classList.remove('focus'); }, state: st, finish };
}
