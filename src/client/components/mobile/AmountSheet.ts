import {PlayerInputModel, SelectAmountModel} from '@/common/models/PlayerInputModel';

/** The number the player is being asked for, when that is the whole of the question. */
export function amountInput(waitingFor: PlayerInputModel | undefined): SelectAmountModel | undefined {
  return waitingFor?.type === 'amount' ? waitingFor : undefined;
}
