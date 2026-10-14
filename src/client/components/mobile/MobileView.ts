/**
 * The views the mobile shell's segmented control switches between.
 *
 * `turn` is everything the player can do right now, and where a turn opens. The
 * board, the whole hand and the log sit beside it rather than behind a tab bar, so
 * there are only four places to be.
 */
export const MOBILE_VIEWS = ['turn', 'board', 'cards', 'log'] as const;

export type MobileView = typeof MOBILE_VIEWS[number];

/** The sheet's resting positions, ordered from most to least hidden. */
export const SHEET_SNAPS = ['closed', 'peek', 'half', 'full'] as const;

export type SheetSnap = typeof SHEET_SNAPS[number];

/*
 * The handle the sheet leaves at the bottom of the screen at the `peek` stop, in
 * pixels.
 *
 * Deliberately a fixed pixel count rather than a fraction of the sheet: as a
 * percentage it grew tall enough to cover the tile-placement bar, putting the
 * confirmation out of reach. It is also the height every pane leaves free at its
 * bottom while the handle shows, so the last row of a pane is never stranded under it.
 *
 * Keep it in step with `@mobile-sheet-peek` in `mobile_shell.less`.
 */
export const SHEET_PEEK_PX = 46;
