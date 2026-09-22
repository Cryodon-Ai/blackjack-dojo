// Rule-set presets. `unverified` presets carry assumptions the app cannot confirm.
import { DEFAULT_RULES, normalizeRules } from '../engine/rules.js';

export const PRESETS = [
  { id: 'reference', name: 'Reference game', blurb: '6 decks · S17 · DAS · late surrender · peek · 3:2',
    rules: { ...DEFAULT_RULES, decks: 6, dealerHitsSoft17: false, doubleAfterSplit: true, surrender: 'late', peekOn: 'both', blackjackPays: 1.5 } },
  { id: 'typical-online', name: 'Normal digital blackjack', blurb: '8 decks · S17 · DAS · no surrender · peek · 3:2 — a typical online/RNG table',
    rules: { ...DEFAULT_RULES, decks: 8, dealerHitsSoft17: false, doubleAfterSplit: true, surrender: 'none', peekOn: 'both', blackjackPays: 1.5 } },
  { id: 'bad-table', name: 'Table to avoid', blurb: '6 decks · H17 · 6:5 · no surrender · double 9–11 only',
    rules: { ...DEFAULT_RULES, decks: 6, dealerHitsSoft17: true, doubleAfterSplit: true, surrender: 'none', peekOn: 'both', blackjackPays: 1.2, doubleRestriction: '9-11' } },
  { id: 'gravity', name: 'Gravity Blackjack', source: 'Per ICONIC21\'s published rules for Gravity Blackjack — still worth checking the game\'s own info screen at your casino.',
    blurb: '8 decks · S17 · DAS · one split only · no surrender · peeks on Ace only (not Ten) · 3:2 · 10-card Charlie',
    rules: { ...DEFAULT_RULES, decks: 8, dealerHitsSoft17: false, doubleAfterSplit: true, resplitAces: false, surrender: 'none', peekOn: 'ace', blackjackPays: 1.5, maxSplitHands: 2, charlie: 10 } },
];
export const presetById = (id) => PRESETS.find((p) => p.id === id);

export function describeRules(rulesIn) {
  const r = normalizeRules(rulesIn);
  const peekBit = r.peekOn === 'both' ? 'peek' : r.peekOn === 'ace' ? 'peek on Ace only' : 'no hole card (ENHC)';
  const bits = [Number.isFinite(r.decks) ? `${r.decks} deck${r.decks === 1 ? '' : 's'}` : 'infinite deck', r.dealerHitsSoft17 ? 'H17' : 'S17',
    r.doubleAfterSplit ? 'DAS' : 'no DAS', r.surrender === 'late' ? 'late surrender' : 'no surrender', peekBit,
    r.blackjackPays === 1.5 ? '3:2' : r.blackjackPays === 1.2 ? '6:5' : '1:1'];
  if (r.doubleRestriction !== 'any') bits.push('double 9–11 only');
  if (r.resplitAces) bits.push('resplit aces');
  if (r.maxSplitHands !== 4) bits.push(`max ${r.maxSplitHands} hands`);
  if (r.charlie) bits.push(`${r.charlie}-card Charlie`);
  return bits.join(' · ');
}
