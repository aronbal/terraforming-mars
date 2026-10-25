import * as responses from '../server/responses';
import {IPlayer} from '../IPlayer';
import {Server} from '../models/ServerModel';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {isPlayerId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';
import {BotRunner} from '../bot/BotRunner';

/**
 * Takes a game back to the save before its latest one, for more than Undo offers.
 * The latest save is deleted. Only the game master may, since it takes back the
 * other players' moves too, and the log says who did.
 *
 * Answers with the player's view, as an input would.
 */
export class ApiGameRollback extends Handler {
  public static readonly INSTANCE = new ApiGameRollback();

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const playerId = ctx.url.searchParams.get('id');
    if (playerId === null) {
      responses.badRequest(req, res, 'missing id parameter');
      return;
    }
    if (!isPlayerId(playerId)) {
      responses.badRequest(req, res, 'invalid player id');
      return;
    }

    ctx.ipTracker.addParticipant(playerId, ctx.ip);

    const game = await ctx.gameLoader.getGame(playerId);
    if (game === undefined) {
      responses.notFound(req, res, 'cannot find game for that player');
      return;
    }
    let player: IPlayer | undefined;
    try {
      player = game.getPlayerById(playerId);
    } catch (err) {
      console.warn(`unable to find player ${playerId}`, err);
    }
    if (player === undefined) {
      responses.notFound(req, res, 'player not found');
      return;
    }
    if (game.gameMaster() !== player) {
      responses.badRequest(req, res, 'only the game master, who set the game up, can go back a save');
      return;
    }

    const restored = await ctx.gameLoader.restorePreviousSave(game.id);
    if (restored === undefined) {
      responses.badRequest(req, res, 'there is no earlier save to go back to');
      return;
    }
    // The save gone back to can predate undo being turned on mid-game.
    restored.setUndoOption(game.gameOptions.undoOption);
    const restoredPlayer = restored.getPlayerById(playerId);
    // Logged, not saved: saving now would add a save, and going back again would land here.
    restored.log('${0} went back one save', (b) => b.player(restoredPlayer));
    // A save made between the computers' moves resumes with them.
    BotRunner.run(restored);
    responses.writeJson(res, ctx, Server.getPlayerModel(restoredPlayer));
  }
}
