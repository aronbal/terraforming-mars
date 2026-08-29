import {expect} from 'chai';
import {testGame} from '../TestGame';
import {BotRunner} from '../../src/server/bot/BotRunner';
import {BOT_DIFFICULTIES, BotDifficulty} from '../../src/common/bot/BotDifficulty';
import {Phase} from '../../src/common/Phase';
import {IGame} from '../../src/server/IGame';

/**
 * Plays a game out with every seat controlled by a bot.
 *
 * This is the load-bearing test for the computer opponent: if the bot can
 * answer every input the engine puts to it, the game reaches `Phase.END`, and
 * if it cannot, the run stops early and leaves the game mid-generation.
 */
function playOut(difficulty: BotDifficulty, idSuffix: string): IGame {
  const [game, ...players] = testGame(2, {skipInitialCardSelection: false}, idSuffix);
  for (const player of players) {
    player.bot = difficulty;
  }
  BotRunner.run(game);
  return game;
}

/** A full game is heavier than a unit test, so allow more than the default. */
const GAME_TIMEOUT = 120000;

describe('Bot self-play', () => {
  BOT_DIFFICULTIES.forEach((difficulty) => {
    it(`plays a two-player game through to the end at ${difficulty}`, () => {
      const game = playOut(difficulty, `-self-${difficulty}`);

      expect(game.phase, 'game did not reach the end').to.eq(Phase.END);
      expect(game.players.every((player) => player.getWaitingFor() === undefined)).is.true;
    }).timeout(GAME_TIMEOUT);
  });

  it('terraforms Mars over the course of a game', () => {
    const game = playOut('hard', '-terraform');

    expect(game.getTemperature(), 'temperature never moved').to.be.greaterThan(-30);
    expect(game.generation, 'game ended in a single generation').to.be.greaterThan(3);
  }).timeout(GAME_TIMEOUT);

  it('scores both players above their starting terraform rating', () => {
    const game = playOut('medium', '-scores');

    for (const player of game.players) {
      expect(player.getVictoryPoints().total).to.be.greaterThan(20);
    }
  }).timeout(GAME_TIMEOUT);
});
