import {IPlayer} from '../IPlayer';
import {Tag} from '../../common/cards/Tag';
import {BotProfile} from './BotProfile';
import {BotRandom} from './BotRandom';

/** Tags common enough in every game that a bot can build a style around them. */
const STYLE_TAGS: ReadonlyArray<Tag> = [
  Tag.BUILDING,
  Tag.SPACE,
  Tag.SCIENCE,
  Tag.POWER,
  Tag.EARTH,
  Tag.JOVIAN,
  Tag.PLANT,
  Tag.MICROBE,
  Tag.ANIMAL,
  Tag.CITY,
];

/** How many tags a bot favours. */
const FAVOURITE_TAG_COUNT = 2;

/**
 * A bot's taste for one game.
 *
 * Two players of the same skill still play differently: one goes for cities,
 * another hoards cash, a third collects science. A personality is a small,
 * consistent bias on top of the evaluator, fixed for the whole game, so the
 * bot plays with a recognisable style instead of drifting from turn to turn.
 */
export type BotPersonality = {
  /** Tags this bot is drawn to; cards carrying one look better than they are. */
  readonly favouriteTags: ReadonlyArray<Tag>;
  /** Multiplier on what a card with a favourite tag is worth. */
  readonly favouriteTagBonus: number;
  /** Multiplier, around 1, on how keen the bot is to build cities. */
  readonly cities: number;
  /** Multiplier, around 1, on how keen the bot is to build greeneries. */
  readonly greeneries: number;
  /** Megacredits kept back beyond the profile's reserve; negative spends more freely. */
  readonly thrift: number;
};

export const NEUTRAL_PERSONALITY: BotPersonality = {
  favouriteTags: [],
  favouriteTagBonus: 1,
  cities: 1,
  greeneries: 1,
  thrift: 0,
};

/** A stable 32-bit hash, so a personality survives the server reloading the game. */
function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/**
 * The personality of `player` in their current game.
 *
 * It is derived from the game and player ids rather than stored, so it is the
 * same on every decision and after a restart, and different from game to game.
 * The profile's `personality` sets how far the taste can stray from neutral:
 * weaker bots are more opinionated, stronger ones only lean.
 */
export function personalityOf(player: IPlayer, profile: BotProfile): BotPersonality {
  const strength = profile.personality;
  if (strength <= 0) {
    return NEUTRAL_PERSONALITY;
  }
  const random = new BotRandom(hash(`${player.game.id}/${player.id}`));
  const swing = () => 1 + strength * (random.next() * 2 - 1);

  const tags = STYLE_TAGS.slice();
  const favouriteTags: Array<Tag> = [];
  for (let i = 0; i < FAVOURITE_TAG_COUNT; i++) {
    favouriteTags.push(...tags.splice(random.nextInt(tags.length), 1));
  }

  return {
    favouriteTags,
    favouriteTagBonus: 1 + strength * 0.6,
    cities: swing(),
    greeneries: swing(),
    thrift: Math.round(strength * 10 * (random.next() * 2 - 1)),
  };
}
