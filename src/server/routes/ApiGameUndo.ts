import * as responses from '../server/responses';
import {IPlayer} from '../IPlayer';
import {Server} from '../models/ServerModel';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {isPlayerId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';

/**
 * Turns the game's undo option on or off for a game already under way, for a player
 * who forgot to set it when the game was created. Any player in the game may do it,
 * and the log says who did, so no one is surprised by it.
 *
 * Answers with the player's view, as an input would.
 */
export class ApiGameUndo extends Handler {
  public static readonly INSTANCE = new ApiGameUndo();

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
    const value = ctx.url.searchParams.get('undo');
    if (value !== 'true' && value !== 'false') {
      responses.badRequest(req, res, 'undo must be true or false');
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

    const enabled = value === 'true';
    if (game.gameOptions.undoOption !== enabled) {
      game.setUndoOption(enabled);
      game.log(enabled ? '${0} turned undo on' : '${0} turned undo off', (b) => b.player(player));
    }
    responses.writeJson(res, ctx, Server.getPlayerModel(player));
  }
}
