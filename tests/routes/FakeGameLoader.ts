import {IGameLoader} from '../../src/server/database/IGameLoader';
import {GameIdLedger} from '../../src/server/database/IDatabase';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {GameId, isGameId, PlayerId, SpectatorId} from '../../src/common/Types';
import {SerializedGame} from '../../src/server/SerializedGame';

export class FakeGameLoader implements IGameLoader {
  private games: Map<GameId, IGame> = new Map();
  add(game: IGame): Promise<void> {
    this.games.set(game.id, game);
    return Promise.resolve();
  }
  async getIds(): Promise<Array<GameIdLedger>> {
    return Array.from(this.games.keys())
      .map((gameId) => {
        return {gameId: gameId, participantIds: []};
      });
  }
  public getGame(id: GameId | PlayerId | SpectatorId): Promise<IGame | undefined> {
    if (isGameId(id)) {
      return Promise.resolve(this.games.get(id));
    }

    for (const game of Array.from(this.games.values())) {
      const matches = game.playersInGenerationOrder.some((player) => player.id === id) || game.spectatorId === id;
      if (matches) {
        return Promise.resolve(game);
      }
    }
    return Promise.resolve(undefined);
  }
  restoreGameAt(_gameId: string, _saveId: number): Promise<Game> {
    throw new Error('Method not implemented.');
  }
  /** What `restorePreviousSave` resolves to, one game per call. */
  public previousSaves: Array<IGame | undefined> = [];
  /** The save ids `restorePreviousSave` was asked for, one per call. */
  public restoredSaveIds: Array<number | undefined> = [];
  public restorePreviousSave(_gameId: GameId, saveId?: number): Promise<IGame | undefined> {
    this.restoredSaveIds.push(saveId);
    return Promise.resolve(this.previousSaves.shift());
  }
  /** What `getRecentSaves` resolves to. */
  public recentSaves: Array<{saveId: number, game: SerializedGame}> = [];
  public getRecentSaves(_gameId: GameId, count: number): Promise<Array<{saveId: number, game: SerializedGame}>> {
    return Promise.resolve(this.recentSaves.slice(-count));
  }
  public mark() {
  }
  public completeGame(_game: Game): Promise<void> {
    return Promise.resolve(undefined);
  }
  public saveGame(_game: Game) {
    return Promise.resolve(undefined);
  }
  public maintenance(): Promise<void> {
    return Promise.resolve();
  }
}
