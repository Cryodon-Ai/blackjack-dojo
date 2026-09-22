// The nine-tier curriculum (plus certification). Every number in lesson text is a {{token}} the
// engine resolves at render time, and every strategy statement is listed in claims.js and verified.

export const TIERS = [
  {
    id: 0, title: 'Table Literacy', sub: 'Values, hard vs soft, the sequence of a hand, what each action does, payouts',
    kind: 'quiz', gen: 't0',
    outcome: 'You can narrate a hand out loud, correctly.',
    lessons: [
      { t: 'The only goal', html: `<p>You and the dealer each try to finish <b>closer to 21 without going over</b>. Go over and you <b>bust</b> — you lose immediately, even if the dealer would have busted later.</p><p>Number cards are worth their number. <b>J, Q, K = 10.</b> An <b>Ace is 1 or 11</b>, whichever helps.</p>` },
      { t: 'Hard vs soft', html: `<p>A hand with an Ace counted as <b>11</b> is <b>soft</b>. A,6 is <b>soft 17</b>, shown as <span class="hl">7 / 17</span>. A soft hand <b>cannot bust on one more card</b> — that one fact powers Tier 3.</p><p>Any hand without an 11-Ace is <b>hard</b>: 10,6 is hard 16.</p>` },
      { t: 'The sequence of a hand', html: `<p><b>1.</b> You bet. <b>2.</b> Two cards to you, one card up and one down for the dealer. <b>3.</b> If the dealer shows an Ace or ten, the dealer <b>peeks</b> for blackjack first. <b>4.</b> You act, one hand at a time. <b>5.</b> The dealer plays by fixed rules. <b>6.</b> Payouts.</p>` },
      { t: 'Your five actions', html: `<p><b>Hit</b> — one more card, then choose again.<br><b>Stand</b> — keep your total.<br><b>Double</b> — double the bet, exactly one card, first two cards only.<br><b>Split</b> — a pair becomes two hands, each with its own bet.<br><b>Surrender</b> — give up half your bet (only where offered, first two cards).</p><p class="dim small">The action bar dims anything not currently legal. Long-press a dimmed button to see why.</p>` },
      { t: 'The dealer has no choices', html: `<p>The dealer <b>hits 16 or less and stands on 17 or more</b>. Soft 17 is the only wrinkle: at an <b>S17</b> table the dealer stands on it; at an <b>H17</b> table the dealer hits it. H17 costs you about <span class="hl">0.2%</span> of everything you wager — prefer S17.</p>` },
      { t: 'What blackjack pays', html: `<p>A natural (Ace + ten-value, first two cards) pays <b>3:2</b>: a $10 bet wins $15. Some tables pay <b>6:5</b> — the same $10 wins $12. That "small" change costs you about <span class="hl">{{cost65}}</span> of your total action, more than every other rule difference combined.</p><p>Equal totals <b>push</b>: your bet comes back.</p>` },
    ],
    guided: [],
  },
  {
    id: 1, title: "The Dealer's Weakness", sub: 'Bust probabilities: the mental model behind every chart cell',
    kind: 'quiz', gen: 't1',
    outcome: 'You stop asking "how do I reach 21?" and start asking "will the dealer break?".',
    lessons: [
      { t: 'The dealer plays a fixed script', html: `<p>Because dealers must follow one script, every upcard has fixed odds of how the hand finishes. These are exact, computed for this table, not rules of thumb:</p>{{bars}}<p class="dim small">Chance the dealer busts, by upcard (dealer has no blackjack).</p>` },
      { t: 'Breaking cards and pat cards', html: `<p><b>2–6 are breaking cards.</b> The dealer's most likely start is a stiff hand that has to draw: a 6 busts <span class="hl">{{bust1:6}}</span>, a 5 busts <span class="hl">{{bust1:5}}</span>.</p><p><b>7–A are pat cards.</b> A 7 busts only {{bust:7}}, a 10 {{bust:10}}, an Ace {{bust:A}}. Those dealers usually finish with 17–20 and you have to beat them.</p>` },
      { t: 'The one organizing idea', html: `<p class="lesson"><b>You are not trying to get 21. You are betting on whether the dealer busts.</b></p><p>Everything else is a corollary. Against a breaking card you avoid busting yourself and let the dealer take the risk. Against a pat card you must build a real hand. Doubling and splitting? You do them when the dealer is weak and you can put more money on that weakness.</p>` },
      { t: 'Where the dealer finishes', html: `<p>Against a <b>7</b> the dealer most often ends on 17 (<span class="hl">{{fin:7:17}}</span>). Against a <b>10</b> the most common finish is 20 (<span class="hl">{{fin:10:20}}</span>). Against a <b>6</b> no total is common — 17 comes up only {{fin:6:17}} — because <b>busting is the single most likely outcome ({{bust:6}})</b>. When you know where the dealer finishes, you know what your total has to beat.</p>` },
    ],
    guided: [
      { rowKey: 'H16', up: 6, hint: `Dealer 6 busts {{bust:6}}. Your 16 busts {{pbust:16:6}} if you hit. Who should take the risk?` },
      { rowKey: 'H16', up: 10, hint: `Dealer 10 busts only {{bust:10}}. Standing on 16 wins just {{win:16:10}} of the time.` },
      { rowKey: 'H13', up: 5, hint: `A 5 is a top breaking card ({{bust:5}}). Let them break.` },
    ],
  },
  {
    id: 2, title: 'Hard Totals', sub: 'Four rules instead of sixty cells', kind: 'cells', pool: 'hard',
    outcome: 'Hard totals from four rules, not a chart.',
    lessons: [
      { t: 'Rule 1 — 17 and up: stand', html: `<p>From hard 17 every hit has a large chance to bust and almost nothing to gain. A hit on hard 17 busts {{pbust:17:10}}.</p>` },
      { t: 'Rule 2 — 11 and below: never stand', html: `<p>You cannot bust on one card from 11 or less, so a hit can only help. Standing on 8 against a 6 wins just {{win:8:6}} of the time.</p>` },
      { t: 'Rule 3 — the stiff zone (12–16)', html: `<p><b>Stand against 2–6. Hit against 7–A.</b></p><p>16 vs a 6: dealer busts {{bust:6}}; your hit busts {{pbust:16:6}} — stand ({{ev:H16:6:stand}} vs {{ev:H16:6:hit}}). 16 vs a 10: the dealer busts only {{bust:10}} — hitting ({{ev:H16:10:hit}}) barely beats standing ({{ev:H16:10:stand}}), and at this table surrendering ({{ev:H16:10:surrender}}) beats both.</p>` },
      { t: 'The one exception: 12 vs 2 and 3', html: `<p>A 2 and a 3 bust {{bust1:2}} and {{bust1:3}} — the weakest of the breaking cards. And a hit on 12 busts only {{pbust:12:2}} (just the tens). So <b>hit 12 against 2 and 3</b>: {{ev:H12:2:hit}} vs {{ev:H12:2:stand}} standing. Stand from 12 against 4, 5, 6.</p>` },
      { t: 'Rule 4 — double when the dealer is weak and you are strong', html: `<p><b>11:</b> any ten makes 21. Double vs 2–10 ({{ev:H11:6:double}} against a 6). <b>10:</b> double vs 2–9. <b>9:</b> double vs 3–6 only — against a 2 the dealer is too strong ({{ev:H9:2:hit}} hitting beats {{ev:H9:2:double}} doubling). 11 vs an Ace: just hit at an S17 table.</p>` },
    ],
    guided: [
      { rowKey: 'H12', up: 3, hint: `12 is the one stiff hand that hits vs a 3. Dealer 3 busts {{bust1:3}}; your hit busts {{pbust:12:3}}.` },
      { rowKey: 'H11', up: 6, hint: `Any ten makes 21, and the dealer's 6 busts {{bust:6}}. Put more money out.` },
      { rowKey: 'H9', up: 2, hint: `Doubling 9 against 2 is a trap: the dealer's 2 is too strong.` },
      { rowKey: 'H15', up: 7, hint: `A 7 busts only {{bust:7}}. You have to improve.` },
    ],
  },
  {
    id: 3, title: 'Soft Totals', sub: 'A hand that cannot bust on one card', kind: 'cells', pool: 'soft',
    outcome: 'You know why soft hands double, and why A,7 is a trap.',
    lessons: [
      { t: 'Why soft hands are different', html: `<p>A,6 (soft 17) can take any card without busting: it just becomes a hard total. So <b>the risk of hitting is nearly gone</b>, and what is left is the upside — which is why soft hands double against weak dealers.</p>` },
      { t: 'The soft doubling ladder', html: `<p>The weaker your soft hand, the weaker the dealer needs to be. <b>A,6 doubles vs 3–6. A,4 and A,5 double vs 4–6. A,2 and A,3 double vs 5–6.</b> If doubling is off, you hit.</p>` },
      { t: 'The trap: soft 18', html: `<p>A,7 looks like a good hand, and against a 2, 7 or 8 <b>you stand</b>. Against a 3–6 you <b>double</b>. But against a <b>9, 10 or Ace you hit</b>: those dealers finish on 19 or better often enough ({{finge:9:19}} for a 9) that standing on 18 wins only {{win:18:9}} of the time. Hit: {{ev:A7:9:hit}} vs stand: {{ev:A7:9:stand}}.</p>` },
      { t: 'Soft 19 and up: stand', html: `<p>A,8 and A,9 are already strong ({{ev:A8:10:stand}} vs a 10). At an S17 table you stand on all of them.</p>` },
    ],
    guided: [
      { rowKey: 'A7', up: 9, hint: `The classic trap: A,7 vs 9 hits. A soft hand can't bust on one card and 18 wins only {{win:18:9}}.` },
      { rowKey: 'A6', up: 4, hint: `A soft 17 can't bust and a 4 busts {{bust:4}} — double.` },
      { rowKey: 'A7', up: 7, hint: `18 beats a dealer 7's likely 17. Stand.` },
    ],
  },
  {
    id: 4, title: 'Pairs', sub: 'When two hands beat one', kind: 'cells', pool: 'pairs',
    outcome: 'You split by reasons, not by memory.',
    lessons: [
      { t: 'Always split A,A and 8,8', html: `<p>A,A is a soft 12 — a poor hand; each Ace alone starts at 11. 8,8 is 16, the worst total in the game; split, each 8 starts a workable 8. Even against a 10, splitting 8s loses less ({{ev:88:10:split}}) than hitting ({{ev:88:10:hit}}).</p>` },
      { t: 'Never split 10s, 5s, or (mostly) 4s', html: `<p>20 wins {{win:20:6}} of the time even against a 6 — never split it. 5,5 is a <b>10</b>, the best doubling hand: double vs 2–9. 4,4 is a poor 8 to split; split only vs 5–6 where DAS makes it worth it.</p>` },
      { t: 'Conditional splits against breaking cards', html: `<p><b>2,2 and 3,3: split vs 2–7. 6,6: split vs 2–6. 7,7: split vs 2–7. 9,9: split vs 2–6 and 8–9, stand vs 7, 10, A</b> (18 already beats a dealer 7's likely 17: {{win:18:7}} wins).</p>` },
      { t: 'What DAS changes', html: `<p><b>DAS</b> (double after split) makes small splits more valuable because a good second card can be doubled. Without it, 2,2 and 3,3 split only vs 4–7, 4,4 is never split, and 6,6 stops splitting vs a 2. The Reference game allows DAS; Tier 6 shows what a missing DAS costs you.</p>` },
    ],
    guided: [
      { rowKey: '88', up: 10, hint: `16 vs a 10 is the worst spot in the game. Even here, two 8s beat one 16.` },
      { rowKey: '99', up: 7, hint: `18 already beats what a dealer 7 usually makes (17).` },
      { rowKey: '55', up: 6, hint: `5,5 is a 10, not two 5s. What do you do with 10?` },
    ],
  },
  {
    id: 5, title: 'Surrender & Insurance', sub: 'Cutting losses, and the offers you always refuse', kind: 'mixed', pool: 'surrender',
    outcome: 'You surrender the right hands, and you decline every insurance offer without thinking.',
    lessons: [
      { t: 'Late surrender', html: `<p>Surrender gives back exactly <b>half</b> your bet (−50%). It is right when playing the hand loses <i>more than 50%</i> on average: <b>16 vs 9, 10, A</b> and <b>15 vs 10</b>. Hard 16 vs a 10: hit is {{ev:H16:10:hit}}, stand {{ev:H16:10:stand}}, surrender −50.0%. At a table with H17 the list grows: 15 and 17 vs an Ace.</p><p class="dim small">Not every table offers it, and it is worth only about 0.08% of your action — but the chart cells are free.</p>` },
      { t: 'Insurance, done right', html: `<p>Insurance costs half your bet and pays 2:1 if the dealer has blackjack. With no information about the hole card, {{ins}} of every insurance dollar is lost — a <b>7% house edge</b> on a separate bet, on top of the hand.</p>` },
      { t: 'Even money is insurance', html: `<p>"Even money" on your blackjack against a dealer Ace <i>is</i> insurance on your natural. Playing on is worth more than a flat 1.00 per $1 (you win 1.5 unless the dealer has blackjack ~31% of the time: 1.04 expected). <b>Decline. Always.</b></p>` },
      { t: 'The permanent rule', html: `<p><b>Insurance, even money, and every side bet are never correct for you.</b> This is not a warning; it is a routine. The drills mix these offers into hands so refusing becomes a reflex.</p>` },
    ],
    guided: [
      { rowKey: 'H16', up: 10, hint: `Surrender loses 50%. What does playing 16 vs 10 lose? ({{ev:H16:10:hit}}, {{ev:H16:10:stand}})` },
      { rowKey: 'H15', up: 10, hint: `Same idea: 15 vs 10 loses more than half the time on average.` },
      { rowKey: 'H16', up: 8, hint: `16 vs 8: hitting beats surrendering. Only 9, 10 and A are surrender spots.` },
    ],
  },
  {
    id: 6, title: 'Rule-Set Fluency', sub: 'Game selection: read a rules panel like a contract', kind: 'quiz', gen: 't6', secs: 5,
    outcome: 'Shown any two tables you pick the better in under 5 seconds and know what being wrong costs.',
    lessons: [
      { t: 'The rules are the price', html: `<p>Perfect strategy at the <b>Reference</b> game (6 decks, S17, DAS, late surrender) costs about <span class="hl">{{edge:reference}}</span> of your action. At a <b>table to avoid</b> (H17, 6:5, doubling limits) it is <span class="hl">{{edge:bad-table}}</span>. Same cards, same skill, very different price.</p><p><b>Playing well never makes blackjack a winning game.</b> Perfect play turns a roughly 2% bleed into a roughly 0.4% bleed. Game selection makes the bleed smaller; it does not make it positive.</p>` },
      { t: 'What each rule costs (live from the engine)', html: `<div id="rulecosts" class="dim small">Computing…</div>` },
      { t: 'How to read a panel fast', html: `<p>Scan in this order: <b>1)</b> Blackjack pays 3:2 or 6:5 (6:5 is the table-killer). <b>2)</b> Dealer S17 vs H17. <b>3)</b> Doubling: any two cards? DAS? <b>4)</b> Surrender, peek vs no-hole-card. <b>5)</b> Decks. Anything else is small.</p>` },
      { t: 'The chart, finally', html: `<p>Now that you know why, here is the whole chart for the game you're playing — as something to <i>check yourself against</i>, not memorize from.</p><a class="btn primary block" href="#/stats/chart">Open the full chart</a>` },
    ],
    guided: [],
  },
  {
    id: 7, title: 'Variants & Side Bets', sub: 'The two games you actually play: normal digital blackjack and Gravity Blackjack', kind: 'quiz', gen: 't7', secs: 4,
    outcome: 'You know exactly what changes at each of your two tables, and you decline every side bet under pressure.',
    lessons: [
      { t: 'Normal digital blackjack', html: `<p>An ordinary RNG or live-dealer table, fresh shuffle every hand: this is the <b>Normal digital blackjack</b> preset (8 decks · S17 · DAS · peek · 3:2) — everything Tiers 0–6 already taught applies directly, no adjustment needed. Perfect basic strategy here costs about <span class="hl">{{edge:typical-online}}</span> of your action.</p><p class="dim small">Card counting is worthless on a table that reshuffles every hand — there is no depleted shoe to track.</p>` },
      { t: 'Gravity Blackjack: the multiplier', html: `<p><b>Gravity Blackjack</b> (ICONIC21) deals a normal hand, but after bets lock a random <b>multiplier (2×–10×) may drop onto one of its four side bets</b> — never onto your main bet. To pay for that feature, its base side-bet paytables are cut below a typical standalone table's.</p>` },
      { t: 'Gravity Blackjack: the rule that changes strategy', html: `<p>Most peek tables check the hole card for blackjack whenever the dealer shows an <b>Ace or a Ten</b>. Gravity Blackjack peeks <b>only on an Ace</b> — a Ten-up dealer blackjack is revealed only <i>after</i> you've already acted. That is why two plays change from a standard peek table: <b>hard 11 vs 10</b> and <b>8,8 vs 10</b> hit instead of doubling or splitting, because a hidden dealer blackjack would take the extra wager too. Everything else in Tiers 2–4 still applies unchanged — decks are 8, dealer stands on soft 17, DAS is on, but only <b>one split</b> is allowed and there's no surrender.</p>` },
      { t: 'Gravity Blackjack: side bets, computed', html: `<p>Against its own paytables, before any multiplier lands: <b>Perfect Pairs</b> {{gside:pp:edge}} house edge (hits {{gside:pp:hit}}); <b>21+3</b> {{gside:t213:edge}} (hits {{gside:t213:hit}}); <b>Lucky Ladies</b> {{gside:ll:edge}} (hits {{gside:ll:hit}}); <b>Dealer Bust</b> {{gside:bust:edge}} (hits {{gside:bust:hit}}) <span class="pill">Dealer Bust is a simulated estimate — no exact formula is implemented for it here</span>. The main game costs about {{edge:gravity}}. A multiplier only boosts the rare hand it lands on; it never changes how often that hand hits, so the game's own advertised RTPs after multipliers (95.95% / 96.38% / 94.58% / 93.20%) are still all worse than the main bet by a wide margin. Decline every one of them.</p>` },
    ],
    guided: [],
  },
  {
    id: 8, title: 'Money & Mind', sub: 'Variance, bankroll, bonuses, tilt', kind: 'quiz', gen: 't8',
    outcome: 'A losing session is not a strategy failure; a bonus is worth exactly what its contribution rate says.',
    lessons: [
      { t: 'Variance vs edge', html: `<p>Perfect play at the Reference game costs about {{edge:reference}} per dollar — on 10,000 hands at $10 that is ~$330 expected loss. But a single hand swings by about 1.14 bets, so <b>10,000 hands swing by ~$1,140</b>. A perfect player finishes <i>ahead</i> in a large share of 10,000-hand runs. Run the simulation below.</p><a class="btn block" href="#/play/variance">Run the 10,000-hand simulation</a>` },
      { t: 'Bet sizing & loss limits', html: `<p>Size bets so that a normal bad run cannot end your session: a common professional rule is 1% or less of your session bankroll per hand. Set a <b>session loss limit before you start</b>; the app will remind you when you hit it. The stop-rule is a routine, not a warning.</p>` },
      { t: 'Bonus playthrough math', html: `<p>Expected value ≈ <b>bonus − (bonus × playthrough ÷ contribution) × house edge</b>. Table games often contribute <b>10–20%</b> or are excluded entirely — that one number decides whether a bonus is worth touching. Use the calculator.</p><a class="btn block" href="#/play/bonus">Open the bonus calculator</a>` },
      { t: 'Tilt patterns', html: `<p><b>Loss chasing</b>, <b>bet escalation after a loss</b>, <b>Martingale</b>, <b>"due" thinking</b>, and <b>house-money bets</b> all feel like strategy and all are just bigger bets. The simulator shows Martingale's ruin math.</p><a class="btn block" href="#/play/martingale">See Martingale ruin</a>` },
    ],
    guided: [],
  },
  {
    id: 9, title: 'Certification', sub: '100 random hands · random rules · 3 s each · no chart · ≥ 99%', kind: 'cert',
    outcome: 'A dated certificate with your exact per-hand error cost.',
    lessons: [], guided: [],
  },
];

export const TIER = Object.fromEntries(TIERS.map((t) => [t.id, t]));
