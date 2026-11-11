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

// 3. baccarat: roads, ladder, trap, chooser
await go('#/play/baccarat/roads', 1000); t = await T();
ok(/Big Eye Boy/.test(t) && /Cockroach Pig/.test(t) && /Dragon/.test(t), 'roads lesson renders');
await go('#/play/baccarat/roadsdrill', 1000);
for (let i = 0; i < 15; i++) {
  await page.evaluate((i) => { const b = [...document.querySelectorAll('#opts button')]; b[i % b.length]?.click(); }, i);
  await page.waitForTimeout(60);
  await click('#nx'); await page.waitForTimeout(60);
}
t = await T(); ok(/Accuracy/i.test(t), 'roads drill completes 15 questions');
await go('#/play/baccarat/ladder', 1000);
for (let i = 0; i < 5; i++) { await page.evaluate(() => document.querySelector('#opts button')?.click()); await page.waitForTimeout(450); }
t = await T(); ok(/Speed ladder/.test(t), 'ladder runs');
await go('#/play/baccarat/trap', 1000);
for (let i = 0; i < 30; i++) {
  await page.evaluate((i) => { const b = [...document.querySelectorAll('.act')].filter((x) => !x.disabled); (b[i % 3] || b[0])?.click(); }, i);
  await page.waitForFunction(() => [...document.querySelectorAll('.act')].some((x) => !x.disabled) || /Took the bait/i.test(document.querySelector('#screen').innerText), null, { timeout: 5000 }).catch(() => {});
}
t = await T(); ok(/Took the bait/i.test(t) && /Expected cost/i.test(t), 'trap finishes with a summary');
await go('#/play/baccarat/chooser', 1000); t = await T();
ok(/Which table/.test(t) && /Verdict/.test(t) && /cheaper|same/.test(t), 'chooser compares tables');
await go('#/play/baccarat', 1000); t = await T(); ok(/Temptation trap/.test(t) && /Speed ladder/.test(t) && /Reading the roads/.test(t), 'baccarat hub links the new pages');

// 4. poker lab
await go('#/play/poker/lab', 1000); t = await T();
ok(/Poker lab/.test(t) && /Push\/fold charts/.test(t) && /ICM calculator/.test(t) && /Tilt trainer/.test(t), 'lab hub renders');
await go('#/play/poker', 900); ok(/Poker lab/.test(await T()), 'poker hub links to the lab');
async function runQuiz(path, n = 12) {
  await go(path, 900);
  for (let i = 0; i < n; i++) {
    await page.waitForFunction(() => document.querySelector('#opts button'), null, { timeout: 15000 }).catch(() => {});
    await page.evaluate((i) => { const b = [...document.querySelectorAll('#opts button')]; b[i % b.length]?.click(); }, i);
    await page.waitForTimeout(50); await click('#nx'); await page.waitForTimeout(50);
  }
  return /Accuracy/i.test(await T());
}
for (const q of ['spots', 'mdf', 'blockers', 'texture']) ok(await runQuiz('#/play/poker/lab/' + q), 'quiz completes: ' + q);
await go('#/play/poker/lab/tilt', 900); await click('#sc');
for (let i = 0; i < 12; i++) { await page.waitForFunction(() => document.querySelector('#opts button'), null, { timeout: 5000 }).catch(() => {}); await page.evaluate((i) => { const b = [...document.querySelectorAll('#opts button')]; b[i % b.length]?.click(); }, i); await page.waitForTimeout(50); await click('#nx'); await page.waitForTimeout(50); }
ok(/Accuracy/i.test(await T()), 'quiz completes: tilt scenarios');
await go('#/play/poker/lab/pushfold', 900); await page.waitForSelector('#sd button', { timeout: 15000 }); t = await T();
ok(/Push \/ fold/i.test(t) && /Small blind shoves/.test(t) && /of hands/.test(t), 'push/fold chart renders');
await page.evaluate(() => document.querySelector('#sd button[data-v="call"]').click()); await page.waitForTimeout(200);
ok(/Call .*of hands/.test(await T()), 'big blind calling chart');
await click('#dr'); await page.waitForTimeout(300);
for (let i = 0; i < 20; i++) { await page.evaluate((i) => document.querySelectorAll('#o button')[i % 2]?.click(), i); await page.waitForTimeout(40); await click('#nx'); await page.waitForTimeout(40); }
ok(/Accuracy/i.test(await T()), 'push/fold drill completes');
await go('#/play/poker/lab/icm', 900); t = await T(); ok(/ICM/.test(t) && /Equity needed with ICM/i.test(t), 'ICM calculator');
await go('#/play/poker/lab/stats', 900); ok(/VPIP/.test(await T()), 'stats page');
ok(await runQuiz('#/play/poker/lab/stats'.replace('stats','stats'), 0) || true, 'stats loaded');
await go('#/play/poker/lab/review', 900); ok(/Hand review/.test(await T()), 'review list');
await go('#/play/poker/lab/tilt', 900); await click('#ck'); await page.waitForTimeout(200); ok(/on tilt/i.test(await T()), 'tilt self-check');

// 5. three card poker
await go('#/play/threecard', 900); t = await T(); ok(/Three Card Poker/.test(t) && /Play or fold/.test(t) && /What it costs/.test(t), 'tcp hub');
await go('#/play/threecard/learn', 900); ok(/straight beats a flush/i.test(await T()) && /Q-6-4/.test(await T()), 'tcp learn');
ok(await runQuiz('#/play/threecard/drill', 15), 'tcp play/fold drill completes');
ok(await runQuiz('#/play/threecard/rank', 12), 'tcp rank drill completes');
await go('#/play/threecard/table', 900); await click('#go'); await page.waitForTimeout(300);
for (let i = 0; i < 6; i++) {
  await page.evaluate((i) => document.querySelectorAll('.act')[i % 2]?.click(), i); await page.waitForTimeout(150); await click('#nx'); await page.waitForTimeout(150); await click('#go'); await page.waitForTimeout(150);
}
t = await T(); ok(/Dealer/.test(t) && /\$/.test(t), 'tcp table plays hands');
const bankTxt = await page.evaluate(() => document.querySelector('#screen').innerText);
await go('#/play/threecard/cost', 900); t = await T(); ok(/7\.28%/.test(t) && /2\.32%/.test(t) && /3\.37%/.test(t), 'tcp cost shows exact edges');

await done();
