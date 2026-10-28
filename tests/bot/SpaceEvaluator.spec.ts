import {expect} from 'chai';
import {testGame} from '../TestGame';
import {bestCitySpaceValue, scoreSpace} from '../../src/server/bot/evaluate/SpaceEvaluator';
import {ActionScorer} from '../../src/server/bot/evaluate/ActionScorer';
import {CardEvaluator} from '../../src/server/bot/evaluate/CardEvaluator';
import {Tempo, VP_VALUE} from '../../src/server/bot/evaluate/Values';
import {profileFor} from '../../src/server/bot/BotProfile';
import {CityStandardProject} from '../../src/server/cards/base/standardProjects/CityStandardProject';
import {IPlayer} from '../../src/server/IPlayer';
import {Space} from '../../src/server/boards/Space';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {Phase} from '../../src/common/Phase';

const lateGame: Tempo = {progress: 0.9, remainingGenerations: 1, endgame: true};
const midGame: Tempo = {progress: 0.5, remainingGenerations: 5, endgame: false};

/** A land space whose neighbours are all land, so tests control every tile around it. */
function openLandSpace(player: IPlayer): Space {
  const board = player.game.board;
  const space = board.spaces.find((candidate) =>
    candidate.spaceType === SpaceType.LAND &&
    board.getAdjacentSpaces(candidate).length === 6 &&
    board.getAdjacentSpaces(candidate).every((neighbour) => neighbour.spaceType === SpaceType.LAND));
  if (space === undefined) {
    throw new Error('board has no fully open land space');
  }
  return space;
}

function plantGreenery(space: Space, owner: IPlayer): void {
  space.tile = {tileType: TileType.GREENERY};
  space.player = owner;
}

describe('SpaceEvaluator', () => {
  it('scores a city beside an opponent\'s greeneries', () => {
    const [/* game */, player, opponent] = testGame(2);
    const profile = profileFor('hard');
    const space = openLandSpace(player);
    const before = scoreSpace(player, space, TileType.CITY, lateGame, profile);

    // Every greenery beside a city scores for the city's owner, whoever planted it.
    player.game.board.getAdjacentSpaces(space).slice(0, 4).forEach((neighbour) => plantGreenery(neighbour, opponent));

    const after = scoreSpace(player, space, TileType.CITY, lateGame, profile);
    expect(after - before).to.be.at.least(3 * VP_VALUE);
  });

  it('builds a standard project city beside a ring of greeneries', () => {
    const [/* game */, player, opponent] = testGame(2);
    const profile = profileFor('hard');
    const space = openLandSpace(player);
    player.game.board.getAdjacentSpaces(space).slice(0, 4).forEach((neighbour) => plantGreenery(neighbour, opponent));

    const scorer = new ActionScorer(player, profile, lateGame, new CardEvaluator(player, profile, lateGame));
    const value = scorer.standardProjectValue(new CityStandardProject());

    expect(value).to.be.at.least(4 * VP_VALUE);
    expect(bestCitySpaceValue(player, lateGame, profile)).to.be.at.least(scoreSpace(player, space, TileType.CITY, lateGame, profile));
  });

  it('avoids planting a greenery that opens a city space for the opponent', () => {
    const [game, player, opponent] = testGame(2);
    const profile = profileFor('hard');
    const space = openLandSpace(player);
    const [hot, ...rest] = game.board.getAdjacentSpaces(space);
    // Surround one neighbour with greeneries so it is already a strong city space.
    game.board.getAdjacentSpaces(hot)
      .filter((candidate) => candidate.id !== space.id && rest.includes(candidate) === false)
      .slice(0, 3)
      .forEach((candidate) => plantGreenery(candidate, opponent));

    const during = scoreSpace(player, space, TileType.GREENERY, midGame, profile);
    // Once the final greeneries are being placed, nobody can build a city to exploit it.
    game.phase = Phase.END;
    const final = scoreSpace(player, space, TileType.GREENERY, midGame, profile);

    expect(final - during).to.be.greaterThan(VP_VALUE);
  });
});
