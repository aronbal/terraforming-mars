/** The panes the mobile shell can show. `actions` raises the sheet instead of switching pane. */
export const MOBILE_TABS = ['board', 'cards', 'actions', 'players', 'log'] as const;

export type MobileTab = typeof MOBILE_TABS[number];

/** The sheet's resting positions, ordered from most to least hidden. */
export const SHEET_SNAPS = ['closed', 'peek', 'half', 'full'] as const;

export type SheetSnap = typeof SHEET_SNAPS[number];
