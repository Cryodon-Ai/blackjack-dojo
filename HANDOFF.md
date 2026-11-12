# Handoff: Blackjack Dojo (state as of 2026-11-10)

Repo: ~/blackjack-dojo (GitHub Cryodon-Ai/blackjack-dojo, main). Offline PWA, vanilla JS, no build step.
Always run `node tools/stamp.js` before committing/deploying (service-worker cache).

## Done and pushed to main
Counting Pro, baccarat strategy page, Texas Hold'em teacher (+ merged Video Poker from another branch).

## Done, committed, pushed 2026-11-12
- Coach tab (screens/coach.js, app/guard.js, app/weak.js, app/voice.js): plan, leak report, belts, session ritual,
  real results, cost of play, help, cheat cards.
- Counting systems / ace side count / deck estimation (games/countsystems.js).
- Ask the Coach: offline "brain" (app/brain/kb.js, app/brain/brain.js, screens/ask.js): parses hands/counts/cards,
  computes with the solvers, 3 explanation levels, BM25 over KB + lessons. Floating "Ask" button.
Tests: tools/idx-test.mjs, poker-test.mjs, holdem-test.mjs, bacc-test.mjs, vp-test.mjs (node);
tools/count-e2e.mjs, poker-e2e.mjs, coach-e2e.mjs, ask-e2e.mjs (headless: CHROME=... PW=... node tools/X.mjs).

## Done since (2026-11-11), pushed 2026-11-12 (0c718d0)
Items 1-7 of the old list: solved index tables (screens/counting.js 'tables'), bankroll/Kelly + table scout (screens/countextra.js),
back-counting sim, speed-trainer distraction/hear-it modes, insurance + negative index cards; baccarat roads/ladder/trap/chooser
(screens/baccextra.js, app/roads.js); poker lab (engine/pokerlab.js, screens/pokerlab.js, data/hu-equity.json + hu-pushfold.json,
regenerate with tools/gen-hu-equity.mjs then gen-pushfold.mjs), table formats HU/3-max + stack depth + HUD + hand history;
Three Card Poker (engine/threecard.js, screens/threecard.js); iPhone pass (css 16px inputs, tools/phone-audit.mjs);
coach memory (app/brain/memory.js, screens/study.js, data/learned.json): unanswered questions queue, learned library searchable offline,
pluggable researcher (manual via Claude Code, or Claude API with a key kept in localStorage, never the profile). API path is unit-tested
with a mocked fetch only: NOT tried against the live API.
Study sessions: Study screen > Copy questions > answer them into data/learned.json {entries:[{id?,title,tags,simple,standard,deep,status,sources}]}.

## Still to do
1. Real iPhone/Safari pass (keyboard over inputs, home-screen install, audio/speech, IndexedDB in standalone). Headless Chromium only so far.
2. DONE 2026-11-12: pushed 0c718d0. Awaiting Kenneth's iPhone test results.
3. Ideas not built: star/thumbs on learned answers; coach daily plan does not yet suggest the new drills (lab, roads, three card).
4. Equity-calculator card keys are now 44px tall but still ~22px wide at 320px (13 across).

## 2026-11-12 review pass (pushed 2026-11-12 (0c718d0))
- app/brain/extra.js: coach computes push/fold ("shove A5o with 10bb", "call a shove with K2o at 15bb"), MDF / bluff share by bet size,
  Three Card Poker play-or-fold for a named hand (exact EV), Kelly bet; 13 knowledge entries (EXTRA_KB: ICM, Nash push/fold, MDF, blockers,
  range advantage, tilt, roads, TCP, Pair Plus, Kelly, back-counting, penetration, solved indices). Hooked in brain.js answer() before "1. computed answers".
- Three Card Poker play frequency is computed (67.4%); it was a wrong hard-coded 64.1%.
- tools/coach-e2e.mjs made deterministic (70 guarded drill answers). tools/extra-test.mjs added.
- Load time compared with 1404775 (headless, no service worker): no regression (all screens 0.15-0.26 s).
Tests: node tools/{idx,poker,holdem,holdem-formats,bacc,vp,lab,roads,pokerlab,threecard,memory,extra}-test(.mjs); e2e: list-e2e (all new features), count/poker/coach/ask/bacc/lab-e2e; phone-audit.

## Gotchas
- Headless chrome races on first page load: wait for a selector, not a fixed delay.
- innerText is uppercase for CSS-transformed headings: use /i regexes.
- tools/bacc-e2e.mjs has a pre-existing flaky '#rb' failure.
