// E2E for the "59-idea list" features. CHROME=... PW=... node tools/list-e2e.mjs
import { start } from './e2e-lib.mjs';
const { page, T, go, ok, click, done } = await start();

// 1. solved index tables
await go('#/play/counting/tables', 1200); let t = await T();
ok(/Index tables for my rules/.test(t) && /Solve for my rules/.test(t), 'tables screen renders');
await click('#go');
await page.waitForFunction(() => /Re-solve/.test(document.querySelector('#screen').innerText), null, { timeout: 60000 }).catch(() => {});
t = await T(); ok(/Re-solve/.test(t) && /12 vs 3/.test(t) && /Published/.test(t), 'solving fills the table');
ok(/same|changed|kept published/.test(t), 'rows are annotated');

// 2a. insurance + negative-index cards
await go('#/play/counting/dev', 900);
ok(/Negative ones/.test(await T()), 'negative set offered');
await page.evaluate(() => document.querySelector('#t button[data-v="neg"]').click());
await page.waitForTimeout(200); t = await T(); ok(/Insurance vs A/.test(t), 'insurance is in the set');
await click('#go'); await page.waitForTimeout(300);
let sawIns = false;
for (let i = 0; i < 60 && !sawIns; i++) {
  sawIns = await page.evaluate(() => /Take insurance/.test(document.querySelector('#screen').innerText));
  if (sawIns) break;
  await page.evaluate(() => [...document.querySelectorAll('.act')].filter((x) => !x.disabled)[0]?.click());
  await page.waitForFunction(() => [...document.querySelectorAll('.act')].some((x) => !x.disabled), null, { timeout: 4000 }).catch(() => {});
}
ok(sawIns, 'insurance question appears within 60 questions');

// 2b. bankroll + scout
await go('#/play/counting/bankroll', 1200); t = await T();
ok(/Bankroll & Kelly/i.test(t) && /Full Kelly/.test(t), 'bankroll renders');
await click('#go');
await page.waitForFunction(() => /Risk of ruin/.test(document.querySelector('#screen').innerText), null, { timeout: 90000 }).catch(() => {});
t = await T(); ok(/Risk of ruin/.test(t) && /Expected per hour/.test(t), 'bankroll simulation result');
await go('#/play/counting/scout', 900);
await page.evaluate(() => { document.querySelector('#bj button[data-v="1.2"]').click(); });
await page.waitForTimeout(300); await click('#add'); await page.waitForTimeout(600);
t = await T(); ok(/6:5/.test(t) && /Avoid|Poor/.test(t), 'scout rates a 6:5 table poorly');
await page.evaluate(() => document.querySelector('#sh button[data-v="csm"]').click()); await page.waitForTimeout(300); await click('#add'); await page.waitForTimeout(600);
t = await T(); ok(/continuous shuffler/i.test(t), 'scout flags a CSM');

// 2c. back-count sim option
await go('#/play/counting/sim', 900); t = await T(); ok(/Back-count \+2/.test(t), 'sim offers back-counting');

// 2d. distraction mode in speed count
await go('#/play/count', 900);
await page.evaluate(() => document.querySelector('#m2').click()); await page.waitForTimeout(200);
t = await T(); ok(/Distracted/.test(t) && /Hear it/.test(t), 'speed trainer has conditions');

await done();
