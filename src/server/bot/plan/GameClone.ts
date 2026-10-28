import {Game} from '../../Game';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {SerializedGame} from '../../SerializedGame';
import {Phase} from '../../../common/Phase';
import {isICorporationCard} from '../../cards/corporation/ICorporationCard';

/**
 * True when `game` can be copied for `player` to try moves on.
 *
 * `Game.serialize` deliberately drops the deferred-action queue, so a copy
 * taken mid-action is not the position it came from. The top of an action,
 * with the queue empty and the action menu showing, is the one point that
 * survives a round trip exactly: loading a game in the action phase rebuilds
 * that very menu. Anything else, such as another player being asked
 * something, a corporation's first action or Double Down, is refused.
 */
export function canCloneSafely(game: IGame, player: IPlayer): boolean {
  return !game.simulation &&
    game.phase === Phase.ACTION &&
    game.deferredActions.length === 0 &&
    game.activePlayer === player &&
    player.isAtActionMenu() &&
    player.pendingInitialActions.length === 0 &&
    !game.inDoubleDown &&
    // Loading a first-generation game where someone has no corporation yet goes
    // back to the initial research phase rather than to this menu.
    game.players.every((other) => other.playedCards.some(isICorporationCard)) &&
    game.players.every((other) => other === player || other.getWaitingFor() === undefined);
}

/**
 * A disposable copy of `game` for a computer opponent to play moves out on.
 *
 * The copy goes through the same JSON round trip as a save, so it is the game
 * a reload would produce, and shares no objects with the original. It is a
 * simulation, so nothing done to it is saved or recorded, and it starts with
 * an empty log.
 */
export function cloneForLookahead(game: IGame): IGame {
  // The log is most of a late game's size and nothing a move depends on.
  const withoutLog: SerializedGame = {...game.serialize(), gameLog: []};
  return Game.deserialize(JSON.parse(JSON.stringify(withoutLog)), {simulation: true});
}
