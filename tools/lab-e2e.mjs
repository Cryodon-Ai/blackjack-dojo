// Headless end-to-end check of the Strategy Lab at phone width. Needs playwright-core and a chromium:
//   PW=/path/to/node_modules/playwright-core CHROME=/path/to/chrome node tools/lab-e2e.mjs
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
const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); page.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
const T = () => page.evaluate(() => document.querySelector('#screen').innerText.replace(/\s+/g, ' '));
const go = async (h, ms = 1200) => { await page.goto(base + '#/lab' + h); await page.reload(); await page.waitForTimeout(ms); };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };

// Play n hands in a runner screen (alternating choices, so both right and wrong paths run).
async function play(n) {
  for (let i = 0; i < n; i++) {
    await page.evaluate((i) => { const b = [...document.querySelectorAll('.actionbar .act:not(.off)')]; if (b.length) b[i % b.length].click(); }, i);
    await page.waitForTimeout(500);
    // Why Mode sheet
    await page.evaluate(() => { const k = document.querySelector('.sheet [data-k]'); if (k) { k.click(); document.querySelector('.sheet #go')?.click(); } });
    await page.waitForTimeout(250);
    await page.evaluate(() => (document.querySelector('#nx') || document.querySelector('#fin'))?.click());
    await page.waitForTimeout(300);
  }
}

await page.goto(base + '#/lab'); await page.waitForTimeout(2500);
let t = await T();
ok(/Strategy Lab/.test(t) && /Today's workout/.test(t) && /Coach/.test(t), 'hub shows title, workout, coach');
ok(/New here\?/.test(t), 'first-run welcome shows');
ok(!(await page.evaluate(() => !!document.querySelector('#tabs a[data-tab="learn"]'))), 'Learn tab removed from nav');
ok(await page.evaluate(() => document.querySelector('#tabs a.on')?.dataset.tab === 'lab' && document.querySelector('#tabs a.on').getAttribute('aria-current') === 'page'), 'Lab tab active with aria-current');

// Static screens
for (const [h, re] of [['/when', /Which method when/], ['/insights', /working for you/], ['/journal', /Mistake journal/], ['/ladder', /Chunk Ladder/], ['/shortcut', /Dealer-Stiff/]]) { await go(h, 800); ok(re.test(await T()), `screen ${h}`); }
await go('/always', 6000); t = await T(); ok(/Always-Rules/.test(t) && /Always split Aces/.test(t), 'always-rules screen');

// Runner-based methods
for (const [h, re, n] of [['/gut', /Gut-Check/, 4], ['/why', /Why Mode/, 3], ['/today', /Today/, 5], ['/ladder/stiff', /Stiff hands/, 4], ['/coach', /Coach check/, 20]]) {
  await go(h, 1500); ok(re.test(await T()), `${h} loads`); await play(n);
}
t = await T(); ok(/Coach check complete/.test(t) && /ACCURACY|Accuracy/i.test(t), 'coach finishes with results'); ok(/Chunk Ladder|Always-Rules|Fix|Gut-Check|Sprint/.test(t), 'coach gives a recommendation');

// Hub after play: streak, workout count, mastery map, coach history, journal
await go('', 1500); t = await T();
ok(!/New here\?/.test(t), 'welcome gone after play'); ok(/of 30 hands/.test(t), 'daily goal shown');
ok(await page.evaluate(() => document.querySelectorAll('#minimap i').length > 300), 'mastery map has a dot per spot');
await go('/journal', 800); t = await T(); ok(/×\d/.test(t) || /No mistakes/.test(t), 'journal lists mistakes');
await go('/insights', 800); t = await T(); ok(/hands/.test(t), 'insights has data');

// Sprint, audit, shortcut drill, fade, lists, worst
await go('/sprint', 1500); ok(/Score/.test(await T()), 'sprint loads'); await play(3);
await go('/audit', 1500); t = await T(); ok(/Spot the Mistake/.test(t), 'audit loads');
for (let i = 0; i < 3; i++) { await page.evaluate(() => document.querySelector('[data-j]')?.click()); await page.waitForTimeout(600); await page.evaluate(() => document.querySelector('#nx')?.click()); await page.waitForTimeout(300); }
ok(/\d+\/15/.test(await T()), 'audit counts rounds');
await go('/shortcut', 800); await page.evaluate(() => document.querySelector('#go').click()); await page.waitForTimeout(1500); ok(/STIFF|STRONG/.test(await T()), 'shortcut shows dealer label');
await go('/fade', 7000); t = await T(); ok(/spots faded/.test(t), 'fade chart renders');
await go('/lists', 7000); t = await T(); ok(/Hard 5/.test(t) && /otherwise|always/.test(t), 'rule lists render'); ok(!/undefined|NaN/.test(t), 'rule lists have no undefined/NaN');
await go('/worst', 1500); ok(/Fix my worst|Nothing to drill/.test(await T()), 'worst list loads');

// Preset switch + keyboard
await go('', 1200);
await page.evaluate(() => document.querySelector('#presets button[data-p="gravity"]').click()); await page.waitForTimeout(3000);
t = await T(); ok(/8 decks/.test(t), 'switching to Gravity preset changes the table');
await go('/gut', 4000);
await page.keyboard.press('H'); await page.waitForTimeout(350);
ok(await page.evaluate(() => !!document.querySelector('.verdict')), 'keyboard H answers the hand');
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
ok(await page.evaluate(() => !!document.querySelector('.actionbar .act')), 'Enter advances to the next hand');

// Settings toggles
await page.goto(base + '#/stats/settings'); await page.waitForTimeout(1000);
await page.evaluate(() => { const c = document.querySelector('#lg'); c.checked = true; c.dispatchEvent(new Event('change')); }); await page.waitForTimeout(300);
ok(await page.evaluate(() => document.documentElement.classList.contains('lg')), 'large text toggle applies');

console.log(`${pass} passed, ${fail} failed`); if (errs.length) console.log('errors:', [...new Set(errs)].slice(0, 8));
await browser.close(); server.close();
process.exit(fail || errs.length ? 1 : 0);
