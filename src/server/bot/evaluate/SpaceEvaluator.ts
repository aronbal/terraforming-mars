import {IPlayer} from '../../IPlayer';
import {Space} from '../../boards/Space';
import {Board} from '../../boards/Board';
import {SpaceBonus} from '../../../common/boards/SpaceBonus';
import {SpaceType} from '../../../common/boards/SpaceType';
import {TileType} from '../../../common/TileType';
import {BotProfile, weightsOf} from '../BotProfile';
import {Tempo, VP_VALUE, cardDrawValue, stockValues} from './Values';

/** Megacredits the bot assumes it gains for each ocean it builds next to. */
const OCEAN_ADJACENCY_VALUE = 2;

/**
 * Scores a candidate space for a tile.
 *
 * The three things that matter are the bonus printed on the space, what the
 * neighbours are worth, and — for the hardest difficulty — whether taking the
 * space costs the opponent something.
 */
export function scoreSpace(
  player: IPlayer,
  space: Space,
  tileType: TileType | undefined,
  tempo: Tempo,
  profile: BotProfile): number {
  const board = player.game.board;
  let score = bonusValue(player, space, tempo, profile);

  const adjacent = board.getAdjacentSpaces(space);
  const oceans = adjacent.filter((neighbour) => Board.isUncoveredOceanSpace(neighbour)).length;
  score += oceans * (player.oceanBonus > 0 ? player.oceanBonus : OCEAN_ADJACENCY_VALUE);

  if (tileType === TileType.GREENERY) {
    score += greeneryValue(player, adjacent);
  } else if (tileType === TileType.CITY || tileType === TileType.CAPITAL) {
    score += cityValue(player, adjacent, tempo);
  }

  if (profile.playsAgainstOpponent) {
    score += denialValue(player, space, adjacent);
  }

  // Reserved ocean spaces are scarce; do not spend one on a land tile.
  if (space.spaceType === SpaceType.OCEAN && tileType !== undefined && tileType !== TileType.OCEAN) {
    score -= 4;
  }

  return score;
}

function bonusValue(player: IPlayer, space: Space, tempo: Tempo, profile: BotProfile): number {
  const stock = stockValues(player, tempo, weightsOf(profile));
  let value = 0;
  for (const bonus of space.bonus) {
    switch (bonus) {
    case SpaceBonus.TITANIUM:
      value += stock.titanium;
      break;
    case SpaceBonus.STEEL:
      value += stock.steel;
      break;
    case SpaceBonus.PLANT:
      value += stock.plants;
      break;
    case SpaceBonus.DRAW_CARD:
      value += cardDrawValue(tempo);
      break;
    case SpaceBonus.HEAT:
      value += stock.heat;
      break;
    case SpaceBonus.MEGACREDITS:
      value += stock.megacredits;
      break;
    case SpaceBonus.ENERGY:
      value += stock.energy;
      break;
    case SpaceBonus.OCEAN:
    case SpaceBonus.TEMPERATURE:
    case SpaceBonus.TEMPERATURE_4MC:
      value += 4;
      break;
    case SpaceBonus.ANIMAL:
    case SpaceBonus.MICROBE:
    case SpaceBonus.SCIENCE:
    case SpaceBonus.DATA:
      value += 1.8;
      break;
    case SpaceBonus.ENERGY_PRODUCTION:
      value += stock.energy * tempo.remainingGenerations;
      break;
    case SpaceBonus.DELEGATE:
      value += 3;
      break;
    case SpaceBonus.COLONY:
      value += 6;
      break;
    case SpaceBonus.ASTEROID:
      value += 2;
      break;
    default:
      break;
    }
  }
  return value;
}

/** Greeneries want to sit beside the player's own tiles, and beside cities. */
function greeneryValue(player: IPlayer, adjacent: ReadonlyArray<Space>): number {
  let value = 0;
  for (const neighbour of adjacent) {
    if (neighbour.tile === undefined) {
      continue;
    }
    if (Board.isCitySpace(neighbour)) {
      // Each greenery beside a city is a point for whoever owns the city.
      value += neighbour.player?.id === player.id ? VP_VALUE : -VP_VALUE * 0.6;
    }
  }
  return value;
}

/** Cities want empty neighbours the player can fill with greeneries later. */
function cityValue(player: IPlayer, adjacent: ReadonlyArray<Space>, tempo: Tempo): number {
  let value = 0;
  let openNeighbours = 0;
  for (const neighbour of adjacent) {
    if (neighbour.tile === undefined && neighbour.spaceType === SpaceType.LAND) {
      openNeighbours++;
    } else if (neighbour.tile?.tileType === TileType.GREENERY) {
      value += neighbour.player?.id === player.id ? VP_VALUE : 0;
    }
  }
  // Room to grow is only worth something while there is time to grow into it.
  value += Math.min(openNeighbours, 3) * (tempo.endgame ? 0.5 : 1.5);
  return value;
}

/** How much taking this space costs the opponent. */
function denialValue(player: IPlayer, space: Space, adjacent: ReadonlyArray<Space>): number {
  let value = 0;
  for (const neighbour of adjacent) {
    const owner = neighbour.player;
    if (owner !== undefined && owner.id !== player.id && Board.isCitySpace(neighbour)) {
      // Sitting beside their city denies them a greenery point later.
      value += 1.5;
    }
  }
  // Spaces with strong bonuses are worth taking before the opponent does.
  if (space.bonus.length >= 2) {
    value += 1;
  }
  return value;
}
