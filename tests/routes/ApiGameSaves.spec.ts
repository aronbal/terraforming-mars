import {expect} from 'chai';
import {ApiGameSaves} from '../../src/server/routes/ApiGameSaves';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {FakeGameLoader} from './FakeGameLoader';
import {SaveModel} from '../../src/common/models/SaveModel';
import {LogMessage} from '../../src/common/logs/LogMessage';
import {LogMessageType} from '../../src/common/logs/LogMessageType';
import {PlayerId} from '../../src/common/Types';

describe('ApiGameSaves', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  function newGame() {
    const player = TestPlayer.BLUE.newPlayer();
    const other = TestPlayer.RED.newPlayer();
    const game = Game.newInstance('game-saves', [player, other], player, 'spectatorid');
    return {game, player, other};
  }

  function line(message: string, playerId?: PlayerId) {
    return new LogMessage(LogMessageType.DEFAULT, message, [], playerId);
  }

  async function get(id: string) {
    scaffolding.url = '/api/game/saves?id=' + id;
    await scaffolding.get(ApiGameSaves.INSTANCE, res);
  }

  it('is refused to anyone but the game master', async () => {
    const {game, other} = newGame();
    await scaffolding.ctx.gameLoader.add(game);
    await get(other.id);
    expect(res.content).eq('Bad request: only the game master, who set the game up, can go back a save');
  });

  it('lists the earlier saves newest first, each with what was done just before it', async () => {
    const {game, player, other} = newGame();
    await scaffolding.ctx.gameLoader.add(game);
    const saved = (generation: number, lines: Array<LogMessage>) => {
      const serialized = game.serialize();
      serialized.generation = generation;
      serialized.activePlayer = other.id;
      serialized.gameLog = lines;
      return serialized;
    };
    const first = [line('a'), line('b')];
    const second = [...first, line('c'), line('secret', other.id), line('mine', player.id)];
    const latest = [...second, line('d')];
    (scaffolding.ctx.gameLoader as FakeGameLoader).recentSaves = [
      {saveId: 3, game: saved(1, first)},
      {saveId: 4, game: saved(2, second)},
      {saveId: 5, game: saved(2, latest)},
    ];

    await get(player.id);
    const saves: Array<SaveModel> = JSON.parse(res.content);
    expect(saves.map((save) => [save.saveId, save.generation, save.activePlayer])).deep.eq([[4, 2, other.color], [3, 1, other.color]]);
    expect(saves.map((save) => save.log.map((message) => message.message))).deep.eq([['c', 'mine'], ['a', 'b']]);
  });
});
