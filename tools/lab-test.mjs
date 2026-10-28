// Unit tests for the Strategy Lab's pure logic and for the drill pools against the real solver.
//   node tools/lab-test.mjs
import { cellResult } from '../engine/strategy.js';
import { normalizeRules } from '../engine/rules.js';
import { PRESETS } from '../app/presets.js';
import { recommend, runsText, symOf, streakDays, handsOnDay, methodInsights, slowSpots, worstCells, mistakeSummary, dayKey } from '../app/labcore.js';
import { whyTag, whyChoices, TAGS } from '../app/why.js';
import { alwaysFor, ALWAYS_RULES, LADDER, GUT, SHORTCUT, coachPool, bucketOf, ROW, ROWS, isStiffUp } from '../curriculum/cells.js';

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL:', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

const rules = Object.fromEntries(['reference', 'typical-online', 'grand-bonus', 'gravity'].map((id) => [id, normalizeRules(PRESETS.find((p) => p.id === id).rules)]));
const act = (r, rowKey, up) => cellResult(r, rowKey, up).action;

// ---- pools reference real rows ----
const allPools = { always: ALWAYS_RULES.flatMap((r) => r.pool()), ...Object.fromEntries(LADDER.map((l) => ['ladder-' + l.id, l.pool()])), gut: GUT(), shortcut: SHORTCUT() };
for (const [name, pool] of Object.entries(allPools)) {
  ok(pool.length > 0, `${name} pool not empty`);
  for (const c of pool) ok(ROW[c.rowKey] && [2, 3, 4, 5, 6, 7, 8, 9, 10, 1].includes(c.up), `${name}: bad cell ${c.rowKey} ${c.up}`);
  const seen = new Set(pool.map((c) => c.rowKey + c.up)); ok(seen.size === pool.length, `${name} has duplicate cells`);
}
eq(allPools.gut.length, 20, 'gut-check has 20 spots');

// ---- Always-Rules: the filtered pool only keeps spots where the rule truly holds ----
for (const [id, r] of Object.entries(rules)) {
  const { pool, dropped } = await alwaysFor(async (rk, up) => act(r, rk, up));
  ok(pool.length > 80, `${id}: always pool keeps most spots (${pool.length})`);
  for (const rule of ALWAYS_RULES) for (const c of rule.pool()) {
    const holds = rule.expect(act(r, c.rowKey, c.up)), kept = pool.some((p) => p.rowKey === c.rowKey && p.up === c.up);
    ok(holds === kept, `${id}: ${rule.id} ${c.rowKey} vs ${c.up} kept=${kept} holds=${holds}`);
  }
  // Only the no-peek-on-ten game may drop anything, and only 8,8 against a Ten.
  if (id !== 'gravity') eq(dropped.length, 0, `${id}: nothing dropped`);
  else ok(dropped.every((c) => c.rowKey === '88'), `gravity drops only 8,8 spots: ${JSON.stringify(dropped)}`);
}

// ---- Shortcut: without surrender it is exactly stand-vs-stiff / hit-vs-strong ----
for (const id of ['typical-online', 'grand-bonus', 'gravity']) for (const c of SHORTCUT()) {
  eq(act(rules[id], c.rowKey, c.up), isStiffUp(c.up) ? 'S' : 'H', `${id}: shortcut ${c.rowKey} vs ${c.up}`);
}
// With surrender the only deviations are R.
for (const c of SHORTCUT()) { const a = act(rules.reference, c.rowKey, c.up); ok([isStiffUp(c.up) ? 'S' : 'H', 'R'].includes(a), `reference: shortcut ${c.rowKey} vs ${c.up} gave ${a}`); }

// ---- why tags ----
for (const r of ROWS) for (const up of [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]) {
  if (r.kind === 'hard' && r.total === 21) continue;
  const res = cellResult(rules['typical-online'], r.key, up);
  const hand = r.kind === 'soft' ? [1, Number(r.key.slice(1))] : r.kind === 'pair' ? [r.rank, r.rank] : [r.total - 2 > 0 ? Math.min(10, r.total - 2) : 2, r.total - Math.min(10, r.total - 2)];
  const { right, choices } = whyChoices(hand, up, res.action);
  ok(TAGS[right], `tag exists for ${r.key} vs ${up}`);
  ok(choices.length === 3 && new Set(choices).size === 3 && choices.includes(right), `3 distinct choices incl. right for ${r.key} vs ${up}`);
}
eq(whyTag([10, 6], 10, 'H'), 'mustImprove', 'hard 16 vs 10 hit');
eq(whyTag([10, 6], 5, 'S'), 'dealerBust', '16 vs 5 stand');
eq(whyTag([10, 7], 10, 'S'), 'strongTotal', '17 vs 10 stand');
eq(whyTag([1, 6], 9, 'H'), 'freeDraw', 'soft 17 vs 9 hit');
eq(whyTag([5, 6], 6, 'D'), 'pressAdvantage', '11 vs 6 double');
eq(whyTag([8, 8], 10, 'P'), 'twoHands', '8,8 vs 10 split');
eq(whyTag([8, 8], 5, 'P'), 'splitWeak', '8,8 vs 5 split');
eq(whyTag([10, 6], 10, 'R'), 'cutLoss', 'surrender');

// ---- coach ----
for (let i = 0; i < 40; i++) { const p = coachPool(20); eq(p.length, 20, 'coach pool is 20'); ok(new Set(p.map((c) => c.rowKey + c.up)).size === 20, 'coach pool unique'); }
for (const r of ROWS) ok(['stiff', 'soft', 'pairs', 'doubles', 'other'].includes(bucketOf(r.key)), `bucket for ${r.key}`);
ok(recommend({ stiff: { n: 5, c: 1 } }, 0.4, 2000).title.includes('Always-Rules'), 'low accuracy -> Always-Rules');
ok(recommend({ soft: { n: 5, c: 2 }, stiff: { n: 5, c: 5 } }, 0.75, 2000).title.includes('soft'), 'mid accuracy -> weakest area');
ok(recommend({ soft: { n: 5, c: 5 } }, 0.95, 9000).links.some((l) => l[0] === '#/lab/sprint'), 'accurate but slow -> Sprint');
ok(recommend({ soft: { n: 5, c: 5 } }, 0.95, 2000).links.some((l) => l[0] === '#/lab/gut'), 'accurate and fast -> Gut-Check');
ok(recommend({}, 0.7, 1000).title.length > 0, 'recommend survives empty buckets');

// ---- rule list text ----
const fakeCell = (action, hit = 0, stand = 0) => ({ action, ev: { hit, stand } });
eq(symOf(fakeCell('D', 0.2, 0.1)), 'Dh', 'double falls back to hit'); eq(symOf(fakeCell('D', 0.0, 0.1)), 'Ds', 'double falls back to stand');
eq(runsText(Array(10).fill('H')), 'hit always', 'single run');
eq(runsText(['H', 'H', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H']), 'stand vs 4–6; otherwise hit', 'majority is the otherwise');
eq(runsText(['H', 'Dh', 'Dh', 'Dh', 'Dh', 'H', 'H', 'H', 'H', 'H']).includes('hit vs'), false, 'otherwise action is not repeated as a run');
ok(runsText(['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'S', 'S']).includes('hit vs 7–9'), 'range uses an en dash with labels');

// ---- progress helpers ----
const DAY = 86400000, now = new Date(2026, 9, 27, 15).getTime();
const sess = (d, hands = 10, mode = 'lab-gut', acc = 0.8) => ({ date: now - d * DAY, handsPlayed: hands, accuracy: acc, mode });
eq(streakDays([sess(0), sess(1), sess(2)], now), 3, 'streak 3 days');
eq(streakDays([sess(1), sess(2)], now), 2, 'streak counts from yesterday');
eq(streakDays([sess(3)], now), 0, 'streak broken');
eq(streakDays([], now), 0, 'empty streak');
eq(handsOnDay([sess(0, 12), sess(0, 8), sess(1, 99)], now), 20, 'hands today');
const mi = methodInsights([sess(0, 10, 'lab-gut', 0.5), sess(1, 30, 'lab-gut', 1), sess(0, 20, 'lab-ladder-stiff', 0.9), sess(0, 5, 'flash', 1)]);
eq(mi.length, 2, 'only lab sessions'); eq(mi[0].id, 'gut', 'sorted by volume'); eq(mi[0].hands, 40, 'gut hands'); ok(Math.abs(mi[0].acc - 35 / 40) < 1e-9, 'gut accuracy weighted');
const c = (attempts, correct, msTotal = 0, rowKey = 'H12', up = 2) => ({ attempts, correct, msTotal, rowKey, up });
eq(slowSpots([c(5, 5, 40000), c(5, 5, 5000), c(2, 2, 90000), c(5, 2, 90000)]).length, 1, 'slow spots need accuracy, volume and slowness');
eq(worstCells([c(4, 1), c(4, 4), c(1, 0), c(3, 2)]).length, 2, 'worst ignores perfect and single-attempt cells');
eq(worstCells([c(4, 3), c(4, 1)])[0].correct, 1, 'worst sorted weakest first');
eq(worstCells(Array.from({ length: 30 }, () => c(3, 1))).length, 10, 'worst capped at 10');
const ms = mistakeSummary([{ rowKey: 'H16', up: 10, at: 1 }, { rowKey: 'H16', up: 10, at: 3 }, { rowKey: 'A7', up: 9, at: 2 }]);
eq(ms[0].n, 2, 'most repeated first'); eq(ms.length, 2, 'grouped by spot');
ok(dayKey(now) === 20261027, 'dayKey format');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
