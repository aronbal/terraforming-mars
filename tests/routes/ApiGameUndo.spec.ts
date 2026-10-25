import {expect} from 'chai';
import {ApiGameUndo} from '../../src/server/routes/ApiGameUndo';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '../../src/common/http/statusCode';

describe('ApiGameUndo', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  async function newGame() {
    const player = TestPlayer.BLUE.newPlayer();
    const other = TestPlayer.RED.newPlayer();
    const game = Game.newInstance('game-undo', [player, other], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);
    return {game, player};
  }

  it('fails without a valid id or value', async () => {
    scaffolding.url = '/api/game/undo?undo=true';
    await scaffolding.post(ApiGameUndo.INSTANCE, res);
    expect(res.content).eq('Bad request: missing id parameter');

    const {player} = await newGame();
    res = new MockResponse();
    scaffolding.url = '/api/game/undo?id=' + player.id + '&undo=maybe';
    await scaffolding.post(ApiGameUndo.INSTANCE, res);
    expect(res.content).eq('Bad request: undo must be true or false');
  });

  it('fails when the game is not found', async () => {
    scaffolding.url = '/api/game/undo?id=p-some-player-id&undo=true';
    await scaffolding.post(ApiGameUndo.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('turns undo on and off in a game under way, and says so in the log', async () => {
    const {game, player} = await newGame();
    expect(game.gameOptions.undoOption).is.false;

    scaffolding.url = '/api/game/undo?id=' + player.id + '&undo=true';
    await scaffolding.post(ApiGameUndo.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    expect(game.gameOptions.undoOption).is.true;
    expect(JSON.parse(res.content).game.gameOptions.undoOption).is.true;
    expect(game.gameLog[game.gameLog.length - 1].message).eq('${0} turned undo on');

    res = new MockResponse();
    scaffolding.url = '/api/game/undo?id=' + player.id + '&undo=false';
    await scaffolding.post(ApiGameUndo.INSTANCE, res);
    expect(game.gameOptions.undoOption).is.false;
    expect(game.gameLog[game.gameLog.length - 1].message).eq('${0} turned undo off');
  });

  it('logs nothing when the setting does not change', async () => {
    const {game, player} = await newGame();
    const before = game.gameLog.length;
    scaffolding.url = '/api/game/undo?id=' + player.id + '&undo=false';
    await scaffolding.post(ApiGameUndo.INSTANCE, res);
    expect(game.gameLog.length).eq(before);
  });

  it('is saved with the game', async () => {
    const {game} = await newGame();
    game.setUndoOption(true);
    expect(game.serialize().gameOptions.undoOption).is.true;
  });
});
