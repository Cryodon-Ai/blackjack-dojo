// Shared app context: the loaded profile plus helpers every screen uses.
import { store } from './store.js';
import { normalizeRules } from '../engine/rules.js';

export const ctx = {
  profile: null,
  async load() { this.profile = await store.getProfile(); return this.profile; },
  async save() { await store.saveProfile(this.profile); },
  get rules() { return normalizeRules(this.profile.activeRuleSet); },
  async setRules(rules, presetId) { this.profile.activeRuleSet = { ...rules }; this.profile.activePresetId = presetId || 'custom'; await this.save(); },
  esc: (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
};

export const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
export async function handsToday() {
  const t0 = startOfToday();
  return (await store.allSessions()).filter((s) => s.date >= t0).reduce((a, s) => a + (s.handsPlayed || 0), 0);
}
