import {isActionMenu} from '@/client/components/mobile/MobileActionMenu';
import {CardName} from '@/common/cards/CardName';
import {InputResponse} from '@/common/inputs/InputResponse';
import {PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';

/**
 * The pick among cards the card chooser answers: the menu entry at `entry`, or with
 * no entry, the question the player is waiting on -- when either is one.
 */
export function chooserInput(waitingFor: PlayerInputModel | undefined, entry: number | undefined): SelectCardModel | undefined {
  if (waitingFor === undefined) {
    return undefined;
  }
  if (entry === undefined) {
    return waitingFor.type === 'card' && !isActionMenu(waitingFor) ? waitingFor : undefined;
  }
  const option = isActionMenu(waitingFor) ? waitingFor.options[entry] : undefined;
  return option?.type === 'card' ? option : undefined;
}

/** Whether the question the player is waiting on is one the card chooser answers. */
export function isCardChoice(waitingFor: PlayerInputModel | undefined): boolean {
  return chooserInput(waitingFor, undefined) !== undefined;
}

/**
 * What choosing `count` cards costs, in M€: what buying them takes, or as a negative
 * number what selling them pays. Undefined for a pick that is not a sale.
 *
 * The research phase's question is the one whose button buys; the server sets that
 * label, and charges each card at the player's card cost once the pick is in.
 */
export function chooserPrice(input: SelectCardModel, count: number, cardCost: number): number | undefined {
  if (input.annotation === 'sellPatents') {
    return -count;
  }
  if (input.buttonLabel === 'Buy') {
    return count * cardCost;
  }
  return undefined;
}

/** The answer that chooses `cards`, shaped the way the desktop's `SelectCard` sends it. */
export function chooserResponse(entry: number | undefined, cards: ReadonlyArray<CardName>): InputResponse {
  const response: InputResponse = {type: 'card', cards: [...cards]};
  return entry === undefined ? response : {type: 'or', index: entry, response};
}
