# Computer opponent

This fork adds a computer opponent so a single player can play a normal
multiplayer game against the machine, at one of four difficulties.

## Using it

On the new-game screen, set the player count to two or more, then tick
**Computer opponent** on any seat and pick a difficulty. Seats without the tick
are played by people, so mixed games (two humans and a bot, say) work too.

| Level | Name | Plays like |
| --- | --- | --- |
| `easy` | Beginner | Takes legal moves with little planning. Badly undervalues production, so it never builds an engine. |
| `medium` | Engineer | Builds production, plays what it can afford, terraforms steadily, and races milestones. |
| `hard` | Veteran | Prices its engine correctly, values tag synergies, and converts spare cash into points at the end. |
| `insane` | Director | Everything Veteran does, plus placement denial and timing the final generation around who is ahead. Measures as roughly even with Veteran — see the ladder below. |

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
| `src/server/bot/PaymentPlanner.ts` | Builds a legal `Payment` for a given cost. |
| `src/server/bot/CardPayment.ts` | Works out what a menu entry costs and what may be spent on it. |
| `src/server/bot/evaluate/Values.ts` | Prices resources, production and terraform rating. |
| `src/server/bot/evaluate/CardEvaluator.ts` | Scores a card by walking its `behavior`. |
| `src/server/bot/evaluate/ActionScorer.ts` | Scores an entry in the action menu. |
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
therefore under-builds, the way a weak player does. On top of that, weaker
levels mix noise into every score and occasionally discard their ranking
entirely.

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

Results from 60 games per pairing, seats alternated:

```
medium  vs easy     medium wins 59/60 ( 98%)
hard    vs easy     hard wins   59/60 ( 98%)
insane  vs easy     insane wins 60/60 (100%)
hard    vs medium   hard wins   38/60 ( 63%)
insane  vs medium   insane wins 38/60 ( 63%)
insane  vs hard     insane wins 32/60 ( 53%)
```

**Read this honestly: there are three distinct tiers, not four.** `easy` is far
weaker than everything, `hard` beats `medium` reliably, and `insane` is a coin
flip against `hard`. Director differs from Veteran only in opponent awareness —
placement denial and timing the final generation — and against another bot that
plays just as well, denial mostly cancels out.

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
