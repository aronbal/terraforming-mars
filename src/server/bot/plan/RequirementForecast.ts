import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../../cards/ICard';
import {IProjectCard} from '../../cards/IProjectCard';
import {CardRequirement} from '../../cards/requirements/CardRequirement';
import {CardRequirements} from '../../cards/requirements/CardRequirements';
import {GlobalParameterRequirement} from '../../cards/requirements/GlobalParameterRequirement';
import {TagCardRequirement} from '../../cards/requirements/TagCardRequirement';
import {CardName} from '../../../common/cards/CardName';
import {RequirementType} from '../../../common/cards/RequirementType';
import {GlobalParameter} from '../../../common/GlobalParameter';

/** When a card's requirements are likely to be met, and how likely that is at all. */
export type Forecast = {
  /** Generations until the requirements are met: 0 when they are met now. */
  readonly eta: number;
  /** Chance the requirements are ever met while the card is still worth playing. */
  readonly probability: number;
  /** Generations until a maximum requirement that is met now stops being met. */
  readonly closesIn?: number;
};

export const MET: Forecast = {eta: 0, probability: 1};

/** The slowest a global parameter is assumed to move, in steps per generation. */
const MIN_RATE = 0.5;

/** How many generations of history the rate of terraforming is read from. */
const RATE_WINDOW = 3;

/** Steps per generation before there is any history to read, from bot games. */
const DEFAULT_RATES: Record<GlobalParameter, number> = {
  [GlobalParameter.OCEANS]: 0.7,
  [GlobalParameter.OXYGEN]: 1,
  [GlobalParameter.TEMPERATURE]: 1.4,
  [GlobalParameter.VENUS]: 1,
  [GlobalParameter.MOON_HABITAT_RATE]: 0.5,
  [GlobalParameter.MOON_MINING_RATE]: 0.5,
  [GlobalParameter.MOON_LOGISTIC_RATE]: 0.5,
};

/** How much one step of each global parameter moves its value. */
const SCALES: Partial<Record<GlobalParameter, number>> = {
  [GlobalParameter.TEMPERATURE]: 2,
  [GlobalParameter.VENUS]: 2,
};

const PARAMETERS: Partial<Record<RequirementType, GlobalParameter>> = {
  [RequirementType.OXYGEN]: GlobalParameter.OXYGEN,
  [RequirementType.TEMPERATURE]: GlobalParameter.TEMPERATURE,
  [RequirementType.OCEANS]: GlobalParameter.OCEANS,
  [RequirementType.VENUS]: GlobalParameter.VENUS,
  [RequirementType.HABITAT_RATE]: GlobalParameter.MOON_HABITAT_RATE,
  [RequirementType.MINING_RATE]: GlobalParameter.MOON_MINING_RATE,
  [RequirementType.LOGISTIC_RATE]: GlobalParameter.MOON_LOGISTIC_RATE,
};

/** Chance an unmet requirement the bot cannot forecast is met next generation. */
const UNKNOWN_PROBABILITY = 0.5;
const TURMOIL_PROBABILITY = 0.3;

const compiled = new Map<CardName, ReadonlyArray<CardRequirement>>();

function requirementsOf(card: ICard): ReadonlyArray<CardRequirement> {
  let requirements = compiled.get(card.name);
  if (requirements === undefined) {
    requirements = CardRequirements.compile([...card.requirements]).requirements;
    compiled.set(card.name, requirements);
  }
  return requirements;
}

/**
 * How fast `parameter` is moving, in steps per generation.
 *
 * Read off the last few generations' snapshots, never slower than half a
 * step, so a stalled parameter still looks reachable eventually.
 */
export function globalRatePerGeneration(game: IGame, parameter: GlobalParameter): number {
  const history = game.globalsPerGeneration;
  const scale = SCALES[parameter] ?? 1;
  const last = history[history.length - 1]?.[parameter];
  const window = Math.min(RATE_WINDOW, history.length - 1);
  const earlier = history[history.length - 1 - window]?.[parameter];
  if (window < 1 || last === undefined || earlier === undefined) {
    return DEFAULT_RATES[parameter];
  }
  return Math.max(MIN_RATE, (last - earlier) / scale / window);
}

function forecastGlobal(player: IPlayer, requirement: GlobalParameterRequirement): Forecast {
  const parameter = PARAMETERS[requirement.type];
  // `distance` and `getScore` count Adaptation Technology; `satisfies` would also
  // write Think Tank costs onto the card, so it is never called here.
  const score = requirement.getScore(player);
  const met = requirement.max ? score <= requirement.count : score >= requirement.count;
  const rate = parameter === undefined ? MIN_RATE : globalRatePerGeneration(player.game, parameter);
  const distance = requirement.distance(player);
  if (requirement.max) {
    // Global parameters only rise, so a maximum once passed stays passed.
    return met ? {eta: 0, probability: 1, closesIn: distance / rate} : {eta: Number.POSITIVE_INFINITY, probability: 0};
  }
  if (met) {
    return MET;
  }
  return {eta: Math.ceil(distance / rate), probability: 0.9};
}

function forecastTag(player: IPlayer, card: ICard, requirement: TagCardRequirement): Forecast {
  const score = requirement.getScore(player);
  if (requirement.max) {
    // Tags are not lost, so too many now is too many for good.
    return score <= requirement.count ? MET : {eta: Number.POSITIVE_INFINITY, probability: 0};
  }
  if (score >= requirement.count) {
    return MET;
  }
  const missing = requirement.count - score;
  const inHand = player.cardsInHand
    .filter((other) => other.name !== card.name && other.tags.includes(requirement.tag))
    .length;
  return inHand >= missing ? {eta: 1, probability: 0.7} : {eta: 2, probability: 0.3};
}

function forecastOther(player: IPlayer, card: ICard, requirement: CardRequirement): Forecast {
  try {
    // Every requirement but the global ones checks without side effects.
    if (requirement.satisfies(player, card as IProjectCard)) {
      return MET;
    }
  } catch (err) {
    // A requirement on an expansion that is not in play cannot be met.
    return {eta: Number.POSITIVE_INFINITY, probability: 0};
  }
  const turmoil = requirement.type === RequirementType.PARTY ||
    requirement.type === RequirementType.CHAIRMAN ||
    requirement.type === RequirementType.PARTY_LEADERS;
  return {eta: 1, probability: turmoil ? TURMOIL_PROBABILITY : UNKNOWN_PROBABILITY};
}

/**
 * Forecasts when `player` will meet `card`'s requirements.
 *
 * A guess, not a promise: global parameters are extrapolated from how fast
 * Mars has been terraformed, tags from the cards in hand, and everything else
 * is a coin flip for next generation.
 */
export function forecastRequirements(player: IPlayer, card: ICard): Forecast {
  let eta = 0;
  let probability = 1;
  let closesIn: number | undefined;
  for (const requirement of requirementsOf(card)) {
    let forecast: Forecast;
    if (requirement instanceof GlobalParameterRequirement) {
      forecast = forecastGlobal(player, requirement);
    } else if (requirement instanceof TagCardRequirement) {
      forecast = forecastTag(player, card, requirement);
    } else {
      forecast = forecastOther(player, card, requirement);
    }
    eta = Math.max(eta, forecast.eta);
    probability *= forecast.probability;
    if (forecast.closesIn !== undefined) {
      closesIn = Math.min(closesIn ?? Number.POSITIVE_INFINITY, forecast.closesIn);
    }
  }
  if (probability <= 0) {
    return {eta: Number.POSITIVE_INFINITY, probability: 0};
  }
  return closesIn === undefined ? {eta, probability} : {eta, probability, closesIn};
}
