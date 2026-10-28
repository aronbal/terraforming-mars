import {expect} from 'chai';
import {testGame} from '../TestGame';
import {canCloneSafely, cloneForLookahead} from '../../src/server/bot/plan/GameClone';
import {BotBrain} from '../../src/server/bot/BotBrain';
import {BotRandom} from '../../src/server/bot/BotRandom';
import {BotRunner} from '../../src/server/bot/BotRunner';
import {GameLoader} from '../../src/server/database/GameLoader';
import {IGameLoader} from '../../src/server/database/IGameLoader';
import {IDatabase} from '../../src/server/database/IDatabase';
import {Database} from '../../src/server/database/Database';
import {restoreTestDatabase, restoreTestGameLoader, setTestDatabase, setTestGameLoader} from '../testing/setup';
import {SimpleDeferredAction} from '../../src/server/deferredActions/DeferredAction';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {Phase} from '../../src/common/Phase';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {Teractor} from '../../src/server/cards/corporation/Teractor';
import {EcoLine} from '../../src/server/cards/corporation/EcoLine';

/** Records every call that would persist a game, while still making it. */
function watchPersistence(): Array<string> {
  const calls: Array<string> = [];
  const loader = GameLoader.getInstance();
  setTestGameLoader(new Proxy(loader, {
    get(target, property: keyof IGameLoader) {
      const value = target[property];
      if (typeof value !== 'function') {
        return value;
      }
      return (...args: Array<unknown>) => {
        if (property === 'saveGame' || property === 'completeGame' || property === 'mark' || property === 'add') {
          calls.push(`loader.${property}`);
        }
        return (value as (...a: Array<unknown>) => unknown).apply(target, args);
      };
    },
  }));
  const database = Database.getInstance();
  setTestDatabase(new Proxy(database, {
    get(target, property: keyof IDatabase) {
      const value = target[property];
      if (typeof value !== 'function') {
        return value;
      }
      return (...args: Array<unknown>) => {
        if (property === 'saveGame' || property === 'saveGameResults' || property === 'markFinished') {
          calls.push(`database.${property}`);
        }
        return (value as (...a: Array<unknown>) => unknown).apply(target, args);
      };
    },
  }));
  return calls;
}

/** A two-bot game with the first bot at the top of its turn. */
function atActionMenu(): [IGame, TestPlayer, TestPlayer] {
  const [game, player, opponent] = testGame(2, {}, '-clone');
  player.bot = 'insane';
  opponent.bot = 'insane';
  player.playCorporationCard(new Teractor());
  opponent.playCorporationCard(new EcoLine());
  player.megaCredits = 40;
  runAllActions(game);
  player.takeAction();
  return [game, player, opponent];
}

/** The game's saved form, without the wall-clock timers a copy restarts. */
function position(game: IGame): string {
  const serialized = {...game.serialize(), gameLog: []};
  return JSON.stringify({...serialized, players: serialized.players.map((player) => ({...player, timer: undefined}))});
}

describe('GameClone', () => {
  afterEach(() => {
    restoreTestGameLoader();
    restoreTestDatabase();
  });

  it('clones at the top of a turn', () => {
    const [game, player] = atActionMenu();

    expect(canCloneSafely(game, player)).is.true;
  });

  it('refuses while a deferred action is queued', () => {
    const [game, player] = atActionMenu();
    game.defer(new SimpleDeferredAction(player, () => undefined));

    expect(canCloneSafely(game, player)).is.false;
  });

  it('refuses away from the action menu', () => {
    const [game, player] = atActionMenu();
    player.setWaitingFor(new SelectOption('Something else'));

    expect(canCloneSafely(game, player)).is.false;
  });

  it('refuses before every player has a corporation', () => {
    const [game, player] = testGame(2, {}, '-clone');
    player.bot = 'insane';
    player.takeAction();

    expect(canCloneSafely(game, player)).is.false;
  });

  it('refuses for a player who is not up', () => {
    const [game, /* player */, opponent] = atActionMenu();

    expect(canCloneSafely(game, opponent)).is.false;
  });

  it('refuses inside a simulation', () => {
    const [game, player] = atActionMenu();
    const clone = cloneForLookahead(game);

    expect(clone.simulation).is.true;
    expect(canCloneSafely(clone, clone.getPlayerById(player.id))).is.false;
  });

  it('copies the position exactly', () => {
    const [game, player] = atActionMenu();
    const clone = cloneForLookahead(game);

    expect(position(clone)).to.eq(position(game));
    expect(clone.getPlayerById(player.id).isAtActionMenu()).is.true;
  });

  it('leaves the real game untouched while a move is played on the copy', () => {
    const [game, player] = atActionMenu();
    const before = position(game);
    const timers = JSON.stringify(game.players.map((each) => ({...each.timer.serialize(), lastStoppedAt: 0})));
    const logLength = game.gameLog.length;
    const waitingFor = player.getWaitingFor();
    const calls = watchPersistence();

    const clone = cloneForLookahead(game);
    const bot = clone.getPlayerById(player.id);
    const brain = new BotBrain(bot, 'insane', new BotRandom(1));
    for (let step = 0; step < 40 && bot.getWaitingFor() !== undefined; step++) {
      bot.process(brain.respond(bot.getWaitingFor()!));
      if (bot.isAtActionMenu()) {
        break;
      }
    }

    expect(position(clone), 'the move changed the copy').to.not.eq(before);
    expect(position(game)).to.eq(before);
    // `Timer.lastStoppedAt` is one clock shared by every game on the server, so
    // only each timer's own fields belong to this game.
    expect(JSON.stringify(game.players.map((each) => ({...each.timer.serialize(), lastStoppedAt: 0})))).to.eq(timers);
    expect(game.gameLog.length).to.eq(logLength);
    expect(player.getWaitingFor()).to.eq(waitingFor);
    expect(calls).to.deep.eq([]);
  });

  it('never saves or records a simulated game, even played to the end', () => {
    const [game] = atActionMenu();
    const calls = watchPersistence();

    const clone = cloneForLookahead(game);
    clone.save();
    BotRunner.run(clone, {random: new BotRandom(1)});

    expect(clone.phase).to.eq(Phase.END);
    expect(calls).to.deep.eq([]);
    expect(game.phase).to.eq(Phase.ACTION);
  }).timeout(60000);
});
