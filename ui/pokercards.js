// Poker card rendering on top of the shared SVG cards. Poker cards are integers (see engine/poker.js).
import { cardSVG } from './cards.js';
import { rankOf, suitOf, parseCards, classCombos, ALL_CLASSES, RANKS } from '../engine/poker.js';

const SUITL = ['s', 'h', 'd', 'c'];
export const toCard = (c) => {
  const r = rankOf(c);
  return { v: r === 14 ? 1 : r >= 10 ? 10 : r, label: r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : r === 10 ? '10' : String(r), suit: SUITL[suitOf(c)] };
};
export const pcard = (c, opts) => cardSVG(toCard(c), opts);
export const back = () => cardSVG(null, { faceDown: true });
export const pcards = (list, { cls = '' } = {}) => `<span class="minihand ${cls}">${list.map((c) => pcard(c)).join('')}</span>`;
export const pstr = (s) => pcards(parseCards(s));

// 13x13 grid of starting hands. cells: Map label -> css class / content; onTap(label) optional
export function handGrid(cellClass = () => '', { small = false } = {}) {
  const rows = [];
  for (let i = 0; i < 13; i++) {
    const cells = [];
    for (let j = 0; j < 13; j++) {
      const a = RANKS[12 - i], b = RANKS[12 - j];
      const label = i === j ? a + b : i < j ? a + b + 's' : b + a + 'o';
      cells.push(`<td data-h="${label}" class="hg ${cellClass(label)}">${label.replace('s', '').replace('o', '') === label ? label : label[0] + label[1]}<i>${label[2] || ''}</i></td>`);
    }
    rows.push(`<tr>${cells.join('')}</tr>`);
  }
  return `<div class="hgrid ${small ? 'sm' : ''}"><table>${rows.join('')}</table></div>`;
}
export const HGRID_CSS = `
.hgrid{overflow-x:auto}.hgrid table{border-collapse:separate;border-spacing:2px;width:100%;table-layout:fixed}
.hgrid td.hg{font-size:10px;font-weight:700;text-align:center;padding:5px 0;border-radius:4px;background:var(--surface2);color:var(--dim);line-height:1.1;white-space:nowrap}
.hgrid td.hg i{font-style:normal;font-weight:500;opacity:.7;font-size:8px}
.hgrid td.hg.in{background:var(--ok);color:#04130a}.hgrid td.hg.r3{background:#e0556a;color:#fff}.hgrid td.hg.c{background:#e5b64a;color:#1b1300}.hgrid td.hg.sel{outline:2px solid var(--info)}
.hgrid.sm td.hg{font-size:9px;padding:3px 0}
`;
let _css = false;
export function ensurePokerCSS() {
  if (_css) return; _css = true;
  const s = document.createElement('style'); s.textContent = HGRID_CSS + `
.pk-felt{position:relative;background:radial-gradient(ellipse at center,#14653f 0%,#0b4a2d 70%,#08331f 100%);border:6px solid #3a2a1c;border-radius:90px;padding:10px 6px;margin:8px 0;min-height:300px}
.pk-seat{position:absolute;transform:translate(-50%,-50%);text-align:center;font-size:11px;width:78px}
.pk-seat .nm{background:rgba(0,0,0,.55);border-radius:8px;padding:2px 4px;color:#fff;line-height:1.2}.pk-seat .nm b{display:block;font-size:11px}
.pk-seat.me .nm{outline:2px solid var(--info)}.pk-seat.turn .nm{outline:2px solid #ffd54a}.pk-seat.out{opacity:.35}
.pk-seat .pcard{width:26px;height:36px;margin:0 -2px}.pk-seat .cards{height:38px;display:flex;justify-content:center;margin-bottom:2px}
.pk-seat .bt{position:absolute;right:-6px;top:-6px;background:#fff;color:#000;border-radius:50%;width:16px;height:16px;font-weight:800;font-size:10px;line-height:16px}
.pk-seat .betchip{display:inline-block;background:#c9a24a;color:#201400;border-radius:9px;padding:0 6px;font-weight:700;margin-top:2px}
.pk-board{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);text-align:center}.pk-board .pcard{width:38px;height:53px;margin:0 2px}.pk-board .pot{color:#fff;font-weight:700;font-size:13px;margin-bottom:4px}
.pk-hero .pcard{width:54px;height:75px;margin:0 3px}
`;
  document.head.appendChild(s);
}
