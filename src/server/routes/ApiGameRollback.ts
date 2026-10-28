import * as responses from '../server/responses';
import {Server} from '../models/ServerModel';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {BotRunner} from '../bot/BotRunner';
import {gameMasterOf} from './gameMaster';

/**
 * Takes a game back to an earlier save, for more than Undo offers: `saveId`, one of
 * those `ApiGameSaves` lists, or else the save before the latest. The saves after it
 * are deleted. Only the game master may, since it takes back the other players' moves
 * too, and the log says who did.
 *
 * Answers with the player's view, as an input would.
 */
export class ApiGameRollback extends Handler {
  public static readonly INSTANCE = new ApiGameRollback();

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const saveIdParam = ctx.url.searchParams.get('saveId');
    const saveId = saveIdParam === null ? undefined : Number(saveIdParam);
    if (saveId !== undefined && (!Number.isInteger(saveId) || saveId < 0)) {
      responses.badRequest(req, res, 'invalid save id');
      return;
    }

    const found = await gameMasterOf(req, res, ctx);
    if (found === undefined) {
      return;
    }
    const {game, player} = found;

    const restored = await ctx.gameLoader.restorePreviousSave(game.id, saveId);
    if (restored === undefined) {
      responses.badRequest(req, res, 'there is no earlier save to go back to');
      return;
    }
    // The save gone back to can predate undo being turned on mid-game.
    restored.setUndoOption(game.gameOptions.undoOption);
    const restoredPlayer = restored.getPlayerById(player.id);
    // Logged, not saved: saving now would add a save, and going back again would land here.
    restored.log('${0} went back to an earlier save', (b) => b.player(restoredPlayer));
    // A save made between the computers' moves resumes with them.
    BotRunner.run(restored);
    responses.writeJson(res, ctx, Server.getPlayerModel(restoredPlayer));
  }
}
