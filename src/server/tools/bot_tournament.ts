/**
 * Plays computer opponents against each other and reports the results.
 *
 * Use this when changing the bot's evaluation to check that the difficulty
 * ladder still holds: each level should beat the ones below it more often
 * than it loses to them.
 *
 *   npx tsx src/server/tools/bot_tournament.ts [gamesPerPairing]
 *
 * It also compares two versions of one difficulty, playing every seed twice
 * with the seats swapped so the deal cancels out:
 *
 *   npx tsx src/server/tools/bot_tournament.ts ab <pairs> <difficulty> [key=value ...] [vs key=value ...]
 *
 * The settings before `vs` change side A and the ones after change side B, so
 * `ab 200 insane planning.requirementForecast=true vs` measures switching the
 * forecast on against the default.
 */
import {Database} from '../database/Database';
import {IDatabase} from '../database/IDatabase';
import {SerializedGame} from '../SerializedGame';
import {Game} from '../Game';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Player} from '../Player';
import {BotRunner} from '../bot/BotRunner';
import {BotRandom} from '../bot/BotRandom';
import {BotProfileOverride} from '../bot/BotProfile';
import {BotStats, NO_STATS} from '../bot/BotMemory';
import {BOT_DIFFICULTIES, BotDifficulty} from '../../common/bot/BotDifficulty';
import {PlayerId, isPlayerId, isGameId, isSpectatorId, safeCast} from '../../common/Types';
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

/** One seat at the table. */
export type Seat = {
  difficulty: BotDifficulty;
  override?: BotProfileOverride;
};

/** How one seat played, beyond its score. */
export type SeatStats = {
  score: number;
  /** Megacredits left over when the game ended. */
  unspent: number;
  /** Project cards costing 20 or more that the seat played. */
  bigCards: number;
  /** What the seat's planning did. */
  planning: BotStats;
};

export type GameResult = {
  seats: Array<SeatStats>;
  generations: number;
  finished: boolean;
  milliseconds: number;
};

function seatStats(player: IPlayer): SeatStats {
  return {
    score: player.getVictoryPoints().total,
    unspent: player.megaCredits,
    bigCards: player.playedCards.asArray().filter((card) => (card.cost ?? 0) >= 20).length,
    planning: player.botMemory?.stats ?? NO_STATS,
  };
}

/**
 * The game's shuffle seed for tournament seed `seed`.
 *
 * `SeededRandom` expects a seed in [0, 1) and scales it by 2^32, so every
 * whole number gives the same shuffle as 0: before this, every tournament game
 * was dealt the same corporations and cards.
 */
export function deckSeed(seed: number): number {
  return (seed * 0.6180339887498949) % 1;
}

/**
 * Plays one game between bots and reports how each seat did.
 *
 * The ids depend only on `seed` and the seat, not on who sits there, so a
 * seat's dealt cards and personality are the same whoever is playing it.
 */
export function playGame(seats: ReadonlyArray<Seat>, seed: number, label: string = 'game'): GameResult {
  const suffix = `${label}-${seed}`;
  const players = seats.map((seat, index) => {
    const player = new Player(`seat${index}`, index === 0 ? 'blue' : 'red', false, 0, safeCast(`p-${index}-${suffix}`, isPlayerId));
    player.bot = seat.difficulty;
    return player;
  });

  const game: IGame = Game.newInstance(
    safeCast(`g-${suffix}`, isGameId),
    players,
    players[0],
    safeCast(`s-${suffix}`, isSpectatorId),
    undefined,
    deckSeed(seed));

  const overrides = new Map<PlayerId, BotProfileOverride>();
  seats.forEach((seat, index) => {
    if (seat.override !== undefined) {
      overrides.set(players[index].id, seat.override);
    }
  });

  const started = Date.now();
  BotRunner.run(game, {random: new BotRandom(seed), overrides});
  return {
    seats: players.map(seatStats),
    generations: game.generation,
    finished: game.phase === 'end',
    milliseconds: Date.now() - started,
  };
}

/** Plays one game between two difficulties and reports who won. */
export function playMatch(first: BotDifficulty, second: BotDifficulty, seed: number): MatchResult {
  const result = playGame([{difficulty: first}, {difficulty: second}], seed, `${first}-${second}`);
  const [firstScore, secondScore] = result.seats.map((seat) => seat.score);
  let winner: BotDifficulty | 'draw' = 'draw';
  if (firstScore > secondScore) {
    winner = first;
  } else if (secondScore > firstScore) {
    winner = second;
  }

  return {
    winner,
    generations: result.generations,
    scores: {[`${first} (first)`]: firstScore, [`${second} (second)`]: secondScore},
    finished: result.finished,
  };
}

function ladder(gamesPerPairing: number): void {
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

/** Parses settings like `planning.goals=false` into a profile override. */
export function parseOverride(settings: ReadonlyArray<string>): BotProfileOverride {
  const override: Record<string, unknown> = {};
  for (const setting of settings) {
    const [path, raw] = setting.split('=');
    if (path === undefined || raw === undefined) {
      throw new Error(`Expected key=value, got ${setting}`);
    }
    let value: number | boolean = Number(raw);
    if (raw === 'true' || raw === 'false') {
      value = raw === 'true';
    } else if (Number.isNaN(value)) {
      throw new Error(`Expected a number or boolean for ${path}, got ${raw}`);
    }
    const keys = path.split('.');
    let target = override;
    for (const key of keys.slice(0, -1)) {
      target[key] = target[key] ?? {};
      target = target[key] as Record<string, unknown>;
    }
    target[keys[keys.length - 1]] = value;
  }
  return override as BotProfileOverride;
}

function mean(values: ReadonlyArray<number>): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function standardError(values: ReadonlyArray<number>): number {
  if (values.length < 2) {
    return 0;
  }
  const average = mean(values);
  const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance / values.length);
}

/**
 * Plays side A against side B of one difficulty.
 *
 * Every seed is played twice with the seats swapped, so each side gets the
 * same cards and the same seat as often as the other. The paired difference
 * in score per seed is the sharpest measure, because it cancels the deal.
 */
function ab(pairs: number, difficulty: BotDifficulty, a: BotProfileOverride, b: BotProfileOverride): void {
  console.log(`A/B at ${difficulty}, ${pairs} seeds, each played with the seats both ways.`);
  console.log(`  A: ${JSON.stringify(a)}`);
  console.log(`  B: ${JSON.stringify(b)}\n`);

  const sideA: Seat = {difficulty, override: a};
  const sideB: Seat = {difficulty, override: b};
  let aWins = 0;
  let draws = 0;
  let unfinished = 0;
  const differences: Array<number> = [];
  const generations: Array<number> = [];
  const milliseconds: Array<number> = [];
  const statsA: Array<SeatStats> = [];
  const statsB: Array<SeatStats> = [];

  for (let seed = 1; seed <= pairs; seed++) {
    const forwards = playGame([sideA, sideB], seed, 'ab');
    const backwards = playGame([sideB, sideA], seed, 'ab');
    const games: Array<[GameResult, SeatStats, SeatStats]> = [
      [forwards, forwards.seats[0], forwards.seats[1]],
      [backwards, backwards.seats[1], backwards.seats[0]],
    ];
    let difference = 0;
    for (const [game, seatA, seatB] of games) {
      if (!game.finished) {
        unfinished++;
      }
      if (seatA.score > seatB.score) {
        aWins++;
      } else if (seatA.score === seatB.score) {
        draws++;
      }
      difference += (seatA.score - seatB.score) / 2;
      generations.push(game.generations);
      milliseconds.push(game.milliseconds);
      statsA.push(seatA);
      statsB.push(seatB);
    }
    differences.push(difference);
  }

  const games = pairs * 2;
  const rate = (aWins + draws / 2) / games;
  const interval = 1.96 * Math.sqrt(rate * (1 - rate) / games);
  const describe = (stats: ReadonlyArray<SeatStats>) =>
    `score ${mean(stats.map((s) => s.score)).toFixed(1)}  ` +
    `unspent M€ ${mean(stats.map((s) => s.unspent)).toFixed(1)}  ` +
    `20+ cost cards ${mean(stats.map((s) => s.bigCards)).toFixed(2)}  ` +
    `goals set ${mean(stats.map((s) => s.planning.goalsSet)).toFixed(2)}, ` +
    `met ${mean(stats.map((s) => s.planning.goalsMet)).toFixed(2)}, ` +
    `abandoned ${mean(stats.map((s) => s.planning.goalsAbandoned)).toFixed(2)}  ` +
    `lookahead changed ${mean(stats.map((s) => s.planning.lookaheadChanged)).toFixed(2)}`;

  console.log(`A wins ${aWins}/${games}, draws ${draws}: ${(rate * 100).toFixed(1)}% ± ${(interval * 100).toFixed(1)} (95%)`);
  console.log(`Paired VP difference A−B: ${mean(differences).toFixed(2)} ± ${standardError(differences).toFixed(2)} (SE)`);
  console.log(`Average generations ${mean(generations).toFixed(1)}, ${mean(milliseconds).toFixed(0)} ms per game` +
    (unfinished > 0 ? `, UNFINISHED ${unfinished}` : ''));
  console.log(`  A: ${describe(statsA)}`);
  console.log(`  B: ${describe(statsB)}`);
}

function main(): void {
  Database.getInstance = () => NO_DATABASE;
  globalInitialize();

  if (process.argv[2] === 'ab') {
    const pairs = Number(process.argv[3] ?? 100);
    const difficulty = process.argv[4] as BotDifficulty;
    if (!BOT_DIFFICULTIES.includes(difficulty)) {
      throw new Error(`Unknown difficulty ${difficulty}`);
    }
    const settings = process.argv.slice(5);
    const split = settings.indexOf('vs');
    const a = split === -1 ? settings : settings.slice(0, split);
    const b = split === -1 ? [] : settings.slice(split + 1);
    ab(pairs, difficulty, parseOverride(a), parseOverride(b));
    return;
  }

  ladder(Number(process.argv[2] ?? 12));
}

if (process.argv[1]?.endsWith('bot_tournament.ts')) {
  main();
}
