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
mobile/MobilePlayerHome.vue             composes the SAME children into tabs and sheets
mobile/MobileHeader.vue                 generation, TR, globals, resources, tag row
mobile/MobileInitialCards.vue           the opening hand, one selection at a time
mobile/MobileTagRow.vue                 tag counts, from the model's own totals
mobile/MobileBoardPane.vue              the 620x600 stage, pinch, pan, zoom HUD
mobile/MobileActionPanel.vue            WaitingFor: a tab for the menu, a sheet for a question
mobile/MobileActionList.vue             the turn's menu as grouped rows
mobile/MobileActionMenu.ts              which entries group where, and which live elsewhere
mobile/MobileCardsPane.vue              Hand | Played, ready cards first
mobile/MobileFitBlock.vue               scales a desktop-width block down to the phone
mobile/MobileFocusStage.vue             the card or tile being acted on, over a faded board
mobile/MobileMore.vue                   the log, the settings, the way to another game
mobile/MobileSettings.vue               the preferences that mean something on a phone
mobile/MobileTabBar.vue                 Board / Cards / Act / Players / More
mobile/MobileTab.ts                     the tab and snap names, and the peek height
components/InitialCards.ts              the opening hand's arithmetic, shared with the desktop
create/CreateGameSection.vue            a headed section of the create-game form
utils/useMobileLayout.ts                viewport width + preference -> which shell
utils/spaceSelection.ts                 whether a tile is being placed
utils/cardSelection.ts                  a card picked on one tab, for an input on another
utils/boardSelection.ts                 the same, for a milestone, an award or a colony tile
utils/mobileFocus.ts                    whether the panel shows one thing, and whether rows route
utils/mobileNavigation.ts               a tab the game asks the shell to open
styles/mobile_shell.less                everything the shell paints
```

`App.vue` picks the shell for `screen === 'player-home'`. Everything below it —
`Board`, `Card`, `PlayersOverview`, `LogPanel`, `WaitingFor`, `Milestones`,
`Awards`, `Colony`, `Turmoil`, `MoonBoard`, `PlanetaryTracks` — is reused as it
is. `Milestone` and `Award` gained one optional prop each (`claimable`,
`fundable`) and an event, so the shell can make a tile the button that claims it;
with nothing passed they behave exactly as the desktop always had them. The panes are held in the DOM with `v-show` rather than `v-if`,
because `SelectSpace` reaches into the board by `getElementById` and needs it
mounted even when another tab is open.

The board stage is transformed inside a clipping viewport, so the layout box
never matters. Cards use a `--mobile-card-scale` custom property applied with
`transform: scale()`, and give back the room a transform saves themselves — see
**Scaling down is a picture operation** below.

New preference keys in `PreferencesManager.ts`:

- `mobile_layout: 'auto' | 'on' | 'off'`
- `card_scale: number` (0.40–1.00)
- `tag_row: 'auto' | 'always' | 'never'`
- `card_tap: 'magnify' | 'play'` (what tapping a card on the Cards tab does)
- `play_from: 'tabs' | 'actions'` (where an action started by a tap is finished)
- `action_sheet_peek: boolean`
- `mobile_tap_targets: boolean` (the 44px overlay)

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

Known friction to watch: the board viewport has `touch-action: none`, so you
cannot scroll the column by dragging on the board. Leave ~52px of the
"Milestones & Awards" header visible as a tappable handle that scrolls the
column. Validate this on a real device; if it still feels stuck, consider a
dedicated scroll affordance.

## Navigation

A five-item bottom tab bar: **Board · Cards · Act · Players · More**.

`Act` is where the turn's own menu lives, and it is a destination like any other
tab. The same panel becomes a sheet over whichever pane is open when the server
asks a follow-up question instead — a question interrupts what you were doing, a
menu does not. It is one element either way, so the single `WaitingFor` inside it
survives the change; only its class and geometry differ. As a sheet it has four
stops:

| Stop | Position |
| --- | --- |
| closed | fully off screen |
| peek | a fixed **46px** handle above the tab bar |
| half | 50% of the sheet height |
| full | 96% |

Compute the stops in **pixels, not percentages**. The prototype originally used
percentages of the sheet height, which made "peek" ~74px and let it cover the
placement confirm bar — the confirm button was unreachable without manually
dragging the sheet down. The confirm bar also needs a higher `z-index` than the
sheet as a second line of defence.

Only the `full` stop dims the board. At `half` the map stays fully readable,
which is the entire point of the sheet.

**The menu itself** is a list of rows, grouped by what the entry is for. This is
possible because `OrOptions.toModel` now carries each option's `ActionAnnotation`
out to the client: the ids existed for the computer opponent, but every `toModel`
dropped them, leaving the client nothing to match on but translated titles.

The entries whose subject is drawn somewhere else are not offered in the menu at
all. The card entries — play a project card, use a played card's action, a CEO's
action, sell patents — are rows that take the player to the Cards tab; the
milestone, award and colony entries take them to the Board tab, where those tiles
already sit under the map. Either way the thing itself is what they tap. Once
something has been picked there the entry opens instead of pointing away, holding
that choice and its payment; without that, the two tabs would point at each other
forever.

**Where the choice is finished** is the player's, through `play_from`.

`tabs`, the default, holds the thing itself up over a faded board — the card at
the size it was read at, or the milestone or award with its description — and
puts a panel under it that is only the price and the button. It is as tall as
that needs and no taller. They have already said what they are doing, so neither
the rest of the menu nor a second copy of the card is offered around it. Tapping
the faded board, or the panel's head, abandons the pick.

A colony is the exception: it is chosen inside the trade itself, alongside the
fee, so there is nothing to hold up and the panel keeps the whole screen.

**The payment widget is left as the desktop draws it**, and is the same on both
tabs — it is the same money either way. The one thing the shell states is its
size: the widget sizes each running subtotal explicitly at 20px and lets the
total they add up to inherit, which on a desktop is 23px and inside the shell
was 14px. That made the number deciding whether the button can be pressed the
smallest thing on the row.

**The payment widget is the same either way.** It is drawn for a desktop column,
where its two sides — what you spend, and what it is worth in M€ — are obviously
one table; at phone width the values drifted away from the rows they belonged
to, so the shell rules them off into a column. It also sizes each running
subtotal explicitly at 20px and lets the total they add up to inherit, which on
a desktop is 23px and inside the shell was 14px: the number that decides whether
the button can be pressed, drawn as the least of its own parts. The shell states
that size rather than inheriting it.

`actions` takes them to the Act tab instead — and then nothing in the menu may
send them anywhere. Every entry unfolds in place, cards and all, the way the
desktop menu does, because a setting that says "do it all from Act" cannot hand
back a row that is a link to another tab. That is what `MenuContext.routes`
switches off.

**More** holds the game log, the settings and the links to another game. They are
things a player reaches for between decisions rather than during one, so they
share the last tab instead of each taking one of the five. The settings are the
mobile keys plus the preferences that mean something on a phone, grouped; the
desktop `PreferencesDialog` is not embedded, because a third of its switches are
about parts of the desktop layout the shell never draws.

**The board's own tiles** take the tap directly. A milestone the turn's menu
offers is ringed and claims itself; so does an award, and so does a colony tile
the player can trade with. What is offered is read off the menu rather than
recomputed — the server has already worked out what this player can afford and
reach, and a second opinion here could only ever be wrong.

A persistent header carries generation, TR, the three global parameters as
current/max (`-16°/+8°`, `9%/14%`, `5/9`), and the six resources with their
production.

## Cards

The Cards tab holds a segmented control: **Hand | Played**.

- **Hand** — the hand in the player's own order, scaled by `--mobile-card-scale`.
- **Played** — the tableau grouped as the desktop groups it: Corporation, Active,
  Automated, Events.

Cards this turn has a move for are ringed and sort to the front of their group;
the rest are dimmed in place, because a card you cannot afford this generation is
still what you plan the next one around.

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

A tap opens the card to read it, with **Play card** or **Use action** on the
opened card, and tapping the card again puts it back down. `card_tap: 'play'`
makes a tap play the card outright; opening it first is the default, because a
mis-tap that plays a card costs a turn. The existing `magnify_cards` preference is
hover-based and therefore dead on touch.

**Tag row.** A thin strip in the header showing tag counts. It opens itself on
the Cards tab, where you judge card requirements, and folds away on other tabs.
Tapping it overrides that until the next tab change. The `tag_row` preference
switches between `auto`, `always` and `never`. Counts come from the tableau, via
the existing `PlayerTags` logic — do not recompute them independently.

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

- **Tile placement keeps the existing `ConfirmDialog`.** `SelectSpace` already
  confirms a tap, and honours `hide_tile_confirmation`. Rather than build a
  second confirmation, the shell restyles that dialog to sit at the bottom of
  the screen above the sheet, and adds a bar of its own that says a placement is
  under way and offers a way back to the action list.

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

- Does the 52px scroll handle below the board feel right, or does the board read
  as stuck? It is a tap rather than a drag: tapping it scrolls the column to the
  milestones and back.
- Landscape: leave it to whatever the portrait CSS does, or give the board a
  dedicated landscape layout where 620px nearly fits 1:1?
- Turmoil and Colonies sit under the board with milestones and awards. In a full
  Turmoil-plus-Colonies game that column is long; it may want its own tab.
- The spectator view still gets the desktop layout at phone width.
- The create-game sections are closed on arrival except the player count. A
  returning player who always turns the same four expansions on may want the
  sections they last opened remembered instead.
