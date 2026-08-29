# Computer opponent

This fork adds a computer opponent so a single player can play a normal
multiplayer game against the machine, at one of four difficulties.

## Using it

On the new-game screen, set the player count to two or more, then tick
**Computer opponent** on any seat and pick a difficulty. Seats without the tick
are played by people, so mixed games (two humans and a bot, say) work too.

| Level | Plays like |
| --- | --- |
| Easy | Takes legal moves with little planning. Badly undervalues production, so it never builds an engine, and drops cities wherever they happen to fit. |
| Medium | Builds production, plays what it can afford, terraforms steadily, races milestones, and grows greeneries around its cities. |
| Hard | Prices its engine correctly, values tag synergies, plans cities around the forests it can actually grow, and converts spare cash into points at the end. |
| Insane | Everything Hard does, plus placement denial — including taking the city spaces you wanted — and timing the final generation around who is ahead. |

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
| `src/server/bot/evaluate/BoardOutlook.ts` | Prices cities and greeneries against the board, which no card's `behavior` can express. |

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

### Cities, and why they need their own file

A city tile is the one piece the `behavior` DSL cannot price, because by itself
it is worth nothing. It scores one point for every greenery that ends up beside
it, whoever planted that greenery, so what a city is worth is a bet on how much
green the player can still grow and on whether there is anywhere left to grow
it. Neither is written on the card.

`BoardOutlook` makes that bet explicitly, once per decision:

- **What a city is worth** is the greeneries already standing beside the best
  space open to the player, plus the ones the player's plants can still reach —
  banked plants, plants the engine will still grow, and a small allowance for
  greeneries that arrive from cards. A board with nowhere good left to build,
  or a player with no plants, prices its own cities down to nothing.
- **Cities already owned take their share first.** Without that, every city is
  priced as though it were the only one and the bot builds a fourth expecting
  the same three forests the first three are already counting on.
- **What a greenery is worth** includes the point it scores for any city it
  lands beside. Beside the bot's own city a forest is two points, not one;
  beside an opponent's it pays for part of their turn instead. This is what
  makes the bot plant *around* its cities rather than wherever the bonus is
  best, and it feeds the plant conversion, the greenery standard project and
  greenery cards alike.
- **Room to grow** is worth something on its own while there is still time to
  use it, so cities go where forests can follow rather than into a corner.
- **Denial**, for Insane only, counts what taking a space costs the opponent. A
  city may not sit beside another city, so building one closes seven spaces to
  every other player, which matters most when the good spots are running out.

The effect on play is large. Measured over 20 self-play games at Hard, the bot
went from 1.4 cities and 2.6 points of city scoring per game to roughly 3.4
cities and 8.7 points, with greeneries rising from 7 to 9 — and it beats the
evaluator without this reasoning 59% of the time (400 games), by about 7 points
a game.

### Difficulty

The levels run identical code; a profile decides how much of that code's advice
the bot takes. The largest lever is `productionWeight`, which is how accurately
the bot prices its own engine — Easy prices it at 0.4 of its true value and
therefore under-builds, the way a weak player does. `valuesCityGrowth` is the
second: without it a bot builds cities as though they scored a flat point and
never connects them to its forests, which is exactly how a beginner plays them.
On top of that, weaker levels mix noise into every score and occasionally
discard their ranking entirely.

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

## Measuring a change

Two tools, and they answer different questions. Run both after changing
anything in the evaluator.

**Is the ladder still a ladder?** `bot_tournament.ts` plays the levels against
each other; each should beat the ones below it.

```bash
npx tsx src/server/tools/bot_tournament.ts 120
```

```
medium  vs easy     medium wins 120/120 (100%)
hard    vs easy     hard wins  120/120 (100%)
insane  vs easy     insane wins 120/120 (100%)
hard    vs medium   hard wins   78/120 ( 65%)
insane  vs medium   insane wins 76/120 ( 63%)
insane  vs hard     insane wins 68/120 ( 57%)
```

**Did this change help?** The tournament cannot say, because both seats get the
change. `bot_ab.ts` plays a difficulty against itself with profile knobs moved
on one seat:

```bash
npx tsx src/server/tools/bot_ab.ts 400 hard valuesCityGrowth=false
```

**What is the bot actually doing?** `bot_diagnostics.ts` prints the shape of the
games rather than the win rate — tiles laid, where the points came from, how
long the game ran. A change that raises the win rate while the bot stops
building anything is worth looking at twice.

```bash
npx tsx src/server/tools/bot_diagnostics.ts 20 hard hard
```

### A note on seeds

`SeededRandom` takes a float in [0, 1) and scales it back up by 2^32, so every
whole number lands on the same internal state. The tournament used to pass 1,
2, 3 … as seeds, which meant a hundred-game run was one game played a hundred
times with different bot noise — and at Insane, which has no noise, it was one
game played a hundred times identically. Every measurement taken before that
was fixed, including the ladder that used to be printed here, was drawn from a
single board. `seedForMatch` spreads the match number over the unit interval;
`tests/bot/BotTournament.spec.ts` guards it, because the failure is invisible
from the outside.

Bot-versus-bot games run about 16 generations, longer than a typical human
game, because two cautious bots terraform more slowly than a human pushing to
close the game out. Easy games run past 23.

## What has already been tried, and failed

Do not spend time re-deriving these. Each was implemented and measured, and
none beat its baseline. Below roughly 60% at n=400 (standard error about 2.5
points) there is no effect worth keeping.

| Idea | Result |
| --- | --- |
| Buy cards on value with a margin, instead of to a quota | **44%** — actively harmful. More cards beats fewer: the play threshold already filters what gets played, so extra options are worth more than the 3 M€. |
| Price steel and titanium by whether the hand holds cards that can spend them | 49% — no effect. |
| Both of the above together | **32%** — clearly worse. |
| Raise or lower the card buy rate (0.45, 0.6, 0.85, 1.0) | 49-56% — all inside the noise band. |
| Heavier engine weighting, zero cash reserve, more aggressive closing | 49-51% — all inside the noise band. |
| Price a blue card's action by walking its `action` behavior, instead of a flat allowance, and rank action cards by that | 48-49% over 400 games, twice. Taking a free action is nearly always right whatever it does, so pricing it changes little; where it does change the ranking, the DSL undervalues actions that stockpile resources for later. |
| Fold the city-adjacency bonus into the price of a plant, so plant production is worth more once cities are standing | **50%**, down from 59% — clearly harmful. The bonus belongs to one specific greenery on one specific space; spread across every plant the bot owns it triples the value of its whole plant engine. |

Note that the first five rows were measured before the seeding bug above was
found, so they were each drawn from a single board. They are recorded as
suspect rather than deleted: the conclusions are plausible, and re-running them
honestly is cheap.

The conclusion still holds that **parameter tuning is exhausted**: once a level
prices the game accurately, sharpening the same knobs does nothing. What did
work was giving the evaluator something it could not previously see at all —
the board, in `BoardOutlook`. A genuinely stronger fifth tier probably needs
turn-level planning, choosing the best *pair* of actions rather than the best
single action twice, so the bot can play a cheap production card to make an
expensive one affordable in the same turn. That needs simulation, and the
obvious route is blocked: `Game.serialize` deliberately drops the
deferred-action queue, so a clone taken mid-action is not the position it came
from. Any attempt should start by solving that.

## Tests

`tests/bot/SelfPlay.spec.ts` is the load-bearing test: it plays a full
two-player game at every difficulty and asserts the game reaches `Phase.END`.
If the bot cannot answer some input, the run stops early and the test fails.
`tests/bot/BoardOutlook.spec.ts` and the placement cases in
`tests/bot/BotBrain.spec.ts` cover the city and greenery reasoning directly.
