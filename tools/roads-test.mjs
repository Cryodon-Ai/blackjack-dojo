import { derivedMarks, bigColumns, nextMarks, describePattern } from '../app/roads.js';
let bad = 0; const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { bad++; console.log('FAIL', m, JSON.stringify(a), '!=', JSON.stringify(b)); } };
const R = (s) => [...s].map((c) => (c === 'B' ? 'banker' : c === 'P' ? 'player' : 'tie'));
eq(bigColumns(R('BBBPPBT')).map((c) => c.len), [3, 2, 1], 'columns ignore ties');
// BBB PP B : col2 row2 -> col1 reaches row 2 -> red; col3 row1 -> len(col2)=2 vs len(col1)=3 -> blue
eq(derivedMarks(R('BBBPPB'), 1), ['r', 'b'], 'big eye hand example');
// alternating: B P B P B -> col2 row1 is skipped(start), col3 row1: len(col2)=1 == len(col1)=1 -> red ...
eq(derivedMarks(R('BPBPBP'), 1), ['r', 'r', 'r', 'r'], 'chop gives all red on big eye');
// a column that outgrows the one beside it: B P PP... BP PPP: col2 len3 row2: col1 len1 = row 2 missing, ended 1 short -> blue
eq(derivedMarks(R('BPPP'), 1), ['b', 'r'], 'row below a short column: blue then red (ended 2 short)');
eq(derivedMarks(R('BPB'), 2), [], 'small road needs more columns');
eq(derivedMarks(R('BPBP'), 2), ['r'], 'small road first entry');
eq(derivedMarks(R('BPBPB'), 3).length, 1, 'cockroach first entry');
const nm = nextMarks(R('BPBPB'), 'player'); eq(nm.bigEye, 'r', 'next mark big eye after chop continues');
eq(describePattern(R('BBBBBB')).id, 'dragon', 'dragon'); eq(describePattern(R('BPBP')).id, 'pingpong', 'ping pong'); eq(describePattern(R('BBPPBB')).id, 'twotwo', 'two-two');
// invariant: marks = (cells beyond the first two columns' start); count check on a long random sequence
let seq = []; for (let i = 0; i < 200; i++) seq.push(Math.random() < 0.5 ? 'banker' : 'player');
for (const k of [1, 2, 3]) { const cols = bigColumns(seq); let expect = 0; for (let c = k; c < cols.length; c++) expect += cols[c].len - (c === k ? 1 : 0); eq(derivedMarks(seq, k).length, expect, 'mark count k=' + k); }
console.log(bad ? bad + ' problems' : 'roads ok');
process.exit(bad ? 1 : 0);
