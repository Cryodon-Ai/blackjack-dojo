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
