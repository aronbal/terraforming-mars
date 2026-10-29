import * as responses from '../server/responses';
import {IPlayer} from '../IPlayer';
import {Server} from '../models/ServerModel';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {isPlayerId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';

/**
 * Takes back the action a player chose from their turn's menu while it still asks
 * them something -- a space to place a tile on, a target, an award to fund -- and
 * hands them the menu again. It goes back to the save made just before that menu,
 * so it is an Undo of an action not yet finished, and is allowed only where Undo is.
 *
 * Answers with the player's view, as an input would.
 */
export class ApiCancelAction extends Handler {
  public static readonly INSTANCE = new ApiCancelAction();

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

    const saveId = player.cancelActionSaveId();
    if (saveId === undefined) {
      responses.badRequest(req, res, 'there is no action to take back');
      return;
    }
    try {
      const restored = await ctx.gameLoader.restoreGameAt(game.id, saveId);
      // The save gone back to can predate undo being turned on mid-game.
      restored.setUndoOption(game.gameOptions.undoOption);
      player = restored.getPlayerById(player.id);
    } catch (err) {
      console.error(err);
      game.log('Unable to take the action back. Error retrieving game from database. Please try again.', () => {}, {reservedFor: player});
    }
    responses.writeJson(res, ctx, Server.getPlayerModel(player));
  }
}
