// Parametric question generators for the quiz-style tiers (0, 1, 6, 7, 8) and the rules-reader game.
// Each generator is async and returns { q, opts[], answer(index), why, secs? }. Numbers come from the engine.

import { engine } from '../app/engine-client.js';
import { pct, upName } from '../app/feedback.js';
import { LEARN_RULES } from './cells.js';
import { upLabel, UPCARDS } from '../engine/rules.js';
import { houseEdge } from '../app/edges.js';
import { describeRules } from '../app/presets.js';
import { randomTrap, TRAP_KINDS } from './traps.js';

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const money = (x) => '$' + (Math.round(x * 100) / 100).toFixed(x % 1 === 0 ? 0 : 2);

// Build a question from a correct answer and distractors (deduped, shuffled).
function mc(q, correct, distractors, why, extra = {}) {
  const seen = new Set([String(correct)]);
  const ds = distractors.filter((d) => { const k = String(d); if (seen.has(k)) return false; seen.add(k); return true; });
  const opts = shuffle([correct, ...ds.slice(0, 3)]);
  return { q, opts: opts.map(String), answer: opts.map(String).indexOf(String(correct)), why, ...extra };
}

const LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const valueOf = (l) => (l === 'A' ? 1 : ['J', 'Q', 'K'].includes(l) ? 10 : Number(l));
const totalName = (ranks) => {
  const hard = ranks.reduce((a, b) => a + b, 0), soft = ranks.includes(1) && hard <= 11;
  return soft ? `Soft ${hard + 10}` : `Hard ${hard}`;
};

// ---- Tier 0: table literacy -----------------------------------------------------------------
const T0 = [
  async () => {
    const l = pick(['J', 'Q', 'K', 'K', 'A', '10', 'Q']);
    if (l === 'A') return mc(`What is an <b>Ace</b> worth?`, '1 or 11 — whichever helps', ['Always 11', 'Always 1', '10'], 'An Ace counts as 11 unless that would bust you, and then it drops to 1 — automatically, as often as needed.');
    return mc(`What is a <b>${l}</b> worth?`, '10', ['11', l === '10' ? '1' : `${valueOf(l) + 1}`, '1 or 11'], 'Every ten and face card counts 10.');
  },
  async () => {
    let r;
    do { r = [1 + rnd(10), 1 + rnd(10)]; } while (r[0] + r[1] === 11 && r.includes(1));
    const hs = totalName(r);
    const [a, b] = r, hard = a + b;
    const dist = [`Hard ${hard}`, `Soft ${hard + 10}`, `Soft ${hard}`, `Hard ${hard + 10}`, `Hard ${hard + 1}`];
    return mc(`You hold <b>${r.map((v) => (v === 1 ? 'A' : v)).join(', ')}</b>. What is it?`, hs, dist.filter((d) => d !== hs), r.includes(1) && hard <= 11 ? 'An Ace counted as 11 without busting makes the hand SOFT — it cannot bust on one more card.' : 'No Ace counted as 11, so it is a HARD total.');
  },
  async () => {
    const sc = pick([
      { t: 'You hold your first two cards, 5 and 6.', a: 'Yes — on any first two cards at this table', why: 'Doubling is only allowed on your first two cards (this table: any two).' },
      { t: 'You held 4 and 3, hit, and drew a 3. Now you have 10.', a: 'No — you can only double on your first two cards', why: 'After you hit, the double option is gone.' },
      { t: 'You hold 8 and 8 and want to split.', a: 'Yes — a pair can be split', why: 'Any pair can be split into two hands, each with its own bet equal to your first.' },
      { t: 'You hold 8 and 7 and want to split.', a: 'No — only a pair can be split', why: 'Splitting needs two cards of equal rank.' },
      { t: 'You hold 10 and 6 and want to surrender at a table with late surrender.', a: 'Yes — before you take any other action', why: 'Late surrender: after the dealer checks for blackjack, on your first two cards, you may give up half your bet.' },
    ]);
    const yes = sc.a.startsWith('Yes');
    return mc(`${sc.t} <b>Is that allowed?</b>`, sc.a, yes ? ['No — never', 'Only after you hit', 'Only if the dealer busts'] : ['Yes — any time', 'Yes — at every table', 'Only with a pair'].slice(0, 3), sc.why);
  },
  async () => {
    const h17 = Math.random() < 0.5;
    const sc = pick([
      { d: 'a 16', a: 'Hit', why: 'Dealers have no choices: draw on 16 or less.' },
      { d: 'a hard 17', a: 'Stand', why: 'Dealers stand on every hard 17 or more.' },
      { d: 'a 12', a: 'Hit', why: 'The dealer must draw on 16 or less regardless of your hand.' },
      { d: 'a soft 17 (Ace + 6)', a: h17 ? 'Hit' : 'Stand', why: h17 ? 'At an H17 table the dealer hits soft 17 — that costs you about 0.2% of your action; you want S17 tables.' : 'At an S17 table the dealer stands on all 17s including soft 17.' },
      { d: 'a 19', a: 'Stand', why: 'The dealer stands on 17 and up.' },
    ]);
    return mc(`Table rule: dealer <b>${h17 ? 'hits' : 'stands on'}</b> soft 17. The dealer has ${sc.d}. The dealer must:`, sc.a, ['Hit', 'Stand', 'Choose', 'Double'].filter((x) => x !== sc.a), sc.why);
  },
  async () => {
    const b = pick([10, 20, 25, 40, 50, 100]);
    const pay = pick(['3:2', '6:5']);
    const win = pay === '3:2' ? b * 1.5 : b * 1.2;
    return mc(`You bet <b>$${b}</b> and are dealt a natural blackjack. The table pays <b>${pay}</b>. You win:`, money(win), [money(pay === '3:2' ? b * 1.2 : b * 1.5), money(b), money(b * 2)],
      pay === '3:2' ? `3:2 means $3 for every $2 bet: $${b} × 1.5 = ${money(win)}.` : `6:5 means $6 for every $5 bet: $${b} × 1.2 = ${money(win)} — that shortchange costs you about 1.4% of everything you wager.`);
  },
  async () => {
    const sc = pick([
      { t: 'You have 19. The dealer has 19.', a: 'Push — bet returned', why: 'Equal totals tie; nobody wins.' },
      { t: 'You hit and bust with 24. The dealer then busts too.', a: 'You lose', why: 'You act first: once you bust, your bet is gone even if the dealer would have busted later.' },
      { t: 'You have 20. The dealer busts.', a: 'You win', why: 'A dealer bust pays every hand still standing.' },
      { t: 'You have 17. The dealer has 18.', a: 'You lose', why: 'Highest total not over 21 wins.' },
      { t: 'You have 21 from three cards. The dealer has blackjack (Ace + King).', a: 'You lose', why: 'A two-card blackjack beats any other 21.' },
      { t: 'You and the dealer both have blackjack.', a: 'Push — bet returned', why: 'Naturals tie.' },
    ]);
    return mc(`${sc.t} <b>Result?</b>`, sc.a, ['You win', 'You lose', 'Push — bet returned', 'Half your bet is returned'].filter((x) => x !== sc.a), sc.why);
  },
  async () => {
    const sc = pick([
      { q: 'Which action <b>doubles your bet</b> and gives you exactly <b>one</b> more card?', a: 'Double', why: 'Double down: one card, double the money.' },
      { q: 'Which action turns a <b>pair into two hands</b>?', a: 'Split', why: 'Split: a second bet equal to the first, each card starts a new hand.' },
      { q: 'Which action <b>gives up half your bet</b> and ends the hand?', a: 'Surrender', why: 'Late surrender returns half your bet — only where the table offers it.' },
      { q: 'Which action <b>takes exactly one more card</b> and lets you keep deciding?', a: 'Hit', why: 'Hit: one card, then you choose again.' },
      { q: 'Which action <b>ends your turn</b> with your current total?', a: 'Stand', why: 'Stand: no more cards.' },
    ]);
    return mc(sc.q, sc.a, ['Hit', 'Stand', 'Double', 'Split', 'Surrender'].filter((x) => x !== sc.a), sc.why);
  },
  async () => mc('At a table where the dealer <b>peeks</b>, when does the dealer check the hole card for blackjack?', 'Right after the deal, before you act, when the upcard is an Ace or ten', ['After you finish your hand', 'Only if you ask', 'Never — they just play'], 'Peeking means you never double or split into a hand the dealer has already won. European no-hole-card tables skip the peek, and that costs you about 0.1%.'),
  async () => {
    const hard = pick([12, 13, 14, 15, 16]), c = 6 + rnd(5) + (hard > 15 ? 1 : 0);
    const n = Math.max(c, 22 - hard);
    return mc(`You have a hard ${hard} and hit. You draw a ${n === 10 ? 'K' : n}. Your total is:`, `${hard + n} — bust`, [`${hard + n - 10}`, `${hard + n} — safe`, `${hard + 10}`], 'Over 21 is a bust: automatic loss, and it happens before the dealer plays.');
  },
];

// ---- Tier 1: the dealer's weakness ---------------------------------------------------------
const bucket = (b) => (b < 0.2 ? 'Under 20%' : b < 0.3 ? '20–30%' : b < 0.4 ? '30–40%' : 'Over 40%');
const BUCKETS = ['Under 20%', '20–30%', '30–40%', 'Over 40%'];

const T1 = [
  async () => {
    const up = pick(UPCARDS), t = await engine.dealer(LEARN_RULES, up);
    return mc(`The dealer shows <b>${upLabel(up)}</b>. How often does the dealer <b>bust</b>?`, bucket(t.bust), BUCKETS.filter((x) => x !== bucket(t.bust)), `A dealer ${upName(up)} busts ${pct(t.bust, 1)} of the time.`);
  },
  async () => {
    const up = pick(UPCARDS), br = up >= 2 && up <= 6;
    const t = await engine.dealer(LEARN_RULES, up);
    return mc(`Is a dealer <b>${upLabel(up)}</b> a <b>breaking card</b> or a <b>pat card</b>?`, br ? 'Breaking card (2–6)' : 'Pat card (7–A)', [br ? 'Pat card (7–A)' : 'Breaking card (2–6)'], br ? `Breaking cards (2–6) leave the dealer likely to draw into a bust: a ${upName(up)} busts ${pct(t.bust)}.` : `Pat cards (7–A) usually make a hand without drawing much risk: a ${upName(up)} busts only ${pct(t.bust)}.`);
  },
  async () => {
    const all = [];
    for (const u of UPCARDS) all.push([u, (await engine.dealer(LEARN_RULES, u)).bust]);
    const which = pick(['weakest', 'strongest']);
    const sorted = all.slice().sort((a, b) => (which === 'weakest' ? b[1] - a[1] : a[1] - b[1]));
    const four = shuffle(all.filter(([u]) => u !== sorted[0][0])).slice(0, 3);
    return mc(`Which dealer upcard is the <b>${which}</b> — ${which === 'weakest' ? 'busts most often' : 'busts least often'}?`, upLabel(sorted[0][0]), four.map(([u]) => upLabel(u)), `${upLabel(sorted[0][0])} busts ${pct(sorted[0][1], 1)}, the ${which === 'weakest' ? 'highest' : 'lowest'} of any upcard.`);
  },
  async () => {
    const hard = pick([12, 13, 14, 15, 16]), up = pick(UPCARDS);
    const row = `H${hard}`;
    const c = await engine.cell(LEARN_RULES, row, up);
    const t = await engine.dealer(LEARN_RULES, up);
    const ok = c.action === 'S' ? 'Stand — let the dealer bust' : c.action === 'H' ? 'Hit — you must improve' : c.action === 'R' ? 'Surrender (if offered), otherwise hit' : 'Double';
    const ds = ['Stand — let the dealer bust', 'Hit — you must improve', 'Double', 'Surrender (if offered), otherwise hit'].filter((x) => x !== ok);
    return mc(`You have a hard <b>${hard}</b>. The dealer shows <b>${upLabel(up)}</b>. What now?`, ok, ds, `A dealer ${upName(up)} busts ${pct(t.bust)}${c.action === 'S' ? ' — enough that you should not risk busting yourself' : ' — not enough to wait on'}.`, { secs: null });
  },
  async () => {
    const [a, b] = shuffle(UPCARDS).slice(0, 2);
    const [ta, tb] = [await engine.dealer(LEARN_RULES, a), await engine.dealer(LEARN_RULES, b)];
    if (Math.abs(ta.bust - tb.bust) < 0.02) return T1[4]();
    const better = ta.bust > tb.bust ? a : b;
    return mc(`Which dealer upcard is <b>better for you</b> (busts more often): <b>${upLabel(a)}</b> or <b>${upLabel(b)}</b>?`, upLabel(better), [upLabel(better === a ? b : a)], `${upLabel(a)} busts ${pct(ta.bust, 1)}; ${upLabel(b)} busts ${pct(tb.bust, 1)}.`);
  },
];

// ---- Tier 6: rule-set fluency (rules panel reader) -------------------------------------------
const RULE_TWEAKS = [
  { decks: 1 }, { decks: 2 }, { decks: 4 }, { decks: 6 }, { decks: 8 },
  { dealerHitsSoft17: true }, { doubleAfterSplit: false }, { peek: false, surrender: 'none' },
  { doubleRestriction: '9-11' }, { resplitAces: true }, { surrender: 'late' }, { blackjackPays: 1.2 },
];
export function randomTable() {
  const r = { decks: pick([2, 4, 6, 8]), dealerHitsSoft17: Math.random() < 0.4, doubleAfterSplit: Math.random() < 0.8, resplitAces: Math.random() < 0.2,
    surrender: 'none', peek: Math.random() < 0.88, blackjackPays: Math.random() < 0.3 ? 1.2 : 1.5, doubleRestriction: Math.random() < 0.2 ? '9-11' : 'any', maxSplitHands: 4 };
  if (r.peek && Math.random() < 0.3) r.surrender = 'late';
  return r;
}
export async function rulesPair() {
  for (let i = 0; i < 20; i++) {
    const A = randomTable(), B = randomTable();
    const [ea, eb] = [await houseEdge(A), await houseEdge(B)];
    if (ea === null || eb === null || Math.abs(ea - eb) < 0.05) continue;
    return { A, B, ea, eb, better: ea < eb ? 'A' : 'B', costPer100: Math.abs(ea - eb) };
  }
  return rulesPair();
}
const T6 = async () => {
  const p = await rulesPair();
  const dA = describeRules(p.A), dB = describeRules(p.B);
  const worse = p.better === 'A' ? 'B' : 'A';
  return mc(`<div class="card"><b>Table A</b><br><span class="small">${dA}</span></div><div class="card"><b>Table B</b><br><span class="small">${dB}</span></div>Which table is better for you?`,
    `Table ${p.better}`, [`Table ${worse}`], `Table A: ${p.ea.toFixed(2)}% · Table B: ${p.eb.toFixed(2)}% house edge. Playing ${worse} instead costs you an extra <b>$${p.costPer100.toFixed(2)} per $100 wagered</b>.`, { secs: 5 });
};

// ---- Tier 7: variants & side bets -------------------------------------------------------------
const T7 = [
  async () => {
    const t = randomTrap();
    return mc(`<b>${t.title}</b><br>${t.html}`, 'Decline', ['Accept', 'Accept a smaller amount', 'Accept just this once'], t.why, { secs: 4 });
  },
  async () => {
    const t = TRAP_KINDS.multiplierDrop();
    return mc(`<b>${t.tempt || 'Multiplier dropped'}</b> — ${t.title}<br>${t.html}`, 'Decline', ['Accept', 'Accept — the multiplier makes it +EV', 'Accept half'], t.why, { secs: 4 });
  },
  async () => {
    const sc = pick([
      { q: 'In <b>Free Bet Blackjack</b>, the dealer busting with <b>exactly 22</b> means:', a: 'Your non-busted hands push', ds: ['Your hands win', 'Your hands lose', 'The dealer re-deals'], why: 'That push is how the game pays for its free doubles and splits: normally a dealer 22 would have paid you.' },
      { q: 'In Free Bet Blackjack, a <b>free double</b> is offered on your hard 9, 10 or 11. If you lose the hand, you lose:', a: 'Only your original bet', ds: ['Both bets', 'Half of both bets', 'Nothing — free bets never lose'], why: 'The casino covers the extra chip when you lose (as commonly described — verify on the game\'s rules screen). That is why the free double is worth taking; the dealer-22 push is how the game recovers the cost.' },
      { q: 'A blackjack variant advertises <b>bigger payouts for side bets</b>. Your default assumption should be:', a: 'Negative EV until the paytable is verified', ds: ['Positive EV because the payouts are bigger', 'Neutral', 'Positive when a multiplier is showing'], why: 'Payouts and odds move together. Bigger numbers on rarer wins do not improve the price.' },
      { q: 'A "multiplier" drops on a side bet you did NOT bet on. It tells you:', a: 'Nothing about your next hand', ds: ['The next hand is more likely to hit', 'You are due', 'Bet more now'], why: 'RNG hands are independent; a multiplier landing changes the payout of a bet, not the cards.' },
      { q: 'Blackjack Switch pays 1:1 on blackjack, and pushes on dealer 22. The rule change you should notice first:', a: 'The natural pays 1:1 instead of 3:2', ds: ['You can see both dealer cards', 'The dealer must hit 17', 'Doubling is banned'], why: 'A 1:1 natural costs about 2.3 points of edge on its own; Switch offsets some of it with the card swap and pays for the rest with dealer-22 pushes.' },
    ]);
    return mc(sc.q, sc.a, sc.ds, sc.why);
  },
];

// ---- Tier 8: money & mind ----------------------------------------------------------------------
const T8 = [
  async () => {
    const B = pick([10, 20, 25, 50, 100]), P = pick([1, 1, 2, 3, 5]), c = pick([0.1, 0.1, 0.2, 0.5, 1]);
    const e = pick([0.004, 0.005, 0.014, 0.02]);
    const W = B * P / c, loss = W * e, ev = B - loss;
    return mc(`A bonus of <b>${money(B)}</b> needs <b>${P}× playthrough</b>. Blackjack contributes <b>${c * 100}%</b>. Your table's house edge is ${(e * 100).toFixed(1)}%. Expected value of clearing it?`,
      `${ev >= 0 ? '+' : '−'}${money(Math.abs(ev))}`, [`${ev >= 0 ? '−' : '+'}${money(Math.abs(ev))}`, `+${money(B)}`, `−${money(loss * 2)}`].filter((x) => x !== `${ev >= 0 ? '+' : '−'}${money(Math.abs(ev))}`),
      `You must wager ${money(B)} × ${P} ÷ ${c} = ${money(W)}; expected loss ${money(W)} × ${(e * 100).toFixed(1)}% = ${money(loss)}. EV = ${money(B)} − ${money(loss)} = ${ev >= 0 ? '+' : '−'}${money(Math.abs(ev))}. The contribution rate is the number that decides it.`);
  },
  async () => {
    const base = pick([5, 10, 25]), bank = pick([300, 500, 1000, 2000]);
    let bet = base, lost = 0, n = 0;
    while (lost + bet <= bank) { lost += bet; bet *= 2; n++; }
    return mc(`Martingale: base bet <b>${money(base)}</b>, doubling after every loss, bankroll <b>${money(bank)}</b>. After how many straight losses can you <b>no longer afford</b> the next bet?`, `${n}`, [`${n + 2}`, `${Math.max(2, n - 2)}`, `${n + 4}`].map(String),
      `Bets go ${Array.from({ length: n + 1 }, (_, i) => money(base * 2 ** i)).join(', ')}. After ${n} losses you have lost ${money(lost)} and the next bet (${money(bet)}) exceeds what is left. Each loss is close to a coin flip, so a run of ${n} happens far more often than intuition says.`);
  },
  async () => {
    const hands = pick([100, 200, 500]), bet = pick([5, 10, 25]), e = pick([0.004, 0.005, 0.014, 0.02]);
    const exp = hands * bet * e;
    return mc(`You play <b>${hands} hands</b> at <b>${money(bet)}</b> against a <b>${(e * 100).toFixed(1)}%</b> house edge. Expected loss?`, money(exp), [money(exp * 4), money(exp / 4), money(0)],
      `${hands} × ${money(bet)} = ${money(hands * bet)} wagered × ${(e * 100).toFixed(1)}% = ${money(exp)}. It is a price, paid in installments.`);
  },
  async () => {
    const hands = pick([100, 200, 400]), bet = 10, sd = 1.14 * Math.sqrt(hands) * bet;
    const lost = Math.round(sd * pick([0.6, 1.5, 2.5]) / 5) * 5;
    const z = lost / sd;
    const ok = z <= 1 ? 'Normal — well within one standard swing' : z <= 2 ? 'Unlucky but ordinary (about 1 session in 6)' : 'Rare (about 1 session in 40) — still not a strategy failure';
    return mc(`You played <b>${hands} hands</b> at $10 with perfect strategy and are down <b>$${lost}</b>. One standard swing is about <b>$${sd.toFixed(0)}</b>. Verdict:`, ok, ['Normal — well within one standard swing', 'Unlucky but ordinary (about 1 session in 6)', 'Rare (about 1 session in 40) — still not a strategy failure', 'Your strategy is wrong'].filter((x) => x !== ok).slice(0, 3),
      `Variance per hand is about 1.14 bets, so ${hands} hands swing by 1.14 × √${hands} × $10 ≈ $${sd.toFixed(0)}. Losing $${lost} is ${z.toFixed(1)} swings — a losing session is not a strategy failure.`);
  },
  async () => {
    const sc = pick([
      { t: 'You lost 4 hands in a row, so you double your bet "to get it back".', a: 'Loss chasing (escalation)', why: 'Bet size should follow your bankroll plan, never your last result.' },
      { t: 'You are down $80 — your stop-loss — but decide "one more shoe".', a: 'Breaking your stop-rule', why: 'The limit exists because your judgment is worst exactly when you are behind.' },
      { t: 'The last 5 hands were all dealer 20s, so you decide the dealer is "due" to bust.', a: "Gambler's fallacy", why: 'Each RNG hand is independent; nothing is due.' },
      { t: 'You win $60 and immediately raise your bet 3× because you are "playing with their money".', a: 'House-money effect', why: 'Won money is your money. Higher bets after wins raise the cost per hand.' },
    ]);
    return mc(`<b>${sc.t}</b> This is:`, sc.a, ['Loss chasing (escalation)', 'Breaking your stop-rule', "Gambler's fallacy", 'House-money effect', 'Sound bankroll management'].filter((x) => x !== sc.a), sc.why);
  },
];

export const QUIZ = { t0: T0, t1: T1, t6: [T6], t7: T7, t8: T8 };
export async function makeQuestion(genId) {
  const bank = QUIZ[genId];
  return pick(bank)();
}
export { shuffle, pick, mc };
