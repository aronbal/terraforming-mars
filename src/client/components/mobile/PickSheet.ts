import {InputResponse} from '@/common/inputs/InputResponse';
import {PlayerInputModel, SelectColonyModel, SelectPartyModel} from '@/common/models/PlayerInputModel';

/** Option `entry` of the choice the player is waiting on, or with no entry, the question itself. */
function questionAt(waitingFor: PlayerInputModel | undefined, entry: number | undefined): PlayerInputModel | undefined {
  return entry === undefined ? waitingFor : (waitingFor?.type === 'or' ? waitingFor.options[entry] : undefined);
}

/** The party a delegate is being sent to, when that is the question at `entry`. */
export function partyInput(waitingFor: PlayerInputModel | undefined, entry?: number): SelectPartyModel | undefined {
  const input = questionAt(waitingFor, entry);
  return input?.type === 'party' ? input : undefined;
}

/** The colony to build on, when that is the question at `entry`. */
export function colonyInput(waitingFor: PlayerInputModel | undefined, entry?: number): SelectColonyModel | undefined {
  const input = questionAt(waitingFor, entry);
  return input?.type === 'colony' ? input : undefined;
}

/** `response`, sent as option `entry` of the choice when there is one. */
export function entryResponse(entry: number | undefined, response: InputResponse): InputResponse {
  return entry === undefined ? response : {type: 'or', index: entry, response};
}
