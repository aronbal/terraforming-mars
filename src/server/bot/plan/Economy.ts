import {IPlayer} from '../../IPlayer';
import {IProjectCard} from '../../cards/IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {BotProfile} from '../BotProfile';

/** What a player has towards one card, and what they add each generation, in megacredits. */
export type Purse = {
  readonly now: number;
  readonly perGeneration: number;
};

/** Cards dealt each research phase. */
const CARDS_DEALT = 4;

/** Resources counted in a purse, as a payment or a gain lists them. */
export type PurseUnits = {
  readonly megacredits?: number;
  readonly steel?: number;
  readonly titanium?: number;
  readonly heat?: number;
};

/**
 * What `units` are worth towards paying for `card`.
 *
 * Steel only counts towards a building card and titanium towards a space card;
 * heat counts only for a player who may spend it as cash.
 */
export function inPurseTerms(units: PurseUnits, player: IPlayer, card: IProjectCard): number {
  let total = units.megacredits ?? 0;
  if (card.tags.includes(Tag.BUILDING)) {
    total += (units.steel ?? 0) * player.getSteelValue();
  }
  if (card.tags.includes(Tag.SPACE)) {
    total += (units.titanium ?? 0) * player.getTitaniumValue();
  } else if (player.canUseTitaniumAsMegacredits) {
    total += (units.titanium ?? 0) * (player.getTitaniumValue() - 1);
  }
  if (player.canUseHeatAsMegaCredits) {
    total += units.heat ?? 0;
  }
  return total;
}

/**
 * What `player` has and earns towards paying for `card`.
 *
 * Income is megacredit production plus terraform rating, plus the steel or
 * titanium production the card can spend, less what the bot expects to spend
 * on cards each research phase.
 */
export function purseFor(player: IPlayer, card: IProjectCard, profile: BotProfile): Purse {
  const now = inPurseTerms({
    megacredits: player.megaCredits,
    steel: player.steel,
    titanium: player.titanium,
    heat: player.availableHeat(),
  }, player, card);
  const income = inPurseTerms({
    megacredits: player.production.megacredits + player.terraformRating,
    steel: player.production.steel,
    titanium: player.production.titanium,
    heat: player.production.heat,
  }, player, card);
  const research = profile.buyRate * CARDS_DEALT * player.cardCost;
  return {now, perGeneration: income - research};
}

/** A move's effect on a purse: what it spends and gains now, and what it adds to income. */
export type PurseChange = {
  readonly spendNow?: number;
  readonly gainNow?: number;
  readonly incomeDelta?: number;
};

/**
 * Generations until `cost` is affordable from `purse`, after `change`.
 *
 * 0 means affordable now and `Infinity` never: the purse is short and does
 * not grow.
 */
export function etaFor(cost: number, purse: Purse, change: PurseChange = {}): number {
  const available = purse.now - (change.spendNow ?? 0) + (change.gainNow ?? 0);
  if (available >= cost) {
    return 0;
  }
  const income = purse.perGeneration + (change.incomeDelta ?? 0);
  if (income <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.ceil((cost - available) / income);
}
