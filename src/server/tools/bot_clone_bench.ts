/**
 * Measures how long a computer opponent takes to copy a game and play a move
 * out on the copy.
 *
 * Bot moves run synchronously inside the HTTP request that triggered them,
 * so everything the lookahead spends here blocks the server. Run this before
 * raising `planning.lookahead`:
 *
 *   npx tsx src/server/tools/bot_clone_bench.ts [games]
 */
import {Database} from '../database/Database';
import {globalInitialize} from '../globalInitialize';
import {Game} from '../Game';
import {Player} from '../Player';
import {IPlayer} from '../IPlayer';
import {BotRunner} from '../bot/BotRunner';
import {BotRandom} from '../bot/BotRandom';
import {BotBrain} from '../bot/BotBrain';
import {canCloneSafely, cloneForLookahead} from '../bot/plan/GameClone';
import {InputResponse} from '../../common/inputs/InputResponse';
import {isGameId, isPlayerId, isSpectatorId, safeCast} from '../../common/Types';
import {NO_DATABASE, deckSeed} from './bot_tournament';

/** Most follow-up inputs a simulated move may raise before it is abandoned. */
const MAX_STEPS = 40;

function percentile(values: ReadonlyArray<number>, fraction: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

function report(label: string, values: ReadonlyArray<number>): void {
  console.log(`${label.padEnd(28)} p50 ${percentile(values, 0.5).toFixed(2)} ms  ` +
    `p95 ${percentile(values, 0.95).toFixed(2)} ms  max ${percentile(values, 1).toFixed(2)} ms  (n=${values.length})`);
}

function main(): void {
  Database.getInstance = () => NO_DATABASE;
  globalInitialize();
  const games = Number(process.argv[2] ?? 4);
  const clones: Array<number> = [];
  const moves: Array<number> = [];
  const sizes: Array<number> = [];

  for (let seed = 1; seed <= games; seed++) {
    const players = [0, 1].map((index) => {
      const player = new Player(`seat${index}`, index === 0 ? 'blue' : 'red', false, 0, safeCast(`p-${index}-bench-${seed}`, isPlayerId));
      player.bot = 'insane';
      return player;
    });
    const game = Game.newInstance(safeCast(`g-bench-${seed}`, isGameId), players, players[0], safeCast(`s-bench-${seed}`, isSpectatorId), undefined, deckSeed(seed));

    for (const player of players) {
      const process = player.process.bind(player);
      player.process = (response: InputResponse) => {
        if (canCloneSafely(game, player)) {
          measure(game, player, response);
        }
        process(response);
      };
    }
    BotRunner.run(game, {random: new BotRandom(seed)});
  }

  function measure(game: Game, player: IPlayer, response: InputResponse): void {
    sizes.push(JSON.stringify({...game.serialize(), gameLog: []}).length);
    const started = performance.now();
    const clone = cloneForLookahead(game);
    const cloned = performance.now();
    const bot = clone.getPlayerById(player.id);
    const brain = new BotBrain(bot, 'insane', new BotRandom(1));
    try {
      bot.process(response);
      for (let step = 0; step < MAX_STEPS && !bot.isAtActionMenu(); step++) {
        const input = bot.getWaitingFor();
        if (input === undefined) {
          break;
        }
        bot.process(brain.respond(input));
      }
      const menu = bot.getWaitingFor();
      if (menu !== undefined && bot.isAtActionMenu()) {
        new BotBrain(bot, 'insane', new BotRandom(1)).respond(menu);
      }
    } catch (err) {
      // A move the copy cannot finish only costs the time spent on it.
    }
    const finished = performance.now();
    clones.push(cloned - started);
    moves.push(finished - started);
  }

  report('clone', clones);
  report('clone + move + rescore', moves);
  console.log(`serialized size without log: p50 ${(percentile(sizes, 0.5) / 1024).toFixed(0)} KiB, max ${(percentile(sizes, 1) / 1024).toFixed(0)} KiB`);
}

main();
