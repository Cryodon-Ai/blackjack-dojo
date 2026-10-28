// Baccarat scoreboards. results: array of 'player' | 'banker' | 'tie'.
//   beadPlate: every hand in order, filled down 6 rows then across.
//   bigRoad:   streaks of the same winner become columns; ties mark the previous cell; a streak
//              longer than 6 (or blocked) turns right along the bottom as a "dragon tail".

export const ROWS = 6;

export function beadPlate(results) {
  return results.map((w, i) => ({ col: Math.floor(i / ROWS), row: i % ROWS, winner: w }));
}

export function bigRoad(results) {
  const cells = [];
  const occ = new Set();
  const key = (c, r) => `${c},${r}`;
  let last = null, startCol = -1, cur = null, pendingTies = 0;
  for (const w of results) {
    if (w === 'tie') { if (last) last.ties++; else pendingTies++; continue; }
    if (!cur || cur.winner !== w) {
      startCol = cur ? cur.startCol + 1 : 0;
      cur = { winner: w, startCol, col: startCol, row: 0 };
      last = { col: cur.col, row: 0, winner: w, ties: pendingTies }; pendingTies = 0;
    } else if (cur.row < ROWS - 1 && !occ.has(key(cur.col, cur.row + 1))) {
      cur.row++; last = { col: cur.col, row: cur.row, winner: w, ties: 0 };
    } else {
      cur.col++; last = { col: cur.col, row: cur.row, winner: w, ties: 0 };
    }
    occ.add(key(last.col, last.row));
    cells.push(last);
  }
  return cells;
}

export const roadWidth = (cells) => cells.reduce((m, c) => Math.max(m, c.col + 1), 0);

// Longest run of one winner, ignoring ties.
export function longestStreak(results, who) {
  let best = 0, run = 0;
  for (const w of results) { if (w === 'tie') continue; run = w === who ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}
