# Log effects

Structured effects on log messages, so a log row can end in a short summary such
as `+1 temp · ocean` without parsing the message text. The mobile shell's "Since
your last turn" list and its Log view use them; the desktop log ignores them.

## Data shape

`LogMessage` (`src/common/logs/LogMessage.ts`) has an optional field:

```ts
effects?: Array<LogEffect>;
```

`LogEffect` (`src/common/logs/LogEffect.ts`) is one of:

| `type` | Other fields | Meaning |
| --- | --- | --- |
| `'global'` | `parameter`: `'temperature'` \| `'oxygen'` \| `'venus'`, `steps` | Track steps (one temperature step is 2°C, one Venus step is 2%). Negative for a decrease. The values are those of `GlobalParameter`. |
| `'tile'` | `tile`: `'ocean'` \| `'greenery'` \| `'city'` \| `'special'`, `count` | Tiles placed on Mars. Oceans are recorded only here, not as a global parameter. |
| `'tr'` | `steps` | Terraform rating change of the player taking the action. Negative for a loss. |

Effects of the same kind are merged as they are recorded (two temperature raises
are one entry with `steps: 2`), and an entry whose amount cancels out to zero is
removed. The field is only set when at least one effect remains, so most messages
carry nothing extra. Games saved before the field existed load unchanged: log
messages are stored as plain JSON and read back as such, and a missing `effects`
simply means "no effects".

Tile kinds are deliberately coarse: `city` covers cities, capitals, ocean cities,
Red City and New Holland (`toLogTileKind` in `src/common/logs/logEffects.ts`);
every other Mars tile is `special`. Hazards and Moon tiles are not recorded.
Resources, production and card resources are out of scope.

The field travels with the message through `/api/game/logs` (`GameLogs`), which
still drops other players' private messages, and arrives on the client as part of
the `LogMessage` that `fetchLogs` returns.

## Attribution

An effect is attached to the log message of the player action that caused it.

- Messages that report a player action are logged with the `actor` option
  (`game.log(..., {actor: player})`). That message becomes the current action's
  message (`Game.loggedAction`). The marked messages are: playing a card
  (projects, preludes, CEOs, corporations), using a card or CEO action, Viron and
  Delta Project re-uses, a corporation's first action, standard projects (sell
  patents included), standard actions (convert heat, convert plants), claiming a
  milestone, funding an award, Turmoil party actions, and trading with a colony.
- `Game` records global parameter changes, `Game.simpleAddTile` records tiles, and
  `Player` records TR changes through `game.logEffect`. Everything that happens
  until the action ends accumulates on that message, including deferred actions
  and follow-up inputs such as choosing where the Comet ocean goes, even when
  those arrive in later requests.
- TR changes are only recorded for the player who is taking the action. Another
  player's TR change during it is dropped.
- When an action plays or triggers another marked action (for example a card that
  plays another card), the inner message becomes current, and effects from then on
  attach to it.
- The action ends when `Player.takeAction` starts the next one, and when the
  production phase starts.
- Effects with no current action are **dropped**. That covers World Government
  terraforming, Turmoil global events and other end-of-generation effects, final
  greenery placement, and game setup. Those messages already say what happened in
  their text, and guessing at a "nearest" message would attach effects to the
  wrong player's row.

`loggedAction` is not serialized. Games are only saved between actions, so a
reloaded game never resumes in the middle of one.

## Summary text

`summarizeLogEffects(effects)` in `src/common/logs/logEffects.ts` renders the
compact English summary, or `undefined` when there is nothing to show. It is pure
and works on the client and the server.

- Parts are joined with ` · ` in a fixed order: temperature, oxygen, Venus, then
  ocean, greenery, city, special tile, then TR.
- Globals are signed (`+1 temp`, `+2 oxygen`, `-1 Venus`). Tiles show a count
  only above one (`ocean`, `2 oceans`, `2 greeneries`, `3 cities`,
  `special tile`).
- TR is shown only when it differs from what the listed raises normally give (one
  per raised step and per ocean). A Comet is `+1 temp · ocean`, not
  `+1 temp · ocean · +2 TR`; Caretaker Contract is `+1 TR`; raising Venus to 14%
  is `+1 Venus · +2 TR`.

The labels are English and not run through the translation directives.
