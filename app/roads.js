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

// ---- derived roads --------------------------------------------------------------------------------
// Logical Big Road columns: each streak of one winner (ties ignored) is one column, however long it runs.
export function bigColumns(results) {
  const cols = [];
  for (const w of results) {
    if (w === 'tie') continue;
    const c = cols[cols.length - 1];
    if (c && c.winner === w) c.len++; else cols.push({ winner: w, len: 1 });
  }
  return cols;
}

// Big Eye Boy (offset 1), Small Road (2), Cockroach Pig (3). Each new Big Road entry is compared with the column
// `offset` to its left: 'r' (red) = it repeats the pattern, 'b' (blue) = it breaks it.
//   first entry of a column : red if the column just before it is as long as the column `offset` before that one
//   later entries           : red if the compared column reaches this row, or ended 2+ rows short (a long streak);
//                             blue if it ended exactly one row short.
// Entries start at column offset+1 row 2 (or column offset+2 row 1).
export function derivedMarks(results, offset) {
  const cols = bigColumns(results), out = [];
  for (let c = offset; c < cols.length; c++) {               // 0-indexed column c is column c+1
    for (let r = 1; r <= cols[c].len; r++) {
      if (c === offset && r === 1) continue;                 // the very first possible entry is row 2 of column offset+1
      if (r === 1) out.push(cols[c - 1].len === cols[c - 1 - offset].len ? 'r' : 'b');
      else { const L = cols[c - offset].len; out.push(L >= r || L < r - 1 ? 'r' : 'b'); }
    }
  }
  return out;
}

// Lay derived marks out like a Big Road: a change of colour starts a new column; a repeat goes down (then right).
export function derivedCells(marks) {
  return bigRoad(marks.map((m) => (m === 'r' ? 'banker' : 'player'))).map((c) => ({ col: c.col, row: c.row, mark: c.winner === 'banker' ? 'r' : 'b' }));
}

// What the three derived roads would add if the next decision were `next` ('player' | 'banker').
export function nextMarks(results, next) {
  const res = {};
  for (const [name, k] of [['bigEye', 1], ['small', 2], ['cockroach', 3]]) {
    const before = derivedMarks(results, k), after = derivedMarks([...results, next], k);
    res[name] = after.length > before.length ? after[after.length - 1] : null;
  }
  return res;
}

// Names for what the last few columns look like.
export function describePattern(results) {
  const cols = bigColumns(results);
  if (!cols.length) return { name: 'Nothing yet', id: 'none' };
  const last = cols[cols.length - 1];
  if (last.len >= 6) return { name: `Dragon (${last.len} ${last.winner}s in a row)`, id: 'dragon' };
  const tail = cols.slice(-4);
  if (tail.length === 4 && tail.every((c) => c.len === 1)) return { name: 'Ping pong (alternating)', id: 'pingpong' };
  const t3 = cols.slice(-3);
  if (t3.length === 3 && t3.every((c) => c.len === 2)) return { name: 'Two-two (pairs of results)', id: 'twotwo' };
  if (t3.length === 3 && t3[0].len === 1 && t3[1].len === 2 && t3[2].len === 1) return { name: 'One-two', id: 'onetwo' };
  return { name: 'No named pattern', id: 'none' };
}
