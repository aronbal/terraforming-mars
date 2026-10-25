import {PlayerInputModel, SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {Payment} from '@/common/inputs/Payment';
import {SpendableResource} from '@/common/inputs/Spendable';

/**
 * The price the player is being asked to pay: option `entry` of the choice they are
 * waiting on, or with no entry, the question itself when that is a price.
 */
export function paymentInput(waitingFor: PlayerInputModel | undefined, entry?: number): SelectPaymentModel | undefined {
  const input = entry === undefined ? waitingFor : (waitingFor?.type === 'or' ? waitingFor.options[entry] : undefined);
  return input?.type === 'payment' ? input : undefined;
}

/** The answer that pays with `payment`, as option `entry` of the choice when there is one. */
export function paymentResponse(entry: number | undefined, payment: Payment): InputResponse {
  const response: InputResponse = {type: 'payment', payment: {...payment}};
  return entry === undefined ? response : {type: 'or', index: entry, response};
}

/** The units a payment may be made with, in the order the desktop lists them. M€ is always last. */
export function selectPaymentOrder(input: SelectPaymentModel): ReadonlyArray<SpendableResource> {
  const canUse = (unit: SpendableResource): boolean => {
    if (unit === 'megacredits') {
      return true;
    }
    if (unit === 'titanium') {
      return input.paymentOptions.titanium === true || input.paymentOptions.lunaTradeFederationTitanium === true;
    }
    return input.paymentOptions[unit] === true;
  };
  return ([
    'steel',
    'titanium',
    'heat',
    'seeds',
    'auroraiData',
    'kuiperAsteroids',
    'spireScience',
    'megacredits',
  ] as const).filter(canUse);
}
