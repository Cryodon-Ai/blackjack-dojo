// iPhone-readiness audit in headless Chromium (NOT real Safari): every static route at 4 phone widths.
// Checks horizontal overflow, text inputs under 16px (iOS zooms on focus), small tap targets, console errors,
// and that the app reloads fully offline via the service worker.   node tools/phone-audit.mjs [--quick]
import { readdirSync, readFileSync } from 'node:fs';
import { start } from './e2e-lib.mjs';
const quick = process.argv.includes('--quick');
const routes = new Set(['#/', '#/play']);
for (const f of readdirSync(new URL('../screens/', import.meta.url))) {
  const src = readFileSync(new URL('../screens/' + f, import.meta.url), 'utf8');
  for (const m of src.matchAll(/href="(#\/[^"$`{}]+)"/g)) routes.add(m[1]);
}
for (const f of ['games/count.js']) { /* trainer entry points are linked from screens */ }
const list = [...routes].filter((r) => !/\/(learn|drill|drills)\/[a-z0-9-]+$/.test(r) || true).sort();
const { page, base, T, go, ok, done } = await start();
const widths = quick ? [390] : [320, 375, 390, 430];
const problems = new Map();
const note = (k, v) => { if (!problems.has(k)) problems.set(k, new Set()); problems.get(k).add(v); };
console.log(`${list.length} routes x ${widths.length} widths`);
for (const w of widths) {
  await page.setViewportSize({ width: w, height: 844 });
  for (const r of list) {
    await page.goto(base + r); await page.reload(); await page.waitForTimeout(quick ? 500 : 650);
    const res = await page.evaluate((w) => {
      const out = { over: [], inp: [], tap: [], broke: /something broke/i.test(document.body.innerText) };
      const inScroll = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) return true; } return false; };
      for (const el of document.querySelectorAll('#screen *')) {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        if (r.right > w + 1 && !inScroll(el) && getComputedStyle(el).position !== 'fixed') out.over.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + String(el.className).split(' ')[0]);
      }
      for (const el of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea')) if (parseFloat(getComputedStyle(el).fontSize) < 16) out.inp.push(el.id || el.name || el.tagName);
      for (const el of document.querySelectorAll('#screen button, #screen a.btn, #screen a.card, #screen .seg button, #screen .act')) {
        const r = el.getBoundingClientRect(); if (r.width && r.height && !el.disabled && (r.height < 36 || r.width < 36)) out.tap.push((el.textContent || '').trim().slice(0, 18) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      out.over = [...new Set(out.over)].slice(0, 3); return out;
    }, w);
    if (res.broke) note('BROKE', `${r}@${w}`);
    if (res.over.length) note('overflow', `${r}@${w}: ${res.over.join(', ')}`);
    if (res.inp.length) note('input<16px', `${r}: ${[...new Set(res.inp)].join(',')}`);
    if (res.tap.length) note('small tap', `${r}: ${[...new Set(res.tap)].slice(0, 3).join(' | ')}`);
  }
}
// offline
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base + '#/play/baccarat'); await page.waitForTimeout(2500);
await page.context().setOffline(true);
for (const r of ['#/play/baccarat/trap', '#/play/poker/lab/pushfold', '#/play/threecard', '#/play/counting/tables']) {
  let text = '';
  try { await page.goto(base + r); await page.reload(); await page.waitForTimeout(1500); text = await T(); } catch (e) { text = 'ERR ' + e.message; }
  ok(text.length > 40 && !/ERR|something broke/i.test(text), 'offline reload works: ' + r);
}
for (const [k, v] of problems) { console.log(`\n${k} (${v.size})`); for (const s of [...v].slice(0, quick ? 12 : 25)) console.log('  ' + s); }
ok(!problems.has('BROKE'), 'no route shows "Something broke"');
await done();
