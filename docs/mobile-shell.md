# Mobile shell

A plan for making the game playable on a phone without changing the board, the
cards, or the desktop client.

Status: **phases 1-9 are implemented.** The card browser at `/cards` and the
spectator view are still open.

A working reference for the target design lives at
[`prototypes/mobile-shell-prototype.html`](prototypes/mobile-shell-prototype.html).
It is a static page, outside the build — open it in a browser at phone width.
The players and the log are mocked; the board geometry, the track coordinates,
the Tharsis space kinds, the milestone thresholds and the card data are taken
from this repository. Turn on "Design notes" in its Settings panel for the
reasoning behind each decision.

## Goal and constraints

One hard constraint from the outset: **the board and the game world do not
change.** Size may change; layout, contents and artwork may not. No hiding board
spaces, no re-flowing the hex field, no substituting simplified artwork.

Everything else follows from that:

- Scale the board and the cards as **whole units**. Never reposition their
  internals.
- Desktop stays as it is. The mobile layout is a separate shell that reuses the
  same child components, not a pile of media-query overrides fighting the
  existing rules.
- Target: portrait first, one-handed. Landscape should work but is not what we
  design for.

## Why the earlier attempts failed

Two branches already exist — `feat/mobile-pwa-optimization` and
`feat/render-pwa`. **Do not merge or build on either.** They are useful only as
a record of what went wrong:

1. **Two competing CSS layers.** `assets/mobile.css` (raw CSS, outside the Less
   build, breakpoint `max-width: 767px`) and `src/styles/mobile_optimizations.less`
   (823 lines, breakpoint `max-width: 768px`) style the same selectors with
   different values. Which one wins depends on load order and specificity, and at
   exactly 768px only one applies.

2. **Three scaling techniques applied at once.** `.board { width: 100%;
   min-width: 600px; transform: scale(0.8) }`. `transform` scales visually but
   not the layout box, so dead space and broken scrolling follow. And 0.8 is a
   fixed factor — 600 × 0.8 = 480px is still wider than a 390px phone.

3. **`.board-outer-spaces { display: none }`** hides real board spaces. That is a
   game change, not a display change, and it violates the constraint above.

4. **It was still one long scroll** in desktop order: board → players → log →
   actions → hand → played cards. Reaching an action meant scrolling roughly five
   screens, with the board out of sight while choosing a space. This — not font
   sizes — is what made it unplayable.

5. **Source files were minified.** `PreferencesManager.ts` and `preferences.less`
   were collapsed to one-liners (−519 lines in `preferences.less` alone), which
   breaks STYLE.md and makes review impossible.

The one thing worth keeping from them is the PWA work: the viewport meta,
`manifest.json`, and the service worker.

## Geometry reference

Numbers verified against the repo. A future session should not have to re-derive
these.

| Thing | Value | Source |
| --- | --- | --- |
| Board artwork | 620 × 600 | `assets/board/mars.png`, `mars-without-venus.png` |
| Hex box | 46 × 51 | `.board-space` in `src/styles/board.less` |
| Hex spacing | 49px horizontal, 41px vertical | `src/styles/board_items_positions.less` |
| Hex field offset inside the artwork | (93, 85) | `.board { margin: 85px 0 0 93px }` in `board.less` |
| Hex field rows | 5·6·7·8·9·8·7·6·5 = 61 on Mars | `board_items_positions.less` |
| Track marker positions | `@temperature-vals`, `@oxygen-vals`, `@venus-vals` | `src/styles/globs.less` |
| Ocean counter | top 524px, left 286px | `.global-numbers-oceans` in `globs.less` |

**The most important finding:** the oxygen, temperature and Venus tracks are
*drawn into the board artwork* as arcs around the planet, and the client places
rotated value markers on top of them at the coordinates in `globs.less`. The hex
field is only the middle of the picture.

So the scalable unit is the **whole 620 × 600 artwork**, not `.board` (600 × 488).
Scaling `.board` alone — which is what `mobile_optimizations.less` did — throws
the printed tracks out of frame entirely.

Global parameter limits and bonus thresholds, from `src/common/constants.ts`:

- `MIN_TEMPERATURE = -30`, `MAX_TEMPERATURE = 8`
- `MIN_OXYGEN_LEVEL = 0`, `MAX_OXYGEN_LEVEL = 14`
- `MAX_OCEAN_TILES = 9`, `MAX_VENUS_SCALE = 30`
- `TEMPERATURE_BONUS_FOR_HEAT_1 = -24`, `TEMPERATURE_BONUS_FOR_HEAT_2 = -20`
- Ocean bonus at temperature 0
- `OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS = 8`

## Architecture

```
PlayerHome.vue                          unchanged, desktop
mobile/MobilePlayerHome.vue             composes the SAME children into views and sheets
mobile/MobileHeader.vue                 generation, rings, resources, tag row
mobile/MobileTabBar.vue                 the views, along the bottom edge
mobile/MobileTurnPage.vue               what the player can do now, read off the turn's menu
mobile/MobileLog.ts                     log lines as rows, and what happened since your last turn
mobile/MobileLogRow.vue                 one log line: player glyph, what, who and when
mobile/MobileLogPane.vue                the whole log, a group per generation
mobile/MobileLogCards.vue               the cards a log line names, opened large
mobile/MobileOverlay.vue                the sheet the players and the menu open in
mobile/MobileIcon.vue, MobileIcons.ts   the Lucide icons the chrome draws, inlined
mobile/MobileInitialCards.vue           the opening hand, one selection at a time
mobile/MobileTagRow.vue                 tag counts, from the model's own totals
mobile/MobileBoardPane.vue              the 620x600 stage, pinch, pan, zoom HUD
mobile/MobileActionPanel.vue            WaitingFor: a sheet for an opened entry or a question
mobile/MobileActionList.vue             the entry that was opened, or the menu as grouped rows
mobile/MobileActionMenu.ts              ready cards, tiles' entries, and the entries left over
mobile/MobileCardsPane.vue              Hand | Played, two to a row, ready cards first
mobile/MobileFitBlock.vue               scales a desktop-width block down to the phone
mobile/MobileFocusStage.vue             the card or tile being acted on, over a faded board
mobile/MobileMore.vue                   the settings and the way to another game
mobile/MobileSettings.vue               the preferences that mean something on a phone
mobile/MobileView.ts                    the view and snap names
components/InitialCards.ts              the opening hand's arithmetic, shared with the desktop
create/CreateGameSection.vue            a headed section of the create-game form
utils/useMobileLayout.ts                viewport width + preference -> which shell
utils/spaceSelection.ts                 whether a tile is being placed
utils/cardSelection.ts                  a card picked on one tab, for an input on another
utils/boardSelection.ts                 the same, for a milestone, an award or a colony tile
utils/mobileFocus.ts                    whether the panel shows one thing, and which entry
styles/mobile_tokens.less               the design system's dark theme, as Less variables
styles/mobile_shell.less                everything the shell paints
```

`App.vue` picks the shell for `screen === 'player-home'`. Everything below it —
`Board`, `Card`, `PlayersOverview`, `LogPanel`, `WaitingFor`, `Milestones`,
`Awards`, `Colony`, `Turmoil`, `MoonBoard`, `PlanetaryTracks` — is reused as it
is. `Milestone` and `Award` gained one optional prop each (`claimable`,
`fundable`) and an event, so the shell can make a tile the button that claims it;
with nothing passed they behave exactly as the desktop always had them. The panes are held in the DOM with `v-show` rather than `v-if`,
because `SelectSpace` reaches into the board by `getElementById` and needs it
mounted even when another view is open.

The board stage is transformed inside a clipping viewport, so the layout box
never matters. Cards use a `--mobile-card-scale` custom property applied with
`transform: scale()`, and give back the room a transform saves themselves — see
**Scaling down is a picture operation** below.

New preference keys in `PreferencesManager.ts`:

- `mobile_layout: 'auto' | 'on' | 'off'`
- `card_scale: number` (0.40–1.00)
- `tag_row: 'auto' | 'always' | 'never'`
- `mobile_tap_targets: boolean` (the 44px overlay)

`card_tap`, `play_from` and `action_sheet_peek` belonged to the Act tab and went
with it in the turn-page redesign. A value still in a player's storage is ignored.

`hide_tile_confirmation` already covers confirming a placement, so no
`confirm_tile_placement` key was added. The manager now stores strings and
numbers as well as booleans; `isBooleanPreference` keeps `PreferencesDialog`
from writing the non-boolean keys back from its own stale snapshot.

## The board pane

- Stage is the full 620 × 600 artwork with the hex field at offset (93, 85).
- Pinch to zoom, drag to pan, double-tap to toggle between fit and 160%.
  Implemented with pointer events and a pointer map; `touch-action: none` on the
  board viewport so the browser does not steal the gesture.
- Fit-to-screen is the default zoom, clamped as the minimum.
- Temperature and oxygen value markers are rendered at the `globs.less`
  coordinates with their rotations, the current value ringed the way the desktop
  client rings it (`#bb8760`), and bonus steps outlined.
- Venus track and its markers render only when the Venus expansion is on, and the
  artwork switches to `mars-without-venus.png` when it is off.

**Tap targets.** At 390px viewport the board fits at scale ≈ 0.62, which makes a
hex ≈ 29px against Apple's recommended 44px minimum. We do not solve this by
enlarging hexes — that would change the board. We solve it with zoom plus a
confirmation step. Ship a debug overlay that draws the 44px ring on each hex so
this stays measurable.

**Placement flow.** Choosing an action that needs a tile highlights legal spaces,
dismisses the action sheet completely, and shows a confirm bar pinned to the
bottom of the pane. Cancel returns to the action list.

Below the board, in the same scrolling column: **milestones and awards** — they
are printed on the physical board, so they belong to the board, not to a menu.
Colonies, Turmoil, the Moon board and Pathfinders tracks go here too.

The board viewport has `touch-action: none`, so you cannot scroll the column by
dragging on the board. It never fills the pane (`max-height: 62dvh`), so the top of
what lies under it is always on screen and the column is scrolled from there. A
tappable "Milestones & awards ▼" handle used to sit between the two; on a phone it
read as clutter and was removed. The turn page's Milestones & awards tile still
scrolls the column straight to them.

## Navigation

The design is proposal **3a** from the Claude Design handoff ("Mobile turn page"),
drawn in the Aronbal Apps design system's dark theme. Its tokens are in
`mobile_tokens.less`; the chrome uses them and the system font, and the board and
the cards keep their own artwork and type.

There is no tab bar. The header ends in a segmented control, **Turn · Board ·
Cards · Log**, and the turn opens on **Turn**: one page with everything the player
can do right now. Players complained of too many tabs to jump between, of an Act
sheet half full of rows that only said "tap something elsewhere", and of how hard
it was to find and play a card. The turn page answers "what can I do now?"
without switching anywhere.

**The header.** `Generation 5`, a `Your turn` pill (or `Waiting`, `Passed`,
`Game over`), and two icon buttons: **Players**, which opens the players overview
in a sheet, and **⋯**, which opens the settings and the links to another game.
Under them the global parameters are progress rings of the steps each has taken
(temperature in two-degree steps, 19 of them; oxygen of 14; oceans of 9; Venus of
15 when it is on), each with its value and goal beside it, the way oceans always
read (`-4°/+8°`, `9/14%`, `5/9`), and its label. A parameter at its goal turns its
ring green with a tick inside. TR is on the right. Then the
six resources, each an icon with the amount beside it and its production as a
badge on the icon's corner (none when there is no production), then the player's tags as small icons
with their counts. The views are a tab bar at the bottom of the screen
(`MobileTabBar.vue`: Turn, Board, Cards, Log, each an icon over its name), where
the thumb already is; at the top of the header they were the furthest control
from a hand holding the phone.

**The turn page** reads the turn's menu rather than listing it. This is possible
because `OrOptions.toModel` carries each option's `ActionAnnotation` out to the
client: the ids existed for the computer opponent, but every `toModel` dropped
them, leaving the client nothing to match on but translated titles.

1. **Since your last turn** — the three newest log lines another player wrote
   after this player's own last line, as rows: a glyph in the player's colour,
   what they did (`Played Comet`), and who and when (`Mette · 2 min`). `Log`
   opens the whole log. The current generation and the one before are read, since
   the last thing a player did is often the pass that ended the previous one.
2. **Ready now · N** — the hand cards the `projectCard` entry offers, then the
   played cards the `actionCard` entry offers, then a CEO's once-per-game action,
   at half size in one sideways row. A pill under each says what a tap leads to:
   for a card to play, its price in the units it would be paid with — steel and
   titanium where the card takes them and the player has them, M€ for the rest,
   each with its resource icon (`PlaySheet.pricePreview`, the play sheet's own
   auto-fill limited to those three units); for an action, a purple `Use`. A bare
   blue `Play · 14 M€` read as a link, and overstated the price whenever steel
   would pay part of it. Unplayable cards are not shown here; the Cards view has
   them, dimmed.
3. **Tiles** — Heat to temp, Greenery, Standard projects, Milestones & awards,
   plus Trade when colonies are in the game and Delegate (and Party action, when
   the menu offers it) with Turmoil. A tile the menu does not offer is dimmed to
   45%. A conversion that is short says how far, as have over need (`5/8`); a
   tile that is simply not on offer says nothing, since dimmed is enough. Empty
   sections — nothing since the last turn, no ready card — are left out rather
   than saying so, and the question row goes while the sheet holding it is up.
   Greenery reads
   `plantsNeededForGreenery`, which the player model now carries, so Ecoline's 7
   is right. Milestones & awards opens the Board view at the tiles under the map,
   where they are claimed.
4. **More actions** — any entry nothing above draws, by its title, so an action
   added to the game later is never unreachable.
5. **Sell patents** and **Pass** as two gray buttons, and **End turn** and
   **Undo** under them when the menu offers them.

When it is not the player's turn the page says whose it is and keeps the rest
readable but inert. When the server asks something other than the menu — a draft,
a follow-up — the page offers a row back to the sheet that holds the question, and
so does the header's `Your turn ›` pill, from any view, while the sheet is put
away.

**Choosing cards.** A question that is a plain pick among cards — the draft, the
cards to buy, any card's own "choose a card" — opens in the card chooser
(`MobileCardChooser.vue`) instead of the sheet, and so does Sell patents. Every
card is on screen at once, two abreast, so they can be compared against each other
and against the tags in the header, which the chooser's scrim leaves unblurred. A
tap chooses a card (for a question that takes one, it moves the choice) and a second
tap puts it back. The one blue button says what the pick comes to: `Select`,
`Buy 2 · 6 M€`, `Sell 3 · +3 M€`, or `Skip` when buying none. A question that must
be answered has no Cancel; the scrim puts the chooser down and the turn page's row
or the header's pill brings it back. A question with cards nested inside it still
uses the sheet, at `full`.

**Taking or leaving one card.** When one card is offered to take or leave
(Board of Directors' prelude, say), the chooser shows two buttons that say what
they do: the blue one takes the card (`Buy`) and the grey `Skip` leaves it.
Before, leaving it was the only button there was until the card was tapped. A
price is added to `Buy` only for cards bought at the card cost (the research
phase). The server marks those `buyCards` in `ChooseCards`, because the button's
label alone does not say so.

**Choosing a number.** A question that is only a number — how many steps of heat
production Insulation gives up, say — opens in the amount sheet
(`MobileAmountSheet.vue`): the number large between a − and a +, the two ends of
the range as a segmented choice, and one blue button that says what it sends
(`Decrease · 3`). It is put down and brought back like the card chooser. Any other
question still uses the sheet, where the desktop's own buttons are redrawn the same
way: the one that answers is blue, the ones that only adjust (MAX, +, −) are grey.

**Choosing between options.** A question that is a choice between plain options
and nothing else opens in the choice sheet (`MobileChoiceSheet.vue`), for example
whose plants to remove, or whether to pay.
- The options are full-width rows, and a tap only ticks one.
- The server's default is ticked to start with.
- One blue button at the bottom sends the ticked option, under its own label
  (`Remove plants`, `Skip`).
- An option about an award or a milestone, such as Asimov's `Fund ${0} award
  [scores]`, reads as the name, its kind and each player's score with a dot in
  their colour.
  - The ticked one also shows the rule from the client's milestone/award manifest
    and what it pays.
  - `ChoiceSheet.boardRuleIn` matches the name, and reads the scores out of the
    option's text.

A choice with an input inside an option still uses the sheet, raised to `full`.
There, `OrOptions` pins its button to the sheet's bottom edge, under every option,
instead of right under the chosen one, where it was in the way of the next.

**Undo, mid-game.** The undo option is set when a game is created, and the
Settings screen (⋯ › Settings) now starts with a **This game** section where it
can be turned on or off afterwards.
- The switch posts to `api/game/undo`, which sets `game.setUndoOption()` and logs
  who changed it. The change is saved with the game's next save.
- The menu the player is being asked gains or loses **Undo** at once
  (`Player.refreshUndoOption`). Within a turn, an action taken while undo was off
  goes back to the start of that turn, the last save made.
- Going back to a save from before undo was turned on keeps undo on (`PlayerInput.performUndo`).
- Against computer opponents only, Undo is also offered at the start of a turn. It
  goes back to before your last action, past the computers' moves, which they then
  make again.
  - `Player` remembers the save id of each of your saved decisions, and Undo
    restores the one before the last. They are recorded whether or not undo is
    on, so turning it on at the start of your turn can go back at once, and they
    are saved with the player, so a restart or an undo keeps them.
  - On Postgres, every save made while answering one request (the computers' moves
    included) lands on the same id, so that save is exactly the state of the decision.
  - It never crosses into another generation.
  - `GameLoader.restoreGameAt` deletes the saves actually stored after the target,
    and refuses a target that is no longer stored.

**This game, under ⋯.** The menu starts with the game itself when there is one.
- **Your link to this game** shows the player's own `player?id=` address, with a
  button that copies it. An app added to the home screen has no address bar, so this
  is the way to the link. Where the clipboard is refused, the link is selected instead.
- **Go back one save** is shown to the game master only: the first person in the
  player list the game was created with (`Game.gameMaster`, sent as
  `PlayerViewModel.isGameMaster`). After a confirm it posts to `api/game/rollback`,
  which refuses anyone else, restores the save before the latest
  (`GameLoader.restorePreviousSave`, deleting the latest), keeps the undo setting,
  logs who went back, and lets the computers move if it is their turn. The log line
  is saved with the next save rather than at once, so going back twice goes back two
  saves.

**Game over.** The turn page's first row becomes `Game over · See the final score`,
a link to the results page, and the action tiles go.

**The results page.** On a phone, `the-end` is `MobileGameEnd.vue` instead of the
desktop's `GameEnd.vue`.
- The winner is named large at the top (`You won!` when it is the player looking).
- The totals, best first, are a list of rows: place, name, corporation, M€ left
  (the tie-break) and the total.
- **By category** compares the sources of points in a two-column grid of tiles,
  one tile for each category anyone scored in (TR, milestones, awards,
  greeneries, cities, cards, and the Moon, tracks or Escape Velocity when they
  apply).
  - Each tile has one bar per player, all measured against the most anyone
    scored in any category.
  - Everyone but the category's leader is dimmed.
  - The lead (`+6`) is written in the leader's colour, or `=` on a tie.
- The score by generation is a small SVG chart.
- Each player's points from cards, milestones and awards are folded rows.
- At the bottom, `New game`, `See the final board` (the player view with
  `&noredirect`) and `Main page`.
- Spectators keep the desktop page.

**Standard projects** open in the play sheet, all of them side by side with the
first one the player can pay for picked out; a tap picks another, and its payment
and `Build · 11 M€` button follow. **Trade** opens the trade sheet
(`MobileTradeSheet.vue`): the colony tile, the ways to pay the fee as a segmented
choice, and `Trade`, which answers the fee and the tile together; a swipe moves to
the next colony, and a colony tapped under the board opens there. **Heat to temp**
opens a confirmation sheet (`MobileConfirmSheet.vue`) with the action's own words,
its warnings and its button. **Greenery** goes straight to the map.

**Playing a card.** A tap on a ready card, on the turn page or in the Cards view,
opens it straight in the play sheet: no bar to confirm on first, since the sheet
is itself the confirmation and nothing is played by the tap. A sideways swipe on
the card in the sheet turns to the next or previous ready card, round and round,
with a dot per card under it.

**Claiming a milestone, funding an award.** The same sheet, for what is printed on
the board (`MobileClaimSheet.vue`): the tile held up to read, and one button —
`Claim`, or `Fund · 14 M€` with the price the server put in the entry's title. A
swipe moves through every milestone on offer, then every award. A tap on a tile
under the board opens it there, and the turn page's Milestones & awards tile opens
the first one on offer straight away; with none on offer it shows the board.

**The sheet** is no longer a destination. It carries only what was opened from the
turn page — a card with its price, a tile's entry — and the questions the server
asks between moves, which come up to `half` by themselves. Over a bare menu it is
closed entirely. When opened from a tile it shows that entry alone, chosen by its
position in the menu (`pickEntry`); a list to choose from (the standard projects,
the hand to sell) opens at `full`, a confirmation at `half`. It has three stops:

| Stop | Position |
| --- | --- |
| closed | fully off screen |
| half | 50% of the sheet height |
| full | 96% |

There used to be a fourth, `peek`: a 46px "Your turn · Tap to open" handle left at
the bottom of every pane. It read as a second screen half-hidden behind the first,
and was removed. Tapping the head, the scrim or dragging it down now puts the sheet
away entirely; the turn page's question row, the placement bar's **Actions** and
the header's turn pill bring it back.

Compute the stops in **pixels, not percentages**, from the sheet's measured
height. The placement confirm bar also needs a higher `z-index` than the sheet.

Only the `full` stop dims the board. At `half` the map stays fully readable,
which is the entire point of the sheet.

**Play and Use** open the **play sheet** (`MobilePlaySheet.vue`, proposal 2b): the
card large, and — for a card to play — a row per resource it may be paid with,
with − and + steppers, the M€ that is left to pay, and a full-width button that
carries the price (`Play · 8 M€`). The rules are the desktop's own: which units a
card takes, their values and reserves live in `ProjectCardPayment.ts` and
`PaymentLedger.ts`, which `SelectProjectCardToPlay` and `PaymentForm` call too,
and the starting payment is the desktop's auto-fill. The answer is posted the way
`WaitingFor` posts one (`playerInputRequest.ts`). Whatever the server asks next —
a target, a tile — arrives in the action sheet like any other question.

Milestones, awards and colonies each have a sheet of their own (above), so
nothing tapped under the board is staged over a faded board any more.

**The payment widget is left as the desktop draws it.** It is drawn for a desktop
column, where its two sides — what you spend, and what it is worth in M€ — are
obviously one table; at phone width the values drifted away from the rows they
belonged to, so the shell rules them off into a column. It also sizes each
running subtotal explicitly at 20px and lets the total they add up to inherit,
which on a desktop is 23px and inside the shell was 14px: the number that decides
whether the button can be pressed, drawn as the least of its own parts. The shell
states that size rather than inheriting it.

**The Log view** is the whole log, a group per generation, newest first, in the
same rows as the short list. Earlier generations are fetched one at a time when
asked for. The log is refetched whenever the game's `step` moves.

A row whose line names cards (`Played Comet`) is a button, here and in "Since
your last turn": a tap opens the cards large, side by side, under the line itself
with who and when, and a tap anywhere puts them down. Rows that name no card stay
plain rows.

For the trailing effect summary on a log row (`+1 temp · ocean`), the server
attaches structured effects to the log message of the action that caused them;
see [`log-effects.md`](log-effects.md) for the data shape and the attribution
rule.

**The board's own tiles** take the tap directly. A milestone the turn's menu
offers is ringed and claims itself; so does an award, and so does a colony tile
the player can trade with. What is offered is read off the menu rather than
recomputed — the server has already worked out what this player can afford and
reach, and a second opinion here could only ever be wrong.

**The menu (⋯)** holds the settings and the links to another game. The settings
are the mobile keys plus the preferences that mean something on a phone, grouped;
the desktop `PreferencesDialog` is not embedded, because a third of its switches
are about parts of the desktop layout the shell never draws.

## Cards

The Cards view holds a segmented control: **Hand | Played**, two cards to a row
at 68%.

- **Hand** — the hand in the player's own order.
- **Played** — the tableau grouped as the desktop groups it: Corporation, Active,
  Automated, Events.

Cards this turn has a move for sort to the front of their group and select on a
tap, as on the turn page; the rest are dimmed in place and take no tap, because a
card you cannot afford this generation is still what you plan the next one
around.

**Card titles are fitted by measuring them** (`textFit`), and the shell keeps its
panes mounted but hidden, so a card can be created with no box at all. Nothing
overflows a box of zero width, so a title fitted then is never shrunk — and the
size is cached for two days, which spreads one bad measurement across every
later visit. `fitTextWhenReady` waits for the element to have a box, watching
with a `ResizeObserver` when it does not, and `fitText` refuses to measure one
that has none. The observer stays on afterwards: the card scale is a preference
a player moves mid-game, and a size fitted to the old width is the wrong size for
the new one. The cached size is keyed on the box width it was measured in as well
as the text, so an answer for one width is never handed to another.

### Scaling down is a picture operation

**Never scale anything in the shell down with `zoom`.** `tests/styles/TextScaling.spec.ts`
fails if anything does.

`zoom` multiplies the computed font sizes. A card's smallest type is 11px, so at
the default card scale it asks for a 6.8px font — and iOS will not draw one. It
substitutes a floor of its own, and only for the glyphs: not for the 12px line
height, and not for the box around them. Card descriptions and corporation
lockups then grew past both while the artwork stayed exactly where it belonged.
Nothing in the page can talk that floor down; `-webkit-text-size-adjust` does not
reach it. Card *titles* looked fine throughout, but only because `textFit`
measures them and shrinks them until they fit — the measurement was hiding the
fault everywhere it was applied.

`transform: scale()` is a picture operation: the block is laid out at its full
size, with its type at the sizes the stylesheet names, and the finished result is
scaled. What it does not do is give back the room it saves, which is the one
thing `zoom` was here for, so each place that uses it reserves the scaled size
itself:

- **Cards** (`mobile_shell.less`) pull their footprint in with margins computed
  from `--card-natural-w` / `--card-natural-h`, which `Card.vue` publishes from
  its own `offsetWidth` / `offsetHeight` — the layout box, which a transform does
  not touch, so the margins never feed back into the measurement. A card in a
  pane the shell has mounted but not shown measures zero and publishes nothing,
  the same rule `fitText` follows. The scale is applied to those properties in
  CSS, so moving the card-scale preference needs no measuring at all.

  This relies on a card's parent establishing a block formatting context, so the
  negative bottom margin reduces the parent's height rather than collapsing
  through it. Both parents the shell uses — the `.cardbox` label and
  `.mobile-card-button` — are `inline-block`, which does. A plain block parent
  would not.

- **`MobileFitBlock`** does the same for Turmoil, the colony tiles and the
  planetary tracks, from its own measurement.

- **`MobileFocusStage`** needs no compensation: the holder is the stage's only
  child and is clipped to the room above the panel.

Scaling *up* with `zoom` is still fine — it can only take type further from the
floor — which is why the milestone and award tiles on the focus stage keep it.

### Why card text stops fitting

A card is a fixed pixel box drawn for one set of font metrics, and its title is
fitted by measuring the rendered text. Both assume the font the stylesheet names
is the font the browser actually uses, and that the browser draws the size the
stylesheet asks for. Two things broke that, and both are now closed off:

- **Ubuntu was fetched from Google Fonts** by a `<link>` in `index.html`. Any
  request that was slow, blocked, or simply not there — the game is an installable
  PWA, so offline is a normal state — redrew every card in the platform's own
  sans-serif. It is self-hosted now, in both weights, beside the menu fonts.
- **iOS boosts text it judges too small to read**, and it boosts the glyphs
  without touching the line height or the box around them. An 11px card
  description drawn at 62% is exactly what that aims at, so the lines grew past a
  12px line height and past the card's own edges while the artwork stayed put.
  `html` now sets `text-size-adjust: none`; the `100%` in the normalize does not
  turn it off, it only scales an adjustment that is applied anyway.

`tests/styles/Fonts.spec.ts` fails if a face is fetched from another origin, if a
declared face points at a file that is not there, or if anything asks for a
`text-size-adjust` other than `none`.

A tap selects a card the turn can use; the bottom bar's name opens it large
enough to read. Nothing is played without the bar's button, because a mis-tap
that plays a card costs a turn. The existing `magnify_cards` preference is
hover-based and therefore dead on touch.

**Tag row.** A thin strip in the header showing tag counts, in the place the view
control used to have, on every view: whether a card needing three science tags is
worth drafting turns on them. It draws nothing until there is a tag to count. The
`tag_row` preference is On or Off (`auto` / `never`; a stored `always` reads as
On). Counts come from the tableau, via the existing `PlayerTags` logic — do not
recompute them independently.

## Entry and startup screens

`App.vue` routes by a `screen` string. Each one needed a pass of its own.

| Screen | Component | What it got |
| --- | --- | --- |
| `start-screen` | `StartScreen.vue` | Done. Its own `width=device-width` override is gone, now that `index.html` declares it for every screen, and the menu rows answer a tap as well as a hover |
| `create-game-form` | `CreateGameForm` | Done. Each heading is the control that opens its own section, through `CreateGameSection.vue`; the player count opens on arrival |
| `load` / `continue-game` | `LoadGameForm`, `ContinueGame` | Done. `continue_game.less` came with the menu restyle; the load form's fields now take the width they have |
| `games-overview` | `GamesOverview` | Done. Each game is a card at phone width — the id and its status on the first line, the players wrapping under them |
| `game-home` | `GameHome.vue` | Came with the menu restyle; the notice no longer floats over the page |
| **initial card selection** | `SelectInitialCards.vue` | Done, as `MobileInitialCards.vue`. See below |
| `player-home` | `PlayerHome.vue` | The shell above |
| `spectator-home` | `SpectatorHome.vue` | **Still open.** Same shell, read-only |
| `the-end` | `GameEnd.vue` | Done. The breakdown scrolls sideways in a box of its own with the player column held at the left; the chart's 950px floor is lifted |
| `cards` | `CardList` | **Still open.** Card browser; scale with `--tm-card-scale` |

### The opening hand

The hardest of them, and the only one that needed a component rather than rules.
The desktop screen is four `SelectCard` grids on one page — a corporation, two
preludes, a CEO and ten project cards — with the money they add up to printed
under the last of them, which at phone width is five screens of scrolling.

`MobileInitialCards.vue` makes each selection a step. The step bar says what each
one has against what it wants (`Preludes 1/2`), and a bar at the foot holds the
starting megacredits, the total after preludes, and whatever is still missing.
Every step stays mounted, because a `SelectCard` holds the player's picks itself.

The selections are the same `SelectCard` the desktop renders, and the arithmetic —
the corporation-specific prelude bonuses, the card cost, the counts that decide
whether the button may be pressed — is `components/InitialCards.ts`, which both
components call. `PlayerInputFactory` swaps the component in the way it already
does for the action menu, and `MobilePlayerHome` gives setup the whole pane and
opens on it: the opening hand is not a question asked in the middle of something.

The viewport meta is the switch that makes all of these matter at once:
`assets/index.html` currently declares `width=1260, user-scalable=1`. Flipping it
to `width=device-width, initial-scale=1, viewport-fit=cover` is a one-line change
that immediately affects **every** screen. Land it together with the shell, not
before — on its own it leaves the desktop layout rendering at phone width with
nothing to catch it.

## PWA

Less work than it looks: `main.ts` already registers `sw.js`, and `src/client/sw.ts`
is deliberately empty ("needed for client side notifications"). What is missing:

- `assets/manifest.json` with name, icons, `display: standalone`, theme colour
- `<link rel="manifest">`, `theme-color`, `apple-mobile-web-app-*` meta tags
- `apple-touch-icon` at a real size (the earlier branch pointed it at
  `favicon.ico`)
- Optional: asset caching in `sw.ts` — keep it conservative, and never cache API
  responses, or players will see stale game state

Respect the safe areas: `viewport-fit=cover` plus
`env(safe-area-inset-bottom)` padding on the tab bar and
`env(safe-area-inset-top)` on the header.

On an iOS home screen the viewport can stop the status bar's height short of the
bottom of the screen (48px on an iPhone 11). Nothing on the page can be drawn in
that band: a shell stretched to the screen's height is cut off at the viewport,
tab labels included. So the shell keeps to the viewport; the page background
behind it is the tab bar's colour, so the band reads as the bottom of the tab bar,
and `utils/standaloneHeight.ts` measures the band so the tab bar drops the room it
would otherwise keep for the home indicator (`.mobile-shell--short`). In a
browser tab, or once the viewport is right, nothing changes.

## Phasing

Each phase should build, lint and pass tests on its own.

1. ~~**Shell skeleton.**~~ `MobilePlayerHome.vue`, `useMobileLayout.ts`, tab bar,
   header, empty panes. Desktop untouched. Viewport meta flipped.
2. ~~**Board pane.**~~ Full-artwork stage, pinch-zoom, tracks, tap-target overlay.
3. ~~**Placement.**~~ Legal-space highlighting, sheet dismissal, confirm bar.
4. ~~**Action sheet.**~~ Pixel snap stops, drag, the four positions.
5. ~~**Cards.**~~ Hand/Played segment, tap-to-magnify, card scale, tag row.
6. ~~**Board extras.**~~ Milestones, awards, then colonies, turmoil, moon,
   pathfinders.
7. ~~**Entry screens**, in the table's order of difficulty.~~ All but the card
   browser and the spectator view. Pinch-zoom is deliberately left enabled as the
   escape hatch.
8. ~~**PWA**: manifest, icons, meta, optional caching.~~
9. ~~**Preferences**: the new keys.~~ They live in a mobile settings sheet that
   embeds `PreferencesDialog.vue` rather than being added to it.

## Testing

- Every new Vue component gets at least a sanity test — CLAUDE.md requires it.
  Ask before writing feature-rich tests.
- `npm run lint` and `npm run test:client` must pass. Run `npm run build:client`
  before pushing anything that touches webpack-resolved imports.
- Playwright is not currently installed in the CI image used for these sessions.
  Do not add Playwright-based mobile tests without first confirming the runner
  can install browsers.
- Manual check on a real phone at the end of each phase. Simulators hide
  touch-target and safe-area problems.

## What was built differently

Four places where the implementation departs from the plan above, and why.

- **Cards scaled with `zoom` at first, and no longer do.** `zoom` scales the
  layout box as well as the paint, which is the property the plan was reaching
  for — but it scales the computed font sizes too, and that turned out to be
  fatal. See below.

- **Tile placement is confirmed in the shell's own bar.** `SelectSpace` still
  honours `hide_tile_confirmation`, but on the mobile layout it no longer opens
  `ConfirmDialog`: that dialog sat over the board, hiding the space it asked
  about. It offers the tap through `spaceSelection.offerPlacement`, and the bar
  under the map turns from "Choose a space · Actions" into "Place here? ✕ ✓".
  Tapping another blinking space simply moves the choice.
  While the bar asks, the tapped space shows the tile it would get, faded and
  pulsing, with the player's cube on it (`BoardSpace` reads the pending
  placement). The server says which tile through `SelectSpaceModel.tileType`,
  which `SelectSpace.placing()` sets for cities, greeneries, oceans and the
  special tiles placed through `PlaceTile`; where it is not set, a bright hex
  marks the space instead.

- **The shell learns about a placement from `SelectSpace` itself**, through
  `src/client/utils/spaceSelection.ts`. The top-level `waitingFor` does not show
  a nested `SelectSpace`, and the clicks are wired onto the board's DOM rather
  than declared in the model, so there is nothing else to watch. On that signal
  the shell switches to the board, scrolls it into view and closes the sheet.

- **Played cards are a grid, not `StackedCards`.** A stacked card's only
  affordance is hover, which does not exist on a touch screen — the same
  reasoning the plan applies to `magnify_cards`. The desktop grouping
  (Corporation, Active, Automated, Events) is kept.

- **Double-tap zoom is suppressed while a space is being chosen**, so it cannot
  fight tap-to-place. A drag's trailing click is swallowed for the same reason.

- **The end-game breakdown stays a table.** The plan said cards; the table is up
  to seventeen numeric columns, and one card per player would put each number
  beside its own label but no longer beside the same number for anyone else,
  which is what a score table is read for. It scrolls sideways in a box of its
  own instead, with the player column held at the left.

## Open questions

- Landscape: leave it to whatever the portrait CSS does, or give the board a
  dedicated landscape layout where 620px nearly fits 1:1?
- Turmoil and Colonies sit under the board with milestones and awards. In a full
  Turmoil-plus-Colonies game that column is long; it may want its own tab.
- The spectator view still gets the desktop layout at phone width.
- The create-game sections are closed on arrival except the player count. A
  returning player who always turns the same four expansions on may want the
  sections they last opened remembered instead.
