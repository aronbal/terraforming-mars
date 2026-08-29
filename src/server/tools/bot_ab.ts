/**
 * Plays one difficulty against itself with a knob moved, and reports the split.
 *
 * The difficulty ladder in `bot_tournament.ts` answers "is medium still worse
 * than hard"; it cannot answer "did this change to the evaluator help", because
 * both seats get the change. This does: it plays a difficulty against the same
 * difficulty with one or more profile fields overridden on one seat.
 *
 *   npx tsx src/server/tools/bot_ab.ts 100 hard valuesCityGrowth=false
 *
 * The named fields are applied to the *challenger*, so the run above measures
 * how often the shipped `hard` beats a `hard` that has city planning switched
 * off. A win rate meaningfully above 50% means the feature is earning its keep.
 * At 100 games the standard error is about 5 points, so treat anything under
 * roughly 60% as noise.
 */
import {Database} from '../database/Database';
import {Game} from '../Game';
import {IGame} from '../IGame';
import {Player} from '../Player';
import {BotRunner} from '../bot/BotRunner';
import {BotDifficulty, isBotDifficulty} from '../../common/bot/BotDifficulty';
import {BotProfile, clearProfileOverrides, overrideProfile, profileFor} from '../bot/BotProfile';
import {isPlayerId, isGameId, isSpectatorId, safeCast} from '../../common/Types';
import {globalInitialize} from '../globalInitialize';
import {NO_DATABASE, seedForMatch} from './bot_tournament';

/**
 * Reads `name=value` pairs into profile fields.
 *
 * Only the shape is checked here. A misspelled field name would silently do
 * nothing, so it is rejected rather than quietly measuring nothing.
 */
function parseOverrides(args: ReadonlyArray<string>, reference: BotProfile): Partial<BotProfile> {
  const values: Record<string, unknown> = {};
  for (const arg of args) {
    const [name, raw] = arg.split('=');
    if (raw === undefined || !(name in reference)) {
      throw new Error(`Not a profile field: ${arg}`);
    }
    values[name] = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
  }
  return values as Partial<BotProfile>;
}

function main(): void {
  Database.getInstance = () => NO_DATABASE;
  globalInitialize();

  const games = Number(process.argv[2] ?? 100);
  const difficulty = process.argv[3] ?? 'hard';
  if (!isBotDifficulty(difficulty)) {
    throw new Error(`Not a difficulty: ${difficulty}`);
  }
  const changes = process.argv.slice(4);
  if (changes.length === 0) {
    throw new Error('Give at least one profile field to override, e.g. valuesCityGrowth=false');
  }

  // The two seats have to run different profiles in one process, and a profile
  // is looked up by difficulty, so the challenger borrows a difficulty the
  // baseline is not using and has the whole profile copied onto it.
  const challenger: BotDifficulty = difficulty === 'easy' ? 'insane' : 'easy';
  const reference = {...profileFor(difficulty)};
  overrideProfile(challenger, {...reference, ...parseOverrides(changes, reference)});

  let baselineWins = 0;
  let draws = 0;
  let unfinished = 0;
  const scores = [0, 0];

  for (let match = 1; match <= games; match++) {
    // Alternate seats so going first is not what decides the run.
    const swap = match % 2 === 1;
    const seats: Array<BotDifficulty> = swap ? [difficulty, challenger] : [challenger, difficulty];
    const suffix = `ab-${match}`;
    const players = [
      new Player('first', 'blue', false, 0, safeCast(`p-first-${suffix}`, isPlayerId)),
      new Player('second', 'red', false, 0, safeCast(`p-second-${suffix}`, isPlayerId)),
    ];
    players[0].bot = seats[0];
    players[1].bot = seats[1];

    const game: IGame = Game.newInstance(
      safeCast(`g-${suffix}`, isGameId), players, players[0],
      safeCast(`s-${suffix}`, isSpectatorId), undefined, seedForMatch(match));
    BotRunner.run(game);
    if (game.phase !== 'end') {
      unfinished++;
    }

    const baseline = swap ? 0 : 1;
    const baselineScore = players[baseline].getVictoryPoints().total;
    const challengerScore = players[1 - baseline].getVictoryPoints().total;
    scores[0] += baselineScore;
    scores[1] += challengerScore;
    if (baselineScore > challengerScore) {
      baselineWins++;
    } else if (baselineScore === challengerScore) {
      draws++;
    }
  }

  clearProfileOverrides();
  const rate = ((baselineWins / games) * 100).toFixed(0);
  console.log(`${difficulty} vs ${difficulty} with ${changes.join(' ')}`);
  console.log(
    `baseline wins ${baselineWins}/${games} (${rate}%)  draws ${draws}  ` +
    `avg score ${(scores[0] / games).toFixed(1)} vs ${(scores[1] / games).toFixed(1)}` +
    (unfinished > 0 ? `  UNFINISHED ${unfinished}` : ''));
}

main();
