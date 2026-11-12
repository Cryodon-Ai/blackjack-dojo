// Headless check of the Coach area. CHROME=... PW=... node tools/coach-e2e.mjs
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
const T = () => page.evaluate(() => document.querySelector('#screen').innerText.replace(/\s+/g, ' '));
const go = async (h, ms = 900) => { await page.goto(base + '#/' + h); await page.reload(); await page.waitForTimeout(ms + 600); };
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };

await go('coach', 1200); let t = await T();
ok(/today's plan/i.test(t) && /leak report/i.test(t) && /belts/i.test(t) && /keep yourself honest/i.test(t), 'coach home sections');
ok(/white belt/i.test(t), 'belts show');
// make some drill data so the plan and leak report fill in
await go('play/poker/drills/preflop', 800);
// enough answers that some spot repeats (the leak report needs two tries on the same item); tolerant of the drill ending
for (let i = 0; i < 70; i++) {
  const had = await page.evaluate((i) => { const b = [...document.querySelectorAll('#opts button')]; if (!b.length) return false; b[i % b.length].click(); return true; }, i);
  if (!had) { await go('play/poker/drills/preflop', 500); continue; }
  await page.waitForTimeout(30); await page.evaluate(() => document.querySelector('#nx')?.click()); await page.waitForTimeout(30);
}
await page.waitForTimeout(700);
await go('coach', 1000); t = await T(); ok(/poker/i.test(t) && /\d+%/.test(t), 'leak report reflects the drill');
// session plan -> debrief
await go('coach/session', 800);
await page.evaluate(() => document.querySelector('#go').click()); await page.waitForTimeout(600);
t = await T(); ok(/debrief/i.test(t), 'session started, debrief shown');
ok(await page.evaluate(() => !!document.getElementById('plan-bar') && !document.getElementById('plan-bar').hidden), 'plan bar visible');
await page.evaluate(() => { document.querySelector('#r').value = '-60'; document.querySelector('#save').click(); }); await page.waitForTimeout(900);
t = await T(); ok(/real results/i.test(t) && /−\$60/.test(t), 'result saved and listed');
await go('coach', 1000); t = await T(); ok(/cooldown/i.test(t), 'stop-loss breach starts cooldown');
for (const [h, re] of [['coach/cost', /per hour/i], ['coach/settings', /reality check/i], ['coach/help', /1-800-GAMBLER/], ['coach/print', /cheat cards/i]]) { await go(h, 700); t = await T(); ok(re.test(t), h + ' renders'); }
ok(await page.evaluate(() => document.querySelectorAll('td.hg.in').length > 100), 'print page draws range grids');
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors'); console.log(`${pass} passed, ${fail} failed`);
await browser.close(); server.close(); process.exit(fail || errs.length ? 1 : 0);
