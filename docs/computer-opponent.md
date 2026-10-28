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
| `medium` | Medium | Builds production, plays what it can afford, terraforms steadily, and races milestones. |
| `hard` | Hard | Prices its engine correctly, values tag synergies, and converts spare cash into points at the end. Watches the opponent the way a competent human does: claims a milestone before they can, funds awards only on leads they cannot close, and pushes to end the game when ahead. |
| `insane` | Insane | Everything Hard does, plus placement denial. Measures as roughly even with Hard — see the ladder below. |

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

There is no tree search. Cloning a game to try moves is not reliable here,
because `Game.serialize` deliberately drops the deferred-action queue, so a
clone taken mid-action is not the position it came from. The bot is a tuned
static evaluator instead.

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

Results from 60 games per pairing, seats alternated, with softmax, personality,
corporation strategy, `attention` and Hard watching the opponent in place:

```
medium  vs easy     medium wins 54/60 ( 90%)
hard    vs easy     hard wins   60/60 (100%)
insane  vs easy     insane wins 60/60 (100%)
hard    vs medium   hard wins   41/60 ( 68%)
insane  vs medium   insane wins 44/60 ( 73%)
insane  vs hard     insane wins 34/60 ( 57%)
```

Before Hard watched the opponent, hard versus medium came out at 137/200 (68%)
over 200 games, so a single 60-game run can swing by about six points either way.

**Read this honestly: there are three distinct tiers, not four.** `easy` is far
weaker than everything, `hard` beats `medium` reliably, and `insane` is a coin
flip against `hard`. Insane differs from Hard in placement denial and slightly
sharper knobs, and against another bot that plays just as well, denial mostly
cancels out.

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

At n=100 the standard error is about 5 points, so nothing under roughly 60% is
a real effect.

The conclusion is that **parameter tuning is exhausted**: once a level prices
the game accurately, sharpening the same knobs does nothing. A genuinely
stronger fourth tier needs a structural capability the evaluator does not have,
most plausibly turn-level planning — choosing the best *pair* of actions rather
than the best single action twice, so the bot can play a cheap production card
to make an expensive one affordable in the same turn. That needs simulation,
and the obvious route is blocked: `Game.serialize` deliberately drops the
deferred-action queue, so a clone taken mid-action is not the position it came
from. Any attempt should start by solving that.

## Tests

`tests/bot/SelfPlay.spec.ts` is the load-bearing test: it plays a full
two-player game at every difficulty and asserts the game reaches `Phase.END`.
If the bot cannot answer some input, the run stops early and the test fails.
