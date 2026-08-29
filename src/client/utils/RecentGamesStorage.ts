// Remembers the games this browser has opened, so the start screen can offer a
// way back into them.
//
// The server has no notion of "my games" — a game is reachable only through the
// unguessable player, spectator or game id handed out when it was created. Losing
// that link loses the game, so each visit records the id here, in localStorage,
// under a single entry holding the whole list.
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {GameId, ParticipantId} from '@/common/Types';

const STORAGE_KEY = 'recentGames';
const MAX_ENTRIES = 12;
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/** How a remembered game is rejoined, which decides both the id and the page. */
export type RecentGameKind = 'player' | 'spectator' | 'game';

export type RecentGame = {
  /** The player, spectator or game id that leads back into the game. */
  id: ParticipantId | GameId;
  kind: RecentGameKind;
  /** The game's generated name, which is friendlier to read than its id. */
  gameName: string;
  /** The player's name. Absent for spectator and game entries. */
  name?: string;
  color?: Color;
  generation?: number;
  phase?: Phase;
  /** When this game was last opened in this browser. */
  lastSeenMs: number;
};

function localStorageSupported(): boolean {
  return typeof localStorage !== 'undefined';
}

function isRecentGame(entry: unknown): entry is RecentGame {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }
  const candidate = entry as Partial<RecentGame>;
  return typeof candidate.id === 'string' &&
    typeof candidate.gameName === 'string' &&
    typeof candidate.lastSeenMs === 'number' &&
    (candidate.kind === 'player' || candidate.kind === 'spectator' || candidate.kind === 'game');
}

function read(): Array<RecentGame> {
  try {
    if (!localStorageSupported()) {
      return [];
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const oldest = Date.now() - TTL_MS;
    return parsed
      .filter(isRecentGame)
      .filter((entry) => entry.lastSeenMs > oldest)
      .sort((a, b) => b.lastSeenMs - a.lastSeenMs);
  } catch (err) {
    console.warn('unable to read recent games from local storage', err);
    return [];
  }
}

function write(entries: ReadonlyArray<RecentGame>): void {
  try {
    if (!localStorageSupported()) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch (err) {
    console.warn('unable to store recent games in local storage', err);
  }
}

/** The games opened in this browser, most recently opened first. */
export function getRecentGames(): Array<RecentGame> {
  return read();
}

/**
 * Records a visit to a game, so it shows up on the continue-game screen.
 *
 * An id already on the list is refreshed in place, which keeps its details
 * current and moves it to the front.
 */
export function rememberGame(game: Omit<RecentGame, 'lastSeenMs'>): void {
  const entries = read().filter((entry) => entry.id !== game.id);
  entries.unshift({...game, lastSeenMs: Date.now()});
  write(entries);
}

/** Drops a game from the list. The game itself is untouched. */
export function forgetGame(id: RecentGame['id']): void {
  write(read().filter((entry) => entry.id !== id));
}

/** Drops every game from the list. */
export function forgetAllGames(): void {
  write([]);
}
