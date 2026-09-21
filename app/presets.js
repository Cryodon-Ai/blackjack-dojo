// Rule-set presets. `unverified` presets carry assumptions the app cannot confirm.
import { DEFAULT_RULES, normalizeRules } from '../engine/rules.js';

export const PRESETS = [
  { id: 'reference', name: 'Reference game', blurb: '6 decks · S17 · DAS · late surrender · peek · 3:2',
    rules: { ...DEFAULT_RULES, decks: 6, dealerHitsSoft17: false, doubleAfterSplit: true, surrender: 'late', peek: true, blackjackPays: 1.5 } },
  { id: 'typical-online', name: 'Typical online', blurb: '8 decks · S17 · DAS · no surrender · peek · 3:2',
    rules: { ...DEFAULT_RULES, decks: 8, dealerHitsSoft17: false, doubleAfterSplit: true, surrender: 'none', peek: true, blackjackPays: 1.5 } },
  { id: 'bad-table', name: 'Table to avoid', blurb: '6 decks · H17 · 6:5 · no surrender · double 9–11 only',
    rules: { ...DEFAULT_RULES, decks: 6, dealerHitsSoft17: true, doubleAfterSplit: true, surrender: 'none', peek: true, blackjackPays: 1.2, doubleRestriction: '9-11' } },
  { id: 'gravity', name: 'Gravity Blackjack', unverified: true,
    blurb: 'Base rules ASSUMED (8 decks · S17 · DAS · no surrender · peek · 3:2). Check the game\'s info screen and edit.',
    rules: { ...DEFAULT_RULES, decks: 8, dealerHitsSoft17: false, doubleAfterSplit: true, surrender: 'none', peek: true, blackjackPays: 1.5 } },
];
export const presetById = (id) => PRESETS.find((p) => p.id === id);

export function describeRules(rulesIn) {
  const r = normalizeRules(rulesIn);
  const bits = [Number.isFinite(r.decks) ? `${r.decks} deck${r.decks === 1 ? '' : 's'}` : 'infinite deck', r.dealerHitsSoft17 ? 'H17' : 'S17',
    r.doubleAfterSplit ? 'DAS' : 'no DAS', r.surrender === 'late' ? 'late surrender' : 'no surrender', r.peek ? 'peek' : 'no hole card (ENHC)',
    r.blackjackPays === 1.5 ? '3:2' : r.blackjackPays === 1.2 ? '6:5' : '1:1'];
  if (r.doubleRestriction !== 'any') bits.push('double 9–11 only');
  if (r.resplitAces) bits.push('resplit aces');
  return bits.join(' · ');
}
