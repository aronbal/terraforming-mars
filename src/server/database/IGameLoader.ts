import {IGame} from '../IGame';
import {PlayerId, GameId, SpectatorId} from '../../common/Types';
import {GameIdLedger} from './IDatabase';
import {SerializedGame} from '../SerializedGame';

/**
 * Loads games from javascript memory or database
 * Loads games from database sequentially as needed
 */
export interface IGameLoader {
  add(game: IGame): Promise<void>;
  getIds(): Promise<Array<GameIdLedger>>;
  /**
   * Fetches a game from the GameLoader cache.
   *
   * @param {GameId | PlayerId | SpectatorId} id the id of the game to retrieve, or
   * one of its player ids, or its spectator id.
   * @param {boolean} forceLoad (default is false.) When true always load from the database,
   * which refreshes the cache. This should never be true during an active game except when
   * doing an adminstrative rollback. Don't even make this true for normal game undos.
   * That's what `restoreGameAt` is for.
   */
  getGame(id: GameId | PlayerId | SpectatorId, forceLoad?: boolean): Promise<IGame | undefined>;
  /**
   * Reload a game at a specific version, deleting all versions ahead of it.
   *
   * @param {GameId} gameId the id of the game to retrieve
   * @param {number} saveId the save id to load
   */
  restoreGameAt(gameId: GameId, saveId: number): Promise<IGame>;
  /**
   * Reload a game at an earlier save -- `saveId`, or else the one before the latest --
   * deleting every save after it. Resolves undefined when that is not a stored save
   * before the latest.
   */
  restorePreviousSave(gameId: GameId, saveId?: number): Promise<IGame | undefined>;
  /**
   * The game's latest saves, `count` at most, oldest first, each as it was saved.
   */
  getRecentSaves(gameId: GameId, count: number): Promise<Array<{saveId: number, game: SerializedGame}>>;
  /**
   * Mark a game to be purged from the cache. It will be
   * purged a a future call to `sweep`.
   *
   * @param {GameId} gameId the game to be removed from the cache. Only call this for completed games.
   */
  mark(gameId: GameId): void;

  /**
   * Saves a game (but takes into account that the game might have already been purged.)
   *
   * Do not call IDatabase.saveGame directly in a running system.
   */
  saveGame(game: IGame): Promise<void>;
  completeGame(game: IGame): Promise<void>;
  maintenance(): Promise<void>;
}
