// Texas Hold'em lessons. Each lesson: { id, title, blurb, body(h) } where h supplies card renderers.
// Written for someone who knows nothing and wants the strategy that actually wins money, in order.

const ex = (h, cards, text) => `<div class="small" style="margin:8px 0">${h.pstr(cards)} ${text}</div>`;
const sec = (t, b) => `<div class="card"><h3>${t}</h3>${b}</div>`;
const li = (items) => `<ul class="small" style="margin:6px 0 0;padding-left:18px">${items.map((i) => `<li style="margin:4px 0">${i}</li>`).join('')}</ul>`;
const tbl = (rows, head) => `<table class="evtable" style="font-size:13px">${head ? `<tr>${head.map((x) => `<td class="dim">${x}</td>`).join('')}</tr>` : ''}${rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</table>`;

export const LESSONS = [
  {
    id: 'basics', title: '1 · The game and the hand rankings', blurb: 'What you are trying to do, and which hand beats which.',
    body: (h) => `
      ${sec('The goal', `<p class="small">Texas Hold'em is played with a normal 52-card deck. Each player gets <b>two private cards</b> (hole cards). Five <b>community cards</b> are dealt face-up in the middle: three (the <b>flop</b>), then one (the <b>turn</b>), then one (the <b>river</b>). Your hand is the best <b>five cards</b> you can make from your two and the five on the board; you may use both, one or none of your hole cards.</p>
        <p class="small">You win the pot either by having the best hand at the <b>showdown</b>, or by making everyone else <b>fold</b>. The second way is why poker is a game of decisions, not just cards.</p>`)}
      ${sec('Hand rankings, best to worst', `<div style="display:grid;gap:6px">${[
        ['Royal flush', 'Ah Kh Qh Jh Th', 'A K Q J 10 of one suit'],
        ['Straight flush', '9s 8s 7s 6s 5s', 'Five in a row, one suit'],
        ['Four of a kind', 'Kh Kd Kc Ks 4d', 'Four of the same rank'],
        ['Full house', 'Qh Qd Qc 8s 8h', 'Three of one rank plus a pair'],
        ['Flush', 'Ah Jh 8h 5h 2h', 'Five of one suit, any order'],
        ['Straight', '9c 8d 7h 6s 5c', 'Five in a row, any suits (the ace plays high or low)'],
        ['Three of a kind', '7h 7d 7c Ks 2d', 'Three of the same rank'],
        ['Two pair', 'Jh Jd 4c 4s Ad', 'Two different pairs'],
        ['One pair', 'Th Td Ac 8s 3d', 'Two of the same rank'],
        ['High card', 'Ah Jd 8c 5s 2d', 'Nothing: your highest card plays'],
      ].map(([n, c, d]) => `<div class="row" style="gap:8px;align-items:center"><div style="min-width:118px"><b>${n}</b><div class="small dim">${d}</div></div>${h.pstr(c)}</div>`).join('')}</div>`)}
      ${sec('Ties and kickers', `<p class="small">Same category: the higher cards win. If two players both have a pair of aces, the next-best card (the <b>kicker</b>) decides. Suits never rank: if the best five cards are identical, the pot is split.</p>${ex(h, 'Ah Kd', 'versus')}${ex(h, 'Ac Jd', 'On a board of A♠ 8♦ 5♣ 3♥ 2♠ both pair aces; <b>king kicker beats jack kicker</b>.')}`)}
      ${sec('Five things beginners get wrong', li(['A flush beats a straight, and a full house beats a flush.', 'The ace is both the highest card and the lowest (A-2-3-4-5, the “wheel”, is the lowest straight).', 'You do not need to use your hole cards, but if the best hand is the board, you split.', 'Two pair: the higher pair is compared first.', 'Hand strength is relative to the board: a pair of nines can be great on a dry board and weak on a board of K-Q-J-10.']))}`,
  },
  {
    id: 'flow', title: '2 · How a hand flows', blurb: 'Blinds, the four betting rounds, and your options.',
    body: (h) => `
      ${sec('Blinds and the button', `<p class="small">Two players post forced bets before the cards: the <b>small blind (SB)</b> and <b>big blind (BB)</b>. The <b>dealer button</b> moves one seat left each hand, so everyone pays the blinds in turn. We measure everything in <b>big blinds (bb)</b> because the stakes do not matter to the strategy: a 100bb stack plays the same at any stakes.</p>`)}
      ${sec('The four betting rounds', tbl([['Preflop', 'Two hole cards. Action starts left of the big blind and ends with the BB.'], ['Flop', 'Three cards. Action starts with the first live player left of the button.'], ['Turn', 'Fourth card.'], ['River', 'Fifth card. Then the showdown.']]))}
      ${sec('Your options', li(['<b>Fold</b>: give up the hand and any chips already in.', '<b>Check</b>: pass, only if nobody has bet this round.', '<b>Call</b>: match the current bet.', '<b>Bet / raise</b>: put in more. A raise must be at least as big as the last bet or raise in that round.', '<b>All-in</b>: bet your whole stack.']))}
      ${sec('Worked example', `<p class="small">Blinds 0.5 / 1. You are on the button with ${h.pstr('Ad Qs')}. Three players fold to you. You <b>raise to 2.5bb</b>. The small blind folds; the big blind calls. The pot is 5.5bb (2.5 + 2.5 + the small blind's 0.5). The flop is ${h.pstr('Qh 7c 2d')}: you have top pair with the best kicker. The big blind checks. You <b>bet 3bb</b> (a bit over half the pot). He calls. The pot is 11.5bb. The turn is a ${h.pstr('4s')} and so on. Every decision follows the same questions: where am I, what do they have, how big is the pot, and what do I want to happen.</p>`)}
      ${sec('Cash game versus tournament', `<p class="small"><b>Cash game:</b> the chips are real money; you can leave when you like and reload when you lose. The practice table here is a cash game. <b>Tournament:</b> everyone pays an entry, the blinds rise on a clock, and you play until you are out. Strategy changes a lot in tournaments (see the tournament lesson); start with cash.</p>`)}`,
  },
  {
    id: 'position', title: '3 · Position: the most important idea', blurb: 'Why acting last is worth money, and the names of the seats.',
    body: (h) => `
      ${sec('Why position matters', `<p class="small">After the flop, the player <b>left of the button</b> acts first and the <b>button acts last</b>. Acting last means you see what everyone does before you decide. That information is worth real money: you can bet when they check, fold when they bet big, and control the size of the pot. Top players win mostly from the late seats and give back the least from the early ones.</p>`)}
      ${sec('The seats at a 6-player table', tbl([['UTG (under the gun)', 'First to act preflop. Worst seat: five players still to act. Play very tight.'], ['HJ (hijack)', 'Second to act. Tight.'], ['CO (cutoff)', 'Right of the button. A good seat: open up.'], ['BTN (button)', 'Best seat: acts last after the flop. Play the widest range.'], ['SB (small blind)', 'Acts first after the flop for the rest of the hand. Hard seat.'], ['BB (big blind)', 'Last to act preflop, then first after the flop. You already paid, so defend with more hands.']]))}
      ${sec('What to do about it', li(['Open fewer hands from early seats and more from late seats. The next lesson gives you the exact ranges.', 'When you are out of position, prefer to make a bet yourself or fold. Calling and then guessing is expensive.', 'When you are in position, you can call more often and “take a free card” by checking behind.', 'The same hand changes value by seat: ' + 'K♠J♦ ' + 'is a fold under the gun and a raise on the button.']))}`,
  },
  {
    id: 'preflop', title: '4 · Starting hands and preflop play', blurb: 'Which hands to play from which seat, how to raise, and how to respond to a raise.',
    body: (h) => `
      ${sec('Raise or fold: do not limp', `<p class="small">When nobody has raised, you almost always either <b>raise</b> (usually to 2.5–3 big blinds) or <b>fold</b>. “Limping” (just calling the big blind) lets the blinds see a cheap flop and leaves you without the initiative. Winning players rarely limp.</p>`)}
      ${sec('Which hands from which seat', `<p class="small">Ranges, in percent of all hands: <b>UTG ~14%</b>, <b>HJ ~18%</b>, <b>CO ~26%</b>, <b>BTN ~43%</b>, <b>SB ~40%</b> (raise-or-fold). The Ranges page shows each one on a chart you can tap. These are solid starting ranges for 6-max cash with 100bb stacks, not solver-exact numbers; they are a correct, profitable plan.</p>
        <p class="small">What makes a good hand: <b>pairs</b> (they make sets), <b>high cards that dominate</b> (A-K, A-Q), <b>suited</b> cards (about +3 points of equity: flush potential) and <b>connected</b> cards (straight potential). The worst hands are offsuit, gapped, low cards.</p>
        <a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:8px" href="#/play/poker/ranges">Open the Ranges page</a>`)}
      ${sec('Facing a raise: 3-bet, call or fold', `<p class="small">Someone raised ahead of you. Your three choices:</p>${li(['<b>3-bet</b> (re-raise): with the very best hands (QQ+, A-K) for value, and a few suited aces like A-5s as bluffs.', '<b>Call</b>: with good hands that play well after the flop (pairs 77–JJ, suited broadways, A-Q), preferably in position.', '<b>Fold</b>: the rest. A raise from early position is a strong range; a raise from the button is wider.'])}
        <p class="small">Versus a <b>3-bet or more</b>, you continue with only QQ+ and A-K, and fold nearly everything else. Many micro-stakes players 3-bet only with real hands: respect it.</p>`)}
      ${sec('Raise sizes', tbl([['Open raise', '2.5bb from the button, 3bb from other seats'], ['Isolate a limper', '3–4bb plus 1bb per limper'], ['3-bet in position', 'About 3x their raise'], ['3-bet out of position', 'About 4x their raise'], ['4-bet', 'About 2.2x their 3-bet; with 100bb this is close to all-in']]))}
      ${sec('The big blind', `<p class="small">You already have 1bb in, so you get a discount to call. Defend with many hands against a late-position raise, and fold the junk against an early-position raise. Never fold in the BB when it is free to check.</p>`)}`,
  },
  {
    id: 'odds', title: '5 · Pot odds, equity and outs', blurb: 'The math that tells you whether a call is profitable.',
    body: (h) => `
      ${sec('Equity', `<p class="small"><b>Equity</b> is your share of the pot if all the cards were dealt out now. ${h.pstr('As Ad')} against a random hand has 85% equity; ${h.pstr('7s 2d')} has about 35%. The calculator on the Tools page gives you the number for any situation.</p>`)}
      ${sec('Pot odds: the price of a call', `<p class="small">If someone bets and you must call, your price is <b>call ÷ (pot after the bet + your call)</b>. That is the equity you need. Call when your equity is higher than the price.</p>
        ${tbl([['Bet ⅓ pot', '20%'], ['Bet ½ pot', '25%'], ['Bet ⅔ pot', '29%'], ['Bet pot', '33%'], ['Bet 2× pot', '40%']], ['Their bet', 'You need'])}
        <p class="small">Example: pot is 10bb, they bet 5bb. The pot is now 15bb and you must pay 5bb: 5 ÷ (15 + 5) = <b>25%</b>. If you will win more than 25% of the time, call.</p>`)}
      ${sec('Counting outs', `<p class="small">An <b>out</b> is a card that turns a losing hand into a probable winner. Count the cards left in the deck that help you.</p>
        ${tbl([['Flush draw (4 to a flush)', '9 outs'], ['Open-ended straight draw (8-7 on 6-5-K)', '8 outs'], ['Gutshot (one card fills the gap)', '4 outs'], ['Two overcards to the board', '6 outs'], ['Flush draw + open-ended straight draw', '15 outs'], ['Flush draw + one overcard', '12 outs'], ['Flush draw + two overcards', '15 outs'], ['Set (three of a kind) to full house or better', '7 outs']], ['Draw', 'Outs'])}`)}
      ${sec('The rule of 2 and 4', `<p class="small">Quick estimate of the chance to hit: multiply your outs by <b>4</b> on the flop (two cards to come) or by <b>2</b> on the turn (one card to come). 9 outs on the flop is about 36% (exactly 35%). With more than 8 outs the “4” slightly overestimates: subtract 1 for each out over 8.</p>
        <p class="small">Compare it with the price. Flush draw on the flop facing a half-pot bet: you need 25% and have about 35%, so <b>call</b>. On the turn, the same draw has about 18% (9 × 2) against the same 25%: now you need <b>implied odds</b> (money you can win on the river when you hit) to continue.</p>`)}
      ${sec('Implied odds and reverse implied odds', `<p class="small"><b>Implied odds:</b> if you hit your draw you will win more than what is in the pot now. Strong against opponents who pay off. <b>Reverse implied odds:</b> a hand that wins small and loses big, like the weak ace that makes top pair and then loses to a better ace.</p>`)}`,
  },
  {
    id: 'postflop', title: '6 · Playing after the flop', blurb: 'Board texture, continuation bets, value bets and sizing.',
    body: (h) => `
      ${sec('Read the board first', `<p class="small"><b>Dry</b> boards have few draws: ${h.pstr('Kc 7d 2h')}. <b>Wet</b> boards have flush and straight draws: ${h.pstr('9h 8h 6c')}. Paired boards (${h.pstr('Qs Qd 4c')}) make trips and full houses less likely and favour whoever raised preflop. Your hand is strong or weak <i>relative to the board</i>.</p>
        <p class="small"><b>Bet smaller on dry boards</b> (a third to a half of the pot): few hands are drawing, so you do not need to charge them much. <b>Bet bigger on wet boards</b> (two thirds to the pot): you want drawing hands to pay a lot or fold.</p>`)}
      ${sec('The continuation bet', `<p class="small">If you raised preflop and got called, you usually have the stronger range. Betting the flop is a <b>continuation bet</b>. It works best on dry boards and heads-up; it is weaker against several opponents or on boards that connect with a caller (like ${h.pstr('8d 7d 6c')}). A good plan: c-bet with a real hand or a draw, check back weak hands that cannot call a bet, and give up on bad boards.</p>`)}
      ${sec('Value betting', `<p class="small">A <b>value bet</b> is a bet you want called by a worse hand. Ask: “what worse hands call this?”. If the answer is “none”, you are not value betting. Against loose opponents (who call too much), bet thinner and bigger. Do not slowplay on wet boards: you want to be paid before the draw hits.</p>`)}
      ${sec('Pot control', `<p class="small">With a medium-strength hand (middle pair, weak top pair) you want to <b>keep the pot small</b>: check or bet small, and avoid turning it into a big pot you will probably lose. Big pots are for strong hands.</p>`)}
      ${sec('Check-raise and check-call', `<p class="small">Out of position, checking and then raising is a strong play: use it with very strong hands and with strong draws. Check-calling is for medium hands that can win at showdown. In micro stakes, a check-raise usually means a real hand: respect it.</p>`)}
      ${sec('Knowing when to give up', `<p class="small">Not every hand deserves a bet on every street. If you bluffed the flop, got called, and the turn is a bad card, <b>stop</b>. Most money lost by beginners is chasing a hand that was beaten, calling three streets with one pair against a player who has shown strength.</p>`)}`,
  },
  {
    id: 'bluff', title: '7 · Bluffing and semi-bluffing', blurb: 'When a bluff makes money, and how often to do it.',
    body: (h) => `
      ${sec('A bluff makes money in two ways', `<p class="small">A bluff wins when they fold. A <b>semi-bluff</b> is a bluff with a draw: it wins if they fold <i>and</i> if you hit your hand. That is why strong draws are the best bluffing hands: ${h.pstr('Ah 5h')} on ${h.pstr('Kh 9h 2c')} can bet, win the pot immediately, or hit the flush.</p>`)}
      ${sec('The break-even math', `<p class="small">A bet of size B into a pot P only needs to work <b>B ÷ (P + B)</b> of the time to break even as a pure bluff. Half-pot: it must work 33%. Pot-size: 50%. If you think they fold more than that, bluff. If you think they never fold (a calling station), <b>do not bluff</b>: bet your good hands instead.</p>
        <p class="small">A balanced player bluffs only often enough that the opponent is indifferent to calling. With a bet of ⅓ pot, about 20% of your betting hands are bluffs; ½ pot, 25%; ⅔ pot, 29%; pot, 33%. At small stakes, bluff <b>less</b> than that: most opponents call too much.</p>
        ${tbl([['⅓ pot', '20%', '75%'], ['½ pot', '25%', '67%'], ['⅔ pot', '29%', '60%'], ['Pot', '33%', '50%']], ['Bet size', 'Bluffs in your bets', 'They must defend'])}`)}
      ${sec('Good bluffing spots', li(['Against <b>one</b> opponent, not three.', 'When you were the preflop raiser and the board favours your range (A-high or K-high dry flops).', 'When your hand has <b>outs</b> if called (draws) or blocks their strong hands (holding the ace of the flush suit).', 'Against thinking opponents who fold. Not against calling stations or against someone who has just called two streets.', 'When your <b>story</b> makes sense: your bets match the hand you are representing.']))}
      ${sec('Bad bluffing spots', li(['Bluffing the river with a hand that could win at showdown. Check and show it down.', 'Multiway pots. The more people, the more likely someone has it.', 'Boards that are very good for the caller.', 'Because you are bored, tilted or behind in the session.']))}`,
  },
  {
    id: 'players', title: '8 · Reading opponents and exploiting them', blurb: 'Player types, the stats that show them, and what to do about each.',
    body: (h) => `
      ${sec('The five types you will meet', tbl([
        ['Tight and passive (the nit)', 'Plays few hands, rarely raises. When they bet big, they have it. <b>Steal their blinds; fold to their aggression.</b>'],
        ['Solid regular (TAG)', 'Tight, aggressive. The standard strategy. Avoid fancy plays; use position.'],
        ['Loose and aggressive (LAG)', 'Many hands, lots of raises. They are bluffing more than average: <b>call down lighter, trap with strong hands.</b>'],
        ['Calling station', 'Plays many hands and calls too much. <b>Value bet relentlessly, almost never bluff.</b>'],
        ['Maniac', 'Raises everything. Do not bluff them; <b>let them bet into your strong hands</b> and call with medium hands.'],
      ]))}
      ${sec('Two numbers worth knowing', `<p class="small"><b>VPIP</b> (voluntarily put money in pot): the percent of hands they play. <b>PFR</b> (preflop raise): the percent they raise. A solid 6-max regular is about 22/18. A VPIP of 40+ with a low PFR is a calling station. 12/8 is a nit. 45/35 is a maniac.</p>
        <p class="small">You can estimate them by watching: how many hands do they enter, and how often do they raise?</p>`)}
      ${sec('Bet sizing tells', `<p class="small">Many weak players bet <b>small with weak hands and big with strong ones</b>, or the reverse when bluffing. Watch what they show at showdown and write it down. Timing tells matter online: an instant check-call often means a weak or drawing hand; a long think then a big raise is rarely a bluff at small stakes.</p>`)}
      ${sec('Adjust, don\'t overthink', `<p class="small">Against beginners the strategy is simple: <b>play tight and aggressive, bluff rarely, value bet a lot, and fold when they show real strength.</b> You will win more by not making mistakes than by making clever plays.</p>`)}`,
  },
  {
    id: 'money', title: '9 · Bankroll, variance and tilt', blurb: 'How to not go broke while you learn, and how to handle the swings.',
    body: (h) => `
      ${sec('Variance is large', `<p class="small">A good 6-max cash player might win <b>5 big blinds per 100 hands</b>, with a standard deviation of around <b>90 bb per 100</b>. Over 10,000 hands that is +500bb expected with a swing of ±900bb: even a winning player can be down after 10,000 hands, and downswings of 30 buy-ins happen to winners. The variance tool on the Tools page simulates it.</p>`)}
      ${sec('Bankroll rules', tbl([['Cash games', '20–30 buy-ins for the stake you play (a buy-in is 100bb). Move down when you drop below 20.'], ['Tournaments', '100+ buy-ins. They have far more variance.'], ['Beginners', 'Play the smallest stakes until you beat them. The money is for learning.']]))}
      ${sec('Session rules', li(['Set a <b>stop-loss</b> (for example 3 buy-ins) before you start, and stop when you hit it.', 'Quit when you are tired, angry or drunk: you will make mistakes you would never normally make.', 'Never chase losses with a bigger stake.', 'Use only money you can afford to lose. Poker is not an income until you have proved it at a stake over tens of thousands of hands.']))}
      ${sec('Tilt', `<p class="small"><b>Tilt</b> is playing worse because you are emotional. The usual triggers: a bad beat (losing as a big favourite), a long losing streak, a player who taunts you. The fix is a rule, not willpower: after losing a big pot, <b>stand up for five minutes</b>. If you notice you are playing hands you would normally fold, you are on tilt.</p>`)}
      ${sec('Bad beats are normal', `<p class="small">With ${h.pstr('As Ad')} against ${h.pstr('Kh Kd')} you win 82% of the time and lose 18%. That is one in five or six. Over a night, you will lose with your best hands several times. If you made the right decision, the result does not matter.</p>`)}`,
  },
  {
    id: 'tourney', title: '10 · Tournaments in a nutshell', blurb: 'What changes when you cannot rebuy and the blinds keep rising.',
    body: (h) => `
      ${sec('What is different', li(['<b>Chips are not money.</b> Doubling your stack does not double your prize, and busting costs more than a double wins (ICM). Survival matters more near the money.', 'The blinds keep rising, so your stack in big blinds shrinks. Always think in big blinds.', 'Stack depth drives strategy: deep (100bb+) like cash; mid (20–40bb) play tighter and more aggressively preflop; short (under 15bb) is push-or-fold.']))}
      ${sec('Short-stack basics', `<p class="small">At <b>10 big blinds or fewer</b>, calling a raise and playing after the flop is awkward, so the choice is usually <b>all-in or fold</b>. Roughly: from the button with 10bb you can shove with roughly the top 35–50% of hands; from early position with 10bb, roughly the top 15–25%. Treat these as rough: the ranges shrink as the stack grows and widen as it shrinks. A published push/fold chart (Nash chart) gives the exact hands; learn one when you play tournaments.</p>`)}
      ${sec('M-ratio', `<p class="small"><b>M</b> = your stack ÷ (small blind + big blind + antes). M above 10: comfortable. M 5–10: look for a chance to raise first-in. M under 5: all-in or fold, and soon.</p>`)}
      ${sec('Bubble and final table', `<p class="small">Near the prizes, big stacks pressure medium stacks, who cannot afford to gamble. Calling an all-in requires a much better hand than raising does. Do not gamble just before the money unless you are short.</p>`)}`,
  },
  {
    id: 'online', title: '11 · Playing online', blurb: 'Rake, game selection, multi-tabling and staying safe.',
    body: (h) => `
      ${sec('Rake is the real cost', `<p class="small">The room takes a cut of every pot (the <b>rake</b>), commonly around 5% up to a cap. At small stakes it is large: a winning player must first beat the rake. The calculator on the Tools page converts rake into big blinds per 100 hands. Rakeback and bonuses change the real cost; always check what the room actually charges.</p>`)}
      ${sec('Choose your game', `<p class="small"><b>Table selection is the biggest edge available to a beginner.</b> Sit where players are weak: high percent of players seeing the flop, big average pots. Leave a table full of tight regulars. If there is no fish at the table, you are the fish.</p>`)}
      ${sec('Online habits', li(['<b>Play one table</b> while you learn. Every extra table halves your attention.', 'Take notes on opponents (“calls everything”, “only bets with the nuts”). You will see the same people again.', 'Do not play tired, in a hurry, or while watching something else.', 'Time-bank decisions: the clock is there; use it on big pots.']))}
      ${sec('Sweepstakes and social poker', `<p class="small">Sites that use virtual coins in place of money can have different rake structures, and the player pool is often weaker than real-money sites. Read the terms: what is the cash-out rule, what is the rake or fee, and are the coins redeemable. Treat the practice you get here as the point.</p>`)}
      ${sec('Staying safe', li(['Collusion and bots exist. Report players who always seem to act as a team.', 'Never share your account or send money to a stranger for “coaching”.', 'Use a unique password and two-factor sign-in.']))}`,
  },
  {
    id: 'mistakes', title: '12 · The mistakes that cost the most', blurb: 'A checklist of the leaks beginners pay for, in order of cost.',
    body: (h) => `
      ${sec('Preflop', li(['Playing too many hands, especially weak offsuit hands from early seats.', 'Limping instead of raising or folding.', 'Calling raises with hands that are dominated (K-9 against a raise).', 'Not defending enough in the BB, or defending with everything.', 'Calling a 3-bet or 4-bet with hands that cannot win.']))}
      ${sec('Postflop', li(['Calling too much with one pair for three streets.', 'Bluffing calling stations.', 'Never folding top pair, even when the board and the betting say you are beaten.', 'Betting too small when a draw is possible and too big when it is not.', 'Check-calling instead of betting when you are the aggressor.', 'Slowplaying a strong hand on a wet board.']))}
      ${sec('Mental game', li(['Playing to “get even” after a loss.', 'Playing in a bad mood or when tired.', 'Judging a decision by the result instead of by the odds.', 'Playing stakes too high for the bankroll.']))}
      ${sec('A habit that fixes most of it', `<p class="small">Before each decision, ask in order: <b>1. Where am I (position)? 2. What do they have? 3. What is the pot odds or what do I need? 4. What do I want them to do?</b> The practice table asks you the same questions: use its coach until the answers come automatically.</p>`)}`,
  },
];

export const GLOSSARY = [
  ['3-bet', 'The third bet in a hand: the first re-raise after the blind and the open raise.'], ['Barrel', 'A bet on a later street. “Double barrel” = bet flop and turn.'], ['Board', 'The community cards.'],
  ['Bubble', 'The last place before the prizes in a tournament.'], ['C-bet', 'Continuation bet: a bet by the preflop raiser on the flop.'], ['Check-raise', 'Check, then raise after someone bets.'],
  ['Cooler', 'A hand where you lost with a very strong hand to an even stronger one, no way to get away.'], ['Equity', 'Your share of the pot if the cards were dealt out now.'], ['Fold equity', 'The chance they fold to your bet.'],
  ['Heads-up', 'Two players in the hand.'], ['ICM', 'A model for the cash value of tournament chips.'], ['Implied odds', 'Extra money you win after hitting a draw.'], ['Kicker', 'The side card that breaks a tie between equal pairs.'],
  ['Limp', 'Calling the big blind preflop instead of raising.'], ['Muck', 'To throw your cards away without showing.'], ['Nuts', 'The best possible hand on this board.'], ['Outs', 'Cards that improve your hand.'],
  ['Overbet', 'A bet larger than the pot.'], ['Pot odds', 'The price of a call compared with the pot.'], ['Range', 'All the hands a player could have in a spot.'], ['Rake', 'The fee the room takes from each pot.'],
  ['Semi-bluff', 'A bet with a draw: wins if they fold or if you hit.'], ['Set', 'Three of a kind using a pocket pair and one board card.'], ['Slowplay', 'Playing a strong hand passively to disguise it.'], ['Squeeze', 'A 3-bet after a raise and one or more callers.'],
  ['Tilt', 'Playing badly because you are upset.'], ['Value bet', 'A bet that wants to be called by worse hands.'], ['Villain', 'Your opponent in a hand.'], ['VPIP / PFR', 'Percent of hands played / raised preflop.'],
];

export const TIPS = [
  ['Position', 'Play more hands on the button and cutoff and fewer from early seats. Acting last is worth money on every street.'],
  ['Raise or fold', 'Do not limp. Raise to 2.5–3bb or fold.'],
  ['Defend the BB', 'You get a price discount. Defend wide against late raises, fold junk against early raises.'],
  ['3-bet for value', 'Re-raise with QQ+ and A-K. Do not 3-bet bluff against calling stations.'],
  ['Bet size = board', 'Small on dry boards, large on wet boards.'],
  ['Ask: what calls?', 'Before a value bet, name a worse hand that calls. If you cannot, check.'],
  ['Count your outs', 'Flush draw = 9, open-ended = 8, gutshot = 4. Multiply by 4 on the flop, 2 on the turn.'],
  ['Pot odds first', 'Bet half pot: you need 25%. Bet pot: 33%. Compare with your equity before you call.'],
  ['Do not bluff stations', 'If they never fold, value bet and fold to their raises.'],
  ['Fold to strength', 'At small stakes, a big river raise nearly always means a strong hand.'],
  ['Pot control', 'Medium hands play small pots. Strong hands play big pots.'],
  ['One table', 'Learn on one table. More tables multiply mistakes.'],
  ['Table selection', 'Sit with weak players. Leave when you are the weakest.'],
  ['Stop-loss', 'Decide your loss limit before you start, and stop there.'],
  ['Results are noise', 'Judge decisions, not outcomes. A bad beat is not a mistake.'],
  ['Bankroll', '20–30 buy-ins for cash; 100+ for tournaments.'],
];
