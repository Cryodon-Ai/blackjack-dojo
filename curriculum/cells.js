// Chart rows as drillable "cells": metadata, random hand generation, tier pools.

import { rulesKey, UPCARDS, REFERENCE_RULES, normalizeRules } from '../engine/rules.js';

export { UPCARDS };
export const LEARN_RULES = normalizeRules({ ...REFERENCE_RULES });     // the game Tiers 2-5 teach on

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];

export const ROWS = (() => {
  const rows = [];
  for (let t = 5; t <= 21; t++) rows.push({ key: `H${t}`, kind: 'hard', total: t, label: `Hard ${t}` });
  for (let k = 2; k <= 9; k++) rows.push({ key: `A${k}`, kind: 'soft', label: `A,${k}`, total: 11 + k });
  for (let k = 2; k <= 10; k++) rows.push({ key: k === 10 ? 'TT' : `${k}${k}`, kind: 'pair', rank: k, label: k === 10 ? 'T,T' : `${k},${k}` });
  rows.push({ key: 'AA', kind: 'pair', rank: 1, label: 'A,A' });
  return rows;
})();
export const ROW = Object.fromEntries(ROWS.map((r) => [r.key, r]));

export const cellKey = (rowKey, up, rules) => `${rowKey}|${up}|${rulesKey(rules)}`;

const THREE_CARD_21 = [[7, 7, 7], [10, 6, 5], [9, 8, 4], [10, 7, 4], [8, 8, 5], [9, 9, 3], [10, 8, 3], [10, 9, 2], [6, 6, 9]];
const THREE_CARD_20 = [[8, 7, 5], [10, 6, 4], [9, 7, 4], [9, 8, 3], [10, 7, 3], [6, 7, 7]];

// Concrete hand for a row. Hard totals never include an ace and never show a pair (a pair has its own
// row and its own answer); hard 20/21 are three-card hands. Returns engine ranks.
export function randomRanks(rowKey) {
  const r = ROW[rowKey];
  if (r.kind === 'soft') return [1, Number(rowKey.slice(1))];
  if (r.kind === 'pair') return [r.rank, r.rank];
  if (r.total === 21) return pick(THREE_CARD_21);
  if (r.total === 20) return pick(THREE_CARD_20);
  const comps = [];
  for (let a = 2; a <= 10; a++) { const b = r.total - a; if (b > a && b <= 10) comps.push([a, b]); }
  const c = pick(comps);
  return Math.random() < 0.5 ? c : [c[1], c[0]];
}

// ---- tier pools: which (row, upcard) cells does a tier drill? -------------------------------
const allUps = UPCARDS;
const cellsOf = (rows, ups = allUps) => rows.flatMap((k) => ups.map((u) => ({ rowKey: k, up: u })));

export const POOLS = {
  hard: () => cellsOf(ROWS.filter((r) => r.kind === 'hard' && r.total <= 20).map((r) => r.key)),
  soft: () => cellsOf(ROWS.filter((r) => r.kind === 'soft').map((r) => r.key)),
  pairs: () => cellsOf(ROWS.filter((r) => r.kind === 'pair').map((r) => r.key)),
  surrender: () => [...cellsOf(['H14', 'H15', 'H16', 'H17'], [7, 8, 9, 10, 1]), ...cellsOf(['77', '88', '99'], [8, 9, 10, 1])],
  all: () => ROWS.filter((r) => r.total !== 21 || r.kind !== 'hard').flatMap((r) => allUps.map((u) => ({ rowKey: r.key, up: u }))),
  // The 12 most-misplayed decisions
  boss: () => [
    ['A7', 9], ['H12', 2], ['H12', 3], ['H9', 2], ['H16', 10], ['88', 10],
    ['H11', 1], ['A7', 1], ['22', 2], ['AA', 1], ['H15', 10], ['H13', 2],
  ].map(([rowKey, up]) => ({ rowKey, up })),
};

export const BOSS_LABELS = ['A,7 vs 9', '12 vs 2', '12 vs 3', '9 vs 2', '16 vs 10', '8,8 vs 10', '11 vs A', 'Soft 18 vs A', '2,2 vs 2', 'A,A vs A', '15 vs 10', '13 vs 2'];

// Drill categories for the Drill tab.
export const ZONES = [
  { id: 'hard', label: 'Hard totals', pool: POOLS.hard },
  { id: 'soft', label: 'Soft totals', pool: POOLS.soft },
  { id: 'pairs', label: 'Pairs', pool: POOLS.pairs },
  { id: 'surrender', label: 'Surrender spots', pool: POOLS.surrender },
  { id: 'all', label: 'Everything', pool: POOLS.all },
];
export const zoneOfRow = (rowKey) => (ROW[rowKey].kind === 'hard' ? 'hard' : ROW[rowKey].kind === 'soft' ? 'soft' : 'pairs');

// Rows that are trivial/unreachable in some rulesets can be dropped from certification/blackout.
export const isDrillable = (rowKey) => rowKey !== 'H21';

// ---- Strategy Lab pools -----------------------------------------------------------------------
const rows = (keys, ups = allUps) => cellsOf(keys, ups);
const hardKeys = (a, b) => { const k = []; for (let t = a; t <= b; t++) k.push('H' + t); return k; };

export const ALWAYS_RULES = [
  { id: 'aa', expect: (a) => a === 'P', text: 'Always split Aces', pool: () => rows(['AA']) },
  { id: '88', expect: (a) => a === 'P', text: 'Always split 8s (2 through 10)', pool: () => rows(['88'], [2, 3, 4, 5, 6, 7, 8, 9, 10]) },
  { id: 'nosplit', expect: (a) => a !== 'P', text: 'Never split 5s or tens', pool: () => rows(['55', 'TT']) },
  { id: 'stand17', expect: (a) => a === 'S', text: 'Stand on hard 18–20, and on 17 against 2–10', pool: () => [...rows(hardKeys(18, 20)), ...rows(['H17'], [2, 3, 4, 5, 6, 7, 8, 9, 10])] },
  { id: 'hit8', expect: (a) => a === 'H', text: 'Hit hard 5–7 always, and 8 against 7 or higher', pool: () => [...rows(hardKeys(5, 7)), ...rows(['H8'], [7, 8, 9, 10, 1])] },
  { id: 'ins', text: 'Never take insurance (a decision, not a drill cell)', pool: () => [] },
];
export const ALWAYS_POOL = () => ALWAYS_RULES.flatMap((r) => r.pool());

// The Always-Rules that really hold on a given table: drops cells whose solved play differs
// (e.g. 8,8 vs a Ten on a game that does not peek for Tens). `decide(rowKey, up)` returns the action.
export async function alwaysFor(decide) {
  const keep = [], dropped = [];
  for (const r of ALWAYS_RULES) for (const c of r.pool()) (r.expect(await decide(c.rowKey, c.up)) ? keep : dropped).push(c);
  return { pool: keep, dropped };
}

// Chunk Ladder: the order BlackjackInfo and most coaches teach the chart in.
export const LADDER = [
  { id: 'stiff', label: 'Stiff hands', sub: 'Hard 12–16 against every upcard', pool: () => rows(hardKeys(12, 16)) },
  { id: 'soft', label: 'Soft hands', sub: 'A,2 through A,9', pool: () => rows(['A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9']) },
  { id: 'pairs', label: 'Pair splitting', sub: '2s, 3s, 4s, 6s, 7s and 9s', pool: () => rows(['22', '33', '44', '66', '77', '99']) },
  { id: 'doubles', label: 'Doubling', sub: 'Hard 9, 10 and 11', pool: () => rows(['H9', 'H10', 'H11']) },
];

// Gut-Check: the 20 spots where the right play feels wrong.
export const GUT = () => [
  ['H12', 2], ['H12', 3], ['H13', 2], ['H15', 10], ['H16', 9], ['H16', 10], ['H10', 10], ['H10', 1], ['H11', 1], ['H9', 2],
  ['A7', 9], ['A7', 10], ['A7', 1], ['A6', 2], ['A8', 6], ['88', 10], ['88', 1], ['99', 7], ['77', 8], ['22', 8],
].map(([rowKey, up]) => ({ rowKey, up }));

// Dealer-Stiff Shortcut: assume the hole card is a ten. 2-6 is "stiff" (likely to bust), 7-A is "strong".
// 12 against 2 and 3 is the known exception, so it lives in Gut-Check instead.
export const SHORTCUT = () => [
  ...rows(hardKeys(13, 16)), ...rows(['H12'], [4, 5, 6, 7, 8, 9, 10, 1]),
];
export const isStiffUp = (u) => u >= 2 && u <= 6;

// Coach diagnostic buckets (every drillable cell lands in exactly one).
export function bucketOf(rowKey) {
  const r = ROW[rowKey];
  if (r.kind === 'soft') return 'soft';
  if (r.kind === 'pair') return 'pairs';
  if (r.total >= 12 && r.total <= 16) return 'stiff';
  if (r.total >= 9 && r.total <= 11) return 'doubles';
  return 'other';
}
export function coachPool(n = 20) {
  const want = { stiff: 5, soft: 5, pairs: 5, doubles: 3, other: 2 };
  const by = {};
  for (const r of ROWS) { if (r.kind === 'hard' && r.total === 21) continue; for (const u of allUps) (by[bucketOf(r.key)] ||= []).push({ rowKey: r.key, up: u }); }
  const out = [];
  for (const [b, k] of Object.entries(want)) {
    const a = by[b].slice();
    for (let i = 0; i < k; i++) out.push(a.splice(rnd(a.length), 1)[0]);
  }
  for (let i = out.length - 1; i > 0; i--) { const j = rnd(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.slice(0, n);
}
