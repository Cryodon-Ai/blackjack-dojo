import { Hand, botAction, coach, grade, STYLES } from '../engine/holdem.js';
import { rng } from '../engine/poker.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const rand = rng(99);
const styles = ['tag', 'nit', 'lag', 'station', 'maniac', 'tag'];
const profit = Array(6).fill(0); let hands = 0, showdowns = 0, maxPot = 0, errs = 0;
const t0 = Date.now();
for (let i = 0; i < 3000; i++) {
  const h = new Hand({ names: ['a', 'b', 'c', 'd', 'e', 'f'], styles, button: i % 6, rand });
  let guard = 0;
  try {
    while (!h.done && guard++ < 200) {
      const s = h.toAct, a = botAction(h, s);
      h.act(s, a);
    }
  } catch (e) { errs++; if (errs < 4) console.log('ERR', e.message, h.street, JSON.stringify(h.log.slice(-4))); continue; }
  ok(h.done, 'hand finished'); if (!h.done) continue;
  const sum = h.net.reduce((a, b) => a + b, 0);
  if (Math.abs(sum) > 1e-6) { fail++; console.log('net sum', sum); }
  for (let s = 0; s < 6; s++) { profit[s] += h.net[s]; if (h.stack[s] < -1e-9 || h.total[s] > 100.0001) { fail++; console.log('stack/total bad', h.stack[s], h.total[s]); } }
  hands++; if (h.showdown) showdowns++; maxPot = Math.max(maxPot, h.pot);
}
console.log('hands', hands, 'showdowns', showdowns, 'maxPot', maxPot.toFixed(0), 'errors', errs, (Date.now() - t0) + 'ms');
console.log('bb/100 by style:', styles.map((s, i) => `${s}:${(profit[i] / hands * 100).toFixed(1)}`).join('  '));
// coach on a few spots
const h = new Hand({ names: [], styles, button: 0, rand: rng(5) });
const c = coach(h, h.toAct); ok(['fold', 'raise', 'call', 'check'].includes(c.rec) && c.why.length > 10, 'coach returns a recommendation');
ok(grade('raise', 'raise') === 'good' && grade('fold', 'raise') === 'leak' && grade('call', 'raise') === 'ok', 'grading');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail || errs ? 1 : 0);
