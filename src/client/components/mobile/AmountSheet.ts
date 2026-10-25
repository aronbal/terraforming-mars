import {InputResponse} from '@/common/inputs/InputResponse';
import {PlayerInputModel, SelectAmountModel} from '@/common/models/PlayerInputModel';

/**
 * The number the player is being asked for: option `entry` of the choice they are
 * waiting on, or with no entry, the question itself when that is a number.
 */
export function amountInput(waitingFor: PlayerInputModel | undefined, entry?: number): SelectAmountModel | undefined {
  const input = entry === undefined ? waitingFor : (waitingFor?.type === 'or' ? waitingFor.options[entry] : undefined);
  return input?.type === 'amount' ? input : undefined;
}

/** The answer that sends `amount`, as option `entry` of the choice when there is one. */
export function amountResponse(entry: number | undefined, amount: number): InputResponse {
  const response: InputResponse = {type: 'amount', amount};
  return entry === undefined ? response : {type: 'or', index: entry, response};
}
