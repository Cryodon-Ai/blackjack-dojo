// Rewrites the BUILD id and PRECACHE list in sw.js from the files actually on disk.
// Run before every deploy:  node tools/stamp.js
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
// Files that are dev/verification only and never needed on the phone.
const SKIP_DIR = new Set(['tools', 'tests', 'node_modules', '.git']);
const SKIP_FILE = /^(\..*|package\.json|deploy\.md|README\.md|sw\.js|.*\.log|verify\.js|verify-output\.txt|reference-chart\.js|reference-dealer\.js)$/;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!SKIP_DIR.has(name)) walk(p); }
    else if (!SKIP_FILE.test(name)) files.push(relative(root, p));
  }
})(root);
files.sort();
const h = createHash('sha256');
for (const f of files) { h.update(f); h.update(readFileSync(join(root, f))); }
const build = h.digest('hex').slice(0, 12);
let sw = readFileSync(join(root, 'sw.js'), 'utf8');
sw = sw.replace(/\/\* STAMP:BUILD \*\/ const BUILD = .*;/, `/* STAMP:BUILD */ const BUILD = '${build}';`);
sw = sw.replace(/\/\* STAMP:PRECACHE \*\/ const PRECACHE = .*;/, `/* STAMP:PRECACHE */ const PRECACHE = ${JSON.stringify(['./', ...files.map((f) => './' + f)])};`);
writeFileSync(join(root, 'sw.js'), sw);
console.log(`stamped build ${build}: ${files.length} files precached`);
