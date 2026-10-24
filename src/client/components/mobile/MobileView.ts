/**
 * The views the mobile shell's segmented control switches between.
 *
 * `turn` is everything the player can do right now, and where a turn opens. The
 * board, the whole hand and the log sit beside it rather than behind a tab bar, so
 * there are only four places to be.
 */
export const MOBILE_VIEWS = ['turn', 'board', 'cards', 'log'] as const;

export type MobileView = typeof MOBILE_VIEWS[number];

/*
 * The sheet's resting positions, ordered from most to least hidden.
 *
 * There is no stop between closed and half. A handle parked at the bottom of every
 * pane read as a second, half-hidden screen; the sheet is now either up or gone, and
 * the turn page, the placement bar and the header's turn pill bring it back.
 */
export const SHEET_SNAPS = ['closed', 'half', 'full'] as const;

export type SheetSnap = typeof SHEET_SNAPS[number];
