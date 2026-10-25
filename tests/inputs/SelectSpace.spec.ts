import {expect} from 'chai';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {Space} from '../../src/server/boards/Space';
import {IGame} from '../../src/server/IGame';
import {testGame} from '../TestGame';
import {TileType} from '../../src/common/TileType';
import {PlaceCityTile} from '../../src/server/deferredActions/PlaceCityTile';
import {PlaceGreeneryTile} from '../../src/server/deferredActions/PlaceGreeneryTile';
import {PlaceOceanTile} from '../../src/server/deferredActions/PlaceOceanTile';
import {TestPlayer} from '../TestPlayer';

describe('SelectSpace', () => {
  let game: IGame;
  let player: TestPlayer;
  let selected: Space | undefined;

  const cb = (cards: Space) => {
    selected = cards;
    return undefined;
  };

  beforeEach(() => {
    [game, player] = testGame(1);
    selected = undefined;
  });

  it('Simple', () => {
    const selectSpace = new SelectSpace('', game.board.spaces).andThen(cb);
    selectSpace.process({type: 'space', spaceId: '05'});
    expect(selected!.id).eq('05');
  });

  it('Cannot select space not part of the set', () => {
    const selectSpace = new SelectSpace('', game.board.spaces).andThen(cb);
    expect(() => selectSpace.process({type: 'space', spaceId: '00'}))
      .to.throw(Error, /Space not available/);
  });

  it('says which tile the space will get, only when told', () => {
    expect(new SelectSpace('', game.board.spaces).toModel()).not.to.have.property('tileType');
    expect(new SelectSpace('', game.board.spaces).placing(TileType.CITY).toModel().tileType).eq(TileType.CITY);
  });

  it('is told the tile by the placement actions', () => {
    expect(new PlaceCityTile(player).execute()?.toModel()).deep.include({tileType: TileType.CITY});
    expect(new PlaceGreeneryTile(player).execute()?.toModel()).deep.include({tileType: TileType.GREENERY});
    expect(new PlaceOceanTile(player).execute()?.toModel()).deep.include({tileType: TileType.OCEAN});
  });
});
