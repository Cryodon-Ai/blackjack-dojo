// "Because…" tags: the one-line idea behind each play, used by Why Mode and the Coach.
// Derived from the same facts the verdict text uses (action, hand, dealer upcard).

export const TAGS = {
  dealerBust: 'The dealer is weak and likely to bust, so let them',
  freeDraw: "I can't bust on one card, so drawing is free",
  strongTotal: 'My total is already strong, and a hit would mostly hurt it',
  mustImprove: 'The dealer is strong, so standing loses too often and I have to draw',
  pressAdvantage: "I'm the favorite here, so put more money out",
  twoHands: 'Two hands starting from this card beat one hand I would be stuck with',
  cutLoss: 'This hand loses more than half a bet on average, so cut the loss',
  splitWeak: 'The dealer is weak, so two hands both get to profit',
};

// hand = engine ranks (Ace = 1); up = dealer upcard rank; action = 'H'|'S'|'D'|'P'|'R'
export function whyTag(hand, up, action) {
  const hard = hand.reduce((a, b) => a + b, 0);
  const soft = hand.includes(1) && hard <= 11;
  const total = soft ? hard + 10 : hard;
  const weak = up >= 2 && up <= 6;
  if (action === 'R') return 'cutLoss';
  if (action === 'P') return weak ? 'splitWeak' : 'twoHands';
  if (action === 'D') return 'pressAdvantage';
  if (action === 'S') return (!soft && hard >= 12 && hard <= 16 && weak) || (soft && weak) ? 'dealerBust' : 'strongTotal';
  if (soft || hard <= 11) return 'freeDraw';
  return 'mustImprove';
}

// One correct tag plus two distractors, shuffled.
export function whyChoices(hand, up, action) {
  const right = whyTag(hand, up, action);
  const others = Object.keys(TAGS).filter((k) => k !== right && !(right === 'dealerBust' && k === 'splitWeak'));
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  const out = [right, others[0], others[1]];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return { right, choices: out };
}
