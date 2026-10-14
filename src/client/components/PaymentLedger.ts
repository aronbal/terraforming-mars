import {DEFAULT_PAYMENT_VALUES, Payment} from '@/common/inputs/Payment';
import {SPENDABLE_RESOURCES, SpendableResource} from '@/common/inputs/Spendable';
import {sum} from '@/common/utils/utils';

/**
 * Data about the resources that can be spent for this action.
 */
export type Ledger = Record<SpendableResource, {
  /** The number of resources available, omitting reserved resources */
  available: number,
  /** The exchange rate for units of this resource */
  rate: number,
  /** Whether any resources are held in reserve. */
  reserved?: boolean,
}>;

export function newDefaultLedger(): Ledger {
  const ledger = {} as Ledger;
  for (const unit of SPENDABLE_RESOURCES) {
    ledger[unit] = {available: 0, rate: DEFAULT_PAYMENT_VALUES[unit]};
  }
  return ledger;
}

/** The name each payment unit is shown under. */
export const PAYMENT_UNIT_DESCRIPTIONS: Readonly<Record<SpendableResource, string>> = {
  steel: 'Steel',
  titanium: 'Titanium',
  heat: 'Heat',
  seeds: 'Seeds',
  auroraiData: 'Data',
  kuiperAsteroids: 'Asteroids',
  spireScience: 'Science',
  megacredits: 'M€',
  floaters: 'Floaters',
  graphene: 'Graphene',
  lunaArchivesScience: 'Science',
  microbes: 'Microbes',
  plants: 'Plants',
};

/** The `resource_icon` modifier class that draws `unit`. */
export function paymentUnitIconClass(unit: SpendableResource): string {
  switch (unit) {
  case 'kuiperAsteroids': return 'resource_icon--asteroid';
  case 'lunaArchivesScience': return 'resource_icon--science';
  case 'spireScience': return 'resource_icon--science';
  case 'auroraiData': return 'resource_icon--auroraidata';
  case 'seeds': return 'resource_icon--seed';
  default: return 'resource_icon--' + unit;
  }
}

/** What `payment` is worth in M€, counting only the units in `order`. */
export function totalSpent(payment: Payment, order: ReadonlyArray<SpendableResource>, ledger: Ledger): number {
  return sum(order.map((unit) => payment[unit] * ledger[unit].rate));
}

/**
 * The M€ that make up whatever the other units in `payment` leave of `cost`.
 *
 * Capped by the M€ available, so a payment that cannot be covered stays short rather
 * than spending money the player does not have.
 */
export function remainingMegacredits(
  payment: Payment,
  cost: number,
  order: ReadonlyArray<SpendableResource>,
  ledger: Ledger,
): number {
  const nonMegacredits = totalSpent(payment, order, ledger) - payment.megacredits;
  const remaining = Math.max(0, cost - nonMegacredits);
  return Math.min(ledger.megacredits.available, remaining);
}

/**
 * Why `payment` cannot be sent for `cost`, or `undefined` when it can.
 *
 * Overpaying by less than the rate of every unit spent -- two steel for a 3 M€ card --
 * is allowed, and is not reported here.
 */
export function paymentProblem(
  payment: Payment,
  cost: number,
  order: ReadonlyArray<SpendableResource>,
  ledger: Ledger,
): string | undefined {
  if (cost === 0) {
    return undefined;
  }
  for (const unit of order) {
    if (payment[unit] > ledger[unit].available) {
      // TODO(kberg): Make this a Message
      return `You do not have enough ${unit}`;
    }
  }
  const delta = totalSpent(payment, order, ledger) - cost;
  if (delta < 0) {
    return 'Haven\'t spent enough';
  }
  if (delta > 0) {
    for (const unit of order) {
      if (payment[unit] > 0 && delta >= ledger[unit].rate) {
        // TODO(kberg): Make this a Message
        return `You cannot overspend ${unit}`;
      }
    }
  }
  return undefined;
}
