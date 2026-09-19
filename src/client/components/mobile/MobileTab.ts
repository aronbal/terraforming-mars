/**
 * The panes the mobile shell can show.
 *
 * `actions` holds the turn's own menu; it is also where a question the server asks
 * mid-action arrives, and there it is a sheet over another pane rather than a place
 * to navigate to. `more` is everything that is not the game in front of you: the log,
 * the settings, and the way to another game.
 */
export const MOBILE_TABS = ['board', 'cards', 'actions', 'players', 'more'] as const;

export type MobileTab = typeof MOBILE_TABS[number];

/** The sheet's resting positions, ordered from most to least hidden. */
export const SHEET_SNAPS = ['closed', 'peek', 'half', 'full'] as const;

export type SheetSnap = typeof SHEET_SNAPS[number];

/*
 * The handle the sheet leaves above the tab bar at the `peek` stop, in pixels.
 *
 * Deliberately a fixed pixel count rather than a fraction of the sheet: as a
 * percentage it grew tall enough to cover the tile-placement bar, putting the
 * confirmation out of reach. It is also the height every pane leaves free at its
 * bottom, so the last row of a pane is never stranded under the handle.
 *
 * Keep it in step with `@mobile-sheet-peek` in `mobile_shell.less`.
 */
export const SHEET_PEEK_PX = 46;
