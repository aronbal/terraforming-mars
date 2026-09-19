# Mobile shell

A plan for making the game playable on a phone without changing the board, the
cards, or the desktop client.

Status: **planned, not implemented.** This document is the handoff. Nothing in
`src/` has changed yet.

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
PlayerHome.vue                  unchanged, desktop
MobilePlayerHome.vue     NEW    composes the SAME children into tabs and sheets
useMobileLayout.ts       NEW    viewport width + preference -> which shell
```

`App.vue` picks the shell for `screen === 'player-home'` and
`screen === 'spectator-home'`. Everything below that — `Board`, `Card`,
`SortableCards`, `PlayersOverview`, `LogPanel`, `WaitingFor`, `Milestones`,
`Awards`, `Colony` — is reused unmodified.

A `--tm-scale` custom property drives board scaling and a `--tm-card-scale`
drives card scaling. Both are applied with `transform: scale()` on a wrapper
whose own box is sized with `calc()`, so the layout box and the painted size
agree. This is the part the earlier branches got wrong.

New preference keys in `PreferencesManager.ts` (append to `Preferences`, keep the
existing formatting — do not reformat the file):

- `mobile_layout: 'auto' | 'on' | 'off'`
- `card_scale: number` (0.40–1.00)
- `tag_row: 'auto' | 'always' | 'never'`
- `confirm_tile_placement: boolean` (the existing `hide_tile_confirmation` may
  cover this — check before adding)
- `action_sheet_peek: boolean`

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

A five-item bottom tab bar: **Board · Cards · Act · Players · Log**.

`Act` is not a destination. It raises a bottom sheet over whichever pane is
already open, with four stops:

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

A persistent header carries generation, TR, the three global parameters as
current/max (`-16°/+8°`, `9%/14%`, `5/9`), and the six resources with their
production.

## Cards

The Cards tab holds a segmented control: **Hand | Played**.

- **Hand** — the existing `SortableCards`, scaled by `--tm-card-scale`.
- **Played** — the tableau grouped as the desktop groups it: Corporation, Active,
  Automated (stacked), Events (stacked). Cards with an unused action get a
  visible "action ready" marker.

Cards magnify on **tap**. The existing `magnify_cards` preference is hover-based
and is therefore dead functionality on touch; it needs a touch path.

**Tag row.** A thin strip in the header showing tag counts. It opens itself on
the Cards tab, where you judge card requirements, and folds away on other tabs.
Tapping it overrides that until the next tab change. The `tag_row` preference
switches between `auto`, `always` and `never`. Counts come from the tableau, via
the existing `PlayerTags` logic — do not recompute them independently.

## Entry and startup screens

`App.vue` routes by a `screen` string. Each one needs a mobile pass. Some already
have partial responsive rules — check before writing new ones.

| Screen | Component | Existing mobile CSS | Work |
| --- | --- | --- | --- |
| `start-screen` | `StartScreen.vue` | `start_screen.less` has 1023 / 767 blocks | Verify against `width=device-width`; the existing rules were written for the 1260px viewport |
| `create-game-form` | `CreateGameForm` | `create_game_form.less` has 1023 / 767 blocks | Longest form in the app. Needs step-by-step or accordion treatment on a phone |
| `load` / `continue-game` | `LoadGameForm`, `ContinueGame` | `continue_game.less` has a 767 block | Light touch |
| `games-overview` | `GamesOverview` | `games-overview.less`, none | Table → cards |
| `game-home` | `GameHome.vue` | `game_home.less` has 1023 / 767 blocks | Waiting room; mostly fine |
| **initial card selection** | `SelectInitialCards.vue` | none | **The hardest one.** Corporation + prelude + CEO + 10 project cards, all as `SelectCard` grids, on one screen. Needs the same segmented/stepped treatment as the Cards tab |
| `player-home` | `PlayerHome.vue` | none | The shell above |
| `spectator-home` | `SpectatorHome.vue` | none | Same shell, read-only |
| `the-end` | `GameEnd.vue` | `game_end.less`, none | Score table → stacked cards |
| `cards` | `CardList` | `card_list.less`, none | Card browser; scale with `--tm-card-scale` |

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

1. **Shell skeleton.** `MobilePlayerHome.vue`, `useMobileLayout.ts`, tab bar,
   header, empty panes. Desktop untouched. Viewport meta flipped.
2. **Board pane.** Full-artwork stage, pinch-zoom, tracks, tap-target overlay.
3. **Placement.** Legal-space highlighting, sheet dismissal, confirm bar.
4. **Action sheet.** Pixel snap stops, drag, the four positions.
5. **Cards.** Hand/Played segment, tap-to-magnify, `--tm-card-scale`, tag row.
6. **Board extras.** Milestones, awards, then colonies, turmoil, moon,
   pathfinders.
7. **Entry screens**, in the table's order of difficulty.
8. **PWA**: manifest, icons, meta, optional caching.
9. **Preferences**: the new keys, wired into `PreferencesDialog.vue`.

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

## Open questions

- Does the 52px scroll handle below the board feel right, or does the board read
  as stuck?
- Should `peek` stay on by default, or should the sheet default to closed and be
  reached only through the Act tab?
- Landscape: leave it to whatever the portrait CSS does, or give the board a
  dedicated landscape layout where 620px nearly fits 1:1?
- Where do Turmoil and Colonies go — under the board with milestones and awards,
  or their own tab once the board column gets long?
