import {NewPlayerModel} from '@/common/game/NewGameConfig';
import {PlayerId} from '@/common/Types';

/**
 * Where a new game goes straight to: the one person's own view, when every other seat
 * is a computer, so there are no links to hand out. Undefined when there are other
 * people to send links to.
 */
export function onlyHumanPlayer(
  created: {players: ReadonlyArray<{id: PlayerId, color: string}>},
  seats: ReadonlyArray<Pick<NewPlayerModel, 'color' | 'bot'>>,
): PlayerId | undefined {
  const people = seats.filter((seat) => seat.bot === undefined);
  if (people.length !== 1) {
    return undefined;
  }
  return created.players.find((player) => player.color === people[0].color)?.id;
}
