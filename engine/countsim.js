// Card-counting simulation: a persistent shoe with a cut card, Hi-Lo true count, a bet ramp and
// (optionally) the index plays. Compares a counter with a flat bettor playing the same cards.
// Heads-up (one spot): other players change hands per hour, not the edge per hand.

import { Round } from './round.js';
import { normalizeRules } from './rules.js';
import { makePolicy, mulberry32 } from './sim.js';
import { indexPlay, insuranceTaken, rampUnits, RAMPS } from './indices.js';

const HILO = [0, -1, 1, 1, 1, 1, 1, 0, 0, 0, -1];
const policies = new Map();
const policyFor = (rules) => {
  const k = JSON.stringify(rules);
  let p = policies.get(k);
  if (!p) { p = makePolicy(rules); policies.set(k, p); }
  return p;
};

class CountShoe {
  constructor(decks, pen, rand) {
    this.decks = decks; this.pen = pen; this.rand = rand;
    this.shuffle();
  }
  shuffle() {
    this.c = new Int32Array(11);
    for (let r = 1; r <= 9; r++) this.c[r] = 4 * this.decks;
    this.c[10] = 16 * this.decks;
    this.n = 52 * this.decks; this.total = this.n; this.rc = 0;
  }
  get decksLeft() { return Math.max(0.5, this.n / 52); }
  get tc() { return this.rc / this.decksLeft; }
  needShuffle() { return this.total - this.n >= this.total * this.pen || this.n < 20; }
  draw() {
    let k = Math.floor(this.rand() * this.n), r = 1;
    for (; r <= 10; r++) { k -= this.c[r]; if (k < 0) break; }
    this.c[r]--; this.n--; this.rc += HILO[r];
    return { v: r };
  }
}

// params: { rules, hands, pen, ramp:'1-8', deviations:true, seed, unitsCap }
// Returns stats for the COUNTER and for a flat 1-unit bettor on the same rounds.
export function runCountSim(params) {
  const rules = normalizeRules({ ...params.rules, decks: params.rules.decks });
  const policy = policyFor(rules);
  const rand = mulberry32(params.seed || 1);
  const shoe = new CountShoe(rules.decks, params.pen ?? 0.75, rand);
  const ramp = params.ramp || '1-8', dev = params.deviations !== false, n = params.hands;
  const flatOnly = params.ramp === 'flat';
  let cNet = 0, cSq = 0, cWag = 0, fNet = 0, fSq = 0, fWag = 0, sumUnits = 0, handsHigh = 0, shuffles = 0;
  const byTC = {};       // floored TC -> { n, net(unit-bet) }
  const nets = [];       // per-round counter nets (for the risk-of-ruin sample)
  let devUsed = 0, insTaken = 0;
  for (let i = 0; i < n; i++) {
    if (shoe.needShuffle()) { shoe.shuffle(); shuffles++; }
    const tcBefore = shoe.tc, ftc = Math.floor(tcBefore);
    const units = flatOnly ? 1 : rampUnits(ramp, tcBefore);
    const r = new Round(rules, () => shoe.draw()).deal();
    let insNet = 0;
    if (r.up.v === 1 && dev && insuranceTaken(tcBefore)) { insNet = r.dealerBJ ? 1 : -0.5; insTaken++; }
    while (r.phase === 'player') {
      const hi = r.active; if (hi < 0) break;
      const basic = policy(r, hi);
      let act = basic;
      if (dev) {
        const h = r.hands[hi];
        const x = indexPlay(rules, h.cards.map((c) => c.v), r.up.v, shoe.tc, basic, r.legal(hi));
        if (x.deviated) devUsed++;
        act = x.action;
      }
      r.act(hi, act);
    }
    if (r.phase !== 'over') r.playDealer();
    const s = r.settle();
    const unitNet = s.net, unitWag = s.wagered;
    const cn = unitNet * units + insNet * units, cw = unitWag * units;
    cNet += cn; cSq += cn * cn; cWag += cw; sumUnits += units;
    fNet += unitNet; fSq += unitNet * unitNet; fWag += unitWag;
    if (units > 1) handsHigh++;
    const k = Math.max(-6, Math.min(8, ftc));
    const b = byTC[k] || (byTC[k] = { n: 0, net: 0 });
    b.n++; b.net += unitNet;
    if (nets.length < 200000) nets.push(cn);
  }
  const mean = cNet / n, sd = Math.sqrt(Math.max(0, cSq / n - mean * mean));
  const fmean = fNet / n, fsd = Math.sqrt(Math.max(0, fSq / n - fmean * fmean));
  return {
    hands: n, shuffles, avgUnits: sumUnits / n, pctRaised: handsHigh / n,
    counter: { net: cNet, perHand: mean, sd, edgePct: cWag ? cNet / cWag * 100 : 0, se: sd / Math.sqrt(n) },
    flat: { net: fNet, perHand: fmean, sd: fsd, edgePct: fWag ? fNet / fWag * 100 : 0, se: fsd / Math.sqrt(n) },
    byTC, devUsed, insTaken, nets,
  };
}

// Risk of ruin by simulating many sessions of the same per-round results (bootstrap), given a bankroll in units.
export function riskOfRuin(nets, bankrollUnits, handsPerSession, sessions, seed = 5) {
  const rand = mulberry32(seed);
  let ruined = 0, sum = 0, up = 0;
  for (let s = 0; s < sessions; s++) {
    let b = bankrollUnits, dead = false;
    for (let h = 0; h < handsPerSession; h++) {
      b += nets[Math.floor(rand() * nets.length)];
      if (b <= 0) { dead = true; break; }
    }
    if (dead) ruined++;
    sum += b - bankrollUnits; if (b > bankrollUnits) up++;
  }
  return { ruin: ruined / sessions, avgResult: sum / sessions, pctUp: up / sessions };
}
export { RAMPS };

// What the UI asks the worker for: the sim plus risk of ruin at a few bankrolls (in units), without the raw nets.
export function countSimReport(params) {
  const r = runCountSim(params);
  const nets = r.nets; delete r.nets;
  r.ror = {};
  for (const b of [50, 100, 200, 400]) r.ror[b] = riskOfRuin(nets, b, 20000, 300, 9).ruin;
  r.params = { ramp: params.ramp, pen: params.pen, deviations: params.deviations !== false, decks: params.rules.decks };
  return r;
}
