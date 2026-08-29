import {IPlayer} from '../IPlayer';
import {IProjectCard} from '../cards/IProjectCard';
import {IStandardProjectCard, isIStandardProjectCard} from '../cards/IStandardProjectCard';
import {SelectCardToPlay} from '../inputs/SelectCardToPlay';
import {Payment, PaymentOptions} from '../../common/inputs/Payment';
import {Units} from '../../common/Units';
import {planPayment} from './PaymentPlanner';

export type PlayableCard = IProjectCard | IStandardProjectCard;

/** Everything needed to pay for one entry in a play-a-card menu. */
export type PaymentContext = {
  readonly cost: number;
  readonly options: Partial<PaymentOptions>;
  readonly reserveUnits: Units;
};

/**
 * Works out what a menu entry costs and what may be spent on it.
 *
 * Standard projects and project cards price themselves differently, and the
 * menu itself can override a cost (Standard Technology, for instance), so this
 * mirrors what the client's own card model does.
 */
export function paymentContextFor(
  player: IPlayer,
  option: SelectCardToPlay<PlayableCard>,
  card: PlayableCard): PaymentContext {
  const reserveUnits = option.extras.get(card.name)?.reserveUnits ?? Units.EMPTY;
  const overriddenCost = option.extras.get(card.name)?.overriddenCost;

  if (isIStandardProjectCard(card)) {
    return {
      cost: overriddenCost ?? card.getAdjustedCost(player),
      options: {
        ...card.canPayWith(player),
        auroraiData: true,
        spireScience: true,
        heat: player.canUseHeatAsMegaCredits,
        lunaTradeFederationTitanium: player.canUseTitaniumAsMegacredits,
      },
      reserveUnits,
    };
  }

  const afford = player.affordOptionsForCard(card);
  return {
    cost: overriddenCost ?? afford.cost,
    options: afford,
    reserveUnits: afford.reserveUnits ?? reserveUnits,
  };
}

/** The payment the bot would make for `card`, or `undefined` if it cannot pay. */
export function planPaymentFor(
  player: IPlayer,
  option: SelectCardToPlay<PlayableCard>,
  card: PlayableCard): Payment | undefined {
  const context = paymentContextFor(player, option, card);
  return planPayment(player, context.cost, context.options, context.reserveUnits);
}
