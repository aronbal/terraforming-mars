import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {MAX_OCEAN_TILES, MAX_OXYGEN_LEVEL, MAX_TEMPERATURE, MIN_TEMPERATURE} from '../../../common/constants';
import {TileType} from '../../../common/TileType';

/**
 * One victory point, expressed in megacredits.
 *
 * Everything the bot weighs is converted to megacredits so that engine
 * building and point scoring can be compared on one scale. A victory point
 * keeps a fixed value while production decays, which is what makes the bot
 * stop investing in its engine near the end of the game.
 */
export const VP_VALUE = 5;

/**
 * How much a bot leans on engine building versus immediate value.
 *
 * A value of 1 is the bot's best estimate of what something is really worth.
 * Weaker difficulties are given weights below 1 so that they systematically
 * undervalue production and terraforming, which is what a weak player does.
 */
export type ValueWeights = {
  readonly production: number;
  readonly terraform: number;
};

export const NEUTRAL_WEIGHTS: ValueWeights = {production: 1, terraform: 1};

/** How far along Mars is, and how much game is likely left. */
export type Tempo = {
  /** Terraforming progress, averaged over the three global parameters, from 0 to 1. */
  readonly progress: number;
  /** Estimated generations remaining, at least 1. */
  readonly remainingGenerations: number;
  /** True when the game is likely to end within about two generations. */
  readonly endgame: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function oceanCount(game: IGame): number {
  return game.board.spaces.filter((space) => space.tile?.tileType === TileType.OCEAN).length;
}

/**
 * Estimates where the game is in its arc.
 *
 * The generation estimate extrapolates from the rate of terraforming so far,
 * which is noisy in the first couple of generations and settles quickly after.
 */
export function tempoOf(game: IGame): Tempo {
  const temperature = (game.getTemperature() - MIN_TEMPERATURE) / (MAX_TEMPERATURE - MIN_TEMPERATURE);
  const oxygen = game.getOxygenLevel() / MAX_OXYGEN_LEVEL;
  const oceans = Math.min(oceanCount(game), MAX_OCEAN_TILES) / MAX_OCEAN_TILES;
  const progress = clamp((temperature + oxygen + oceans) / 3, 0, 1);

  const projectedTotal = progress > 0.08 ? game.generation / progress : 12;
  const remainingGenerations = clamp(Math.round(projectedTotal - game.generation), 1, 12);

  return {
    progress,
    remainingGenerations,
    endgame: progress >= 0.75 || remainingGenerations <= 2,
  };
}

/** What one point of terraform rating is worth right now. */
export function terraformRatingValue(tempo: Tempo, weights: ValueWeights = NEUTRAL_WEIGHTS): number {
  // A point of TR is a victory point plus a megacredit of income every
  // remaining generation.
  return (VP_VALUE + tempo.remainingGenerations) * weights.terraform;
}

/**
 * What one unit of each stockpiled resource is worth right now.
 *
 * Steel and titanium are discounted below their face value because they can
 * only be spent on cards with the matching tag. Plants and heat are priced off
 * what they convert into, so they get cheaper as terraforming finishes.
 */
export function stockValues(player: IPlayer, tempo: Tempo, weights: ValueWeights = NEUTRAL_WEIGHTS): Record<Resource, number> {
  const trValue = terraformRatingValue(tempo, weights);
  const plantsForGreenery = Math.max(1, player.plantsNeededForGreenery);

  return {
    megacredits: 1,
    steel: player.getSteelValue() * 0.8,
    titanium: player.getTitaniumValue() * 0.75,
    // A greenery is a victory point plus a step of oxygen.
    plants: Math.max(1, (VP_VALUE + trValue) / plantsForGreenery),
    // Energy is only worth what it becomes next production phase.
    energy: 0.7,
    heat: Math.max(0.6, trValue / 8),
  };
}

/**
 * What one step of each kind of production is worth right now.
 *
 * A step of production pays out once per remaining generation, so this is the
 * single biggest reason the bot's priorities shift over the course of a game.
 */
export function productionValues(player: IPlayer, tempo: Tempo, weights: ValueWeights = NEUTRAL_WEIGHTS): Record<Resource, number> {
  const stock = stockValues(player, tempo, weights);
  const payouts = tempo.remainingGenerations * weights.production;
  return {
    megacredits: stock.megacredits * payouts,
    steel: stock.steel * payouts,
    titanium: stock.titanium * payouts,
    plants: stock.plants * payouts,
    energy: stock.energy * payouts,
    heat: stock.heat * payouts,
  };
}

/**
 * What an unseen card drawn from the deck is worth.
 *
 * Cards are options rather than guaranteed value, and options are worth less
 * when there is no time left to use them.
 */
export function cardDrawValue(tempo: Tempo): number {
  return tempo.endgame ? 1.5 : 3.5;
}
