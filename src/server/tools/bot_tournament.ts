/**
 * Plays computer opponents against each other and reports the results.
 *
 * Use this when changing the bot's evaluation to check that the difficulty
 * ladder still holds: each level should beat the ones below it more often
 * than it loses to them.
 *
 *   npx tsx src/server/tools/bot_tournament.ts [gamesPerPairing]
 */
import {Database} from '../database/Database';
import {IDatabase} from '../database/IDatabase';
import {SerializedGame} from '../SerializedGame';
import {Game} from '../Game';
import {IGame} from '../IGame';
import {Player} from '../Player';
import {BotRunner} from '../bot/BotRunner';
import {BOT_DIFFICULTIES, BotDifficulty} from '../../common/bot/BotDifficulty';
import {isPlayerId, isGameId, isSpectatorId, safeCast} from '../../common/Types';
import {globalInitialize} from '../globalInitialize';

/** Games are played in memory; nothing here should touch a real database. */
export const NO_DATABASE = {
  markFinished: () => Promise.resolve(),
  deleteGameNbrSaves: () => Promise.resolve(),
  getPlayerCount: () => Promise.resolve(0),
  getGame: () => Promise.resolve({} as SerializedGame),
  getGameId: () => Promise.resolve('g'),
  getGameVersion: () => Promise.resolve({} as SerializedGame),
  getGameIds: () => Promise.resolve([]),
  getSaveIds: () => Promise.resolve([]),
  initialize: () => Promise.resolve(),
  saveGameResults: () => {},
  saveGame: () => Promise.resolve(),
  purgeUnfinishedGames: () => Promise.resolve([]),
  compressCompletedGames: () => Promise.resolve(),
  stats: () => Promise.resolve({}),
  storeParticipants: () => Promise.resolve(),
  getParticipants: () => Promise.resolve([]),
  createSession: () => Promise.resolve(),
  deleteSession: () => Promise.resolve(),
  getSessions: () => Promise.resolve([]),
} satisfies IDatabase;

export type MatchResult = {
  winner: BotDifficulty | 'draw';
  generations: number;
  scores: Record<string, number>;
  finished: boolean;
};

/** Plays one game between two difficulties and reports who won. */
export function playMatch(first: BotDifficulty, second: BotDifficulty, seed: number): MatchResult {
  const suffix = `${first}-${second}-${seed}`;
  const players = [
    new Player('first', 'blue', false, 0, safeCast(`p-first-${suffix}`, isPlayerId)),
    new Player('second', 'red', false, 0, safeCast(`p-second-${suffix}`, isPlayerId)),
  ];
  players[0].bot = first;
  players[1].bot = second;

  const game: IGame = Game.newInstance(
    safeCast(`g-${suffix}`, isGameId),
    players,
    players[0],
    safeCast(`s-${suffix}`, isSpectatorId),
    undefined,
    seed);

  BotRunner.run(game);

  const firstScore = players[0].getVictoryPoints().total;
  const secondScore = players[1].getVictoryPoints().total;
  let winner: BotDifficulty | 'draw' = 'draw';
  if (firstScore > secondScore) {
    winner = first;
  } else if (secondScore > firstScore) {
    winner = second;
  }

  return {
    winner,
    generations: game.generation,
    scores: {[`${first} (first)`]: firstScore, [`${second} (second)`]: secondScore},
    finished: game.phase === 'end',
  };
}

function main(): void {
  Database.getInstance = () => NO_DATABASE;
  globalInitialize();

  const gamesPerPairing = Number(process.argv[2] ?? 12);
  console.log(`Playing ${gamesPerPairing} games per pairing.\n`);

  let seed = 1;
  for (let i = 0; i < BOT_DIFFICULTIES.length; i++) {
    for (let j = i + 1; j < BOT_DIFFICULTIES.length; j++) {
      const stronger = BOT_DIFFICULTIES[j];
      const weaker = BOT_DIFFICULTIES[i];
      let strongerWins = 0;
      let draws = 0;
      let unfinished = 0;
      let totalGenerations = 0;

      for (let n = 0; n < gamesPerPairing; n++) {
        // Alternate seats so going first is not what decides the pairing.
        const swap = n % 2 === 1;
        const result = swap ?
          playMatch(stronger, weaker, seed++) :
          playMatch(weaker, stronger, seed++);
        totalGenerations += result.generations;
        if (!result.finished) {
          unfinished++;
        }
        if (result.winner === stronger) {
          strongerWins++;
        } else if (result.winner === 'draw') {
          draws++;
        }
      }

      const rate = ((strongerWins / gamesPerPairing) * 100).toFixed(0);
      const generations = (totalGenerations / gamesPerPairing).toFixed(1);
      console.log(
        `${stronger.padEnd(7)} vs ${weaker.padEnd(7)}  ` +
        `${stronger} wins ${String(strongerWins).padStart(2)}/${gamesPerPairing} (${rate.padStart(3)}%)  ` +
        `draws ${draws}  avg generations ${generations}` +
        (unfinished > 0 ? `  UNFINISHED ${unfinished}` : ''));
    }
  }
}

if (process.argv[1]?.endsWith('bot_tournament.ts')) {
  main();
}
