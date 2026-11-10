// Optional spoken feedback (Web Speech). Off by default; Coach > Settings turns it on. Silent if unsupported.
import { ctx } from './ctx.js';
const strip = (s) => String(s).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
export const voiceOn = () => !!(ctx.profile && ctx.profile.settings && ctx.profile.settings.voice) && 'speechSynthesis' in window;
export function say(text, { rate = 1.05, queue = false } = {}) {
  if (!voiceOn()) return;
  try { if (!queue) speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(strip(text)); u.rate = rate; speechSynthesis.speak(u); } catch { /* ignore */ }
}
export const stopSpeaking = () => { try { speechSynthesis.cancel(); } catch { /* ignore */ } };
