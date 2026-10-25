import {expect} from 'chai';
import {ApiGameRollback} from '../../src/server/routes/ApiGameRollback';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '../../src/common/http/statusCode';
import {FakeGameLoader} from './FakeGameLoader';
import {GameId} from '../../src/common/Types';

describe('ApiGameRollback', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  function newGame(id: GameId, opponentIsBot: boolean) {
    const player = TestPlayer.BLUE.newPlayer();
    const other = TestPlayer.RED.newPlayer();
    if (opponentIsBot) {
      other.bot = 'easy';
    }
    const game = Game.newInstance(id, [player, other], player, 'spectatorid');
    return {game, player};
  }

  async function post(id: string) {
    scaffolding.url = '/api/game/rollback?id=' + id;
    await scaffolding.post(ApiGameRollback.INSTANCE, res);
  }

  it('fails without a valid id', async () => {
    scaffolding.url = '/api/game/rollback';
    await scaffolding.post(ApiGameRollback.INSTANCE, res);
    expect(res.content).eq('Bad request: missing id parameter');
  });

  it('fails when the game is not found', async () => {
    await post('p-some-player-id');
    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('is refused to anyone but the game master', async () => {
    const {game} = newGame('game-rollback', false);
    await scaffolding.ctx.gameLoader.add(game);
    await post(game.players[1].id);
    expect(res.content).eq('Bad request: only the game master, who set the game up, can go back a save');
  });

  it('is the game master\'s also in a game against people', async () => {
    const {game, player} = newGame('game-rollback', false);
    await scaffolding.ctx.gameLoader.add(game);
    (scaffolding.ctx.gameLoader as FakeGameLoader).previousSaves.push(Game.deserialize(game.serialize()));
    await post(player.id);
    expect(res.statusCode).eq(statusCode.ok);
  });

  it('is refused without an earlier save', async () => {
    const {game, player} = newGame('game-rollback', true);
    await scaffolding.ctx.gameLoader.add(game);
    await post(player.id);
    expect(res.content).eq('Bad request: there is no earlier save to go back to');
  });

  it('answers with the game at the earlier save, keeping undo, and logs who went back', async () => {
    const {game, player} = newGame('game-rollback', true);
    game.setUndoOption(true);
    await scaffolding.ctx.gameLoader.add(game);
    const earlier = Game.deserialize(game.serialize());
    earlier.setUndoOption(false);
    earlier.generation = 3;
    (scaffolding.ctx.gameLoader as FakeGameLoader).previousSaves.push(earlier);

    await post(player.id);
    expect(res.statusCode).eq(statusCode.ok);
    const model = JSON.parse(res.content);
    expect(model.game.generation).eq(3);
    expect(model.game.gameOptions.undoOption).is.true;
    expect(earlier.gameLog[earlier.gameLog.length - 1].message).eq('${0} went back one save');
  });
});
