import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {BotBrain} from '../../src/server/bot/BotBrain';
import {BotRandom} from '../../src/server/bot/BotRandom';
import {BotProfileOverride, NO_PLANNING} from '../../src/server/bot/BotProfile';
import {GameLoader} from '../../src/server/database/GameLoader';
import {IGameLoader} from '../../src/server/database/IGameLoader';
import {restoreTestGameLoader, setTestGameLoader} from '../testing/setup';
import {InvestmentLoan} from '../../src/server/cards/base/InvestmentLoan';
import {SpaceElevator} from '../../src/server/cards/base/SpaceElevator';
import {Mine} from '../../src/server/cards/base/Mine';
import {Teractor} from '../../src/server/cards/corporation/Teractor';
import {EcoLine} from '../../src/server/cards/corporation/EcoLine';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {cast} from '../../src/common/utils/utils';

const STATIC: BotProfileOverride = {planning: NO_PLANNING};
const LOOKAHEAD: BotProfileOverride = {planning: {...NO_PLANNING, lookahead: 4, lookaheadDiscount: 0.9, lookaheadBudgetMs: 1000}};

/**
 * A bot at the top of its turn, three megacredits short of Space Elevator,
 * holding a card that raises cash now and one that is simply good value.
 */
function shortOfSpaceElevator(): [IGame, TestPlayer] {
  const [game, player, opponent] = testGame(2, {}, '-plan');
  player.bot = 'insane';
  opponent.bot = 'insane';
  player.playCorporationCard(new Teractor());
  opponent.playCorporationCard(new EcoLine());
  runAllActions(game);
  player.megaCredits = 25;
  player.titanium = 0;
  player.steel = 0;
  player.cardsInHand.push(new InvestmentLoan(), new SpaceElevator(), new Mine());
  player.takeAction();
  return [game, player];
}

function chosenCard(player: TestPlayer, override: BotProfileOverride): string | undefined {
  const menu = cast(player.getWaitingFor(), OrOptions);
  const response = new BotBrain(player, 'insane', new BotRandom(1), override).respond(menu);
  if (response.type !== 'or' || response.response.type !== 'projectCard') {
    return undefined;
  }
  return response.response.card;
}

/** The game's saved form, without wall-clock timers or the bot's own memory. */
function position(game: IGame): string {
  const serialized = {...game.serialize(), gameLog: []};
  return JSON.stringify({
    ...serialized,
    players: serialized.players.map((player) => ({...player, timer: undefined, botMemory: undefined})),
  });
}

describe('TurnPlanner', () => {
  afterEach(() => {
    restoreTestGameLoader();
  });

  it('plays the card that makes an expensive one affordable first', () => {
    const [/* game */, player] = shortOfSpaceElevator();

    expect(chosenCard(player, STATIC), 'without looking ahead').to.eq(new Mine().name);
    expect(chosenCard(player, LOOKAHEAD), 'looking ahead').to.eq(new InvestmentLoan().name);
    expect(player.botMemory?.stats?.lookaheadChanged).to.eq(1);
  });

  it('does not look ahead with lookahead off or no time to do it', () => {
    const [/* game */, player] = shortOfSpaceElevator();

    expect(chosenCard(player, STATIC)).to.eq(new Mine().name);
    expect(chosenCard(player, {planning: {...LOOKAHEAD.planning, lookaheadBudgetMs: 0}})).to.eq(new Mine().name);
    expect(player.botMemory).is.undefined;
  });

  it('leaves the real game untouched', () => {
    const [game, player] = shortOfSpaceElevator();
    const before = position(game);
    const logLength = game.gameLog.length;
    const waitingFor = player.getWaitingFor();
    const saves: Array<string> = [];
    const loader = GameLoader.getInstance();
    setTestGameLoader(new Proxy(loader, {
      get(target, property: keyof IGameLoader) {
        const value = target[property];
        if (typeof value !== 'function') {
          return value;
        }
        return (...args: Array<unknown>) => {
          saves.push(property);
          return (value as (...a: Array<unknown>) => unknown).apply(target, args);
        };
      },
    }));

    chosenCard(player, LOOKAHEAD);

    expect(position(game)).to.eq(before);
    expect(game.gameLog.length).to.eq(logLength);
    expect(player.getWaitingFor()).to.eq(waitingFor);
    expect(saves).to.deep.eq([]);
  });
});
