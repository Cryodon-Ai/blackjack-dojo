// Headless check of Ask the Coach. CHROME=... PW=... node tools/ask-e2e.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => { try { const f = join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); r.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); r.end(await readFile(f)); } catch { r.writeHead(404); r.end(); } }).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const { chromium } = await import((process.env.PW || '/home/kkiddgutridge/trade-atlas/node_modules/playwright-core') + '/index.mjs');
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/kkiddgutridge/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); page.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
await page.goto(base + '#/ask'); await page.reload(); await page.waitForSelector('#q', { timeout: 20000 });
const lastA = () => page.evaluate(() => { const a = [...document.querySelectorAll('.coach-a')]; return a.length ? a[a.length - 1].innerText.replace(/\s+/g, ' ') : ''; });
async function ask(q, re, label, wait = 25000) {
  const n0 = await page.evaluate(() => document.querySelectorAll('.coach-a').length);
  await page.fill('#q', q); await page.click('#send');
  await page.waitForFunction((n0) => { const a = [...document.querySelectorAll('.coach-a')]; return a.length > n0 && !/Thinking/.test(a[a.length - 1].innerText); }, n0, { timeout: wait }).catch(() => {});
  const t = await lastA(); ok(re.test(t), `${label} :: ${t.slice(0, 220)}`); return t;
}
await ask('What should I do with 16 vs 10?', /hit|surrender/i, '16 v 10');
await ask('soft 18 against a 9', /hit/i, 'A7 v 9');
await ask('8,8 vs 10', /split/i, '88 v 10');
await ask('12 vs 3 at true count +2', /stand/i, '12 v 3 at +2 stands');
await ask('what about at -1?', /hit/i, 'follow-up changes the count');
await ask('AKs vs QQ', /4\d(\.\d)?%|5\d(\.\d)?%/, 'AKs v QQ equity near 43%');
await ask('Should I open J9s from UTG?', /fold/i, 'J9s UTG fold');
await ask('Should I open J9s from the button?', /raise/i, 'J9s BTN raise');
await ask('Pot is 20, he bets 10, I have 9 outs on the flop', /call/i, 'pot odds + outs');
await ask('Running count 8 with 2.5 decks left', /3\.2/, 'true count');
await ask('What bet at true count +3 on a 1-8 spread?', /4 units/, 'bet size');
await ask('banker has 5, player third card is 3', /Banker/i, 'baccarat draw');
await ask('Why is banker the best bet?', /45\.86|commission/i, 'KB banker');
await ask('Explain pot odds like I am new', /price|equity/i, 'KB pot odds');
await ask('does card counting work online', /shuffl|RNG|random/i, 'KB counting online');
await ask('what should I work on?', /./, 'personal plan');
// levels + buttons
await page.click('#lv button[data-v="deep"]'); await page.waitForTimeout(300);
ok(await page.evaluate(() => document.querySelectorAll('.coach-a').length > 5), 'history kept when changing level');
const t = await ask('16 vs 10', /Dealer 17|Dealer bust/i, 'deep level shows the dealer distribution');
await page.click('#lv button[data-v="simple"]'); await page.waitForTimeout(300);
ok(/./.test(await lastA()), 'plain level renders');
ok(await page.evaluate(() => !!document.getElementById('ask-fab')), 'ask button exists');
await page.goto(base + '#/coach'); await page.waitForTimeout(1500);
ok(/Ask the Coach/.test(await page.evaluate(() => document.querySelector('#screen').innerText)), 'coach home links to ask');
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors'); console.log(`${pass} passed, ${fail} failed`);
await browser.close(); server.close(); process.exit(fail || errs.length ? 1 : 0);
