// The coach's brain: understands a question, pulls out the hands / counts / cards / positions it mentions,
// works the answer out with the app's real engines (exact blackjack solver, Monte Carlo poker equity,
// baccarat rules, ranges), and explains it at three levels: plain, standard, deep. Everything runs offline.
// When the question is conceptual it searches the knowledge base and the lessons (BM25).

import { KB } from './kb.js';
import { engine } from '../engine-client.js';
import { explain, ACTION_NAME } from '../feedback.js';
import { describeRules } from '../presets.js';
import { upLabel } from '../../engine/rules.js';
import { indexPlay, ruleFor, idxOf, rampUnits, RAMPS, edgeAtTC, insuranceTaken } from '../../engine/indices.js';
import { handLabel } from '../../ui/cards.js';
import { bankerDraws, bankerReason, edges as baccEdges } from '../../engine/baccarat.js';
import { equity, classCombos, parseRange, RFI, openAction, facingRaise, rangePct, chen, RANKS, POSITIONS, potOddsNeeded, ruleOf, strengthOrder, ALL_CLASSES, parseCards } from '../../engine/poker.js';
import { LESSONS, GLOSSARY, TIPS } from '../../curriculum/poker.js';
import { worst } from '../weak.js';

const W2N = { ace: 1, aces: 1, one: 1, two: 2, deuce: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, tens: 10, jack: 10, queen: 10, king: 10, face: 10 };
const PW2R = { ace: 14, king: 13, queen: 12, jack: 11, ten: 10, nine: 9, eight: 8, seven: 7, six: 6, five: 5, four: 4, three: 3, two: 2, deuce: 2 };
const POSW = { utg: 'UTG', 'under the gun': 'UTG', hj: 'HJ', hijack: 'HJ', co: 'CO', cutoff: 'CO', 'cut off': 'CO', btn: 'BTN', button: 'BTN', sb: 'SB', 'small blind': 'SB', bb: 'BB', 'big blind': 'BB' };
const num = (s) => (s === undefined || s === null ? null : Number(String(s).replace('−', '-')));
const sgn = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
const pc = (x, d = 0) => `${(x * 100).toFixed(d)}%`;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const upName = (u) => (u === 1 ? 'an ace' : u === 10 ? 'a ten' : `a ${u}`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const strip = (h) => String(h).replace(/<br\s*\/?>/g, ' ').replace(/<\/(p|li|tr|div|h3)>/g, '. ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim();

// ---- entity extraction ------------------------------------------------------------------------------------------------------
const norm = (t) => ` ${t.toLowerCase().replace(/[–—]/g, '-').replace(/−/g, '-').replace(/\b(versus|against|vs\.?|v\.?)\b/g, ' vs ').replace(/\s+/g, ' ')} `;

function parseUp(n) {
  const m = n.match(/ vs (?:an? |the |dealer(?:'s)? )?(?:dealer (?:is |has |shows |showing )?(?:an? )?)?(ace|ten|face(?: card)?|king|queen|jack|two|three|four|five|six|seven|eight|nine|a|\d{1,2})\b/)
    || n.match(/dealer (?:is showing|shows|showing|has|upcard (?:is|of)?|up card (?:is|of)?)\s*(?:an? )?(ace|ten|face(?: card)?|king|queen|jack|two|three|four|five|six|seven|eight|nine|\d{1,2})\b/)
    || n.match(/(?:upcard|up card)(?: of| is)? (?:an? )?(ace|ten|face(?: card)?|king|queen|jack|two|three|four|five|six|seven|eight|nine|\d{1,2})\b/);
  if (!m) return null;
  const w = m[1].replace(' card', '');
  if (w === 'a') return 1;
  const v = /^\d/.test(w) ? Number(w) : W2N[w];
  return v >= 1 && v <= 10 ? v : null;
}

function parseBJHand(n, up) {
  const before = up !== null && n.includes(' vs ') ? n.slice(0, n.indexOf(' vs ')) : n;
  let m;
  if ((m = before.match(/soft\s*(\d{2})/))) { const t = Number(m[1]); if (t >= 13 && t <= 21) return { cards: [1, t - 11], text: `soft ${t}` }; }
  if ((m = before.match(/\b(?:a|ace)\s*[,\-/ ]?\s*(\d|two|three|four|five|six|seven|eight|nine|ten)\b/)) && !/\bpair of aces?\b/.test(before)) { const v = /^\d/.test(m[1]) ? Number(m[1]) : W2N[m[1]]; if (v >= 2 && v <= 10) return { cards: [1, v], text: `A,${v}` }; }
  if (/\b(?:pair of )?(?:two )?aces\b|\ba,\s*a\b|\baa\b|\bpocket aces\b/.test(before) && !/ace[s]? (?:king|queen)/.test(before)) return { cards: [1, 1], text: 'A,A' };
  if ((m = before.match(/\b(?:pair of|double|pocket)\s*(twos|threes|fours|fives|sixes|sevens|eights|nines|tens|\d{1,2}s?)\b/))) {
    const PL = { twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6, sevens: 7, eights: 8, nines: 9, tens: 10 };
    const v = PL[m[1]] || Number(m[1].replace(/s$/, ''));
    if (v >= 2 && v <= 10) return { cards: [v, v], text: `${v},${v}` };
  }
  if ((m = before.match(/\b(\d{1,2})\s*[,\-/]\s*(\d{1,2})\b/)) && Number(m[1]) >= 2 && Number(m[1]) <= 10 && Number(m[2]) >= 2 && Number(m[2]) <= 10) return { cards: [Number(m[1]), Number(m[2])], text: `${m[1]},${m[2]}` };
  if ((m = before.match(/\b([2-9])\1\b/))) return { cards: [Number(m[1]), Number(m[1])], text: `${m[1]},${m[1]}` };
  if ((m = before.match(/\b(\d{1,2})\s+(\d{1,2})\s*(?:vs)?\s*$/)) && Number(m[1]) <= 10 && Number(m[2]) <= 10) return { cards: [Number(m[1]), Number(m[2])], text: `${m[1]},${m[2]}` };
  if ((m = before.match(/(?:hard\s*)?\b(\d{1,2})\b\s*$/)) || (m = before.match(/\bhard\s*(\d{1,2})\b/)) || (m = before.match(/\b(?:have|got|with|holding|hand of|total of|is|a)\s+(?:a |an )?(\d{1,2})\b/))) {
    const t = Number(m[1]);
    if (t >= 5 && t <= 20) { const x = Math.floor((t - 1) / 2); return { cards: t <= 11 ? [x, t - x] : t === 20 ? [10, 5, 5] : [10, t - 10], text: `hard ${t}` }; }
  }
  return null;
}

function parsePokerLabel(raw, n) {
  let m;
  // explicit: AKs, QJo, T9s, AhKd
  if ((m = raw.match(/\b([AKQJT2-9])([shdc])\s?([AKQJT2-9])([shdc])\b/))) { const hi = RANKS.indexOf(m[1]) >= RANKS.indexOf(m[3]) ? [m[1], m[3]] : [m[3], m[1]]; return hi[0] === hi[1] ? hi[0] + hi[1] : hi[0] + hi[1] + (m[2] === m[4] ? 's' : 'o'); }
  if ((m = raw.match(/\b([AKQJT2-9])([AKQJT2-9])(s|o)\b/i)) && RANKS.includes(m[1].toUpperCase()) && RANKS.includes(m[2].toUpperCase())) { let a = m[1].toUpperCase(), b = m[2].toUpperCase(); if (RANKS.indexOf(a) < RANKS.indexOf(b)) [a, b] = [b, a]; return a === b ? a + b : a + b + m[3].toLowerCase(); }
  if ((m = raw.match(/\b([AKQJT2-9])\1\b/))) return m[1] + m[1];
  if ((m = n.match(/\b(aa|kk|qq|jj|tt)\b/))) return m[1].toUpperCase();
  if ((m = n.match(/(?:pocket|pair of|a pair of)\s+(aces|kings|queens|jacks|tens|nines|eights|sevens|sixes|fives|fours|threes|twos|deuces)/))) { const k = { aces: 14, kings: 13, queens: 12, jacks: 11, tens: 10, nines: 9, eights: 8, sevens: 7, sixes: 6, fives: 5, fours: 4, threes: 3, twos: 2, deuces: 2 }[m[1]]; return RANKS[k - 2] + RANKS[k - 2]; }
  if ((m = n.match(/\b(ace|king|queen|jack|ten|nine|eight|seven|six|five|four|three|two)[ -]+(ace|king|queen|jack|ten|nine|eight|seven|six|five|four|three|two)\b(?:\s+(suited|offsuit|off suit|unsuited))?/))) {
    let a = PW2R[m[1]], b = PW2R[m[2]]; if (a < b) [a, b] = [b, a];
    if (a === b) return RANKS[a - 2] + RANKS[a - 2];
    return RANKS[a - 2] + RANKS[b - 2] + (m[3] && m[3] === 'suited' ? 's' : 'o');
  }
  return null;
}
function allPokerLabels(raw, n) {
  const out = []; const seen = new Set();
  const re = /\b([AKQJT2-9])([AKQJT2-9])(s|o)?\b/g; let m;
  while ((m = re.exec(raw))) { const a = m[1], b = m[2]; if (!m[3] && a !== b) continue; if (/^[a-z]/.test(a)) continue; let x = a, y = b; if (RANKS.indexOf(x) < RANKS.indexOf(y)) [x, y] = [y, x]; const l = x === y ? x + y : x + y + (m[3] || 's'); out.push([m.index, l]); }
  const low = /\b(aa|kk|qq|jj|tt)\b/g; while ((m = low.exec(n))) out.push([m.index, m[1].toUpperCase()]);
  const words = /(?:pocket |a pair of |pair of )?\b(aces|kings|queens|jacks)\b/g; while ((m = words.exec(n))) { const k = { aces: 'A', kings: 'K', queens: 'Q', jacks: 'J' }[m[1]]; out.push([m.index, k + k]); }
  return out.sort((a, b) => a[0] - b[0]).map((x) => x[1]).filter((l) => !seen.has(l + out.length) && (seen.add(l + out.length), true));
}

export function extract(text) {
  const raw = text, n = norm(text), e = {};
  e.up = parseUp(n);
  const bj = parseBJHand(n, e.up); if (bj) e.bj = bj;
  let m;
  if ((m = n.match(/(?:true count|tc)\s*(?:of|is|at|=|:)?\s*\(?([+\-]?\s?\d+(?:\.\d+)?)/)) || (m = n.match(/\bat\s*(?:a )?(?:true count )?([+\-]\s?\d+(?:\.\d+)?)\b/)) || (m = n.match(/\bcount (?:of|is|at)\s*([+\-]?\d+(?:\.\d+)?)/))) e.tc = num(m[1].replace(/\s/g, ''));
  if ((m = n.match(/running count\s*(?:of|is|at|=)?\s*([+\-]?\d+)/)) || (m = n.match(/\brc\s*(?:of|is|=)?\s*([+\-]?\d+)/))) e.rc = num(m[1]);
  if ((m = n.match(/(\d+(?:\.\d+)?)\s*(?:decks?|d)\s*(?:left|remaining|remain|to go|in the shoe)?/)) && /left|remain|decks?/.test(n)) e.decksLeft = num(m[1]);
  const pos = []; for (const [k, v] of Object.entries(POSW)) { const re = new RegExp(`\\b${k}\\b`, 'g'); let mm; while ((mm = re.exec(n))) pos.push([mm.index, v]); }
  e.positions = pos.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  e.pk = allPokerLabels(raw, n); const one = parsePokerLabel(raw, n); if (one && !e.pk.length) e.pk = [one];
  if ((m = n.match(/\bpot\s*(?:is|of|=|:)?\s*\$?(\d+(?:\.\d+)?)/))) e.pot = num(m[1]);
  if ((m = n.match(/\b(?:bet|bets|betting|raise|raises|raised|shoves?|pushes?)\s*(?:of|is|to|=|:)?\s*\$?(\d+(?:\.\d+)?)/))) e.bet = num(m[1]);
  if ((m = n.match(/\b(\d{1,2})\s*outs?\b/))) e.outs = num(m[1]);
  if (/\bflop\b/.test(n)) e.street = 'flop'; else if (/\bturn\b/.test(n)) e.street = 'turn'; else if (/\briver\b/.test(n)) e.street = 'river';
  if ((m = n.match(/banker (?:has|total|is|with|shows)?\s*(\d)/))) e.bBank = num(m[1]);
  if ((m = n.match(/(?:player'?s?|his|their)\s*(?:third|3rd)(?: card)?\s*(?:is|was|=)?\s*(?:an? )?(\d|ace|ten|face|king|queen|jack|nine|eight|seven|six|five|four|three|two)/))) e.pThird = /^\d/.test(m[1]) ? num(m[1]) : (W2N[m[1]] === 10 ? 0 : W2N[m[1]]);
  if (/player (?:stood|stands|did not draw|didn'?t draw|no (?:third|draw))/.test(n)) e.pThird = null, e.pStood = true;
  if ((m = n.match(/bankroll\s*(?:of|is|=)?\s*\$?(\d[\d,]*)\s*(units?|u|dollars|\$)?/))) e.bankroll = num(m[1].replace(/,/g, '')), e.bankUnits = /unit|u$/.test(m[2] || '');
  const spread = n.match(/\b1\s*[-–to]+\s*(4|8|12)\b/); if (spread) e.ramp = `1-${spread[1]}`;
  e.n = n;
  return e;
}

// ---- retrieval (BM25 over the knowledge base, lessons, glossary and tips) --------------------------------------------------------------------------
const STOP = new Set('a an the of to in on at is are was were be been do does did i you me my we it its this that these those and or but if then than so for with from by as how what why when where which who can could should would will shall may might have has had not no yes about into over under up down out just very really'.split(' '));
const stem = (w) => w.replace(/(ing|ed|es|s)$/, (m, x, i, s) => (s.length - m.length >= 3 ? '' : m));
const tok = (t) => String(t).toLowerCase().replace(/[^a-z0-9+\-\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
let CORPUS = null, AVG = 0, DF = new Map();
function corpus() {
  if (CORPUS) return CORPUS;
  const docs = [];
  for (const k of KB) docs.push({ id: k.id, kb: k, title: k.title, links: k.links, text: `${k.title} ${k.tags} ${k.simple} ${k.standard} ${k.deep}`, boost: `${k.title} ${k.tags}` });
  for (const l of LESSONS) {
    let html = ''; try { html = l.body({ pstr: () => '', pcards: () => '' }); } catch { /* ignore */ }
    html.split('<h3>').slice(1).forEach((chunk, i) => { const title = strip(chunk.split('</h3>')[0]), body = strip(chunk.split('</h3>')[1] || ''); if (body.length > 40) docs.push({ id: `lesson:${l.id}:${i}`, title: `${title}`, from: l.title, links: [{ href: `#/play/poker/learn/${l.id}`, text: l.title }], text: `${title} ${body}`, boost: `${title} ${l.title}`, body }); });
  }
  for (const [t, d] of GLOSSARY) docs.push({ id: 'gl:' + t, title: t, links: [{ href: '#/play/poker/tips', text: 'Glossary' }], text: `${t} ${d}`, boost: t, body: d, gloss: true });
  for (const [t, b] of TIPS) docs.push({ id: 'tip:' + t, title: t, links: [{ href: '#/play/poker/tips', text: 'Tips' }], text: `${t} ${b}`, boost: t, body: b });
  for (const d of docs) { d.tf = new Map(); const ts = [...tok(d.text), ...tok(d.boost), ...tok(d.boost), ...tok(d.boost)]; d.len = ts.length; for (const w of ts) d.tf.set(w, (d.tf.get(w) || 0) + 1); for (const w of new Set(ts)) DF.set(w, (DF.get(w) || 0) + 1); }
  AVG = docs.reduce((a, d) => a + d.len, 0) / docs.length;
  return (CORPUS = docs);
}
export function search(q, n = 4) {
  const docs = corpus(), qs = [...new Set(tok(q))], N = docs.length, k1 = 1.4, b = 0.75;
  const qset = new Set(qs), ql = ` ${String(q).toLowerCase()} `;
  const scored = docs.map((d) => {
    let s = 0;
    for (const w of qs) { const f = d.tf.get(w); if (!f) continue; const idf = Math.log(1 + (N - (DF.get(w) || 0) + 0.5) / ((DF.get(w) || 0) + 0.5)); s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / AVG)); }
    if (s > 0) { const bs = new Set(tok(d.boost)); let m = 0; for (const w of qset) if (bs.has(w)) m++; s += 5 * (m / Math.max(1, qset.size)); if (d.kb) s *= 1.25; if (ql.includes(` ${d.title.toLowerCase()}`) ) s += 8; }
    return { d, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  return scored.slice(0, n);
}

// ---- helpers for answers ------------------------------------------------------------------------------------------------------------------------------------
const A = (title, simple, standard, deep, extra = {}) => ({ title, simple, standard: standard ?? simple, deep: deep ?? standard ?? simple, ...extra });
const bullets = (items) => `<ul style="margin:6px 0 0;padding-left:18px">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const evTable = (lines) => `<table class="evtable">${lines.map((l) => `<tr class="${l.best ? 'best' : ''}"><td>${l.name}${l.best ? ' ✓' : ''}${l.legal ? '' : ' (not allowed)'}</td><td class="num">${(l.ev * 100 >= 0 ? '+' : '−') + Math.abs(l.ev * 100).toFixed(1)}%</td></tr>`).join('')}</table>`;
const dealerBars = (t) => `<table class="evtable">${[['17', t[17]], ['18', t[18]], ['19', t[19]], ['20', t[20]], ['21', t[21]], ['Bust', t.bust]].map(([k, v]) => `<tr><td>Dealer ${k}</td><td class="num">${pc(v, 1)}</td></tr>`).join('')}</table>`;
const hitCards = (hard, soft) => (soft ? 'any single card' : `a ${21 - hard}-or-less card`);

// ---- handlers --------------------------------------------------------------------------------------------------------------------------------------------------------------
async function bjDecision(e, ctx) {
  const rules = ctx.rules, cards = e.bj.cards, up = e.up;
  const res = await engine.decide(rules, cards, up);
  const best = res.action, fb = await explain(rules, cards, up, { ...res, action: best }, best);
  const bust = fb.dealer.bust, name = ACTION_NAME[best], total = fb.total, soft = fb.soft;
  const hand = fb.title;
  const weak = up >= 2 && up <= 6;
  const layman = {
    S: weak ? `Stand. The dealer showing ${upName(up)} busts about ${pc(bust)} of the time, so you let them take the risk.` : `Stand. Your ${total} is good enough that taking another card would risk busting more than it could gain.`,
    H: `Hit. ${soft ? 'The ace means you cannot bust with one card, ' : ''}${weak ? 'even though the dealer is weak, ' : 'the dealer is strong, so '}standing on ${total} would mostly lose. Taking a card gives you a real chance to improve.`,
    D: `Double down. You are likely ahead, and the dealer's ${upLabel(up)} is not strong enough to stop you, so put more money out while you are favoured.`,
    P: `Split. Two hands starting from this card are worth more than one hand with ${total}.`,
    R: `Surrender. This hand loses so often that giving up half your bet is the cheapest way out.`,
  }[best];
  const second = fb.lines.filter((l) => l.legal && !l.best)[0];
  const cond = rules.surrender === 'late' ? '' : (best !== 'R' ? '' : '');
  const out = A(`${hand}: ${name}`, `<b>${layman}</b>`,
    `<b>${name}.</b> ${esc(fb.reason)}${second ? ` ${name} is worth ${(fb.lines[0].ev * 100).toFixed(1)}% of your bet on average, against ${(second.ev * 100).toFixed(1)}% for ${second.name.toLowerCase()}.` : ''}`,
    `<b>${name}.</b> ${esc(fb.reason)}<div class="small dim" style="margin:8px 0 2px">Expected value per $1 bet (${esc(describeRules(rules))}):</div>${evTable(fb.lines)}<div class="small dim" style="margin:8px 0 2px">How the dealer's ${upLabel(up)} finishes:</div>${dealerBars(fb.dealer)}<p class="small dim">${soft ? '' : `Hitting busts you ${pc(fb.bustHit)} of the time. `}Standing wins ${pc(fb.stand.win)}, pushes ${pc(fb.stand.push)}, loses ${pc(fb.stand.lose)}.${cards.length === 2 && !soft && cards[0] !== cards[1] ? ' This is the total-dependent play; a few rare compositions of the same total can differ.' : ''} Change the table rules and the answer can change.</p>`,
    { kind: 'bj', links: [{ href: '#/guide', text: 'Strategy chart' }, { href: '#/lab', text: 'Practise it' }], chips: [`${hand} vs a ${up === 6 ? 10 : up === 10 ? 6 : up + 1}`, `${hand} vs ${upLabel(up)} at true count +3`, 'Give me a similar example'], example: async () => { const c = pick([[10, 6], [10, 2], [1, 7], [8, 8], [5, 6], [9, 2], [10, 5], [1, 2]]), u = pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 1]); return bjDecision({ bj: { cards: c, text: '' }, up: u }, ctx); } });
  out.mem = { intent: 'bj', ents: { bj: e.bj, up } };
  return out;
}

async function bjIndex(e, ctx) {
  const rules = ctx.rules, cards = e.bj.cards, up = e.up, tc = Math.floor(e.tc ?? 0);
  const res = await engine.decide(rules, cards, up), L = { H: true, S: true, D: res.legal.double, P: res.legal.split, R: res.legal.surrender };
  const best = res.action, ix = indexPlay(rules, cards, up, tc, best, L), rule = ruleFor(rules, cards, up), hand = (await explain(rules, cards, up, { ...res, action: best }, best)).title;
  const mk = (x) => ACTION_NAME[x];
  let simple, standard, deep;
  if (!rule) {
    simple = `No count change here. ${mk(best)}, exactly as the chart says: this hand is not one of the plays where the count matters.`;
    standard = `${hand}: no index play governs this hand, so even at a true count of ${sgn(tc) || '0'} you play basic strategy: <b>${mk(best)}</b>. The index plays are a short list (the Illustrious 18 and Fab 4); most hands never deviate.`;
    deep = standard + ' If you want the full list for your rules, open the index drill, or ask “what is the index for 16 vs 10”.';
  } else {
    const idx = idxOf(rule, rules);
    simple = `${mk(ix.action)}. ${ix.above ? `The count is high enough (${sgn(tc)} against a trigger of ${sgn(idx)}) that the deck is rich in tens, which changes the best play.` : `The count is below the trigger (${sgn(tc)} against ${sgn(idx)}), so you play it the normal way.`}`;
    standard = `<b>${mk(ix.action)}.</b> ${hand} has an index of <b>${sgn(idx)}</b>: make the ${mk(rule.play).toLowerCase()} play at a true count of ${sgn(idx)} or higher, otherwise ${mk(rule.below).toLowerCase()}. At ${sgn(tc)} you are ${ix.above ? 'at or above' : 'below'} the index. Basic strategy alone says ${mk(best)}.`;
    deep = standard + `<p class="small dim">Why: a high true count means the remaining cards are richer in tens and aces, which makes the dealer bust more and makes your doubles and stands better. At the index the two plays have equal expected value; one count away they differ by only a fraction of a percent, so ${Math.abs(tc - idx) <= 1 ? 'this is a close call and rounding of the true count matters.' : 'this is not a close call.'} Index numbers are for Hi-Lo and ${rules.dealerHitsSoft17 ? 'H17' : 'S17'} rules.</p>`;
  }
  const out = A(`${hand} at true count ${sgn(tc) || '0'}`, simple, standard, deep, { kind: 'bj', links: [{ href: '#/play/counting/dev', text: 'Index drill' }], chips: [`${hand} vs ${upLabel(up)} at true count ${sgn(tc + 2)}`, `${hand} vs ${upLabel(up)} at true count ${sgn(tc - 2)}`] });
  out.mem = { intent: 'bjIndex', ents: { bj: e.bj, up, tc } };
  return out;
}

function indexList(e, ctx) {
  return import('../../engine/indices.js').then(({ activeRules, tierName }) => {
    const rules = ctx.rules, list = activeRules(rules, {}), sg = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0');
    const plays = list.map((r) => `${r.label}: ${ACT_L[r.play]} at ${sg(idxOf(r, rules))}+`);
    return A('Index plays for your rules', `An index is the true count at which a play changes. Example: stand on 16 against a 10 once the count is 0 or higher.`, `For ${describeRules(rules)} these are the plays and their triggers:${bullets(plays.slice(0, 12))}<div class="small dim">…and ${Math.max(0, plays.length - 12)} more in the drill. Insurance: take it at +3 or higher.</div>`, `${bullets(plays)}<div class="small dim" style="margin-top:6px">Make the play at the index or higher; below it, play the other way (for 13 v 2 at −1: stand at −1 or higher and hit below it). Source: Schlesinger's Illustrious 18 and Fab 4 (Hi-Lo, 6 decks); the app can derive indices for your exact rules.</div>`, { links: [{ href: '#/play/counting/dev', text: 'Drill the index plays' }] });
  });
}
const ACT_L = { S: 'stand', H: 'hit', D: 'double', P: 'split', R: 'surrender' };

function betSize(e) {
  const tc = Math.floor(e.tc ?? 0), spread = e.ramp || '1-8', u = rampUnits(spread, tc), edge = edgeAtTC(0.5, tc);
  return A(`Bet at true count ${sgn(tc) || '0'}`, `Bet ${u} unit${u > 1 ? 's' : ''}. ${u === 1 ? 'The count is not in your favour, so stay at the minimum.' : 'The count is in your favour, so bet more.'}`,
    `On a ${spread} spread at a true count of ${sgn(tc) || '0'}, bet <b>${u} unit${u > 1 ? 's' : ''}</b>. Each +1 of true count is worth roughly +0.5% player edge; against a house edge near 0.5% you are at about <b>${edge >= 0 ? '+' : '−'}${Math.abs(edge).toFixed(1)}%</b> here.`,
    `Ramp (${spread}): ${[1, 2, 3, 4, 5, 6, 7].map((t) => `TC ${t === 1 ? '≤1' : t === 7 ? '7+' : t} → ${rampUnits(spread, t)}`).join(' · ')}. The logic is Kelly: bet in proportion to your edge. With about a +0.5% edge per true count, a bankroll of B units and variance near 1.3 per hand, the full-Kelly bet is about edge × B ÷ 1.3 units; real ramps use well under half of that for safety and to stay unnoticed.`,
    { links: [{ href: '#/play/counting/ramp', text: 'Bet-sizing drill' }], chips: ['What is my edge at true count +4', 'How big a bankroll do I need for a 1-8 spread'], mem: { intent: 'bet', ents: { tc, ramp: spread } } });
}

function trueCount(e) {
  const rc = e.rc, d = e.decksLeft, tc = rc / d;
  return A('True count', `Divide the running count by the decks left: ${rc} ÷ ${d} = ${tc.toFixed(1)}.`, `True count = running count ÷ decks remaining = ${rc} ÷ ${d} = <b>${tc.toFixed(1)}</b>. Most players round down (floor), so use <b>${Math.floor(tc)}</b> for index plays and bets.`,
    `The running count says how many more small cards than big cards have gone. The true count scales it by how much shoe is left: the same +6 is much more powerful with 1 deck left (+6) than with 3 (+2). Mistakes in estimating the decks left matter: a half-deck error here changes the true count by ${(Math.abs(rc / (d + 0.5) - tc)).toFixed(1)}.`,
    { links: [{ href: '#/play/count', text: 'True-count drill' }, { href: '#/play/counting/decks', text: 'Deck estimation' }], chips: [`What should I bet at true count ${Math.floor(tc)}`] });
}

async function pokerEquity(e) {
  const [a, b] = e.pk; const hero = classCombos(a)[0];
  let opp = classCombos(b).find((c) => !c.some((x) => hero.includes(x))) || classCombos(b)[1];
  const r = equity(hero, [], [opp], 12000), win = r.equity;
  const verdict = win > 0.62 ? `${a} is a clear favourite` : win > 0.53 ? `${a} is a modest favourite` : win > 0.47 ? 'about a coin flip' : win > 0.38 ? `${a} is an underdog` : `${a} is a big underdog`;
  return A(`${a} vs ${b}`, `${a} wins about ${pc(win)} of the time against ${b}: ${verdict}.`, `Before the flop, <b>${a}</b> has about <b>${pc(win, 1)}</b> equity against <b>${b}</b> (win ${pc(r.win, 1)}, tie ${pc(r.tie, 1)}, lose ${pc(r.lose, 1)}). ${verdict}.`,
    `Computed by dealing out 12,000 random boards. ${a.length === 2 && b.length === 2 && a !== b ? 'Pair against pair: the higher pair is about an 80% favourite.' : (a.length === 2) !== (b.length === 2) ? 'Pair against two overcards is the classic coin flip: usually 52–56% for the pair.' : ''} Domination matters: a hand like A-Q against A-K has only about 25–30% because it shares an ace and loses when the other card pairs. Suited hands add roughly 2–3 points of equity from flush chances.`,
    { links: [{ href: '#/play/poker/calc', text: 'Equity calculator' }], chips: [`${b} vs ${a}`, `${a} vs a random hand`] });
}

function vsRandom(e) {
  const a = e.pk[0], hero = classCombos(a)[0], r = equity(hero, [], [null], 8000), win = r.equity;
  return A(`${a} against a random hand`, `${a} wins about ${pc(win)} of the time against a random hand.`, `${a} has about <b>${pc(win, 1)}</b> equity against one random hand. Rank among the 169 starting hands: #${strengthOrder().indexOf(a) + 1}. Chen score: ${chen(a)}.`, `Win ${pc(r.win, 1)}, tie ${pc(r.tie, 1)}, lose ${pc(r.lose, 1)}. Against more opponents the number falls quickly: hands that make big pairs and strong draws keep their value; weak offsuit hands collapse.`, { links: [{ href: '#/play/poker/calc', text: 'Equity calculator' }] });
}

function pokerOpen(e) {
  const label = e.pk[0], pos = e.positions[0] || 'BTN', facing = /\b(raise|raised|raises|3.?bet|re-?raise|opens?|opened)\b/.test(e.n) && e.positions.length >= 2;
  if (facing) {
    const hero = e.positions[0], opener = e.positions[1], act = facingRaise(label, hero, opener), nm = { '3bet': 're-raise (3-bet)', call: 'call', fold: 'fold' }[act];
    return A(`${label} in the ${hero} vs a raise from ${opener}`, `${act === 'fold' ? 'Fold' : act === 'call' ? 'Call' : 'Re-raise'}. ${act === 'fold' ? 'It is not strong enough against someone who already showed strength.' : act === 'call' ? 'Good enough to see a flop, not strong enough to build a big pot.' : 'A premium hand: make the pot bigger while you are ahead.'}`,
      `${label} versus a raise from the ${opener}, from the ${hero}: <b>${nm}</b>. The raiser's range is ${['UTG', 'HJ'].includes(opener) ? 'tight (about 14–18% of hands)' : 'wide (26–43% of hands)'}, so you need ${act === 'fold' ? 'a stronger hand' : act === 'call' ? 'a hand that plays well post-flop' : 'a premium hand or a good bluff candidate'}.`,
      `Three-bet with QQ+ and A-K for value (and a few suited aces like A-5s as bluffs); call with pairs 77–JJ, suited broadways and A-Q, especially in position; fold the rest. Out of position (blinds) you play tighter because you act first after the flop. This is a solid default, not solver-exact.`, { links: [{ href: '#/play/poker/ranges', text: 'Charts' }], chips: [`${label} on the button`, 'What is a 3-bet'], mem: { intent: 'pkopen', ents: { pk: [label], positions: [hero] } } });
  }
  const act = openAction(label, pos), where = POSITIONS.filter((p) => p !== 'BB' && openAction(label, p) === 'raise');
  const hero = classCombos(label)[0], eq = equity(hero, [], [null], 3000).equity;
  return A(`${label} from the ${pos}`, `${act === 'raise' ? 'Raise' : 'Fold'}. ${act === 'raise' ? `${label} is good enough to open from the ${pos}.` : `${label} is too weak to open from the ${pos}.`}`,
    `<b>${act === 'raise' ? 'Raise (to about 2.5–3 big blinds)' : 'Fold'}</b> with ${label} first in from the ${pos}. The standard ${pos} range is about ${pc(rangePct(RFI[pos] || RFI.BTN))} of hands. ${where.length ? `${label} is an open from: ${where.join(', ')}.` : `${label} is not an open from any seat.`}`,
    `${label} wins ${pc(eq)} against a random hand (Chen ${chen(label)}). Early seats have more players left to act behind you, so the range tightens: UTG ~14%, HJ ~18%, CO ~26%, BTN ~43%, SB ~40% (raise or fold). These are solid ranges for 6-max, 100 big blinds, not solver-exact.`,
    { links: [{ href: '#/play/poker/ranges', text: 'Charts' }, { href: '#/play/poker/drills/preflop', text: 'Preflop drill' }], chips: [`${label} on the ${pos === 'BTN' ? 'UTG' : 'button'}`, `${label} vs a raise from the cutoff`], mem: { intent: 'pkopen', ents: { pk: [label], positions: [pos] } } });
}

function potOdds(e) {
  const pot = e.pot, bet = e.bet, need = bet / (pot + 2 * bet), o = e.outs;
  let more = '';
  if (o) { const st = e.street === 'turn' ? 1 : 2, eq = st === 2 ? 1 - ((47 - o) * (46 - o)) / (47 * 46) : o / 46; more = ` With ${o} outs ${st === 2 ? 'on the flop' : 'on the turn'} you hit about ${pc(eq)} (the rule of ${st === 2 ? '4' : '2'} says ${Math.min(99, o * (st === 2 ? 4 : 2))}%). That is ${eq > need ? '<b>more</b> than you need: a call' : '<b>less</b> than you need: a fold unless implied odds help'}.`; }
  return A('Pot odds', `You need to win ${pc(need)} of the time to break even on the call.${more ? '' : ''}${more}`,
    `The pot is ${pot} and the bet is ${bet}. After the bet the pot is ${pot + bet}; you pay ${bet} to win it, so the total after you call is ${pot + 2 * bet}. You need <b>${bet} ÷ ${pot + 2 * bet} = ${pc(need, 1)}</b> equity.${more}`,
    `Formula: need = call ÷ (pot + bet + call). For a bet of ${(bet / pot).toFixed(2)} × the pot that is ${(bet / pot).toFixed(2)} ÷ (1 + 2 × ${(bet / pot).toFixed(2)}) = ${pc(need, 1)}. Implied odds (what you win when you hit) lower the equity you really need; reverse implied odds (you win small and lose big) raise it.${more}`,
    { links: [{ href: '#/play/poker/drills/odds', text: 'Pot-odds drill' }], chips: ['What are my chances with 9 outs on the flop'] });
}

function outsAnswer(e) {
  let o = e.outs, name = '';
  const n = e.n;
  if (!o) { if (/flush draw|four to a flush/.test(n)) [o, name] = [9, 'a flush draw']; else if (/open.?ended|oesd|eight outs/.test(n)) [o, name] = [8, 'an open-ended straight draw']; else if (/gutshot|gut shot|inside straight/.test(n)) [o, name] = [4, 'a gutshot']; else if (/two overcards|overcards/.test(n)) [o, name] = [6, 'two overcards']; else if (/combo|flush and (?:a )?straight/.test(n)) [o, name] = [15, 'a flush draw plus an open-ended straight draw']; else if (/set .*full house|trips .*full house/.test(n)) [o, name] = [7, 'a set (to full house or better)']; }
  const flop = e.street !== 'turn', fl = 1 - ((47 - o) * (46 - o)) / (47 * 46), tu = o / 46;
  return A(`${o} outs`, `${name ? `With ${name} (${o} outs) ` : `With ${o} outs `}you hit about ${pc(flop ? fl : tu)} of the time${flop ? ' by the river' : ' on the next card'}.`,
    `${name ? `<b>${name}</b>: ` : ''}<b>${o} outs</b>. Rule of 2 and 4: on the flop (two cards to come) ${o} × 4 = ${Math.min(99, o * 4)}% (exactly ${pc(fl, 1)}); on the turn (one to come) ${o} × 2 = ${Math.min(99, o * 2)}% (exactly ${pc(tu, 1)}).`,
    `Exact: with two cards to come, P(hit) = 1 − (47−${o})(46−${o}) ÷ (47×46) = ${pc(fl, 1)}; with one, ${o} ÷ 46 = ${pc(tu, 1)}. The ×4 shortcut overestimates when you have more than 8 outs (subtract one point per extra out). Compare it with the price of the call: half-pot bet needs 25%, pot-size bet 33%. Remember some outs may give an opponent a better hand (tainted outs).`,
    { links: [{ href: '#/play/poker/drills/outs', text: 'Outs drill' }], chips: ['Pot odds: pot 20, bet 10, 9 outs on the flop'] });
}

function baccDraw(e) {
  const b = e.bBank, p3 = e.pThird === undefined ? null : e.pThird, stood = e.pStood || e.pThird === undefined;
  const third = stood ? null : (p3 === 0 ? 10 : p3), draws = bankerDraws(b, third);
  return A(`Banker ${b}${stood ? '' : ` vs Player third ${p3}`}`, `${draws ? 'The Banker draws.' : 'The Banker stands.'}`, `<b>${draws ? 'Banker draws a third card.' : 'Banker stands.'}</b> ${esc(bankerReason(b, third))}`,
    `The Banker rule is a fixed table: 0–2 always draw, 7 always stands; 3 draws unless the Player's third card was an 8; 4 draws on 2–7; 5 draws on 4–7; 6 draws on 6–7. If the Player stood, the Banker draws on 0–5.`, { links: [{ href: '#/play/baccarat/drill/banker', text: 'Banker drill' }] });
}

const GAMEW = [[/video poker|jacks or better/, 0], [/blackjack.*6.?5|6.?5.*blackjack/, 8], [/blackjack/, 1], [/craps|pass line/, 2], [/banker/, 3], [/baccarat.*player|player bet/, 4], [/baccarat|punto/, 3], [/single zero|european roulette|roulette/, 5], [/double zero|american roulette/, 10], [/war/, 6], [/three card|3 card/, 7], [/caribbean/, 9], [/tie/, 13], [/slots?/, 14], [/keno/, 15]];
async function costAnswer(e, ctx) {
  const { COSTS } = await import('../../screens/coach.js');
  let idx = null; for (const [re, i] of GAMEW) if (re.test(e.n)) { idx = i; break; }
  if (idx === null) return null;
  const [name, edge, per] = COSTS[idx], bet = 25, loss = bet * per * edge / 100;
  return A(name, `${name} keeps about ${edge} cents of every dollar you bet.`, `<b>${name}</b>: house edge about <b>${edge}%</b>. At $${bet} a round and ${per} rounds an hour you wager $${(bet * per).toLocaleString()} an hour and expect to lose about <b>$${loss.toFixed(2)} an hour</b>.`,
    `Expected loss per hour = bet × rounds per hour × edge. ${edge < 1 ? 'This is one of the cheapest bets in the casino, and only with correct play.' : edge > 5 ? 'This is an expensive bet: the edge is several times that of the best table games.' : ''} Speed matters as much as edge: a fast game at a small edge can cost more per hour than a slow game at a larger one. The ladder compares them all.`, { links: [{ href: '#/coach/cost', text: 'Cost of play' }] });
}

function riskOfRuin(e) {
  const B = e.bankUnits ? e.bankroll : e.bankroll, edge = 0.0065, sd2 = 5.4, ror = Math.exp(-2 * edge * B / sd2);
  return A('Risk of ruin', `With ${B} units and a typical 1–8 counting edge, the chance of eventually going broke is about ${pc(ror)}.`, `Using a typical 1–8 spread edge of about ${(edge * 100).toFixed(2)} units per hand and a variance of about ${sd2} units² per hand, risk of ruin ≈ exp(−2 × edge × bankroll ÷ variance) = exp(−2 × ${edge} × ${B} ÷ ${sd2}) = <b>${pc(ror)}</b>.`, `Those two inputs are rough averages; the simulator gives your own numbers for your rules and penetration. Risk of ruin falls exponentially with bankroll: doubling the bankroll squares the (small) probability. This formula assumes a constant edge and a long horizon.`, { links: [{ href: '#/play/counting/sim', text: 'Simulate it' }] });
}

async function personal(e, ctx, kind) {
  const w = worst(ctx, { n: 6 });
  if (kind === 'plan') return A('What to work on', w.length ? `Your biggest leaks are: ${w.slice(0, 3).map((x) => x.key).join(', ')}.` : 'Nothing is standing out yet.', w.length ? `Your most-missed items (at least two tries):${bullets(w.map((x) => `${esc(x.game.replace(':', ' · '))}: <b>${esc(x.key)}</b> (${Math.round(x.rate * 100)}% over ${x.n} tries)`))}Practise these first.` : 'I have no recorded misses yet. Play a few drills or a practice table session and I will tell you where the leaks are.', null, { links: [{ href: '#/coach', text: "Today's plan" }] });
  const p = ctx.profile, lessons = Object.keys((p.poker && p.poker.lessons) || {}).length;
  return A('Your progress', `You have finished ${lessons} poker lesson${lessons === 1 ? '' : 's'} and tracked ${w.length ? 'some misses to fix' : 'few misses so far'}.`, `Open the Coach tab for your belts, streak, and leak report. Right now: ${lessons} poker lessons done; ${(p.counting && p.counting.dev) ? `index accuracy ${Math.round(p.counting.dev.c / p.counting.dev.n * 100)}%` : 'no index drills yet'}.`, null, { links: [{ href: '#/coach', text: 'Coach' }] });
}

// ---- intent routing -------------------------------------------------------------------------------------------------------------------------------------------------------
const has = (n, re) => re.test(n);
export const mem = { last: null };

export async function answer(text, ctx) {
  const e = extract(text), n = e.n;
  const short = tok(text).length <= 4;
  // follow-ups reuse what we were just talking about
  if (mem.last && (short || /^\s*(and|what about|how about|what if|now|ok|okay|but)\b/.test(n)) && !/\bwhy\b/.test(n.trim().slice(0, 8))) {
    const m = mem.last, ne = { ...m.ents };
    if (e.up) ne.up = e.up; if (e.bj) ne.bj = e.bj; if (e.tc !== undefined) ne.tc = e.tc; if (e.positions.length) ne.positions = e.positions; if (e.pk.length) ne.pk = e.pk;
    const isBJ = m.intent === 'bj' || m.intent === 'bjIndex';
    // only a follow-up if the new message changes something relevant to the topic we were on
    const changed = isBJ ? ((e.up || e.bj || e.tc !== undefined) && !e.pk.length) : m.intent === 'bet' ? (e.tc !== undefined && !e.pk.length && !e.bj) : ((e.positions.length || e.pk.length) && !e.bj);
    if (changed) { const full = { ...extract(''), ...ne, n }; if (m.intent === 'bj' && ne.tc !== undefined) m.intent = 'bjIndex'; const r = await route(m.intent, full, ctx); if (r) return r; }
  }
  // 1. computed answers
  if (e.pk.length >= 2 && /\bvs\b/.test(n) && !e.bj) { const r = await pokerEquity(e); r.mem = { intent: 'pkeq', ents: e }; return r; }
  if (!e.bj && e.pk.length === 1 && /(equity|chance|odds|win)/.test(n) && /random|any hand|vs/.test(n)) return vsRandom(e);
  if (!e.bj && e.pk.length >= 1 && (e.positions.length || /\b(open|raise|fold|play|call|3.?bet|limp|worth)\b/.test(n))) return pokerOpen(e);
  if (e.bj && e.up) { if (e.tc !== undefined || /count|index|deviat/.test(n)) return bjIndex(e, ctx); return bjDecision(e, ctx); }
  if (/index|deviation|illustrious|fab (?:4|four)/.test(n) && /(list|all|what are|which|show|numbers)/.test(n)) return indexList(e, ctx);
  if (e.rc !== undefined && e.decksLeft) return trueCount(e);
  if (e.tc !== undefined && /(bet|units?|ramp|spread|wager|size)/.test(n)) return betSize(e);
  if (e.pot && e.bet) return potOdds(e);
  if ((e.outs || /flush draw|open.?ended|gutshot|overcards|oesd|combo draw/.test(n)) && /(outs|chance|odds|hit|percent|%|draw)/.test(n)) return outsAnswer(e);
  if (e.bBank !== undefined && (e.pThird !== undefined || e.pStood)) return baccDraw(e);
  if (e.bankroll && /(risk of ruin|ruin|bankroll)/.test(n)) return riskOfRuin(e);
  if (/(what should i (work on|practice|practise|study|fix)|my (weak|leaks?|mistakes)|where am i (weak|bad)|what.s my (weakest|worst))/.test(n)) return personal(e, ctx, 'plan');
  if (/(how am i doing|my progress|my belt|how good am i)/.test(n)) return personal(e, ctx, 'progress');
  if (/(house edge|how much (does|do)|cost|expected loss|edge of)/.test(n)) { const r = await costAnswer(e, ctx); if (r) return r; }
  // 2. concepts: knowledge base and lessons
  const hits = search(text, 5);
  if (!hits.length || hits[0].s < 1.2) return null;
  const top = hits[0].d;
  const rel = hits.slice(1).filter((h) => h.s > hits[0].s * 0.45).slice(0, 3).map((h) => h.d.title);
  if (top.kb) return A(top.kb.title, top.kb.simple, top.kb.standard, top.kb.deep, { kind: 'kb', links: top.kb.links, chips: rel.map((t) => `Tell me about ${t.toLowerCase()}`) });
  const sentences = (top.body || '').split(/(?<=[.!?])\s+/);
  return A(top.title, sentences.slice(0, 2).join(' '), top.body.length > 700 ? top.body.slice(0, 700) + '…' : top.body, top.body, { kind: 'lesson', links: top.links, chips: rel.map((t) => `Tell me about ${t.toLowerCase()}`) });
}

async function route(intent, e, ctx) {
  if (intent === 'bj') return bjDecision(e, ctx);
  if (intent === 'bjIndex') return bjIndex(e, ctx);
  if (intent === 'bet') return betSize(e);
  if (intent === 'pkopen') return pokerOpen(e);
  if (intent === 'pkeq') return e.pk.length >= 2 ? pokerEquity(e) : null;
  return null;
}

export const STARTERS = [
  'What should I do with 16 vs 10?',
  'Soft 18 against a 9?',
  '12 vs 3 at true count +2',
  'What bet at true count +3 on a 1-8 spread?',
  'Running count 8 with 2.5 decks left',
  'AKs vs QQ',
  'Should I open J9s from UTG?',
  'Pot is 20, he bets 10, I have 9 outs on the flop',
  'Why is Banker the best bet in baccarat?',
  'Explain pot odds like I am new',
  'What should I work on?',
  'Does card counting work online?',
];
// Knowledge added after startup (shipped study results, things the coach learned): searchable like built-in entries.
export function addKnowledge(list) {
  let added = 0;
  for (const e of list) {
    if (!e || !e.id || !e.title || KB.some((k) => k.id === e.id)) continue;
    KB.push({ id: e.id, title: e.title, tags: e.tags || e.title, simple: e.simple || e.standard, standard: e.standard, deep: e.deep || e.standard, links: e.links || [], learned: e.status || true });
    added++;
  }
  if (added) CORPUS = null;
  return added;
}
export { KB };
