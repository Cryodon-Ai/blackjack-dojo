# Handoff: Blackjack Dojo (state as of 2026-11-10)

Repo: ~/blackjack-dojo (GitHub Cryodon-Ai/blackjack-dojo, main). Offline PWA, vanilla JS, no build step.
Always run `node tools/stamp.js` before committing/deploying (service-worker cache).

## Done and pushed to main
Counting Pro, baccarat strategy page, Texas Hold'em teacher (+ merged Video Poker from another branch).

## Done locally, committed, NOT pushed (as of this file)
- Coach tab (screens/coach.js, app/guard.js, app/weak.js, app/voice.js): plan, leak report, belts, session ritual,
  real results, cost of play, help, cheat cards.
- Counting systems / ace side count / deck estimation (games/countsystems.js).
- Ask the Coach: offline "brain" (app/brain/kb.js, app/brain/brain.js, screens/ask.js): parses hands/counts/cards,
  computes with the solvers, 3 explanation levels, BM25 over KB + lessons. Floating "Ask" button.
Tests: tools/idx-test.mjs, poker-test.mjs, holdem-test.mjs, bacc-test.mjs, vp-test.mjs (node);
tools/count-e2e.mjs, poker-e2e.mjs, coach-e2e.mjs, ask-e2e.mjs (headless: CHROME=... PW=... node tools/X.mjs).

## Still to do (from the 59-idea list), in priority order
1. Solved index tables for the user's exact rules: engine/indexsolve.js exists and matches published within +-1 for
   most rows (12v2 outlier: keep published if |diff|>2). Needs: worker op + screen + override in engine/indices.js idxOf.
2. Bankroll/Kelly tool page, table scout log, back-counting (wong) option in engine/countsim.js, distraction/audio mode
   in games/count.js speed trainer, "Negative-index" + insurance cards in the index drill.
3. Baccarat: road-reading drills (Big Eye/Small/Cockroach), speed ladder, temptation trap mode, table chooser.
4. Poker: postflop spot trainer, bluff-catcher/MDF drill, blocker + board-texture drills, HU Nash push/fold + ICM
   calculator (precompute 169x169 equity matrix to data/), formats (HU/3-max/stack depths), opponent stats (VPIP/PFR
   from table bots), hand review with equity per street, tilt trainer.
5. Three Card Poker trainer; house-edge ladder already in Coach > Cost of play.
6. Real iPhone test pass (install flow, offline, keyboard over inputs).
Skipped on purpose: AI chat via cloud API (offline brain replaces it), hand-history import, share-challenge links,
Blackjack variants (Free Bet, Spanish 21, Switch) solvers (big).

## Gotchas
- Headless chrome races on first page load: wait for a selector, not a fixed delay.
- innerText is uppercase for CSS-transformed headings: use /i regexes.
- tools/bacc-e2e.mjs has a pre-existing flaky '#rb' failure.
