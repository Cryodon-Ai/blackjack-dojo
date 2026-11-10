// Headless end-to-end check of the poker area at phone width.
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
const go = async (h, ms = 900) => { await page.goto(base + '#/play/poker' + h); await page.reload(); await page.waitForTimeout(ms + 500); };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };

await go('', 1500); let t = await T();
ok(/Poker/.test(t) && /Learn Hold'em/.test(t) && /Practice table/.test(t) && /Starting-hand charts/.test(t) && /Equity calculator/.test(t), 'hub shows every area');
await page.goto(base + '#/play'); await page.waitForTimeout(900); ok(/Poker/.test(await T()), 'Play hub links to Poker');

// every lesson renders
for (const id of ['basics', 'flow', 'position', 'preflop', 'odds', 'postflop', 'bluff', 'players', 'money', 'tourney', 'online', 'mistakes']) {
  await go('/learn/' + id, 500); t = await T(); ok(t.length > 500, 'lesson ' + id + ' renders (' + t.length + ')');
}
await go('/learn/basics', 600); ok(await page.evaluate(() => document.querySelectorAll('.minihand .pcard').length >= 40), 'basics lesson draws cards');
await page.evaluate(() => document.querySelector('#done').click()); await page.waitForTimeout(600); ok(/Starting|flows/i.test(await T()), 'Done moves to the next lesson');

// ranges
await go('/ranges', 800); t = await T(); ok(/Starting-hand charts/.test(t) && /raise \d\d\.\d%/.test(t), 'ranges chart shows percent');
ok(await page.evaluate(() => document.querySelectorAll('td.hg').length === 169), '169 cells');
await page.evaluate(() => document.querySelector('#m button[data-v="BTN"]').click()); await page.waitForTimeout(200);
ok(await page.evaluate(() => document.querySelectorAll('td.hg.in').length > 60), 'BTN range highlights many hands');
await page.evaluate(() => document.querySelector('td.hg[data-h="AKs"]').click()); await page.waitForTimeout(200); ok(/AKs · Raise/.test(await T()), 'tap a hand shows details');
await page.evaluate(() => document.querySelector('#m2 button[data-v="early"]').click()); await page.waitForTimeout(200);
ok(await page.evaluate(() => document.querySelectorAll('td.hg.r3').length > 3 && document.querySelectorAll('td.hg.c').length > 10), 'vs-raise chart shows 3-bet and call');

// all drills: 15 questions each
for (const id of ['rank', 'name', 'outs', 'odds', 'preflop', 'vsraise', 'equity', 'position']) {
  await go('/drills/' + id, 700);
  for (let i = 0; i < 15; i++) {
    await page.evaluate((i) => { const b = [...document.querySelectorAll('#opts button')]; b[i % b.length].click(); }, i);
    await page.waitForTimeout(60);
    await page.evaluate(() => document.querySelector('#nx')?.click()); await page.waitForTimeout(60);
  }
  await page.waitForTimeout(900);
  t = await T(); ok(/accuracy/i.test(t), 'drill ' + id + ' finishes with results :: ' + t.slice(0, 160));
}

// calculator
await go('/calc', 800);
await page.evaluate(() => { const cs = (c) => document.querySelector(`.ck[data-c="${c}"]`).click(); cs(12 * 4 + 0); cs(12 * 4 + 1); });   // A♠ A♥
await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('#go').click());
await page.waitForFunction(() => /Your equity/.test(document.querySelector('#screen').innerText), null, { timeout: 15000 }).catch(() => {});
t = await T(); const m = t.match(/Your equity (\d+\.\d)%/); ok(m && Number(m[1]) > 82 && Number(m[1]) < 88, 'AA vs random equity ~85% (' + (m && m[1]) + ')');

// tools and tips
await go('/tools', 800); await page.evaluate(() => document.querySelector('#sim').click()); await page.waitForTimeout(2500);
t = await T(); ok(/Chance of being behind/.test(t) && /downswing/.test(t) && /per 100 hands/.test(t), 'rake and variance tools work');
await go('/tips', 500); t = await T(); ok(/glossary/i.test(t) && /sixteen rules/i.test(t), 'tips and glossary');

// practice table: play 8 hands, always follow whatever is easiest
await go('/table', 800);
await page.evaluate(() => document.querySelector('#go').click()); await page.waitForTimeout(500);
let hands = 0;
for (let step = 0; step < 900 && hands < 8; step++) {
  const st = await page.evaluate(() => { const bar = document.querySelector('#bar'); if (!bar) return 'none'; const tx = bar.innerText; if (/Next hand/.test(tx)) return 'next'; if (/Fold/.test(tx) && /Raise|Check|Call/.test(tx)) return 'act'; if (bar.querySelector('[data-to]')) return 'size'; return 'wait'; });
  if (st === 'next') { hands++; await page.evaluate(() => document.querySelector('#nx').click()); }
  else if (st === 'act') await page.evaluate(() => { const bs = [...document.querySelectorAll('#bar .act')]; const call = bs.find((b) => /Call|Check/.test(b.innerText)); (call || bs[0]).click(); });
  await page.waitForTimeout(st === 'wait' ? 150 : 100);
}
ok(hands >= 8, 'played 8 hands at the poker table (got ' + hands + ')');
ok(await page.evaluate(() => document.querySelectorAll('.pk-seat').length === 5), 'five opponents seated');
await page.evaluate(() => document.querySelector('#end').click()); await page.waitForTimeout(500);
t = await T(); ok(/Session over/.test(t) && /Decision quality/.test(t), 'poker session summary');

console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
console.log(`${pass} passed, ${fail} failed`);
await browser.close(); server.close();
process.exit(fail || errs.length ? 1 : 0);
