import {CardName} from '@/common/cards/CardName';
import {InputResponse} from '@/common/inputs/InputResponse';
import {Payment} from '@/common/inputs/Payment';
import {PlayerInputModel, SelectCardModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {CardOffer, offerFor} from '@/client/utils/cardSelection';

/**
 * The input that offers a card to the play sheet, and where it sits in the input the
 * player is waiting on.
 *
 * `index` is the entry's place in the turn's menu, which is what an `or` response
 * names; it is undefined when the server asked for the card directly.
 */
export type PlaySheetEntry =
  {kind: 'play', input: SelectProjectCardToPlayModel, index: number | undefined} |
  {kind: 'action', input: SelectCardModel, index: number | undefined};

/** What the play sheet needs to know about the payment after every change. */
export type PlaySheetPaymentState = {
  payment: Payment;
  /** Why the payment cannot be sent, in the desktop's words, or undefined. */
  problem: string | undefined;
  /** How many M€ more than the price the payment is worth, when that is allowed. */
  overpaid: number;
};

function entryFor(input: PlayerInputModel, name: CardName, offer: CardOffer, index: number | undefined): PlaySheetEntry | undefined {
  if (offerFor(input, name) !== offer) {
    return undefined;
  }
  if (input.type === 'projectCard') {
    return {kind: 'play', input, index};
  }
  if (input.type === 'card') {
    return {kind: 'action', input, index};
  }
  return undefined;
}

/**
 * The input that makes `offer` for `name`, looking one level into an `or` the way
 * `offerIn` does: the turn's menu is an `or` of everything the player may do.
 */
export function findPlaySheetEntry(input: PlayerInputModel | undefined, name: CardName, offer: CardOffer): PlaySheetEntry | undefined {
  if (input === undefined) {
    return undefined;
  }
  const direct = entryFor(input, name, offer, undefined);
  if (direct !== undefined || input.type !== 'or') {
    return direct;
  }
  for (let index = 0; index < input.options.length; index++) {
    const entry = entryFor(input.options[index], name, offer, index);
    if (entry !== undefined) {
      return entry;
    }
  }
  return undefined;
}

/**
 * The answer that plays `name` with `payment`, or uses its action, shaped as the
 * desktop's menu would send it -- or undefined when a card is to be played and there
 * is no payment yet.
 *
 * `SelectProjectCardToPlay`, `SelectCard` and `OrOptions` build these three shapes;
 * this builds the same ones without them.
 */
export function playSheetResponse(entry: PlaySheetEntry, name: CardName, payment: Payment | undefined): InputResponse | undefined {
  let response: InputResponse;
  if (entry.kind === 'play') {
    if (payment === undefined) {
      return undefined;
    }
    response = {type: 'projectCard', card: name, payment};
  } else {
    response = {type: 'card', cards: [name]};
  }
  return entry.index === undefined ? response : {type: 'or', index: entry.index, response};
}
