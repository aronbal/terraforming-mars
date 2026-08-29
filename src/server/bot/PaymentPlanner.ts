import {IPlayer} from '../IPlayer';
import {Payment, PaymentOptions, DEFAULT_PAYMENT_VALUES} from '../../common/inputs/Payment';
import {SpendableResource} from '../../common/inputs/Spendable';
import {Units} from '../../common/Units';

/**
 * The order in which the bot spends resources.
 *
 * Least flexible first: card resources and alloys can only be spent on cards
 * with the matching tag, so holding them costs the player options later, while
 * megacredits are always useful and are kept for last.
 */
const SPEND_ORDER: ReadonlyArray<SpendableResource> = [
  'microbes',
  'floaters',
  'lunaArchivesScience',
  'spireScience',
  'seeds',
  'auroraiData',
  'graphene',
  'kuiperAsteroids',
  'titanium',
  'steel',
  'plants',
  'heat',
  'megacredits',
] as const;

type Wallet = {
  available: Record<SpendableResource, number>,
  value: Record<SpendableResource, number>,
};

/**
 * Works out how the player should pay `cost`.
 *
 * Returns `undefined` when the player cannot actually cover the cost, which
 * lets callers treat "can't afford" and "shouldn't bother" the same way.
 */
export function planPayment(
  player: IPlayer,
  cost: number,
  options: Partial<PaymentOptions>,
  reserveUnits: Units = Units.EMPTY): Payment | undefined {
  if (cost <= 0) {
    return Payment.EMPTY;
  }

  const wallet = buildWallet(player, options, reserveUnits);
  const payment: Record<SpendableResource, number> = {...Payment.EMPTY};
  let remaining = cost;

  // Spend without overshooting, cheapest-to-hold resources first.
  for (const resource of SPEND_ORDER) {
    if (remaining <= 0) {
      break;
    }
    const value = wallet.value[resource];
    const available = wallet.available[resource];
    if (value <= 0 || available <= 0) {
      continue;
    }
    const units = Math.min(available, Math.floor(remaining / value));
    if (units > 0) {
      payment[resource] = units;
      remaining -= units * value;
    }
  }

  // A remainder smaller than one unit of anything spent above is covered by
  // cash, which is the only resource worth exactly one.
  if (remaining > 0 && wallet.value.megacredits > 0) {
    const units = Math.min(wallet.available.megacredits - payment.megacredits, remaining);
    if (units > 0) {
      payment.megacredits += units;
      remaining -= units;
    }
  }

  // Still short: overpay with the least wasteful resource still on hand.
  while (remaining > 0) {
    const candidate = cheapestTopUp(wallet, payment, remaining);
    if (candidate === undefined) {
      return undefined;
    }
    payment[candidate] += 1;
    remaining -= wallet.value[candidate];
  }

  const result = Payment.of(payment);
  if (!player.canSpend(result, reserveUnits)) {
    return undefined;
  }
  if (player.payingAmount(result, options) < cost) {
    return undefined;
  }
  return result;
}

/**
 * Picks the resource that covers the shortfall with the least value thrown away.
 *
 * Prefers a unit that covers the remainder exactly or nearly so; failing that,
 * takes the smallest unit available so the overpayment stays small.
 */
function cheapestTopUp(
  wallet: Wallet,
  payment: Record<SpendableResource, number>,
  remaining: number): SpendableResource | undefined {
  let best: SpendableResource | undefined;
  let bestWaste = Number.POSITIVE_INFINITY;

  for (const resource of SPEND_ORDER) {
    const value = wallet.value[resource];
    if (value <= 0 || wallet.available[resource] - payment[resource] <= 0) {
      continue;
    }
    const waste = Math.max(0, value - remaining);
    if (waste < bestWaste) {
      bestWaste = waste;
      best = resource;
    }
  }
  return best;
}

function buildWallet(player: IPlayer, options: Partial<PaymentOptions>, reserveUnits: Units): Wallet {
  const available: Record<SpendableResource, number> = {
    megacredits: Math.max(0, player.megaCredits - reserveUnits.megacredits),
    steel: Math.max(0, player.steel - reserveUnits.steel),
    titanium: Math.max(0, player.titanium - reserveUnits.titanium),
    plants: Math.max(0, player.plants - reserveUnits.plants),
    heat: Math.max(0, player.availableHeat() - reserveUnits.heat),
    microbes: player.getSpendable('microbes'),
    floaters: player.getSpendable('floaters'),
    lunaArchivesScience: player.getSpendable('lunaArchivesScience'),
    spireScience: player.getSpendable('spireScience'),
    seeds: player.getSpendable('seeds'),
    auroraiData: player.getSpendable('auroraiData'),
    graphene: player.getSpendable('graphene'),
    kuiperAsteroids: player.getSpendable('kuiperAsteroids'),
  };

  // A resource the player may not spend on this purchase is worth zero here,
  // which keeps it out of the payment entirely.
  const usable: Record<SpendableResource, boolean> = {
    megacredits: true,
    steel: options.steel === true,
    titanium: options.titanium === true || player.canUseTitaniumAsMegacredits,
    plants: options.plants === true,
    heat: player.canUseHeatAsMegaCredits,
    microbes: options.microbes === true,
    floaters: options.floaters === true,
    lunaArchivesScience: options.lunaArchivesScience === true,
    spireScience: options.spireScience === true,
    seeds: options.seeds === true,
    auroraiData: options.auroraiData === true,
    graphene: options.graphene === true,
    kuiperAsteroids: options.kuiperAsteroids === true,
  };

  // Luna Trade Federation spends titanium as cash, but each unit is worth one
  // less than it would be on a space card.
  const titaniumValue = options.titanium === true ?
    player.getTitaniumValue() :
    player.getTitaniumValue() - 1;

  const value: Record<SpendableResource, number> = {
    ...DEFAULT_PAYMENT_VALUES,
    steel: player.getSteelValue(),
    titanium: titaniumValue,
  };

  for (const resource of SPEND_ORDER) {
    if (usable[resource] === false) {
      value[resource] = 0;
    }
  }

  return {available, value};
}
