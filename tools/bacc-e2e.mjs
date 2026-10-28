// Headless end-to-end check of the Baccarat area at phone width. Needs playwright-core and a chromium:
//   PW=/path/to/node_modules/playwright-core CHROME=/path/to/chrome node tools/bacc-e2e.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  try { const f = join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); r.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); r.end(await readFile(f)); }
  catch { r.writeHead(404); r.end(); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const { chromium } = await import((process.env.PW || '/home/kkiddgutridge/trade-atlas/node_modules/playwright-core') + '/index.mjs');
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/kkiddgutridge/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
await page.addInitScript(() => { window.__fly = 0; const sp = CSSStyleDeclaration.prototype.setProperty; CSSStyleDeclaration.prototype.setProperty = function (k, ...r) { if (k === '--sx') window.__fly++; return sp.call(this, k, ...r); }; });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); page.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
const T = () => page.evaluate(() => document.querySelector('#screen').innerText.replace(/\s+/g, ' '));
const go = async (h, ms = 1200) => { await page.goto(base + '#/play/baccarat' + h); await page.reload(); await page.waitForTimeout(ms); };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };


await go('', 1500); let t = await T();
ok(/Baccarat/.test(t) && /Learn baccarat/.test(t) && /Practice table/.test(t) && /Do patterns work/.test(t), 'hub shows the baccarat areas');
await page.goto(base + '#/play'); await page.waitForTimeout(1000); ok(/Baccarat/.test(await T()), 'Play hub links to Baccarat');
await go('', 1200);
await page.evaluate(() => document.querySelector('#v button[data-v="ez"]').click()); await page.waitForTimeout(500);
ok(await page.evaluate(() => document.querySelector('#v button[data-v="ez"]').classList.contains('on')), 'EZ variant selectable');
await page.evaluate(() => document.querySelector('#v button[data-v="standard"]').click()); await page.waitForTimeout(300);

await go('/learn', 1500); t = await T();
ok(/Card values/.test(t) && /Banker rule/.test(t) && /5% commission/.test(t), 'learn page shows rules and commission');
ok(/Banker/.test(t) && /1\.06%/.test(t) && /14\.36%/.test(t), 'learn page shows the exact house edges');
ok(await page.evaluate(() => document.querySelectorAll('.minihand .pcard').length >= 8), 'learn page draws example cards');
ok(await page.evaluate(() => [...document.querySelectorAll('table.evtable')].some((tb) => tb.rows.length >= 9)), 'banker draw table is rendered');

// every drill: answer 15 questions, then see results
for (const id of ['count', 'player', 'banker', 'winner', 'payout', 'edge']) {
  await go('/drill/' + id, 900);
  for (let i = 0; i < 15; i++) {
    await page.evaluate((i) => { const b = [...document.querySelectorAll('#opts button')]; b[i % b.length].click(); }, i);
    await page.waitForTimeout(80);
    await page.evaluate(() => document.querySelector('#nx')?.click()); await page.waitForTimeout(80);
  }
  t = await T(); ok(/Accuracy/i.test(t) && /Best streak/i.test(t), `drill ${id} finishes with results`);
}

// practice table: call the draws
await go('/practice', 1500);
let asked = 0;
for (let i = 0; i < 40 && asked < 6; i++) {
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => { if (document.querySelector('#bar button[data-id]:not(:disabled)')) { document.querySelector('#bar button[data-id]').click(); return 'q'; } if (document.querySelector('#bar #go')) { document.querySelector('#bar #go').click(); return 'go'; } if (document.querySelector('#deal:not([disabled])')) { document.querySelector('#deal').click(); return 'deal'; } return 'wait'; });
  if (state === 'q') asked++;
}
ok(asked >= 3, `practice asks the dealer questions (${asked})`);
ok(await page.evaluate(() => !!document.querySelector('.felt.bacc.practice') && !!document.querySelector('.dealer-fig') && document.querySelectorAll('.bseat .pcard').length >= 4), 'practice table shows dealer and both hands');
ok(/Calls right/.test(await T()), 'practice HUD tracks calls');

// table: bet, deal, settle
await go('/table', 1500);
await page.evaluate(() => document.querySelector('.bzone[data-bet="banker"]').click()); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('.bzone[data-bet="banker"]').click()); await page.waitForTimeout(200);
ok(await page.evaluate(() => document.querySelector('.bz-chip')?.textContent.includes('$10')), 'tapping a bet zone stacks chips');
await page.evaluate(() => document.querySelector('#deal').click()); await page.waitForTimeout(9000);
t = await T();
ok(/Net/.test(t) && /(Player|Banker) wins|Tie/.test(t), 'hand is dealt and settled');
ok(await page.evaluate(() => document.querySelectorAll('.bseat .pcard').length >= 4), 'at least four cards were dealt');
ok(await page.evaluate(() => document.querySelectorAll('.road-scroll circle').length >= 2), 'scoreboard records the hand');
ok(/House edge on each bet/.test(await T()), 'house edge line shows');
await page.evaluate(() => document.querySelector('#rb').click()); await page.waitForTimeout(300);
ok(await page.evaluate(() => document.querySelector('.bz-chip')?.textContent.includes('$10')), 'rebet restores the last bet');
await page.evaluate(() => document.querySelector('#end').click()); await page.waitForTimeout(600);
t = await T(); ok(/Table complete/.test(t) && /What the shoe did/.test(t), 'session summary shows');

// patterns simulation
await go('/truth', 800); await page.evaluate(() => document.querySelector('#go').click()); await page.waitForTimeout(2500);
t = await T(); ok(/After a streak/.test(t) && /Always Banker/.test(t) && /Tie every hand/.test(t), 'pattern simulation reports results');

console.log(`${pass} passed, ${fail} failed`); if (errs.length) console.log('errors:', [...new Set(errs)].slice(0, 8));
await browser.close(); server.close();
process.exit(fail || errs.length ? 1 : 0);
