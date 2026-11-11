// Solve heads-up Nash push/fold for effective stacks 2..25 bb from data/hu-equity.json -> data/hu-pushfold.json
import { readFileSync, writeFileSync } from 'node:fs';
import { solvePushFold } from '../engine/pokerlab.js';
const data = JSON.parse(readFileSync(new URL('../data/hu-equity.json', import.meta.url)));
const out = {};
for (let S = 2; S <= 25; S++) {
  const r = solvePushFold(data, S, 700);
  out[S] = { push: r.push, call: r.call, pushPct: +r.pushPct.toFixed(4), callPct: +r.callPct.toFixed(4) };
  console.log(S, 'push', (r.pushPct * 100).toFixed(1) + '%', 'call', (r.callPct * 100).toFixed(1) + '%');
}
writeFileSync(new URL('../data/hu-pushfold.json', import.meta.url), JSON.stringify(out));
