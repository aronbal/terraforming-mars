import {expect} from 'chai';
import {testGame} from '../TestGame';
import {BotMemory, parseBotMemory} from '../../src/server/bot/BotMemory';
import {CardName} from '../../src/common/cards/CardName';
import {Player} from '../../src/server/Player';
import {Game} from '../../src/server/Game';

const MEMORY: BotMemory = {
  version: 1,
  goal: {card: CardName.EARTH_CATAPULT, setGeneration: 3, eta: 1, net: 18},
  stats: {goalsSet: 2, goalsMet: 1, goalsAbandoned: 0, lookaheadChanged: 4},
};

describe('BotMemory', () => {
  it('reads back what it wrote', () => {
    expect(parseBotMemory(JSON.parse(JSON.stringify(MEMORY)))).to.deep.eq(MEMORY);
  });

  it('rejects an unknown version', () => {
    expect(parseBotMemory({...MEMORY, version: 2})).is.undefined;
    expect(parseBotMemory(undefined)).is.undefined;
    expect(parseBotMemory('memory')).is.undefined;
  });

  it('drops a goal on a card that does not exist', () => {
    const parsed = parseBotMemory({...MEMORY, goal: {...MEMORY.goal, card: 'No Such Card'}});

    expect(parsed?.goal).is.undefined;
    expect(parsed?.stats).to.deep.eq(MEMORY.stats);
  });

  it('survives a player round trip', () => {
    const [/* game */, player] = testGame(2);
    player.botMemory = MEMORY;

    const restored = Player.deserialize(JSON.parse(JSON.stringify(player.serialize())));
    expect(restored.botMemory).to.deep.eq(MEMORY);
  });

  it('survives a game round trip', () => {
    const [game, player] = testGame(2);
    player.botMemory = MEMORY;

    const restored = Game.deserialize(JSON.parse(JSON.stringify(game.serialize())));
    expect(restored.getPlayerById(player.id).botMemory).to.deep.eq(MEMORY);
  });

  it('is not saved for a human player', () => {
    const [/* game */, player] = testGame(2);

    expect(Object.keys(player.serialize())).does.not.include('botMemory');
  });
});
