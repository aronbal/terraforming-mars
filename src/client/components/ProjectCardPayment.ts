import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {SpendableResource} from '@/common/inputs/Spendable';
import {Units} from '@/common/Units';

/*
 * What a project card may be paid with, for every widget that pays for one.
 *
 * The desktop's `SelectProjectCardToPlay` and the mobile shell's play sheet both ask
 * these questions, and a card that one of them lets you pay for with titanium and
 * the other does not would be a bug nobody could see from either side.
 */

/** The facts about one card and one player that decide what the card may be paid with. */
export type ProjectCardPaymentContext = {
  card: CardModel;
  tags: ReadonlyArray<Tag>;
  playerinput: SelectProjectCardToPlayModel;
  thisPlayer: PublicPlayerModel;
};

/** Every unit a project card might be paid with, in the order they are shown. */
const PROJECT_CARD_UNITS = [
  'steel',
  'titanium',
  'heat',
  'plants',
  'microbes',
  'floaters',
  'lunaArchivesScience',
  'seeds',
  'graphene',
  'kuiperAsteroids',
  'auroraiData',
  'spireScience',
  'megacredits',
] as const;

/** Whether titanium pays for the card at its full value. */
export function canUseTitaniumRegularly(context: ProjectCardPaymentContext): boolean {
  return context.tags.includes(Tag.SPACE) ||
    context.thisPlayer.lastCardPlayed === CardName.LAST_RESORT_INGENUITY;
}

/** Whether the card may be paid for, in part, with `unit`. */
export function canPayProjectCardWith(unit: SpendableResource, context: ProjectCardPaymentContext): boolean {
  const {card, tags, playerinput, thisPlayer} = context;
  const canPayWith = card.standardProjectCanPayWith;
  if (canPayWith !== undefined) {
    // Standard project: use explicit payment rules from the server
    switch (unit) {
    case 'megacredits':
      return true;
    // auroraiData and spireScience are always accepted by standard projects
    // (see StandardProjectCard.canPlayOptions.)
    case 'auroraiData':
    case 'spireScience':
      return true;
    case 'heat':
      return playerinput.paymentOptions.heat === true;
    case 'steel':
      return canPayWith.steel === true;
    case 'titanium':
      return canPayWith.titanium === true ||
        playerinput.paymentOptions.lunaTradeFederationTitanium === true;
    case 'seeds':
      return canPayWith.seeds === true;
    case 'kuiperAsteroids':
      return canPayWith.kuiperAsteroids === true;
    case 'plants':
    case 'microbes':
    case 'floaters':
    case 'lunaArchivesScience':
    case 'graphene':
      return false;
    default: throw new Error('Unknown unit ' + unit);
    }
  } else {
    // Regular project card: tag-based payment rules
    switch (unit) {
    case 'megacredits':
      return true;
    case 'heat':
      return playerinput.paymentOptions.heat === true;
    case 'steel':
      return tags.includes(Tag.BUILDING) ||
        thisPlayer.lastCardPlayed === CardName.LAST_RESORT_INGENUITY;
    case 'titanium':
      return canUseTitaniumRegularly(context) ||
        playerinput.paymentOptions.lunaTradeFederationTitanium === true;
    case 'plants':
      return tags.includes(Tag.BUILDING) && playerinput.paymentOptions.plants === true;
    case 'microbes':
      return tags.includes(Tag.PLANT);
    case 'floaters':
      return tags.includes(Tag.VENUS);
    case 'lunaArchivesScience':
      return tags.includes(Tag.MOON);
    case 'seeds':
      return tags.includes(Tag.PLANT);
    case 'graphene':
      return tags.includes(Tag.SPACE) ||
        tags.includes(Tag.CITY);
    case 'kuiperAsteroids':
    case 'auroraiData':
    case 'spireScience':
      return false;
    default:
      throw new Error('Unknown unit ' + unit);
    }
  }
}

/** The units the card may be paid with, in the order they are shown. */
export function projectCardPaymentOrder(context: ProjectCardPaymentContext): ReadonlyArray<SpendableResource> {
  return PROJECT_CARD_UNITS.filter((unit) => canPayProjectCardWith(unit, context));
}

/**
 * What one titanium is worth towards the card.
 *
 * Luna Trade Federation lets titanium pay for cards without a space tag, at one M€
 * less than usual.
 */
export function projectCardTitaniumRate(context: ProjectCardPaymentContext): number {
  const titaniumValue = context.thisPlayer.titaniumValue;
  if (canUseTitaniumRegularly(context) || context.card.standardProjectCanPayWith?.titanium === true) {
    return titaniumValue;
  }
  return titaniumValue - 1;
}

/**
 * The standard resources the player may spend on the card, less what the card holds
 * back for itself.
 *
 * `heat` is passed in rather than read off the player, because Stormcraft's floaters
 * count as heat too.
 */
export function unitsAfterReserve(thisPlayer: PublicPlayerModel, heat: number, reserveUnits: Units): Units {
  return Units.of({
    steel: Math.max(thisPlayer.steel - reserveUnits.steel, 0),
    titanium: Math.max(thisPlayer.titanium - reserveUnits.titanium, 0),
    heat: Math.max(heat - reserveUnits.heat, 0),
    plants: Math.max(thisPlayer.plants - reserveUnits.plants, 0),
  });
}
