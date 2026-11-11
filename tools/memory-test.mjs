// Brain memory: queue merging, library entries become searchable, import/export, and the API researcher with a mocked fetch.
import { logQuestion, topQueue, addEntry, importEntries, exportQueue, studyQueue, RESEARCHERS, setKey, brainOf } from '../app/brain/memory.js';
import { search } from '../app/brain/brain.js';
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = v; }, removeItem(k) { delete this._[k]; } };
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } };
const ctx = { profile: {} };
logQuestion(ctx, 'What is the zorblax strategy for dragon bonus?');
logQuestion(ctx, 'the zorblax strategy for dragon bonus what is');   // same words, different order
logQuestion(ctx, 'How deep should a shoe be dealt?');
ok(brainOf(ctx).queue.length === 2 && topQueue(ctx)[0].n === 2, 'duplicate questions merge and rank first');
ok(search('zorblax', 3).length === 0, 'unknown topic not found yet');
addEntry(ctx, { title: 'Zorblax strategy', tags: 'zorblax dragon bonus', standard: 'A made-up topic used by a test.', status: 'verified' });
ok(search('zorblax strategy', 3)[0]?.d.title === 'Zorblax strategy', 'learned entry is searchable');
ok(brainOf(ctx).queue.length === 1, 'answered question leaves the queue');
ok(JSON.parse(exportQueue(ctx)).questions.length === 1, 'export lists the open questions');
const got = importEntries(ctx, JSON.stringify({ entries: [{ title: 'Shoe penetration', tags: 'shoe deep dealt penetration', standard: 'How much of the shoe is dealt before the shuffle.', status: 'sourced', sources: ['https://example.com'] }] }));
ok(got.length === 1 && brainOf(ctx).library.length === 2 && brainOf(ctx).queue.length === 0, 'import adds entries and clears the matching question');
let threw = false; try { importEntries(ctx, 'not json'); } catch { threw = true; } ok(threw, 'bad import rejected');
// API researcher with a mocked network
ok(!RESEARCHERS.anthropic.available(), 'api researcher unavailable without a key');
setKey('test-key'); ok(RESEARCHERS.anthropic.available(), 'available once a key is set');
logQuestion(ctx, 'Explain the Kelly criterion for card counters');
let sent = null;
const mock = async (url, opt) => { sent = { url, opt }; return { ok: true, json: async () => ({ content: [{ text: 'Sure: {"title":"Kelly for counters","tags":"kelly bankroll","simple":"Bet in proportion to your edge.","standard":"Kelly sizes bets by edge over variance.","deep":"f = edge/variance."}' }] }) }; };
const r = { ...RESEARCHERS.anthropic, research: (q) => RESEARCHERS.anthropic.research(q, { fetchImpl: mock }) };
const res = await studyQueue(ctx, r, { max: 3 });
ok(res.done === 1 && res.failed === 0, 'study session answers the queue');
ok(sent.opt.headers['x-api-key'] === 'test-key' && sent.opt.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'request carries the key and browser header');
ok(brainOf(ctx).library[0].status === 'unverified' && brainOf(ctx).library[0].src === 'api', 'api answers are labelled unverified');
ok(!JSON.stringify(ctx.profile).includes('test-key'), 'the key never enters the profile');
const bad401 = { ...RESEARCHERS.anthropic, research: (q) => RESEARCHERS.anthropic.research(q, { fetchImpl: async () => ({ ok: false, status: 401 }) }) };
logQuestion(ctx, 'Another unknown thing about chips'); const r2 = await studyQueue(ctx, bad401, { max: 1 }); ok(r2.failed === 1, 'API errors are counted, not thrown');
console.log(bad ? bad + ' problems' : 'memory ok'); process.exit(bad ? 1 : 0);
