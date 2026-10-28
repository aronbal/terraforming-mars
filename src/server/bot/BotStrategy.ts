import {IPlayer} from '../IPlayer';
import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {BotProfile} from './BotProfile';
import {BotPersonality, personalityOf} from './BotPersonality';
import {Tempo} from './evaluate/Values';

/** How many tags a bot is building around at any one time. */
const FOCUS_TAG_COUNT = 2;

/** The least a focus tag's card is overrated by, so even a pure bot leans into its plan. */
const MINIMUM_FOCUS_BONUS = 1.08;

/** The plan a corporation suggests: the tags it rewards and the tiles it likes. */
type CorporationStyle = {
  readonly tags?: ReadonlyArray<Tag>;
  readonly cities?: number;
  readonly greeneries?: number;
};

/**
 * The obvious plan for the corporations whose reward is not visible in their
 * own tags or behavior. A corporation missing here still steers the bot
 * through the tags printed on it.
 */
const CORPORATION_STYLES: Partial<Record<CardName, CorporationStyle>> = {
  [CardName.ECOLINE]: {tags: [Tag.PLANT], greeneries: 1.25},
  [CardName.THARSIS_REPUBLIC]: {tags: [Tag.CITY], cities: 1.3},
  [CardName.MINING_GUILD]: {tags: [Tag.BUILDING]},
  [CardName.PHOBOLOG]: {tags: [Tag.SPACE]},
  [CardName.SATURN_SYSTEMS]: {tags: [Tag.JOVIAN]},
  [CardName.TERACTOR]: {tags: [Tag.EARTH]},
  [CardName.POINT_LUNA]: {tags: [Tag.EARTH]},
  [CardName.THORGATE]: {tags: [Tag.POWER]},
  [CardName.INVENTRIX]: {tags: [Tag.SCIENCE]},
  [CardName.VALLEY_TRUST]: {tags: [Tag.SCIENCE]},
  [CardName.ARKLIGHT]: {tags: [Tag.ANIMAL, Tag.PLANT]},
  [CardName.SPLICE]: {tags: [Tag.MICROBE]},
  [CardName.ECOTEC]: {tags: [Tag.MICROBE, Tag.PLANT]},
  [CardName.RECYCLON]: {tags: [Tag.BUILDING, Tag.MICROBE]},
  [CardName.CHEUNG_SHING_MARS]: {tags: [Tag.BUILDING]},
  [CardName.FACTORUM]: {tags: [Tag.BUILDING]},
  [CardName.STORMCRAFT_INCORPORATED]: {tags: [Tag.JOVIAN]},
  [CardName.ASTRODRILL]: {tags: [Tag.SPACE]},
  [CardName.PALLADIN_SHIPPING]: {tags: [Tag.SPACE]},
  [CardName.APHRODITE]: {tags: [Tag.VENUS]},
  [CardName.MORNING_STAR_INC]: {tags: [Tag.VENUS]},
  [CardName.PHILARES]: {cities: 1.15, greeneries: 1.15},
  [CardName.ARCADIAN_COMMUNITIES]: {cities: 1.15},
  [CardName.MARS_DIRECT]: {tags: [Tag.MARS]},
  [CardName.HABITAT_MARTE]: {tags: [Tag.MARS, Tag.SCIENCE]},
};

/**
 * The bot's plan for this decision: its personality, steered by its position.
 *
 * A person picks a direction from their corporation and opening, then follows
 * the cards: a PhoboLog player who keeps drawing science ends up playing
 * science. So the focus tags are a weighted vote. The corporation speaks
 * loudest at the start and fades as Mars is terraformed, while every tag the
 * bot has actually played (preludes and CEOs included) and every tag in hand
 * adds to it, and the personality's favourites tip close calls. When the cards
 * do not follow the corporation's plan, the vote moves and so does the bot.
 */
export function playStyleOf(player: IPlayer, profile: BotProfile, tempo: Tempo): BotPersonality {
  const personality = personalityOf(player, profile);
  const votes = new Map<Tag, number>();
  const vote = (tag: Tag, weight: number) => {
    if (tag !== Tag.WILD && tag !== Tag.EVENT && tag !== Tag.CLONE) {
      votes.set(tag, (votes.get(tag) ?? 0) + weight);
    }
  };

  const corporationWeight = Math.max(0.25, 1 - tempo.progress);
  let cities = personality.cities;
  let greeneries = personality.greeneries;
  for (const corporation of player.tableau.corporations()) {
    const style = CORPORATION_STYLES[corporation.name];
    style?.tags?.forEach((tag) => vote(tag, 4 * corporationWeight));
    corporation.tags.forEach((tag) => vote(tag, 2 * corporationWeight));
    cities *= style?.cities ?? 1;
    greeneries *= style?.greeneries ?? 1;
  }
  for (const card of player.tableau.asArray()) {
    card.tags.forEach((tag) => vote(tag, 1));
  }
  for (const card of player.cardsInHand) {
    card.tags.forEach((tag) => vote(tag, 0.5));
  }
  personality.favouriteTags.forEach((tag) => vote(tag, 1.5));

  const favouriteTags = [...votes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, FOCUS_TAG_COUNT)
    .map(([tag]) => tag);

  return {
    ...personality,
    favouriteTags,
    favouriteTagBonus: Math.max(MINIMUM_FOCUS_BONUS, personality.favouriteTagBonus),
    cities,
    greeneries,
  };
}
