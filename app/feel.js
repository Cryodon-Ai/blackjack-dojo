// Small feedback cues: haptics and a soft tone, both optional (Stats > Settings).
import { ctx } from './ctx.js';

let ac = null;
function tone(freq, ms, vol = 0.04) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(ac.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + ms / 1000); o.stop(ac.currentTime + ms / 1000);
  } catch { /* audio unavailable */ }
}
export function cue(ok) {
  const s = (ctx.profile && ctx.profile.settings) || {};
  if (s.hapticsOn && navigator.vibrate) { try { navigator.vibrate(ok ? 12 : [30, 40, 30]); } catch { /* ignore */ } }
  if (s.soundOn) { if (ok) tone(880, 120); else tone(220, 220); }
}
