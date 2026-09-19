/** The panes the mobile shell can show. `actions` raises the sheet instead of switching pane. */
export const MOBILE_TABS = ['board', 'cards', 'actions', 'players', 'log'] as const;

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
