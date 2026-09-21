// Lesson text carries {{tokens}}; every number a lesson quotes is resolved from the engine here.

import { engine } from '../app/engine-client.js';
import { bustOnHit, pct, signed, ACTION_NAME, upName } from '../app/feedback.js';
import { LEARN_RULES } from './cells.js';
import { bjCost } from '../app/edges.js';
import { UPCARDS, upLabel } from '../engine/rules.js';
import { presetById } from '../app/presets.js';
import { houseEdge } from '../app/edges.js';

const upNum = (s) => (s === 'A' ? 1 : s === 'T' ? 10 : Number(s));
const KEY = { hit: 'hit', stand: 'stand', double: 'double', split: 'split', surrender: 'surrender' };

export function insuranceEdge(decks = 6) {
  const N = 52 * decks;
  const p = (16 * decks) / (N - 1);     // ten among the unseen cards once an ace is showing
  return 1 - 3 * p;                     // house edge on the 2:1 insurance bet
}

async function one(spec) {
  const [name, ...a] = spec.split(':');
  const R = LEARN_RULES;
  switch (name) {
    case 'bust': return pct((await engine.dealer(R, upNum(a[0]))).bust);
    case 'bust1': return pct((await engine.dealer(R, upNum(a[0]))).bust, 1);
    case 'pbust': { const h = Number(a[0]); return pct(h <= 11 ? 0 : bustOnHit(R, [10, h - 10], upNum(a[1]))); }
    case 'win': {
      const t = await engine.dealer(R, upNum(a[1])), tot = Number(a[0]);
      let w = t.bust; for (const d of [17, 18, 19, 20, 21]) if (tot > d) w += t[d];
      return pct(w);
    }
    case 'fin': { const t = await engine.dealer(R, upNum(a[0])); return pct(t[Number(a[1])], 1); }   // P(dealer finishes on a total)
    case 'finge': { const t = await engine.dealer(R, upNum(a[0])); let x = 0; for (let d = Number(a[1]); d <= 21; d++) x += t[d]; return pct(x); }
    case 'ev': { const c = await engine.cell(R, a[0], upNum(a[1])); return signed(c.ev[KEY[a[2]]], 1); }
    case 'act': { const c = await engine.cell(R, a[0], upNum(a[1])); return ACTION_NAME[c.action]; }
    case 'bars': return await bustBars();
    case 'ins': return pct(insuranceEdge(6), 1);
    case 'cost65': return bjCost(6, 1.2).toFixed(2) + '%';
    case 'edge': { const p = presetById(a[0]); const e = await houseEdge(p.rules); return e === null ? '—' : e.toFixed(2) + '%'; }
    default: return `{{${spec}}}`;
  }
}

export async function bustBars() {
  const rows = [];
  for (const u of UPCARDS.slice().sort((a, b) => (a === 1 ? 11 : a) - (b === 1 ? 11 : b))) rows.push([u, (await engine.dealer(LEARN_RULES, u)).bust]);
  const max = Math.max(...rows.map((r) => r[1]));
  return `<div class="bars">${rows.map(([u, b]) => `<div class="bar"><span class="lbl">${upLabel(u)}</span><span class="track"><span class="fill ${u >= 2 && u <= 6 ? 'break' : ''}" style="width:${(b / max * 100).toFixed(1)}%"></span></span><span class="num">${pct(b, 1)}</span></div>`).join('')}</div>`;
}

export async function resolveTokens(html) {
  const specs = [...new Set([...html.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]))];
  const vals = {};
  await Promise.all(specs.map(async (s) => { vals[s] = await one(s); }));
  return html.replace(/\{\{([^}]+)\}\}/g, (_, s) => vals[s]);
}
