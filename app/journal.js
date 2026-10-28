// Mistake journal: the last 60 wrong answers (spot, what you chose, what was right), kept in the profile.
import { ctx } from './ctx.js';

const CAP = 60;
export const journal = {
  list() { return (ctx.profile && ctx.profile.mistakes) || []; },
  async add(m) {
    if (!ctx.profile) return;
    const a = ctx.profile.mistakes || (ctx.profile.mistakes = []);
    a.push({ ...m, at: Date.now() });
    if (a.length > CAP) a.splice(0, a.length - CAP);
    await ctx.save();
  },
  async clear() { if (ctx.profile) { ctx.profile.mistakes = []; await ctx.save(); } },
};
