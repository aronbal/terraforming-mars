import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {InputResponse} from '../../common/inputs/InputResponse';
import {Units} from '../../common/Units';
import {OrOptions} from '../inputs/OrOptions';
import {AndOptions} from '../inputs/AndOptions';
import {SelectCard} from '../inputs/SelectCard';
import {SelectSpace} from '../inputs/SelectSpace';
import {SelectAmount} from '../inputs/SelectAmount';
import {SelectPayment} from '../inputs/SelectPayment';
import {UndoActionOption} from '../inputs/UndoActionOption';
import {BotBrain} from './BotBrain';
import {BotRandom} from './BotRandom';
import {planPayment} from './PaymentPlanner';

/**
 * Ceiling on decisions resolved in one call.
 *
 * A generation of two-player Terraforming Mars resolves in well under a
 * hundred inputs; this only exists so a bug cannot spin the server forever.
 */
const MAX_DECISIONS = 2000;

/** How many times one input may be retried before the bot gives up on it. */
const MAX_ATTEMPTS_PER_INPUT = 24;

/**
 * Plays out every computer opponent's pending decisions.
 *
 * Call this after anything that might hand control to a bot: game creation,
 * and each time a human submits input. It returns once no bot is waiting,
 * which is either because the humans are up or because the game has ended.
 */
export class BotRunner {
  private readonly random = new BotRandom();

  public static run(game: IGame): void {
    new BotRunner().play(game);
  }

  /** True when at least one player in this game is a computer opponent. */
  public static hasBots(game: IGame): boolean {
    return game.players.some((player) => player.bot !== undefined);
  }

  public play(game: IGame): void {
    let decisions = 0;
    let previous: PlayerInput | undefined = undefined;
    let attempts = 0;

    while (decisions++ < MAX_DECISIONS) {
      const bot = this.nextWaitingBot(game);
      if (bot === undefined) {
        return;
      }
      const input = bot.getWaitingFor();
      if (input === undefined) {
        return;
      }

      attempts = input === previous ? attempts + 1 : 0;
      previous = input;
      if (attempts >= MAX_ATTEMPTS_PER_INPUT) {
        console.warn(`Bot ${bot.color} is stuck on a ${input.type} input; leaving it for a human.`);
        return;
      }

      if (!this.resolve(bot, input)) {
        return;
      }
    }
    console.warn('Bot runner hit its decision ceiling; stopping to avoid a loop.');
  }

  private nextWaitingBot(game: IGame): IPlayer | undefined {
    return game.players.find((player) => player.bot !== undefined && player.getWaitingFor() !== undefined);
  }

  /**
   * Answers one input.
   *
   * The brain's answer is tried first. `Player.process` restores the pending
   * input when a response is rejected, so a refused answer is recoverable and
   * the fallbacks below get their turn.
   */
  private resolve(bot: IPlayer, input: PlayerInput): boolean {
    const difficulty = bot.bot;
    if (difficulty === undefined) {
      return false;
    }

    try {
      const response = new BotBrain(bot, difficulty, this.random).respond(input);
      bot.process(response);
      return true;
    } catch (err) {
      // Fall through to the safe answers below.
    }

    for (const candidate of this.fallbacks(input, bot)) {
      try {
        bot.process(candidate);
        return true;
      } catch (err) {
        continue;
      }
    }

    console.warn(`Bot ${bot.color} could not answer a ${input.type} input.`);
    return false;
  }

  /**
   * Simple answers to try when scoring fails.
   *
   * These aim only to be legal. A bot that plays a mediocre move keeps the
   * game moving; a bot that plays no move strands its opponent.
   */
  private* fallbacks(input: PlayerInput, player: IPlayer): Generator<InputResponse> {
    if (input instanceof OrOptions) {
      for (let index = 0; index < input.options.length; index++) {
        const option = input.options[index];
        if (option instanceof UndoActionOption) {
          continue;
        }
        for (const inner of this.fallbacks(option, player)) {
          yield {type: 'or', index, response: inner};
        }
      }
      return;
    }

    if (input instanceof AndOptions) {
      const responses: Array<InputResponse> = [];
      for (const option of input.options) {
        const first = this.fallbacks(option, player).next();
        if (first.done === true) {
          return;
        }
        responses.push(first.value);
      }
      yield {type: 'and', responses};
      return;
    }

    if (input instanceof SelectCard) {
      const {min, max} = input.config;
      const selectable = input.cards
        .filter((_card, index) => input.config.enabled?.[index] !== false)
        .map((card) => card.name);
      yield {type: 'card', cards: selectable.slice(0, Math.max(min, 0))};
      if (min === 0 && max > 0 && selectable.length > 0) {
        yield {type: 'card', cards: selectable.slice(0, 1)};
      }
      return;
    }

    if (input instanceof SelectSpace) {
      for (const space of input.spaces) {
        yield {type: 'space', spaceId: space.id};
      }
      return;
    }

    if (input instanceof SelectAmount) {
      yield {type: 'amount', amount: input.min};
      if (input.max !== input.min) {
        yield {type: 'amount', amount: input.max};
      }
      return;
    }

    if (input instanceof SelectPayment) {
      const payment = planPayment(player, input.amount, input.paymentOptions, input.reserveUnits ?? Units.EMPTY);
      if (payment !== undefined) {
        yield {type: 'payment', payment};
      }
      return;
    }

    if (input.type === 'option') {
      yield {type: 'option'};
      return;
    }
  }
}
