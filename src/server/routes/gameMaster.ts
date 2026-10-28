import * as responses from '../server/responses';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Context} from './IHandler';
import {isPlayerId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';

/**
 * The game and its game master, when the request's `id` is the game master's.
 *
 * Otherwise the request has been answered with what is wrong, and this resolves undefined.
 */
export async function gameMasterOf(req: Request, res: Response, ctx: Context): Promise<{game: IGame, player: IPlayer} | undefined> {
  const playerId = ctx.url.searchParams.get('id');
  if (playerId === null) {
    responses.badRequest(req, res, 'missing id parameter');
    return undefined;
  }
  if (!isPlayerId(playerId)) {
    responses.badRequest(req, res, 'invalid player id');
    return undefined;
  }

  ctx.ipTracker.addParticipant(playerId, ctx.ip);

  const game = await ctx.gameLoader.getGame(playerId);
  if (game === undefined) {
    responses.notFound(req, res, 'cannot find game for that player');
    return undefined;
  }
  let player: IPlayer | undefined;
  try {
    player = game.getPlayerById(playerId);
  } catch (err) {
    console.warn(`unable to find player ${playerId}`, err);
  }
  if (player === undefined) {
    responses.notFound(req, res, 'player not found');
    return undefined;
  }
  if (game.gameMaster() !== player) {
    responses.badRequest(req, res, 'only the game master, who set the game up, can go back a save');
    return undefined;
  }
  return {game, player};
}
