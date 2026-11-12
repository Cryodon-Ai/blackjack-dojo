// Coach brain, part two: computed answers and knowledge for the poker lab, Three Card Poker, Kelly sizing,
// baccarat roads and the counting tools. brain.js calls extraAnswer() before its own computed answers and
// adds EXTRA_KB to the searchable knowledge base. Everything is computed from the same engines the screens use.

import { mdf, bluffShare, potOdds as needEq, shoveEV } from '../../engine/pokerlab.js';
import { playEV, shouldPlay, evaluate3 } from '../../engine/threecard.js';
import { edgeAtTC } from '../../engine/indices.js';

const A = (title, simple, standard, deep, extra = {}) => ({ title, simple, standard: standard ?? simple, deep: deep ?? standard ?? simple, ...extra });
const pc = (x, d = 0) => `${(x * 100).toFixed(d)}%`;
const L = (href, text) => ({ href, text });
const VAR = 1.3;                                   // variance of one flat-bet blackjack hand, units²

// ---- data (precomputed heads-up tables; loaded once, injectable for tests) ------------------------------------------
let PF = null, EQ = null;
export function setData(pf, eq) { PF = pf; EQ = eq || EQ; }
async function loadPF() {
  if (!PF) PF = await fetch('./data/hu-pushfold.json').then((r) => r.json());
  return PF;
}
async function loadEQ() {
  if (!EQ) { try { EQ = await fetch('./data/hu-equity.json').then((r) => r.json()); } catch { EQ = null; } }
  return EQ;
}

// ---- push / fold ---------------------------------------------------------------------------------------------------------
async function pushFold(e) {
  const n = e.n, m = n.match(/(\d+(?:\.\d+)?)\s*(?:bbs?|big blinds?|bigs)\b/);
  if (!m || !e.pk.length || !/(shov|push|jam|all.?in)/.test(n)) return null;
  const asked = Number(m[1]), S = Math.max(2, Math.min(25, Math.round(asked))), label = e.pk[0];
  const pf = await loadPF(), row = pf[S]; if (!row) return null;
  const calling = /\bcall/.test(n);
  const set = calling ? row.call : row.push, yes = set.includes(label);
  const clamp = asked !== S ? ` (I have tables for 2 to 25 big blinds, so this uses ${S})` : '';
  let evLine = '';
  if (!calling) { const eq = await loadEQ(); if (eq) { const ev = shoveEV(eq, label, row.call, S); evLine = ` Against the equilibrium calling range the shove is worth about <b>${ev >= 0 ? '+' : '−'}${Math.abs(ev).toFixed(2)} bb</b>; folding the small blind is −0.50 bb.`; } }
  const title = calling ? `Calling a shove with ${label} at ${S}bb` : `Shoving ${label} at ${S}bb`;
  const verdict = calling ? (yes ? 'Call' : 'Fold') : (yes ? 'Shove' : 'Fold');
  return A(title,
    `<b>${verdict}.</b> Heads-up with ${S} big blinds${clamp}, ${label} is ${yes ? 'inside' : 'outside'} the equilibrium ${calling ? 'calling' : 'shoving'} range.`,
    `<b>${verdict}.</b> Heads-up at ${S} big blinds effective${clamp}, the small blind's equilibrium shoving range is about ${pc(row.pushPct)} of hands and the big blind calls with about ${pc(row.callPct)}. ${label} is ${yes ? '<b>in</b>' : '<b>not in</b>'} the ${calling ? 'calling' : 'shoving'} range.${evLine}`,
    `These ranges are a Nash equilibrium for a shove-or-fold game, computed in chip EV from a 169 × 169 equity table (20,000 trials per pair), so hands right on the border can flip. It assumes heads-up, no antes and no prize-ladder pressure: with antes you shove wider, and near a pay jump ICM makes calling tighter. Shorter stacks widen both ranges; deeper than about 15–20 big blinds a normal raise usually beats a shove.${evLine}`,
    { kind: 'calc', links: [L('#/play/poker/lab/pushfold', 'Push / fold trainer'), L('#/play/poker/lab/icm', 'ICM')], chips: [`${calling ? 'Shove' : 'Call a shove with'} ${label} ${calling ? 'with' : 'at'} ${S}bb`, 'What is ICM?'] });
}

// ---- MDF / bluff ratio by bet size ------------------------------------------------------------------------------------------
function betFraction(e) {
  const n = e.n; let m;
  if (e.pot && e.bet) return e.bet / e.pot;
  if ((m = n.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:of the |of )?pot/))) return Number(m[1]) / 100;
  if ((m = n.match(/(\d+)\s*\/\s*(\d+)\s*(?:of the |of )?pot/)) && Number(m[2]) > 0) return Number(m[1]) / Number(m[2]);
  if ((m = n.match(/(\d+(?:\.\d+)?)\s*x\s*(?:the )?pot/))) return Number(m[1]);
  if (/\b(quarter|1\/4)[ -]pot/.test(n)) return 0.25;
  if (/\b(third|one third)[ -]pot|third of (?:the )?pot/.test(n)) return 1 / 3;
  if (/\bhalf[ -](?:the )?pot|half of (?:the )?pot/.test(n)) return 0.5;
  if (/two[ -]thirds/.test(n)) return 2 / 3;
  if (/three[ -]quarters?/.test(n)) return 0.75;
  if (/double (?:the )?pot|twice (?:the )?pot/.test(n)) return 2;
  if (/overbet/.test(n)) return 1.5;
  if (/pot[ -]sized?|full pot|bets? (?:the )?pot\b|size of the pot/.test(n)) return 1;
  return null;
}
function defence(e) {
  const n = e.n;
  if (!/(\bmdf\b|minimum defen[cs]e|how often (?:should|do|must) i (?:defend|call|continue)|defend (?:against|vs)|how (?:often|many|much) (?:should|can|do) i bluff|bluff(?:ing)? (?:ratio|frequency|share)|value to bluff)/.test(n)) return null;
  const f = betFraction(e); if (f === null || !(f > 0)) return null;
  const d = mdf(f, 1), b = bluffShare(f, 1), need = needEq(f, 1), size = `${f.toFixed(2).replace(/\.?0+$/, '')} × pot`;
  return A(`Defending against a ${size} bet`,
    `Against a bet of ${size}, keep going with at least <b>${pc(d)}</b> of your range, or the bettor profits by bluffing any two cards.`,
    `Bet = ${size}. <b>Minimum defence frequency</b> = pot ÷ (pot + bet) = <b>${pc(d, 1)}</b>: fold more than ${pc(1 - d, 1)} and a pure bluff shows a profit. A single call needs <b>${pc(need, 1)}</b> equity (bet ÷ (pot + 2 × bet)). On the river the bettor can have up to <b>${pc(b, 1)}</b> bluffs in a balanced betting range, which is ${(b > 0 ? (1 - b) / b : 0).toFixed(1)} value hands per bluff.`,
    `MDF is a guard against being exploited, not a command. It assumes the bettor can bluff freely; real opponents who under-bluff (most low-stakes players on the river) should be folded to more often than MDF says, and over-bluffers called more. It also applies to your whole range at that point, not to one hand: defend with the hands that block their value and unblock their bluffs. Bigger bets lower MDF and let the bettor carry more bluffs: at ${size} that is ${pc(d, 1)} defence and ${pc(b, 1)} bluffs.`,
    { kind: 'calc', links: [L('#/play/poker/lab/mdf', 'MDF trainer'), L('#/play/poker/lab/blockers', 'Blockers')], chips: ['MDF against a pot-sized bet', 'How often should I bluff with a half pot bet?'] });
}

// ---- Three Card Poker: play or fold a named hand ------------------------------------------------------------------------------
const RW = { ace: 14, king: 13, queen: 12, jack: 11, ten: 10, nine: 9, eight: 8, seven: 7, six: 6, five: 5, four: 4, three: 3, two: 2, deuce: 2 };
const RC = { A: 14, K: 13, Q: 12, J: 11, T: 10 };
const RN = (r) => (r <= 10 ? String(r) : { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[r]);
export function parseThree(raw) {
  const s = String(raw).replace(/\b(?:three|3)[ -]?card(?: poker)?\b/gi, ' ').replace(/\btcp\b/gi, ' ');
  let m;
  if ((m = s.match(/(?:^|[^A-Za-z0-9])(10|[AKQJT2-9])[-\s,\/]{0,2}(10|[AKQJT2-9])[-\s,\/]{0,2}(10|[AKQJT2-9])(?![A-Za-z0-9])/))) return [m[1], m[2], m[3]].map((x) => RC[x] || Number(x));
  const words = [...s.toLowerCase().matchAll(/\b(ace|king|queen|jack|ten|nine|eight|seven|six|five|four|three|two|deuce)s?\b/g)].map((x) => RW[x[1]]);
  return words.length === 3 ? words : null;
}
function threeCard(e, text) {
  const n = e.n;
  if (!/\b(?:three|3)[ -]?card|\btcp\b/.test(n)) return null;
  const ranks = parseThree(text); if (!ranks) return null;
  const suited = /\bsuited\b|\bflush\b|same suit/.test(n);
  const sorted = ranks.slice().sort((a, b) => b - a);
  if (suited && new Set(sorted).size < 3) return null;
  const cards = sorted.map((r, i) => (r - 2) * 4 + (suited ? 0 : i));        // engine ints: rank*4 + suit
  const ev = evaluate3(cards);
  if (ev.ranks.join() !== sorted.join()) return null;                         // card encoding guard
  const p = playEV(cards), play = shouldPlay(cards), name = sorted.map(RN).join('-') + (suited ? ' suited' : '');
  const s = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(3)}`;
  return A(`Three Card Poker: ${name}`,
    `<b>${play ? 'Play' : 'Fold'}.</b> ${ev.cat > 0 ? `${ev.name} always plays.` : play ? 'It is Queen-6-4 or better.' : 'It is below Queen-6-4.'}`,
    `<b>${play ? 'Play' : 'Fold'}</b> ${name} (${ev.name.toLowerCase()}). Making the Play bet is worth <b>${s(p.play)}</b> antes on average; folding is exactly −1.000. The dealer fails to qualify ${pc(p.pNotQualify)} of the time, you win outright ${pc(p.pWin)} and lose ${pc(p.pLose)}.`,
    `The rule is: play Queen-6-4 or better, fold anything worse. It comes from comparing the two numbers above for every hand: playing a weak hand still loses on average, but it loses less than the certain −1 of folding once you reach Q-6-4. Following it exactly, the Ante and Play bets together cost about 3.37% of the ante per hand (about 2.0% of the total money you put out). Exact figures here: play ${s(p.play)}, fold −1.000, dealer does not qualify ${pc(p.pNotQualify, 1)}, win ${pc(p.pWin, 1)}, lose ${pc(p.pLose, 1)}, tie ${pc(p.pPush, 2)}.`,
    { kind: 'calc', links: [L('#/play/threecard/drill', 'Play-or-fold drill'), L('#/play/threecard/cost', 'What it costs')], chips: ['Three card poker Q-6-3', 'Is Pair Plus a good bet?'] });
}

// ---- Kelly bet --------------------------------------------------------------------------------------------------------------------
function kelly(e) {
  const n = e.n;
  if (!/\bkelly\b/.test(n)) return null;
  let m, B = e.bankroll;
  if (!B && (m = n.match(/\$?(\d[\d,]{2,})\s*(?:dollar |unit )?bankroll/))) B = Number(m[1].replace(/,/g, ''));
  if (!B && (m = n.match(/\bwith \$?(\d[\d,]{2,})\b/))) B = Number(m[1].replace(/,/g, ''));
  let edge = null, from = '';
  if ((m = n.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:edge|advantage)/)) || (m = n.match(/(?:edge|advantage)\s*(?:of|is|=)?\s*(\d+(?:\.\d+)?)\s*(?:%|percent)/))) { edge = Number(m[1]) / 100; from = `an edge of ${m[1]}%`; }
  else if (e.tc !== undefined && e.tc !== null) { edge = edgeAtTC(0.5, e.tc) / 100; from = `true count ${e.tc >= 0 ? '+' : ''}${e.tc} (about ${(edge * 100).toFixed(2)}% on a 0.5% game)`; }
  if (!B || edge === null) return null;
  if (edge <= 0) return A('Kelly bet', `At ${from} you have no edge, so Kelly says bet the minimum (or nothing).`, `Kelly sizes a bet in proportion to your edge. At ${from} the edge is zero or negative, so the right bet is the table minimum, or sitting the hand out if you are back-counting.`, null, { kind: 'calc', links: [L('#/play/counting/bankroll', 'Bankroll & Kelly')] });
  const full = edge / VAR * B, r = (x) => `$${Math.round(x).toLocaleString('en-US')}`;
  return A('Kelly bet',
    `With ${r(B)} and ${from}, full Kelly is about <b>${r(full)}</b> a hand. Most players bet half of that: <b>${r(full / 2)}</b>.`,
    `Kelly bet = bankroll × edge ÷ variance. For blackjack the variance of one hand is about ${VAR}, so ${r(B)} × ${(edge * 100).toFixed(2)}% ÷ ${VAR} = <b>${r(full)}</b> (full Kelly). Half Kelly is <b>${r(full / 2)}</b>, quarter Kelly ${r(full / 4)}.`,
    `Full Kelly grows a bankroll fastest in theory, but it assumes you know your edge exactly, and the ride is rough: about a one-in-two chance of being down by half at some point. Half Kelly gives up about a quarter of the growth for far smaller swings, which is why it is the usual choice. Kelly bets shrink as the bankroll shrinks, so resize after big wins or losses. This is sizing for a real, measured edge only: it does nothing for a game where the house has the edge.`,
    { kind: 'calc', links: [L('#/play/counting/bankroll', 'Bankroll & Kelly'), L('#/play/counting/sim', 'Simulator')], chips: ['What is risk of ruin?', 'What bet at true count +3 on a 1-8 spread?'] });
}

export async function extraAnswer(text, e) {
  return (await pushFold(e)) || threeCard(e, text) || defence(e) || kelly(e) || null;
}

// ---- knowledge ---------------------------------------------------------------------------------------------------------------------
const K = (id, title, tags, simple, standard, deep, links = []) => ({ id, title, tags, simple, standard, deep, links });
export const EXTRA_KB = [
  K('pk-icm', 'ICM', 'icm independent chip model tournament bubble pay jump chips worth money prize final table sit and go',
    'In a tournament, chips you win are worth less than chips you lose, because you cannot cash out and only the top places are paid.',
    'ICM (the Independent Chip Model) turns chip stacks into prize money. Doubling your stack does not double your share of the prize pool, so risking your whole stack needs more equity than plain pot odds say. The effect is strongest on the bubble and at pay jumps, and strongest for middle stacks while a short stack is still in.',
    'The model gives each player a chance of finishing first equal to their share of the chips, then repeats for second place among the rest, and so on. The gap between the equity you need in chips and the equity you need in prize money is the "risk premium". Big stacks can use it to pressure medium stacks, who should fold hands that would be easy calls in a cash game. ICM ignores skill, position and future blinds, so treat it as a guide.',
    [L('#/play/poker/lab/icm', 'ICM calculator')]),
  K('pk-nash-pushfold', 'Nash push / fold', 'nash push fold shove jam short stack heads up equilibrium all in big blinds chart',
    'With a short stack, the best play is often just all-in or fold. There is a chart for which hands to shove at each stack size.',
    'Below about 10 to 15 big blinds, a normal raise commits too much of your stack, so the game shrinks to shove or fold. A Nash chart gives ranges where neither player can do better by changing: heads-up at 10 big blinds the small blind shoves about 58% of hands and the big blind calls about 37%. Ask me a specific spot, for example "shove A5o with 10bb".',
    'Equilibrium ranges cannot be exploited, but they are not the most profitable against a player who calls too tightly (shove wider) or too loosely (shove tighter, with more value). The app\'s charts are heads-up, chip EV, no antes. Antes widen every range; ICM pressure tightens the calling range.',
    [L('#/play/poker/lab/pushfold', 'Push / fold trainer')]),
  K('pk-mdf', 'Minimum defence frequency (MDF)', 'mdf minimum defence defense frequency how often call fold bluff catcher exploit bet size',
    'It is the share of your hands you must keep playing against a bet so that bluffing you is not automatically profitable.',
    'MDF = pot ÷ (pot + bet). Against a half-pot bet you defend 67%, against a pot-sized bet 50%, against a double-pot bet 33%. The mirror image is the bettor\'s bluff share: bet ÷ (pot + 2 × bet), so a pot-sized river bet can be one-third bluffs.',
    'MDF protects you from an opponent who bluffs as much as they like. Against players who rarely bluff, fold more than MDF; against wild ones, call more. Ask me with a size, for example "MDF against a 75% pot bet".',
    [L('#/play/poker/lab/mdf', 'MDF trainer')]),
  K('pk-blockers', 'Blockers', 'blockers block unblock card removal bluff catch nut flush ace combos remove',
    'A blocker is a card in your hand that makes it less likely your opponent holds a certain hand.',
    'Holding the ace of the flush suit means your opponent cannot have the nut flush. Good bluffs block the hands that would call you; good bluff-catchers block the hands that beat you and do not block the bluffs. The effect is real but small: it settles close decisions, it does not override a clear one.',
    'Count combinations: with an ace in your hand, pocket aces drop from 6 combos to 3 and ace-king from 16 to 12. On the river, compare how much of their value range and how much of their bluffing range your two cards remove. The blocker trainer shows both numbers for any hand and board.',
    [L('#/play/poker/lab/blockers', 'Blocker trainer')]),
  K('pk-range-adv', 'Range advantage and board texture', 'range advantage nut board texture dry wet c-bet continuation bet who does the flop favour favor raiser caller',
    'Some flops are better for the player who raised before the flop, some for the caller. Bet more often on the ones that favour you.',
    'The raiser\'s range holds more big pairs and big aces, so high, dry boards like A-K-4 or K-7-2 favour the raiser: small bets work with most hands. Low, connected boards like 7-6-5 hit the caller\'s range harder: check more and bet bigger when you do bet.',
    'Two things matter: equity advantage (whose range wins more often overall) and nut advantage (who holds more of the very best hands). Equity advantage supports frequent small bets; nut advantage supports large bets. The texture trainer computes the range-against-range equity for each flop.',
    [L('#/play/poker/lab/texture', 'Texture trainer'), L('#/play/poker/lab/spots', 'Postflop spots')]),
  K('pk-tilt', 'Tilt', 'tilt angry frustrated chase losses emotional steaming stop loss bad beat upset',
    'Tilt is playing worse because you are upset. The fix is to notice it early and stop.',
    'Common triggers are bad beats, a run of losses, tiredness and playing too long. Warning signs: playing hands you normally fold, raising stakes to get even, speeding up. Set a stop-loss and a time limit before you sit down, and leave when either is hit.',
    'Losses hurt about twice as much as equal wins feel good, which pushes people to gamble more when behind, exactly when judgement is worst. A fixed pre-session rule works better than willpower in the moment. If stopping is hard, or the money matters, that is a reason to step away and talk to someone; the US helpline is 1-800-GAMBLER.',
    [L('#/play/poker/lab/tilt', 'Tilt check')]),
  K('bacc-roads', 'Baccarat roads (bead plate, big road, derived roads)', 'baccarat roads big road bead plate big eye boy small road cockroach pig derived scoreboard pattern dragon streak trend',
    'The roads are scoreboards of past hands. They look like patterns, but they do not predict the next hand.',
    'The bead plate lists every result in order. The big road starts a new column each time the winner changes. The three derived roads (big eye boy, small road, cockroach pig) only record whether the big road is being "regular": red for repeating, blue for choppy. They do not mean Banker or Player.',
    'Each baccarat hand is close to independent, and the tiny effect of cards already dealt is far too small to use. A long "dragon" streak is exactly what random results produce now and then. Reading roads is a useful skill for following the table and the conversation, not for betting; Banker stays at about 1.06% and Player 1.24% whatever the board shows.',
    [L('#/play/baccarat/roads', 'Roads lesson'), L('#/play/baccarat/trap', 'Temptation trap')]),
  K('tcp-rules', 'Three Card Poker', 'three card poker 3 card tcp rules ante play pair plus q-6-4 queen six four dealer qualify house edge',
    'You get three cards and either fold or bet again. Play Queen-6-4 or better, fold the rest.',
    'You post an Ante, look at three cards, then fold (losing the Ante) or make a Play bet equal to it. The dealer needs Queen-high to qualify: if not, the Ante pays even money and the Play bet is returned. A straight beats a flush here, because with three cards straights are rarer. The best strategy is one rule: play Q-6-4 or better.',
    'With that rule you play about 67% of hands and the Ante and Play bets cost about 3.37% of the ante per hand, roughly 2.0% of the total money wagered. Pair Plus is a separate bet on your own hand: about 7.28% on the common 40-30-6-3-1 pay table and 2.32% on the rarer 40-30-6-4-1. Ask me a hand, for example "three card poker K-7-2".',
    [L('#/play/threecard/learn', 'Learn it'), L('#/play/threecard/table', 'Practice table')]),
  K('tcp-pairplus', 'Pair Plus', 'pair plus side bet three card poker pay table worth good bad',
    'Pair Plus pays when your three cards make a pair or better. It usually costs more than the main game.',
    'It wins about a quarter of the time (25.6%). On the common pay table (flush pays 3) the house edge is about 7.28%; where a flush pays 4 it drops to about 2.32%. Always check what the flush pays.',
    'There is no decision to make on Pair Plus, so there is no strategy that improves it: the pay table is the whole story. The main Ante and Play game at about 3.37% of the ante is the cheaper bet on the common table.',
    [L('#/play/threecard/cost', 'What it costs')]),
  K('cnt-kelly', 'Kelly betting', 'kelly criterion bet size optimal half kelly quarter bankroll growth fraction',
    'Kelly says to bet a share of your bankroll that matches your edge. Bigger edge, bigger bet. No edge, minimum bet.',
    'For blackjack, Kelly bet ≈ bankroll × edge ÷ 1.3. With $10,000 and a 1% edge that is about $77. Most counters bet half Kelly because the edge is an estimate and full Kelly swings hard. Ask me with numbers, for example "Kelly bet with a 10000 bankroll at true count +3".',
    'Kelly only applies when you truly have an edge. In a negative game it says bet nothing, and no way of sizing bets turns a house edge into a player edge.',
    [L('#/play/counting/bankroll', 'Bankroll & Kelly')]),
  K('cnt-wonging', 'Back-counting (Wonging)', 'back counting wong wonging wong in out enter leave shoe watch stand behind mid shoe entry',
    'You watch a table without playing and only sit down when the count is good.',
    'By skipping the negative counts you avoid the hands where the house has the bigger edge, so the same spread earns more per hand played, at the price of fewer hands per hour. Typical plan: enter at true count +1 or +2, leave when it drops below zero.',
    'Many tables post "no mid-shoe entry" to stop exactly this, and hopping in only on rich shoes is easy for staff to notice. The simulator has a back-count setting so you can compare it with playing every hand under your own rules.',
    [L('#/play/counting/sim', 'Simulator')]),
  K('cnt-penetration', 'Penetration', 'penetration deck depth cut card how deep dealt shoe counting matters',
    'Penetration is how much of the shoe is dealt before the shuffle. Deeper is better for a counter.',
    'High true counts mostly appear late in a shoe. If the cut card comes out after half the cards, those counts rarely show up and a counter\'s edge nearly vanishes. About 75% dealt is ordinary, 80% or more is good, under 65% is usually not worth playing.',
    'Penetration often matters more than small rule differences. Compare tables in the simulator by changing only the penetration; the table scout grades a real table from its rules, decks and depth.',
    [L('#/play/counting/scout', 'Table scout'), L('#/play/counting/sim', 'Simulator')]),
  K('cnt-solved-idx', 'Solved index numbers', 'solved index numbers my rules tables custom deviations illustrious computed published',
    'The app can work out the index numbers for your exact rules instead of using the published ones.',
    'Published indices such as the Illustrious 18 were computed for particular rules. The solver recomputes each one for the rules you set and shows where they differ. You can switch drills and the coach to the solved values.',
    'Differences are usually one count either way and worth little money; the published set is fine for most play. Values that drift more than two from the published number are kept at the published figure, as a guard against simulation noise.',
    [L('#/play/counting/tables', 'Solved tables')]),
];
