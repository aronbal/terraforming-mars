import {isActionMenu} from '@/client/components/mobile/MobileActionMenu';
import {CardName} from '@/common/cards/CardName';
import {InputResponse} from '@/common/inputs/InputResponse';
import {PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';

/**
 * The pick among cards the card chooser answers: option `entry` of the menu or of the
 * choice the player is waiting on, or with no entry, the question itself -- when
 * either is one.
 */
export function chooserInput(waitingFor: PlayerInputModel | undefined, entry: number | undefined): SelectCardModel | undefined {
  if (waitingFor === undefined) {
    return undefined;
  }
  if (entry === undefined) {
    return waitingFor.type === 'card' && !isActionMenu(waitingFor) ? waitingFor : undefined;
  }
  const option = waitingFor.type === 'or' ? waitingFor.options[entry] : undefined;
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
 * Cards bought at the card cost, as in the research phase, are marked `buyCards` by
 * the server, which charges each at the player's card cost once the pick is in. The
 * button's `Buy` alone is not enough: Board of Directors' `Buy` costs 12 M€.
 */
export function chooserPrice(input: SelectCardModel, count: number, cardCost: number): number | undefined {
  if (input.annotation === 'sellPatents') {
    return -count;
  }
  if (input.annotation === 'buyCards') {
    return count * cardCost;
  }
  return undefined;
}

/** The answer that chooses `cards`, shaped the way the desktop's `SelectCard` sends it. */
export function chooserResponse(entry: number | undefined, cards: ReadonlyArray<CardName>): InputResponse {
  const response: InputResponse = {type: 'card', cards: [...cards]};
  return entry === undefined ? response : {type: 'or', index: entry, response};
}
