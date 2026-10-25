import {PlayerInputModel, SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {SpendableResource} from '@/common/inputs/Spendable';

/** The payment the player is being asked for, when that is the whole of the question. */
export function paymentInput(waitingFor: PlayerInputModel | undefined): SelectPaymentModel | undefined {
  return waitingFor?.type === 'payment' ? waitingFor : undefined;
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
