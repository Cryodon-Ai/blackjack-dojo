// Headless end-to-end check of Counting Pro at phone width.
//   PW=/path/to/node_modules/playwright-core CHROME=/path/to/chrome node tools/count-e2e.mjs
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
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/kkiddgutridge/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); page.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
const T = () => page.evaluate(() => document.querySelector('#screen').innerText.replace(/\s+/g, ' '));
const go = async (h, ms = 1200) => { await page.goto(base + '#/play/counting' + h); await page.reload(); await page.waitForTimeout(ms); };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };

await go('', 1500); let t = await T();
ok(/Counting Pro/.test(t) && /Index plays/.test(t) && /Bet sizing/.test(t) && /Count & Play/.test(t) && /Does it pay/.test(t), 'hub shows every part');
await page.goto(base + '#/play'); await page.waitForTimeout(900); ok(/Counting Pro/.test(await T()), 'Play hub links to Counting Pro');
await go('/learn', 1000); t = await T(); ok(/perfect basic strategy/i.test(t) && /where counting works/i.test(t), 'roadmap renders');

// index drill: answer 30 questions
await go('/dev', 900); await page.evaluate(() => document.querySelector('#go').click()); await page.waitForTimeout(300);
for (let i = 0; i < 30; i++) {
  await page.evaluate((i) => { const b = [...document.querySelectorAll('.act')].filter((x) => !x.disabled); if (b.length) b[i % b.length].click(); }, i);
  await page.waitForTimeout(60);
  await page.evaluate(() => {}); await page.waitForTimeout(800 > 0 ? 0 : 0);
  await page.waitForFunction(() => [...document.querySelectorAll('.act')].some((x) => !x.disabled), null, { timeout: 4000 }).catch(() => {});
}
t = await T(); ok(/True count/.test(t) && /Dealer shows/.test(t), 'index drill keeps serving questions');

// ramp drill
await go('/ramp', 900); await page.evaluate(() => document.querySelector('#go').click()); await page.waitForTimeout(300);
for (let i = 0; i < 12; i++) {
  await page.evaluate((i) => { const b = [...document.querySelectorAll('.act')].filter((x) => !x.disabled); if (b.length) b[i % b.length].click(); }, i);
  await page.waitForFunction(() => [...document.querySelectorAll('.act')].some((x) => !x.disabled), null, { timeout: 4000 }).catch(() => {});
}
t = await T(); ok(/True count/.test(t) && /unit/.test(t), 'ramp drill keeps serving questions');

// table: 2 others, instant pace; play 6 hands
await go('/table', 1000);
await page.evaluate(() => { document.querySelector('#s button[data-v="none"]').click(); }); await page.waitForTimeout(300);
await page.evaluate(() => { document.querySelector('#a button[data-v="full"]').click(); }); await page.waitForTimeout(300);
await page.evaluate(() => { document.querySelector('#q button[data-v="2"]').click(); }); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('#go').click()); await page.waitForTimeout(600);
let hands = 0;
for (let step = 0; step < 400 && hands < 6; step++) {
  const st = await page.evaluate(() => {
    const bar = document.querySelector('#bar'); if (!bar) return 'none';
    if (document.querySelector('.sheet, .scrim')) return 'sheet';
    const txt = bar.innerText;
    if (/Next hand/.test(txt)) return 'next';
    if (/Count check/.test(txt)) return 'cc';
    if (/Hit/.test(txt) && /Stand/.test(txt)) return 'act';
    if (/Take it/.test(txt)) return 'ins';
    if (bar.querySelector('[data-u]')) return 'bet';
    return 'wait';
  });
  if (st === 'bet') await page.evaluate(() => document.querySelector('#bar [data-u]').click());
  else if (st === 'ins') await page.evaluate(() => document.querySelector('#bar [data-a="no"]').click());
  else if (st === 'act') await page.evaluate(() => { const b = document.querySelector('#bar .act[data-a="S"]:not(.off)') || document.querySelector('#bar .act:not(.off)'); b.click(); });
  else if (st === 'next') { hands++; await page.evaluate(() => document.querySelector('#nx').click()); }
  else if (st === 'cc') await page.evaluate(() => document.querySelector('#cc').click());
  else if (st === 'sheet') await page.evaluate(() => { const ok = document.querySelector('#qc #ok, #qc #go'); if (ok) ok.click(); });
  await page.waitForTimeout(120);
}
ok(hands >= 6, 'played 6 hands at Count & Play (got ' + hands + ')');
t = await T(); ok(/Hand \d+/.test(t) || /Next hand/.test(t), 'table HUD present');
await page.evaluate(() => document.querySelector('#end').click()); await page.waitForTimeout(500);
t = await T(); ok(/Session over/.test(t) && /Bet sizing/.test(t), 'session summary shows');

// simulator
await go('/sim', 1000);
await page.evaluate(() => document.querySelector('#go').click());
await page.waitForFunction(() => /Risk of ruin/.test(document.querySelector('#screen').innerText), null, { timeout: 90000 }).catch(() => {});
t = await T(); ok(/Your edge/.test(t) && /Risk of ruin/.test(t) && /Edge by true count/.test(t), 'simulator returns results');
console.log('sim text:', t.slice(t.indexOf('Result'), t.indexOf('Result') + 260));

console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
console.log(`${pass} passed, ${fail} failed`);
await browser.close(); server.close();
process.exit(fail || errs.length ? 1 : 0);
