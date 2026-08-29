/**
 * Reports what the computer opponent actually builds over a run of games.
 *
 * Win rates say which bot is stronger; they do not say what either bot is
 * doing. This prints the shape of the games — tiles laid, where the points
 * came from, how long the game ran — which is what tells you whether a bot is
 * playing the game or only winning the benchmark.
 *
 *   npx tsx src/server/tools/bot_diagnostics.ts [games] [first] [second]
 */
import {Database} from '../database/Database';
import {Game} from '../Game';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Player} from '../Player';
import {BotRunner} from '../bot/BotRunner';
import {BotDifficulty, isBotDifficulty} from '../../common/bot/BotDifficulty';
import {isPlayerId, isGameId, isSpectatorId, safeCast} from '../../common/Types';
import {globalInitialize} from '../globalInitialize';
import {Board} from '../boards/Board';
import {TileType} from '../../common/TileType';
import {NO_DATABASE, seedForMatch} from './bot_tournament';

type Totals = {
  cities: number,
  greeneries: number,
  cityPoints: number,
  greeneryPoints: number,
  cardPoints: number,
  milestonesAndAwards: number,
  terraformRating: number,
  total: number,
};

function emptyTotals(): Totals {
  return {
    cities: 0,
    greeneries: 0,
    cityPoints: 0,
    greeneryPoints: 0,
    cardPoints: 0,
    milestonesAndAwards: 0,
    terraformRating: 0,
    total: 0,
  };
}

function tilesOf(game: IGame, player: IPlayer, tileType: TileType): number {
  return game.board.spaces.filter((space) => space.tile?.tileType === tileType && Board.spaceOwnedBy(space, player)).length;
}

function accumulate(totals: Totals, game: IGame, player: IPlayer): void {
  const points = player.getVictoryPoints();
  totals.cities += game.board.spaces.filter((space) => Board.isCitySpace(space) && Board.spaceOwnedBy(space, player)).length;
  totals.greeneries += tilesOf(game, player, TileType.GREENERY);
  totals.cityPoints += points.city;
  totals.greeneryPoints += points.greenery;
  totals.cardPoints += points.victoryPoints;
  totals.milestonesAndAwards += points.milestones + points.awards;
  totals.terraformRating += player.terraformRating;
  totals.total += points.total;
}

function report(name: BotDifficulty, totals: Totals, games: number): void {
  const per = (value: number) => (value / games).toFixed(2).padStart(6);
  console.log(
    `${name.padEnd(7)} cities${per(totals.cities)}  greeneries${per(totals.greeneries)}  ` +
    `city VP${per(totals.cityPoints)}  greenery VP${per(totals.greeneryPoints)}  ` +
    `card VP${per(totals.cardPoints)}  milestones and awards${per(totals.milestonesAndAwards)}  ` +
    `TR${per(totals.terraformRating)}  total${per(totals.total)}`);
}

function main(): void {
  Database.getInstance = () => NO_DATABASE;
  globalInitialize();

  const games = Number(process.argv[2] ?? 20);
  const difficulties = [process.argv[3] ?? 'hard', process.argv[4] ?? 'hard'];
  for (const difficulty of difficulties) {
    if (!isBotDifficulty(difficulty)) {
      throw new Error(`Not a difficulty: ${difficulty}`);
    }
  }
  const [first, second] = difficulties as Array<BotDifficulty>;

  const totals = [emptyTotals(), emptyTotals()];
  let generations = 0;

  for (let match = 1; match <= games; match++) {
    const suffix = `diagnostics-${match}`;
    const players = [
      new Player('first', 'blue', false, 0, safeCast(`p-first-${suffix}`, isPlayerId)),
      new Player('second', 'red', false, 0, safeCast(`p-second-${suffix}`, isPlayerId)),
    ];
    players[0].bot = first;
    players[1].bot = second;

    const game: IGame = Game.newInstance(
      safeCast(`g-${suffix}`, isGameId), players, players[0],
      safeCast(`s-${suffix}`, isSpectatorId), undefined, seedForMatch(match));
    BotRunner.run(game);

    generations += game.generation;
    players.forEach((player, seat) => accumulate(totals[seat], game, player));
  }

  console.log(`${games} games, average ${(generations / games).toFixed(1)} generations`);
  report(first, totals[0], games);
  report(second, totals[1], games);
}

main();
