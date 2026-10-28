// SVG renderers for the baccarat scoreboards (bead plate and big road).
import { beadPlate, bigRoad, roadWidth, ROWS } from '../app/roads.js';

const COL = { banker: '#d8334a', player: '#2f6bd8', tie: '#2fbf5a' };
const LET = { banker: 'B', player: 'P', tie: 'T' };
const CELL = 22;

const wrap = (cols, body) => {
  const w = Math.max(cols, 14) * CELL + 4;
  return `<div class="road-scroll"><svg viewBox="0 0 ${w} ${ROWS * CELL + 4}" width="${w}" height="${ROWS * CELL + 4}" role="img" aria-label="scoreboard">
    <g stroke="rgba(255,255,255,.12)" stroke-width="1" fill="none">${Array.from({ length: Math.max(cols, 14) + 1 }, (_, i) => `<path d="M${2 + i * CELL} 2v${ROWS * CELL}"/>`).join('')}${Array.from({ length: ROWS + 1 }, (_, i) => `<path d="M2 ${2 + i * CELL}h${Math.max(cols, 14) * CELL}"/>`).join('')}</g>${body}</svg></div>`;
};

export function beadHTML(rounds) {
  const cells = beadPlate(rounds.map((r) => r.winner));
  const cols = cells.length ? cells[cells.length - 1].col + 1 : 0;
  return wrap(cols, cells.map((c, i) => {
    const r = rounds[i], x = 2 + c.col * CELL + CELL / 2, y = 2 + c.row * CELL + CELL / 2;
    return `<circle cx="${x}" cy="${y}" r="9" fill="${COL[c.winner]}"/><text x="${x}" y="${y + 3.4}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">${LET[c.winner]}</text>`
      + (r.pPair ? `<circle cx="${x - 7}" cy="${y - 7}" r="2.4" fill="#6aa8ff" stroke="#fff" stroke-width=".6"/>` : '') + (r.bPair ? `<circle cx="${x + 7}" cy="${y + 7}" r="2.4" fill="#ff7a8a" stroke="#fff" stroke-width=".6"/>` : '');
  }).join(''));
}

export function bigHTML(rounds) {
  const cells = bigRoad(rounds.map((r) => r.winner));
  return wrap(roadWidth(cells), cells.map((c) => {
    const x = 2 + c.col * CELL + CELL / 2, y = 2 + c.row * CELL + CELL / 2;
    return `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${COL[c.winner]}" stroke-width="2.6"/>` + (c.ties ? `<path d="M${x - 6} ${y + 6}L${x + 6} ${y - 6}" stroke="${COL.tie}" stroke-width="2"/>` : '');
  }).join(''));
}
