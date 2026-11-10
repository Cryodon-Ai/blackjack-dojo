// Session guard: the stop-time timer for a planned real-money session, plus gentle reality checks.
import { toast } from '../ui/hand.js';

let timer = null, lastReality = Date.now(), warned = null;
const bootAt = Date.now();

export function planStatus(ctx) {
  const p = ctx.profile && ctx.profile.plan;
  if (!p) return null;
  return { ...p, elapsedMin: Math.floor((Date.now() - p.start) / 60000) };
}

function bar(text, over) {
  let b = document.getElementById('plan-bar');
  if (!text) { if (b) b.hidden = true; return; }
  if (!b) { b = document.createElement('a'); b.id = 'plan-bar'; b.href = '#/coach/session'; document.body.appendChild(b); }
  b.hidden = false; b.textContent = text; b.className = over ? 'over' : '';
}

export function startGuard(ctx) {
  clearInterval(timer);
  const tick = () => {
    const p = planStatus(ctx), s = ctx.profile.settings || {};
    if (p) {
      const left = p.minutes - p.elapsedMin, over = left <= 0;
      bar(over ? `Time is up (${p.game}): stop and debrief` : `${p.game} · ${left} min left · stop-loss $${p.limit}`, over);
      if (over && warned !== p.start) { warned = p.start; toast('Your planned time is up. Time to stop.', 6000); }
    } else bar(null);
    const every = (s.realityMin ?? 30) * 60000;
    if (every && Date.now() - lastReality >= every) { lastReality = Date.now(); toast(`Reality check: you have been in the app ${Math.round((Date.now() - bootAt) / 60000)} minutes.`, 5000); }
  };
  tick(); timer = setInterval(tick, 20000);
}
