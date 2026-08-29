import {expect} from 'chai';
import {testGame} from '../TestGame';
import {BoardOutlook} from '../../src/server/bot/evaluate/BoardOutlook';
import {tempoOf} from '../../src/server/bot/evaluate/Values';
import {profileFor} from '../../src/server/bot/BotProfile';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Space} from '../../src/server/boards/Space';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {BotDifficulty} from '../../src/common/bot/BotDifficulty';

function outlookFor(game: IGame, player: IPlayer, difficulty: BotDifficulty = 'hard'): BoardOutlook {
  const profile = profileFor(difficulty);
  return new BoardOutlook(player, tempoOf(game), profile);
}

/**
 * An empty land space with at least `neighbours` empty land spaces around it.
 *
 * `away` keeps the result clear of an earlier pick and everything touching it,
 * so two spaces chosen this way never share a neighbour.
 */
function openSpace(game: IGame, neighbours: number, away?: Space): Space {
  const board = game.board;
  const excluded = new Set<string>();
  if (away !== undefined) {
    excluded.add(away.id);
    for (const adjacent of board.getAdjacentSpaces(away)) {
      excluded.add(adjacent.id);
      board.getAdjacentSpaces(adjacent).forEach((next) => excluded.add(next.id));
    }
  }
  const space = board.spaces.find((candidate) =>
    candidate.tile === undefined &&
    candidate.spaceType === SpaceType.LAND &&
    !excluded.has(candidate.id) &&
    board.getAdjacentSpaces(candidate)
      .filter((adjacent) => adjacent.tile === undefined && adjacent.spaceType === SpaceType.LAND)
      .length >= neighbours);
  if (space === undefined) {
    throw new Error(`no empty land space with ${neighbours} empty neighbours`);
  }
  return space;
}

/** The first empty land space beside `space`. */
function emptyNeighbour(game: IGame, space: Space): Space {
  const neighbour = game.board.getAdjacentSpaces(space)
    .find((candidate) => candidate.tile === undefined && candidate.spaceType === SpaceType.LAND);
  if (neighbour === undefined) {
    throw new Error('expected an empty neighbour');
  }
  return neighbour;
}

describe('BoardOutlook', () => {
  it('prices a city by the greeneries it can still grow beside it', () => {
    const [game, player] = testGame(2);
    player.production.override({plants: 3});

    const roomy = openSpace(game, 4);
    const outlook = outlookFor(game, player);
    const spacious = outlook.greeneryPointsFor(roomy);

    // Fill the neighbours in, and the same space stops being worth anything.
    for (const neighbour of game.board.getAdjacentSpaces(roomy)) {
      if (neighbour.tile === undefined && neighbour.spaceType === SpaceType.LAND) {
        game.addCity(player.opponents[0], neighbour);
      }
    }
    const walledIn = outlookFor(game, player).greeneryPointsFor(roomy);

    expect(spacious).to.be.greaterThan(0);
    expect(walledIn, 'a city with nowhere to grow was priced as though it could').to.eq(0);
  });

  it('counts greeneries already standing beside a city space, whoever planted them', () => {
    const [game, player, opponent] = testGame(2);
    const space = openSpace(game, 3);
    const neighbour = emptyNeighbour(game, space);

    const bare = outlookFor(game, player).greeneryPointsFor(space);
    // A city scores for every greenery beside it, not only its owner's.
    game.addGreenery(opponent, neighbour);
    const beside = outlookFor(game, player).greeneryPointsFor(space);

    expect(beside).to.be.greaterThan(bare);
  });

  it('does not expect the same greeneries twice when it already owns cities', () => {
    const [game, player] = testGame(2);
    player.production.override({plants: 1});

    const first = openSpace(game, 4);
    const before = outlookFor(game, player).valueOfNextCity();
    game.addCity(player, first);
    const after = outlookFor(game, player).valueOfNextCity();

    // The plants only stretch so far: once a city is standing and waiting for
    // them, the next city cannot be counting on the same forests.
    expect(after).to.be.lessThan(before);
  });

  it('is worth planting beside the bot\'s own city and costly beside an opponent\'s', () => {
    const [game, player, opponent] = testGame(2);
    const mine = openSpace(game, 4);
    game.addCity(player, mine);
    const theirs = openSpace(game, 4, mine);
    game.addCity(opponent, theirs);

    const outlook = outlookFor(game, player);

    // The same forest scores two points beside the bot's own city and one
    // point for the opponent beside theirs.
    expect(outlook.cityAdjacencyPointsFor(emptyNeighbour(game, mine))).to.be.greaterThan(0);
    expect(outlook.cityAdjacencyPointsFor(emptyNeighbour(game, theirs))).to.be.lessThan(0);
  });

  it('leaves city planning alone on the easiest difficulty', () => {
    const [game, player] = testGame(2);
    player.production.override({plants: 5});
    game.addCity(player, openSpace(game, 4));

    const easy = outlookFor(game, player, 'easy');

    // `easy` prices every city the same wherever it goes and never notices
    // that its own city makes the next forest worth two points, which is what
    // has it dropping cities in corners a stronger bot would never use.
    expect(easy.greeneryAdjacencyBonus()).to.eq(0);
    expect(outlookFor(game, player, 'hard').greeneryAdjacencyBonus()).to.be.greaterThan(0);
    expect(outlookFor(game, player, 'hard').valueOfNextCity())
      .to.be.greaterThan(easy.valueOfNextCity());
  });
});
