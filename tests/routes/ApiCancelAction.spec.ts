import {expect} from 'chai';
import {ApiCancelAction} from '../../src/server/routes/ApiCancelAction';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '../../src/common/http/statusCode';
import {Vitor} from '../../src/server/cards/prelude/Vitor';

describe('ApiCancelAction', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  /* A game whose first player is asked which award Vitor funds. */
  async function midAction() {
    const player = TestPlayer.BLUE.newPlayer();
    const other = TestPlayer.RED.newPlayer();
    const game = Game.newInstance('game-cancel', [player, other], player, 'spectatorid', {undoOption: true});
    await scaffolding.ctx.gameLoader.add(game);
    player.pendingInitialActions = [new Vitor()];
    player.takeAction();
    player.process({type: 'or', index: 0, response: {type: 'option'}});
    return {game, player};
  }

  async function post(id: string) {
    scaffolding.url = '/api/cancelaction?id=' + id;
    await scaffolding.post(ApiCancelAction.INSTANCE, res);
  }

  it('fails without a valid id', async () => {
    scaffolding.url = '/api/cancelaction';
    await scaffolding.post(ApiCancelAction.INSTANCE, res);
    expect(res.content).eq('Bad request: missing id parameter');
  });

  it('fails when the game is not found', async () => {
    await post('p-some-player-id');
    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('refuses when there is no action to take back', async () => {
    const {player} = await midAction();
    player.process({type: 'or', index: 0, response: {type: 'option'}});
    await post(player.id);
    expect(res.content).eq('Bad request: there is no action to take back');
  });

  it('goes back to the save made before the menu', async () => {
    const {game, player} = await midAction();
    const restored = Game.newInstance('game-cancel', [TestPlayer.BLUE.newPlayer(), TestPlayer.RED.newPlayer()], player, 'spectatorid');
    const asked: Array<number> = [];
    scaffolding.ctx.gameLoader.restoreGameAt = (_gameId: string, saveId: number) => {
      asked.push(saveId);
      return Promise.resolve(restored);
    };
    const saveId = player.cancelActionSaveId();
    await post(player.id);
    expect(res.statusCode).eq(statusCode.ok);
    expect(asked).deep.eq([saveId]);
    // The save gone back to keeps undo as it is now.
    expect(restored.gameOptions.undoOption).is.true;
    expect(JSON.parse(res.content).game.gameAge).eq(restored.gameAge);
    expect(game.gameAge).not.eq(restored.gameAge);
  });
});
