import {Phase} from '@/common/Phase';
import {PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';

// Labels describing the player's current state
export type ActionLabel = 'active' | 'passed' | 'next' | 'none' | 'drafting' | 'researching' | '';

const SHOW_NEXT_LABEL_MIN = 2;

/** What `player` is doing right now, as the players overview labels it. */
export function actionLabel(playerView: ViewModel, player: PublicPlayerModel): ActionLabel {
  const game = playerView.game;
  const players = playerView.players;
  if (game.phase === Phase.DRAFTING) {
    return player.needsToDraft ? 'drafting' : 'none';
  } else if (game.phase === Phase.RESEARCH) {
    return player.needsToResearch ? 'researching' : 'none';
  }
  if (game.passedPlayers.includes(player.color)) {
    return 'passed';
  }
  if (player.isActive) {
    return 'active';
  }
  const notPassedPlayers = players.filter((p) => !game.passedPlayers.includes(p.color));
  const currentPlayerIndex = notPassedPlayers.findIndex((p) => p.color === player.color);
  if (currentPlayerIndex === -1) {
    return 'none';
  }
  const prevPlayerIndex = currentPlayerIndex === 0 ? notPassedPlayers.length - 1 : currentPlayerIndex - 1;
  const isNext = notPassedPlayers[prevPlayerIndex].isActive;
  if (isNext && players.length > SHOW_NEXT_LABEL_MIN) {
    return 'next';
  }
  return 'none';
}
