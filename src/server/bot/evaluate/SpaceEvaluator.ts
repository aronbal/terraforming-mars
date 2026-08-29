import {IPlayer} from '../../IPlayer';
import {Space} from '../../boards/Space';
import {Board} from '../../boards/Board';
import {SpaceBonus} from '../../../common/boards/SpaceBonus';
import {SpaceType} from '../../../common/boards/SpaceType';
import {TileType} from '../../../common/TileType';
import {BotProfile, weightsOf} from '../BotProfile';
import {BoardOutlook} from './BoardOutlook';
import {Tempo, cardDrawValue, stockValues} from './Values';

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
  profile: BotProfile,
  outlook: BoardOutlook): number {
  const board = player.game.board;
  let score = bonusValue(player, space, tempo, profile);

  const adjacent = board.getAdjacentSpaces(space);
  const oceans = adjacent.filter((neighbour) => Board.isUncoveredOceanSpace(neighbour)).length;
  score += oceans * (player.oceanBonus > 0 ? player.oceanBonus : OCEAN_ADJACENCY_VALUE);

  if (tileType === TileType.GREENERY) {
    score += greeneryValue(space, outlook);
  } else if (tileType === TileType.CITY || tileType === TileType.CAPITAL) {
    score += cityValue(space, tempo, profile, outlook);
  }

  if (profile.playsAgainstOpponent) {
    score += denialValue(player, space, adjacent, tileType);
    if (tileType === TileType.CITY || tileType === TileType.CAPITAL) {
      score += outlook.cityDenialValue(space);
    }
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

/**
 * Greeneries want to sit beside the player's own cities.
 *
 * Each city beside a greenery scores a point for whoever owns that city, so
 * the same forest is worth two points beside the bot's own city, one point in
 * open ground, and rather less beside an opponent's.
 */
function greeneryValue(space: Space, outlook: BoardOutlook): number {
  return outlook.cityAdjacencyPointsFor(space);
}

/**
 * Cities want greeneries beside them, now or later.
 *
 * This is the whole reason to build one: a city tile is worth nothing on its
 * own. So the score is the points the city should end up collecting — forests
 * already standing beside it, plus the ones this player can still grow into
 * the gaps — and not a flat count of empty neighbours, which is what had the
 * bot dropping cities into corners it could never green.
 */
function cityValue(space: Space, tempo: Tempo, profile: BotProfile, outlook: BoardOutlook): number {
  if (profile.valuesCityGrowth === false) {
    // A weak player counts elbow room and leaves it there.
    const openNeighbours = outlook.growthRoomValue(space);
    return openNeighbours * (tempo.endgame ? 0.5 : 1);
  }
  return outlook.greeneryPointsFor(space) + outlook.growthRoomValue(space);
}

/** How much taking this space costs the opponent. */
function denialValue(player: IPlayer, space: Space, adjacent: ReadonlyArray<Space>, tileType: TileType | undefined): number {
  let value = 0;
  // A greenery beside their city is not denial, it is a gift: it scores them
  // the point. Any other tile takes the slot away instead.
  if (tileType !== TileType.GREENERY) {
    for (const neighbour of adjacent) {
      const owner = neighbour.player;
      if (owner !== undefined && owner.id !== player.id && Board.isCitySpace(neighbour)) {
        value += 1.5;
      }
    }
  }
  // Spaces with strong bonuses are worth taking before the opponent does.
  if (space.bonus.length >= 2) {
    value += 1;
  }
  return value;
}
