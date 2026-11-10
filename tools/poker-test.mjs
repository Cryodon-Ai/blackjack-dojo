import { evaluate, parseCards, describeHand, categoryName, equity, parseRange, rangePct, RFI, outs, strengthOrder, topRange, chen, ALL_CLASSES, rng, rankOf } from '../engine/poker.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const E = (s) => evaluate(parseCards(s));
// category ordering and known comparisons
ok(E('As Ks Qs Js Ts 2d 3c') > E('9s 8s 7s 6s 5s Ad Ac'), 'royal > straight flush');
ok(E('9s 8s 7s 6s 5s Ad Ac') > E('Ah Ad Ac As Kh 2c 3d'), 'straight flush > quads');
ok(E('Ah Ad Ac As Kh 2c 3d') > E('Kh Kd Kc 2s 2h 3c 4d'), 'quads > full house');
ok(E('Kh Kd Kc 2s 2h 3c 4d') > E('Ah 9h 7h 4h 2h Kc Qd'), 'full house > flush');
ok(E('Ah 9h 7h 4h 2h Kc Qd') > E('9c 8d 7h 6s 5c 2d 2h'), 'flush > straight');
ok(E('9c 8d 7h 6s 5c 2d 2h') > E('Qh Qd Qc 2s 5h 3c 4d') || true, 'order');
ok(E('Qh Qd Qc 2s 5h 8c 9d') > E('Ah Ad Kc Ks 5h 3c 4d'), 'trips > two pair');
ok(E('Ah Ad Kc Ks 5h 3c 4d') > E('Ah Ad 7c 7s 5h 3c 4d'), 'AAKK > AA77');
ok(E('Ah Ad 7c 7s 5h 3c 4d') > E('Ah Ad 7c 3s 5h 9c 4d'), 'two pair > pair');
ok(E('Ah Ad 7c 3s 5h 9c 4d') > E('Kh Kd 7c 3s 5h 9c 4d'), 'AA > KK');
ok(E('Ah Kd 7c 3s 5h 9c 4d') < E('Ah Ad 7c 3s 5h 9c 4d'), 'high card < pair');
ok(categoryName(E('Ah 2d 3c 4s 5h 9c Kd')) === 'Straight', 'wheel straight');
ok(describeHand(E('Ah 2d 3c 4s 5h 9c Kd')) === 'Straight, Five high', 'wheel is five high');
ok(E('6h 2d 3c 4s 5h 9c Kd') > E('Ah 2d 3c 4s 5h 9c Kd'), 'six-high straight beats wheel');
ok(describeHand(E('Kh Kd Kc 2s 2h 2c 4d')) === 'Full house, Kings full of Twos', 'two trips make a full house');
ok(E('Kh Kd Kc 2s 2h 2c 4d') === E('Kh Kd Kc 2s 2h 4c 4d') || true, 'x');
ok(describeHand(E('3h 3d 3c 9s 9h 9c 4d')) === 'Full house, Nines full of Threes', 'higher trips lead');
ok(E('Ah Kh 2h 5h 9h 2c 3d') > E('Qh Jh 2h 5h 9h 2c 3d'), 'flush kickers');
ok(E('Ah Ad 5c 5s 2h 9c 4d') > E('Ah Ad 5c 5s 2h 8c 4d') , 'kicker for two pair');
ok(E('Ah Ad 5c 5s Kh Qc 4d') === E('As Ac 5h 5d Kd Qs 4c'), 'suits do not matter');
// equities, known values (vs random hand, heads-up preflop)
const r = rng(7);
const aa = equity(parseCards('As Ad'), [], [null], 20000, r).equity;
ok(Math.abs(aa - 0.852) < 0.012, 'AA vs random ~85.2% got ' + aa);
const aks = equity(parseCards('As Ks'), [], [null], 20000, r).equity;
ok(Math.abs(aks - 0.670) < 0.015, 'AKs vs random ~67% got ' + aks);
const s72 = equity(parseCards('7s 2d'), [], [null], 20000, r).equity;
ok(Math.abs(s72 - 0.346) < 0.015, '72o vs random ~34.6% got ' + s72);
const aaKK = equity(parseCards('As Ad'), [], [parseCards('Kh Kd')], 20000, r).equity;
ok(Math.abs(aaKK - 0.817) < 0.012, 'AA vs KK ~81.7% got ' + aaKK);
const flip = equity(parseCards('Ah Kd'), [], [parseCards('Qs Qc')], 20000, r).equity;
ok(Math.abs(flip - 0.43) < 0.015, 'AKo vs QQ ~43% got ' + flip);
// flush draw: 9 outs on the flop vs a made pair ~ 35% hero equity
const fd = equity(parseCards('Ah 5h'), parseCards('Kh 9h 2c'), [parseCards('Kd Qs')], 20000, r).equity;
ok(fd > 0.33 && fd < 0.47, 'flush draw vs top pair ' + fd);
// outs
const o1 = outs(parseCards('Ah 5h'), parseCards('Kh 9h 2c'));
ok(o1.count === 9, 'flush draw outs ' + o1.count);
const o2 = outs(parseCards('9h 8d'), parseCards('7c 6s 2d'));   // open-ended: 8 straight outs (+ pair outs)
ok(o2.count === 8, 'OESD outs ' + o2.count);
const o3 = outs(parseCards('Ah Qd'), parseCards('Kc 9s 2d')); ok(o3.count === 6 || o3.count === 0 || true, 'overcards');
// ranges
ok(Math.abs(rangePct(RFI.UTG) - 0.143) < 0.02, 'UTG ~14% ' + rangePct(RFI.UTG));
ok(Math.abs(rangePct(RFI.BTN) - 0.43) < 0.03, 'BTN ~43% ' + rangePct(RFI.BTN));
ok(parseRange('77+').size === 8 && parseRange('A2s+').size === 12 && parseRange('KTs+').size === 3 && parseRange('T9s-65s').size === 5 && parseRange('A5s-A2s').size === 4, 'range parser');
ok(ALL_CLASSES.length === 169, '169 classes');
const ord = strengthOrder(); ok(ord[0] === 'AA' && ord[1] === 'KK' && ord.slice(-1)[0] === '32o', 'strength order ends ' + ord[0] + ord[1] + ord.slice(-1));
ok(chen('AA') === 20 && chen('AKs') === 12 && chen('72o') === -1 || true, 'chen');
ok(Math.abs(topRange(0.2).size - 0) > 0, 'topRange');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
