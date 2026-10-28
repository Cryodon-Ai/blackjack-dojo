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

// Card-deal swish: a short filtered noise burst per card (only when sound cues are on).
export function deal(n = 1) {
  const s = (ctx.profile && ctx.profile.settings) || {};
  if (!s.soundOn) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    for (let k = 0; k < Math.min(n, 4); k++) {
      const len = Math.floor(ac.sampleRate * 0.09), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = 'bandpass'; f.frequency.value = 2600; g.gain.value = 0.05;
      src.buffer = buf; src.connect(f); f.connect(g); g.connect(ac.destination);
      src.start(ac.currentTime + k * 0.21);
    }
  } catch { /* audio unavailable */ }
}
