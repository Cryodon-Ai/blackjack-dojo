// Shared headless-browser helper for the e2e scripts: static server + phone-width page + tiny assert kit.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
export async function start() {
  const server = http.createServer(async (q, r) => {
    try { const u = q.url.split('?')[0]; const f = join(ROOT, u === '/' ? 'index.html' : decodeURIComponent(u)); r.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); r.end(await readFile(f)); }
    catch { r.writeHead(404); r.end(); }
  }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/`;
  const { chromium } = await import((process.env.PW || '/home/kkiddgutridge/trade-atlas/node_modules/playwright-core') + '/index.mjs');
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/home/kkiddgutridge/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell' });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
  let pass = 0, fail = 0;
  const T = () => page.evaluate(() => document.querySelector('#screen').innerText.replace(/\s+/g, ' '));
  const go = async (h, ms = 1200) => { await page.goto(base + h); await page.reload(); await page.waitForTimeout(ms); };
  const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
  const click = (sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
  const done = async () => {
    ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
    console.log(`${pass} passed, ${fail} failed`);
    await browser.close(); server.close(); process.exit(fail ? 1 : 0);
  };
  return { page, base, T, go, ok, click, done };
}
