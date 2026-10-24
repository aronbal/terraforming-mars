import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {Payment} from '@/common/inputs/Payment';
import {PlayerInputModel, SelectCardModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SpendableResource} from '@/common/inputs/Spendable';
import {Units} from '@/common/Units';
import {CardOffer, offerFor} from '@/client/utils/cardSelection';
import {computeDefaultPayment} from '@/client/components/PaymentDefaults';
import {newDefaultLedger} from '@/client/components/PaymentLedger';
import {projectCardPaymentOrder, projectCardTitaniumRate, unitsAfterReserve} from '@/client/components/ProjectCardPayment';
import {getCard} from '@/client/cards/ClientCardManifest';

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

/** One part of a price: so many of one unit. */
export type PricePart = {
  unit: SpendableResource;
  amount: number;
};

// The units a price preview spends: the ones a player keeps in stock to pay with.
const PREVIEW_UNITS: ReadonlyArray<SpendableResource> = ['steel', 'titanium', 'megacredits'];

/**
 * What playing `card` from `input` would cost, split the way the play sheet first
 * offers it: steel and titanium where the card takes them, M€ for the rest.
 *
 * A preview only. The rarer units -- heat for Helion, microbes, floaters -- are left
 * to the play sheet, which is where a payment is actually made.
 */
export function pricePreview(input: SelectProjectCardToPlayModel, card: CardModel, thisPlayer: PublicPlayerModel): ReadonlyArray<PricePart> {
  const cost = card.calculatedCost ?? getCard(card.name)?.cost ?? 0;
  const tags = getCard(card.name)?.tags ?? [];
  const context = {card, tags, playerinput: input, thisPlayer};
  const order = projectCardPaymentOrder(context).filter((unit) => PREVIEW_UNITS.includes(unit));
  const available = unitsAfterReserve(thisPlayer, thisPlayer.heat, card.reserveUnits ?? Units.EMPTY);

  const ledger = newDefaultLedger();
  ledger.megacredits = {available: thisPlayer.megacredits, rate: 1};
  ledger.steel = {available: available.steel, rate: thisPlayer.steelValue};
  ledger.titanium = {available: available.titanium, rate: projectCardTitaniumRate(context)};

  const payment = computeDefaultPayment(cost, order, ledger, /* reserveMegacredits= */ false);
  const covered = order.reduce((total, unit) => total + payment[unit] * ledger[unit].rate, 0);
  if (covered < cost) {
    // The rest comes from a unit the preview leaves out, so the plain price is the honest one.
    return [{unit: 'megacredits', amount: cost}];
  }
  const parts = order
    .map((unit) => ({unit, amount: payment[unit]}))
    .filter((part) => part.amount > 0);
  // A free card is still a price: nothing to pay is worth saying.
  return parts.length > 0 ? parts : [{unit: 'megacredits', amount: 0}];
}

// How far, in CSS pixels, a finger must travel sideways for a swipe to turn the card.
const SWIPE_DISTANCE = 50;

/**
 * Which way a swipe from `from` to `to` turns the sheet: left for the next thing,
 * right for the one before. Undefined for a tap, or for a scroll that is more up and
 * down than sideways.
 */
export function swipeDirection(from: {x: number, y: number}, to: {x: number, y: number}): 'next' | 'previous' | undefined {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < 1.5 * Math.abs(dy)) {
    return undefined;
  }
  return dx < 0 ? 'next' : 'previous';
}
