import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {gameMasterOf} from './gameMaster';
import {SaveModel} from '../../common/models/SaveModel';

/** How many earlier saves the game master can pick from. */
const SAVES_LISTED = 30;
/** How many of the lines logged before a save are sent to describe it. */
const LINES_PER_SAVE = 3;

/**
 * The saves the game master can take the game back to, newest first, each described
 * by where it stands and what was done just before it. The latest save is the game
 * as it is, so it is not one of them.
 */
export class ApiGameSaves extends Handler {
  public static readonly INSTANCE = new ApiGameSaves();

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    const found = await gameMasterOf(req, res, ctx);
    if (found === undefined) {
      return;
    }
    const {game, player} = found;

    const saves = await ctx.gameLoader.getRecentSaves(game.id, SAVES_LISTED + 1);
    const models: Array<SaveModel> = saves.slice(0, -1).map(({saveId, game: saved}, index) => {
      // The lines since the save before; the oldest one listed has no save before it at hand.
      const since = index === 0 ? 0 : saves[index - 1].game.gameLog.length;
      const log = saved.gameLog
        .slice(since)
        .filter((message) => message.playerId === undefined || message.playerId === player.id)
        .slice(-LINES_PER_SAVE);
      return {
        saveId,
        generation: saved.generation,
        activePlayer: saved.players.find((p) => p.id === saved.activePlayer)?.color,
        log,
      };
    });
    responses.writeJson(res, ctx, models.reverse());
  }
}
