// Format checks: heads-up and 3-handed hands complete, chips are conserved, positions are sensible.
import { Hand, botAction } from '../engine/holdem.js';
let bad = 0; const fail = (m) => { bad++; console.log('FAIL', m); };
const names = ['You', 'A', 'B', 'C', 'D', 'E'], styles = ['tag', 'tag', 'lag', 'station', 'nit', 'maniac'];
const FORMATS = { hu: (b) => [0, [1, 2, 3, 4, 5][b % 5]], three: (b) => [0, [1, 2, 3, 4, 5][b % 5], [1, 2, 3, 4, 5][(b + 2) % 5]] };
for (const [name, mk] of Object.entries(FORMATS)) {
  for (let n = 0; n < 300; n++) {
    const act = [...new Set(mk(n))].sort((a, b) => a - b);
    const button = act[n % act.length];
    const h = new Hand({ names, styles, button, stack: [20, 40, 100, 200][n % 4], active: act });
    let guard = 0;
    while (!h.done && guard++ < 200) { if (!act.includes(h.toAct)) { fail(name + ': inactive seat to act'); break; } h.act(h.toAct, botAction(h, h.toAct)); }
    if (!h.done) { fail(name + ': hand did not finish'); continue; }
    const sum = h.net.reduce((a, b) => a + b, 0);
    if (Math.abs(sum) > 1e-6) fail(`${name}: chips not conserved (${sum})`);
    if (h.net.some((v, s) => !act.includes(s) && v !== 0)) fail(name + ': an inactive seat won or lost chips');
    if (name === 'hu' && h.posOf(h.order[0]) !== 'BTN') fail('hu button label');
  }
}
console.log(bad ? bad + ' problems' : 'formats ok');
process.exit(bad ? 1 : 0);
