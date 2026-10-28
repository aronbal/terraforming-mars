# Computer opponent

This fork adds a computer opponent so a single player can play a normal
multiplayer game against the machine, at one of four difficulties.

## Using it

On the new-game screen, set the player count to two or more, then tick
**Computer opponent** on any seat and pick a difficulty. Seats without the tick
are played by people, so mixed games (two humans and a bot, say) work too.

| Level | Name | Plays like |
| --- | --- | --- |
| `easy` | Easy | Takes legal moves with little planning and often misjudges close calls. Badly undervalues production, so it never builds an engine. |
| `medium` | Medium | Builds production, plays what it can afford, terraforms steadily, and races milestones. Will hold back a generation to afford a card it wants. |
| `hard` | Hard | Prices its engine correctly, values tag synergies, and converts spare cash into points at the end. Watches the opponent the way a competent human does: claims a milestone before they can, funds awards only on leads they cannot close, and pushes to end the game when ahead. Saves up for big cards and sees what a card does for the rest of its hand. |
| `insane` | Insane | Everything Hard does, plus placement denial, and it plays the first action of each turn with the second in view, trying its best moves out on a copy of the game. |

## How it works

The bot is not a separate rules engine. It answers the same `PlayerInput`
objects the browser is sent, with the same `InputResponse` shape the browser
posts back, so every bot move goes through the ordinary validation path in
`Player.process`. Nothing about the bot can produce a move a human could not
have made through the UI.

### The pieces

| File | Responsibility |
| --- | --- |
| `src/common/bot/BotDifficulty.ts` | The four difficulty names, shared with the client. |
| `src/server/bot/BotProfile.ts` | The tuning knobs each difficulty sets. |
| `src/server/bot/BotBrain.ts` | Turns one `PlayerInput` into one `InputResponse`. |
| `src/server/bot/BotRunner.ts` | Drives every pending bot decision until the humans are up. |
| `src/server/bot/Attention.ts` | What the bot happens to notice in one decision. |
| `src/server/bot/PaymentPlanner.ts` | Builds a legal `Payment` for a given cost. |
| `src/server/bot/CardPayment.ts` | Works out what a menu entry costs and what may be spent on it. |
| `src/server/bot/evaluate/Values.ts` | Prices resources, production and terraform rating. |
| `src/server/bot/evaluate/CardEvaluator.ts` | Scores a card by walking its `behavior`. |
| `src/server/bot/evaluate/ActionScorer.ts` | Scores an entry in the action menu. |
| `src/server/bot/evaluate/MilestonesAndAwards.ts` | Prices claiming a milestone and funding an award. |
| `src/server/bot/evaluate/SpaceEvaluator.ts` | Scores a space for a tile. |
| `src/server/bot/BotMemory.ts` | What a bot carries from one decision to the next, saved with the game. |
| `src/server/bot/plan/RequirementForecast.ts` | When a card's requirements will be met, if ever. |
| `src/server/bot/plan/Economy.ts` | What a player has and earns towards one card. |
| `src/server/bot/plan/GoalPlanner.ts` | Picks a card to save for and prices moves against it. |
| `src/server/bot/plan/Enablers.ts` | What a card does for the other cards in hand. |
| `src/server/bot/plan/GameClone.ts` | When and how a game may be copied to try moves on. |
| `src/server/bot/plan/TurnPlanner.ts` | Plays the best moves out on a copy and scores what follows. |

### Evaluation

Everything is priced in megacredits so that engine building and point scoring
can be compared on one scale.

- A victory point is worth a fixed 5 megacredits.
- A step of production is worth its resource value once per **remaining
  generation**, estimated by extrapolating how fast Mars is being terraformed.
  This is what makes the bot invest early and stop investing late.
- A point of terraform rating is a victory point plus a megacredit of income
  per remaining generation.
- Megacredits the bot cannot plausibly spend before the game ends are worth
  less than face value, which is what stops it hoarding a treasury instead of
  buying greeneries.

Card values come from the declarative `behavior` DSL, so most of the roughly
one thousand cards are priced without any per-card code. Cards with bespoke
`play()` overrides fall back to their tags, victory points and a small
allowance, so the bot treats them as playable rather than worthless.

### Difficulty

The levels run identical code; a profile decides how much of that code's advice
the bot takes. The largest lever is `productionWeight`, which is how accurately
the bot prices its own engine — `easy` prices it at 0.4 of its true value and
therefore under-builds, the way a weak player does.

On top of that, every level but `insane` picks between options with a softmax
rather than always taking the best (`temperature` in the profile, in
megacredits: easy 4, medium 1.8, hard 0.6). A close second is picked often and
a clearly bad move almost never, so mistakes look like a person's misjudgement,
not a random click. Two options 1 M€ apart: hard takes the worse one about 16%
of the time, medium 36%. Five apart: hard practically never, medium 6%,
easy 22%.

Each bot also has a **personality** for the game (`BotPersonality.ts`): two
favourite tags whose cards it overrates, a keenness for cities and for
greeneries, and how much cash it likes to keep back. It is derived from the game
and player ids, so it is stable for the whole game and across restarts, and
different from game to game. `personality` in the profile sets how strong the
taste is: easy 0.35, medium 0.25, hard 0.15, insane 0.1.

On top of the personality, `BotStrategy.playStyleOf` gives the bot a plan for
each decision. Its two focus tags (whose cards it overrates by at least 8%) are
a weighted vote: the corporation's tags and its known style (Ecoline plants and
greeneries, Tharsis cities, PhoboLog space, and so on) count most at the start
and fade as Mars is terraformed, while every tag played (preludes and CEOs
included) and every tag in hand adds to it. When the cards do not follow the
corporation, the vote moves and so does the plan. A/B against the personality
alone over 120 games: medium 52%, hard 51%, insane 50%, so it costs nothing.
A stronger focus bonus (18%) did not make the main tags of Hard's games more
varied, which the card supply decides, and cost about 4 VP a game.

Weaker levels also miss things, the way a person does, rather than only
choosing badly among everything. `attention` is the chance the bot notices any
one option, and `Attention` draws that once per decision from the bot's own
seeded `BotRandom`:

| Level | `attention` |
| --- | --- |
| `easy` | 0.6 |
| `medium` | 0.8 |
| `hard` | 0.95 |
| `insane` | 1 |

- Each card in hand is noticed or overlooked for the whole decision. Deciding
  whether to play a card and deciding which card both read
  `ActionScorer.consideredCards`, so the bot never opens the play-a-card menu
  for a card it then overlooks. If it would overlook every card it can pay for,
  it still sees the best one. Standard projects are always seen.
- When placing a greenery, the bot either thinks about the city spaces it opens
  for the opponent or forgets about them, once for the whole placement.

At `attention` 1 nothing is drawn, so Insane plays exactly as it did before.

How much a level reads its opponent is split into three flags:

| Flag | Levels | What it does |
| --- | --- | --- |
| `watchesMilestonesAndAwards` | Hard, Insane | A milestone an opponent can claim now, or is one step short of (one tag, one city, one point of TR), is worth more to claim first: waiting risks losing its 5 VP and handing them 5 VP. On the last milestone slot any milestone the opponent can reach counts. An opponent who has passed threatens nothing. Milestones the bot cannot claim yet are not valued at all. An award is priced by how safe the lead is — margin against how fast the scores have grown and how many generations are left — and losing it counts as the opponent's 5 VP, so ties and thin early leads are not funded. With one award slot left, funding an award the bot leads is also worth the award it stops an opponent from funding. An award the opponent leads is never funded. |
| `timesTheEnd` | Hard, Insane | In the endgame, each step of temperature, oxygen or oceans is worth more when ahead on points. When behind, only the step that would finish Mars is held back; ordinary terraforming is still points. |
| `deniesPlacement` | Insane | Takes board spaces partly to keep them from the opponent. |

Everything is priced in megacredits like the rest of the evaluator. Medium and
Easy price milestones and awards on their own position alone.

### Planning

Everything above prices one decision on its own. `planning` in the profile
holds what the bot carries from one decision to the next. Each part adds a
megacredit term to the scores the evaluator already gives, before the softmax,
so it composes with the personality, the play style and `attention`.

**Memory.** A brain is built for every decision and a runner for every
request, so nothing a bot means to keep can live on either. `BotMemory` lives
on the player and is saved with the game (`SerializedPlayer.botMemory`, only
when present), so a restart or a rollback restores the memory that belongs to
that position. It is written only at the top of the bot's turn, and is
replaced rather than changed. `parseBotMemory` drops an unknown version or a
card that no longer exists.

**Requirement forecast** (`requirementForecast`, `plan/RequirementForecast.ts`).
When buying, drafting or discarding, a card whose requirements can never be
met again — a maximum already passed, too many tags, an expansion not in play —
ranks last. The engine only ever offers cards to play once their requirements
are met; before this the bot happily bought cards it could never play. The
forecast also extrapolates global parameters from the last few generations'
snapshots, which the savings goals use; it never calls a global requirement's
`satisfies`, which writes Think Tank costs onto the card.

**Savings goals** (`goals` and `goal*`, `plan/GoalPlanner.ts`,
`plan/Economy.ts`). A static evaluator spends what it has on the best thing it
can afford now, so the expensive card in hand waits behind a stream of cheaper
ones. At the top of its turn the bot may pick a hand card one to `goalMaxEta`
generations away, worth at least `goalMinNet` net of its cost after a
`goalRisk` discount per generation of waiting, and remember it. A move whose
spending pushes the goal back a generation is charged `goalCommitment` times
the value lost (all of it if the goal would miss the end of the game); spending
slack the goal does not need in time is free; income that brings the goal
forward earns `enablerWeight` times the value gained. That applies to cards and
standard projects, and as a penalty only to milestones and awards. The goal is
dropped once played, discarded, out of reach, or `goalMaxAgeSlack`
generations late, is replaced only by one better by `goalSwitchMargin`, and no
goal is set in the last generation. New candidates are noticed through
`attention`; a held goal is remembered.

**Enablers** (`enablerWeight`, `plan/Enablers.ts`). The evaluator prices each
card alone and ignores `cardDiscount`. This credits a move with what it does for
the goal and the best three other hand cards: discounts on matching cards in
hand, a tag or global minimum it meets for one of them now, and, as a penalty, a
global maximum it pushes one of them past.

**Lookahead** (`lookahead`, `plan/TurnPlanner.ts`, `plan/GameClone.ts`).
When the bot has a second action this turn, it copies the game and plays up to
`lookahead` moves out on the copy as far as the next action menu, then asks
what the best follow-up is worth there. Half the slots go to the best moves by
their own score and half to hand cards that could change what is possible (they
gain resources now, give a discount, raise a global parameter, or carry a tag a
hand card needs), because the move that opens up the turn is often weak on its
own. A move is credited with `lookaheadDiscount` times its follow-up; moves not
simulated are credited with the best other move still affordable after paying
for them. Passing and ending the turn get nothing, since they forgo the second
action. Only cards held before the move count as follow-ups, and cards that
draw or reveal cards, or whose effect is bespoke code, are never simulated, so
the copy cannot leak the real deck into the decision. `lookaheadBudgetMs` caps
the time per decision: bot moves run synchronously in the HTTP request.

The safe point for a copy is the top of an action. `Game.serialize` drops the
deferred-action queue, but at the action menu the queue is empty, and loading
a game in the action phase rebuilds that very menu, so the position survives a
round trip exactly. `canCloneSafely` checks for it (action phase, empty queue,
the bot up and at its menu, nobody else asked anything, no corporation first
action or Double Down, every player with a corporation). `cloneForLookahead`
takes the save path — serialize without the log, JSON round trip,
`Game.deserialize(…, {simulation: true})` — and a simulation never saves,
never records a result and is never marked in the cache. `GameClone.spec.ts`
checks that playing moves on a copy leaves the real game untouched and that no
call reaches `GameLoader` or the database; keep it passing.

What each level plans:

| Knob | Easy | Medium | Hard | Insane |
| --- | --- | --- | --- | --- |
| `requirementForecast` | off | on | on | on |
| `goals` | off | on | on | on |
| `goalMaxEta` / `goalMinNet` | – | 1 / 15 | 2 / 10 | 2 / 8 |
| `goalSwitchMargin` / `goalCommitment` / `goalRisk` / `goalMaxAgeSlack` | – | 0.3 / 0.5 / 0.85 / 1 | 0.3 / 0.8 / 0.88 / 2 | 0.25 / 1 / 0.9 / 2 |
| `goalGuardsResearch` | off | off | off | off |
| `enablerWeight` | 0 | 0 | 0.5 | 0.7 |
| `lookahead` / `lookaheadDiscount` / `lookaheadBudgetMs` | 0 | 0 | 0 | 4 / 0.9 / 60 |

### Robustness

A bot that cannot answer would strand its opponent, so `BotRunner` never gives
up on the first try. `Player.process` restores the pending input when it
rejects a response, which makes a refused answer recoverable, so the runner
falls back to progressively simpler legal answers — each branch of an `or`, the
minimum legal card selection, the first available space — before it gives up.
It also caps retries per input and total decisions per call, so a bug can slow
a game down but cannot spin the server.

## Checking the difficulty ladder

`src/server/tools/bot_tournament.ts` plays the levels against each other and
reports win rates. Run it after changing anything in the evaluator:

```bash
npx tsx src/server/tools/bot_tournament.ts 60
```

Results from 60 games per pairing, seats alternated, with planning in place:

```
medium  vs easy     medium wins 59/60 ( 98%)  avg generations 17.4
hard    vs easy     hard wins   60/60 (100%)  avg generations 16.2
insane  vs easy     insane wins 60/60 (100%)  avg generations 16.4
hard    vs medium   hard wins   41/60 ( 68%)  avg generations 15.6
insane  vs medium   insane wins 47/60 ( 78%)  avg generations 15.2
insane  vs hard     insane wins 35/60 ( 58%)  avg generations 14.9
```

**Every ladder and A/B result before the planning work was measured on a single
deal.** `SeededRandom` expects a seed in [0, 1) and multiplies it by 2^32, which
wraps to 0 for every whole number, so the tournament's seeds 1, 2, 3… all dealt
the same corporations (Interplanetary Cinematics and Saturn Systems), the same
cards and the same board; only the bots' own randomness and personality
differed. In that one deal the second seat won almost every bot-versus-bot game
by about 25 VP. `deckSeed` now gives each seed its own deal. The older numbers
in this document are kept as they were recorded; read them as one deal's. On
that deal, before planning, the ladder read medium over easy 90%, hard over easy
and insane over easy 100%, hard over medium 68% (137/200 over 200 games before
Hard watched the opponent), insane over medium 73%, and insane over hard 57%.

To compare two versions of one level, play every seed twice with the seats
swapped:

```bash
npx tsx src/server/tools/bot_tournament.ts ab 200 insane planning.lookahead=4 vs planning.lookahead=0
```

Settings before `vs` change side A, after it side B. It reports the win rate
with a 95% interval and, more usefully, the **paired VP difference per seed
with its standard error**: two bots of one level are close, the deal decides
most games, and the paired difference cancels the deal. Win rates between two
versions of one level barely move even when the VP difference is several
standard errors. It also reports cash left at the end, big cards played, and
the planning counters from `BotMemory`. `src/server/tools/bot_clone_bench.ts`
times copying the game and a whole decision with and without lookahead.

The ladder now has four tiers. Insane's edge over Hard is the lookahead, worth
about 2.5 VP a game on top of everything Hard does, so it shows as 58% rather
than as a rout: two strong bots are close, and the deal still decides most
games.

Bot-versus-bot games run about 14 to 16 generations, longer than a typical human
game, because two cautious bots terraform more slowly than a human pushing to
close the game out.

## What has already been tried, and failed

Do not spend time re-deriving these. Each was implemented and measured over
80-120 games of `insane` against `hard`, and none beat the 50% baseline:

| Idea | Result |
| --- | --- |
| Buy cards on value with a margin, instead of to a quota | **44%** — actively harmful. More cards beats fewer: the play threshold already filters what gets played, so extra options are worth more than the 3 M€. |
| Price steel and titanium by whether the hand holds cards that can spend them | 49% — no effect. |
| Both of the above together | **32%** — clearly worse. |
| Value a greenery by adjacency to the player's own cities at decision time | 44% — no effect. Placement already picks good spaces once the greenery is bought. |
| Raise or lower the card buy rate (0.45, 0.6, 0.85, 1.0) | 49-56% — all inside the noise band. |
| Heavier engine weighting, zero cash reserve, more aggressive closing | 49-51% — all inside the noise band. |

One change that measured as no effect between bots was kept anyway, because it
fixes something a human exploits: a city is priced by the best space actually
open for it, counting every adjacent greenery whoever owns it, and a greenery
is charged for the city spaces it makes more attractive to the opponent. Before
that, the bot valued a city at a flat few megacredits, almost never bought the
standard project, ignored the opponent's forests, and ringed open spaces with
greeneries for the human to drop a city into. Measured over 120 games each
against the previous version: 49% at Hard, 53% at Medium, 50% at Insane.

Giving Hard the opponent-reading flags is the same kind of change. Measured
over 320 games of the new Hard against the previous Hard (which ignored the
opponent): 54% overall. Milestones and awards alone measured 51-54%, and
gained the new Hard about 1 VP per game from awards. The first version of
`timesTheEnd` — which held back *every* endgame terraforming step when behind,
and even counted greeneries after oxygen was maxed — measured 45-46%, because a
bot that is behind gives up TR while the leader closes the game anyway; the
current version only refuses the step that finishes Mars and measured 48-50%.
The ladder is otherwise unchanged: on the same 60 seeds per pairing, Hard over
Medium went from 58% to 63%, and Insane over Hard from 57% to 53%, both inside
the noise band.

### Planning, measured

Each row is 200 seeds played both ways (400 games), on proper deals, as paired
VP difference ± standard error. Unless noted, on top of origin/main with
softmax, play style, `attention` and the opponent flags.

| Change | Level | Wins | Paired VP |
| --- | --- | --- | --- |
| Price a bought card for when its requirements will be met (probability × value with that many fewer generations left) | Insane | 44.8% | **−3.06 ± 0.80** — harmful |
| Same | Hard | 44.9% | **−2.57 ± 0.78** — harmful |
| Same, but buying as many cards as before | Insane / Hard | 45.4% / 46.9% | −2.43 ± 0.78 / −1.96 ± 0.77 — harmful |
| Only sink cards that can never be played (kept) | Insane | 50.1% | +0.04 ± 0.19 |
| Same | Hard | 49.1% | +0.03 ± 0.37 |
| Same | Medium | 47.3% | −0.58 ± 0.55 |
| Savings goals (Insane's settings) | Insane | 57.5% | **+2.68 ± 0.67** |
| Savings goals (Hard's settings) | Hard | 54.9% | **+2.64 ± 0.67** |
| Savings goals (Medium's settings) | Medium | 48.8% | +1.13 ± 0.94 |
| Enablers, weight 0.7 | Insane | 51.9% | **+1.72 ± 0.43** |
| Enablers, weight 0.5 | Hard | 50.0% | +0.34 ± 0.44 |
| `goalGuardsResearch` on top of Insane's goals and enablers | Insane | 51.6% | +0.48 ± 0.54 — left off |
| Forecast, goals and enablers together vs none | Insane | 56.6% | **+2.94 ± 0.64** |
| Same | Hard | 55.9% | **+2.88 ± 0.74** |
| Forecast and goals together vs none | Medium | 49.8% | +1.38 ± 0.90 |
| Lookahead 4 vs 0 | Insane | 57.1% | **+3.98 ± 0.64** |
| Lookahead 4 vs 0, both with forecast, goals and enablers | Insane | 53.5% | **+2.52 ± 0.67** |

Before the merge with origin/main the goals measured +1.75 ± 0.72 (Insane's
settings) and +1.99 ± 0.62 (Medium's settings) at Insane, +2.04 ± 0.70 at Hard
and +0.65 ± 0.71 at Medium. A first version that charged a goal's whole risk
discount for every generation of delay, screened on the single tournament deal,
cost Insane 3-4 VP a game.

Three things were switched on although they measure as no effect: sinking
unplayable cards at every level from Medium up, because buying a card the
engine will never offer is a blunder a person sees; goals at Medium, because
saving up for a card is what a medium player does; and enablers at Hard,
because they fix a misjudgement a person sees (pricing Earth Office without the
Earth cards in hand).

At n=100 the standard error is about 5 points, so nothing under roughly 60% is
a real effect.

The conclusion was that **parameter tuning is exhausted**: once a level prices
the game accurately, sharpening the same knobs does nothing, and a stronger
fourth tier needed a structural capability. Planning across decisions — saving
for a card, and trying the first action of a turn out on a copy of the game —
is that capability, and it measures as real. Copying was not blocked after all:
the deferred-action queue that `Game.serialize` drops is always empty at the
top of an action, which is the one point the lookahead copies from.

## Tests

`tests/bot/SelfPlay.spec.ts` is the load-bearing test: it plays a full
two-player game at every difficulty and asserts the game reaches `Phase.END`.
If the bot cannot answer some input, the run stops early and the test fails.

`tests/bot/GameClone.spec.ts` guards the lookahead: a copy is the same
position, playing moves on it leaves the real game's state, log, timers and
pending input untouched, and nothing done to a copy reaches `GameLoader` or the
database, even played to the end. Do not turn the lookahead on anywhere it
fails.
