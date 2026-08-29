import {IPlayer} from '../../IPlayer';
import {Space} from '../../boards/Space';
import {Board} from '../../boards/Board';
import {SpaceType} from '../../../common/boards/SpaceType';
import {BotProfile} from '../BotProfile';
import {Tempo, VP_VALUE} from './Values';

/**
 * How many greeneries the bot assumes it will place from sources other than
 * its own plant production, per remaining generation.
 *
 * Cards that place a greenery outright, and the greenery standard project once
 * the treasury outgrows anything else to buy, both land here.
 */
const GREENERIES_PER_GENERATION_FROM_ELSEWHERE = 0.3;

/**
 * Most greeneries one city can realistically end up touching.
 *
 * A space has six neighbours, but oceans, other players' tiles and the edge of
 * the map take most of them, and the plants have to come from somewhere. Two
 * to three is what a well-placed city collects in a real game.
 */
const MAX_GREENERIES_PER_CITY = 3;

/**
 * Share of the player's remaining greeneries a freshly placed city can expect
 * to attract.
 *
 * A new city is the newest anchor with the most room around it, so it takes
 * the larger part of what is still to be planted, but not all of it: some
 * greeneries go down beside older cities, or away from cities entirely.
 */
const NEW_CITY_SHARE_OF_GREENERIES = 0.65;

/** Value of an empty neighbour a city could still grow into, in megacredits. */
const GROWTH_ROOM_VALUE = 1.2;

/**
 * How much of a point handed to an opponent the bot counts against itself.
 *
 * Not the whole point: the greenery still scores its own point, and refusing
 * every space beside an opponent's city costs more than the opponent gains.
 */
const OPPONENT_CITY_PENALTY = 0.6;

/**
 * What the board is worth to one player, for the parts of the evaluation that
 * a card's `behavior` cannot express.
 *
 * A city tile is the clearest case. By itself it scores nothing at all; it
 * scores one point for every greenery that ends up beside it, whoever planted
 * that greenery. Its worth is therefore a bet on how much green this player
 * can still grow and on whether there is anywhere left to grow it, neither of
 * which is written on the card. Pricing a city as a flat number of points —
 * which is what the bot used to do — either has it build cities it cannot
 * green or, far more often, skip the cities that would have doubled the value
 * of every greenery it goes on to place.
 *
 * One of these is built per decision, so the board scans below run once per
 * move rather than once per card considered.
 */
export class BoardOutlook {
  constructor(
    private readonly player: IPlayer,
    private readonly tempo: Tempo,
    private readonly profile: BotProfile) {}

  private cachedGreeneries: number | undefined;
  private cachedUncommitted: number | undefined;
  private cachedCityValue: number | undefined;
  private cachedGreeneryBonus: number | undefined;

  /**
   * Greeneries this player can still expect to place before the game ends.
   *
   * Plants already banked, plants the engine will still grow, and an allowance
   * for the greeneries that arrive from cards and the standard project.
   */
  public expectedGreeneries(): number {
    if (this.cachedGreeneries === undefined) {
      const perGreenery = Math.max(1, this.player.plantsNeededForGreenery);
      const banked = this.player.plants / perGreenery;
      const grown = (this.player.production.plants * this.tempo.remainingGenerations) / perGreenery;
      const elsewhere = this.tempo.remainingGenerations * GREENERIES_PER_GENERATION_FROM_ELSEWHERE;
      this.cachedGreeneries = banked + grown + elsewhere;
    }
    return this.cachedGreeneries;
  }

  /**
   * Greeneries left over once the cities this player already owns have taken
   * their share.
   *
   * Without this every city is priced as though it were the only one, and the
   * bot builds a fourth city expecting the same three forests it is already
   * counting on for the first three. The plants only stretch so far, so what a
   * new city is worth is what those cities cannot already absorb.
   */
  private uncommittedGreeneries(): number {
    if (this.cachedUncommitted === undefined) {
      let committed = 0;
      for (const space of this.player.game.board.spaces) {
        if (Board.isCitySpace(space) && Board.spaceOwnedBy(space, this.player)) {
          const prospect = this.prospectFor(space);
          committed += Math.max(0, Math.min(prospect.room, MAX_GREENERIES_PER_CITY - prospect.standing));
        }
      }
      this.cachedUncommitted = Math.max(0, this.expectedGreeneries() - committed);
    }
    return this.cachedUncommitted;
  }

  /**
   * Points the next city this player builds should collect, in megacredits.
   *
   * Prices city cards and the city standard project before any space has been
   * chosen, by looking at the best space actually open to the player. A board
   * with nowhere good left to build, or a player with no plants left to grow,
   * prices its own cities down.
   */
  public valueOfNextCity(): number {
    if (this.cachedCityValue === undefined) {
      this.cachedCityValue = this.profile.valuesCityGrowth ?
        this.bestOf(this.citySpaces(), (space) => this.greeneryPointsFor(space)) :
        // A player who has not worked out what a city is for values it at
        // about a point and builds it wherever it fits.
        VP_VALUE;
    }
    return this.cachedCityValue;
  }

  /**
   * Points a city on this space should score, counting the greeneries already
   * beside it and the ones this player can still grow into the gaps.
   *
   * Adjacent greeneries score for the city's owner no matter who planted them,
   * so an opponent's forest beside the bot's city is a point for the bot.
   */
  public greeneryPointsFor(space: Space): number {
    const prospect = this.prospectFor(space);
    return (prospect.standing + this.growthAt(prospect)) * VP_VALUE;
  }

  /**
   * What room beside a city is worth beyond the greeneries counted above.
   *
   * Room the plants will not reach is still optionality: somewhere to put the
   * greenery from a card the bot has not drawn yet. It is worth nothing once
   * there is no time left to plant anything.
   */
  public growthRoomValue(space: Space): number {
    if (this.tempo.endgame) {
      return 0;
    }
    const prospect = this.prospectFor(space);
    const spare = Math.min(prospect.room, MAX_GREENERIES_PER_CITY) - this.growthAt(prospect);
    return Math.max(0, spare) * GROWTH_ROOM_VALUE;
  }

  /** Greeneries a city on this space can still expect to gain. */
  private growthAt(prospect: {standing: number, room: number}): number {
    return Math.min(
      prospect.room,
      this.uncommittedGreeneries() * NEW_CITY_SHARE_OF_GREENERIES,
      Math.max(0, MAX_GREENERIES_PER_CITY - prospect.standing));
  }

  /** Greeneries standing beside a space, and the gaps left around it. */
  private prospectFor(space: Space): {standing: number, room: number} {
    let standing = 0;
    let room = 0;
    for (const neighbour of this.player.game.board.getAdjacentSpaces(space)) {
      if (Board.isGreenerySpace(neighbour)) {
        standing++;
      } else if (this.isPlantable(neighbour)) {
        room++;
      }
    }
    return {standing, room};
  }

  /**
   * Points a greenery on this space hands out through city adjacency.
   *
   * Every city beside a greenery scores a point for whoever owns that city, so
   * planting beside the bot's own city is worth twice what planting in open
   * ground is, and planting beside an opponent's city pays for part of their
   * turn instead.
   */
  public cityAdjacencyPointsFor(space: Space): number {
    let value = 0;
    for (const neighbour of this.player.game.board.getAdjacentSpaces(space)) {
      if (!Board.isCitySpace(neighbour)) {
        continue;
      }
      value += Board.spaceOwnedBy(neighbour, this.player) ? VP_VALUE : -VP_VALUE * OPPONENT_CITY_PENALTY;
    }
    return value;
  }

  /**
   * The extra points a greenery is worth right now because of where it can go.
   *
   * Priced before a space is chosen, so that converting plants and buying the
   * greenery standard project both know that a greenery beside one of the
   * bot's own cities is two points rather than one. That is the other half of
   * valuing cities properly: a bot that builds cities but does not notice they
   * make its plants worth more has only paid for them.
   */
  public greeneryAdjacencyBonus(): number {
    if (this.cachedGreeneryBonus === undefined) {
      this.cachedGreeneryBonus = this.profile.valuesCityGrowth ?
        Math.max(0, this.bestOf(this.greenerySpaces(), (space) => this.cityAdjacencyPointsFor(space))) :
        0;
    }
    return this.cachedGreeneryBonus;
  }

  /**
   * How much of the opponents' city planning this space takes away.
   *
   * A city may not sit beside another city, so building one closes its space
   * and all six neighbours to every other player. Taking one of the last good
   * spots is worth more than the tile itself.
   */
  public cityDenialValue(space: Space): number {
    const board = this.player.game.board;
    let value = 0;
    for (const opponent of this.player.opponents) {
      const spaces = this.spacesFor(() => board.getAvailableSpacesForCity(opponent));
      if (spaces.length === 0) {
        continue;
      }
      const closed = spaces.filter((candidate) =>
        candidate.id === space.id || board.getAdjacentSpaces(space).some((adjacent) => adjacent.id === candidate.id));
      // Denial is only worth much when what is left is running short.
      value += (closed.length / spaces.length) * VP_VALUE;
    }
    return value;
  }

  private isPlantable(space: Space): boolean {
    return space.tile === undefined && space.spaceType === SpaceType.LAND;
  }

  private bestOf(spaces: ReadonlyArray<Space>, score: (space: Space) => number): number {
    let best = 0;
    for (const space of spaces) {
      best = Math.max(best, score(space));
    }
    return best;
  }

  private citySpaces(): ReadonlyArray<Space> {
    return this.spacesFor(() => this.player.game.board.getAvailableSpacesForCity(this.player));
  }

  private greenerySpaces(): ReadonlyArray<Space> {
    return this.spacesFor(() => this.player.game.board.getAvailableSpacesForGreenery(this.player));
  }

  /**
   * Board queries throw when nothing is available, and a bot that cannot price
   * a card is worse off than one that prices it at nothing.
   */
  private spacesFor(query: () => ReadonlyArray<Space>): ReadonlyArray<Space> {
    try {
      return query();
    } catch (err) {
      return [];
    }
  }
}
