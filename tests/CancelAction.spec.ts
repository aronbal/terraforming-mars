import {expect} from 'chai';
import {testGame} from './TestGame';
import {cast} from '../src/common/utils/utils';
import {OrOptions} from '../src/server/inputs/OrOptions';
import {Vitor} from '../src/server/cards/prelude/Vitor';
import {IGame} from '../src/server/IGame';
import {Phase} from '../src/common/Phase';
import {TestPlayer} from './TestPlayer';

/*
 * An action chosen from the turn's menu that still asks something -- here Vitor's
 * first action, which asks which award to fund -- can be taken back to the menu,
 * where Undo is allowed.
 */
describe('Cancel action', () => {
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;

  beforeEach(() => {
    [game, player, opponent] = testGame(2, {undoOption: true});
    player.pendingInitialActions = [new Vitor()];
  });

  /** Takes Vitor's first action, the menu's first option; it then asks for an award. */
  function takeFirstAction(): void {
    player.process({type: 'or', index: 0, response: {type: 'option'}});
    expect(cast(player.getWaitingFor(), OrOptions).title).eq('Select award to fund');
  }

  it('is not offered at the menu', () => {
    player.takeAction();
    expect(player.canCancelAction()).is.false;
    expect(player.cancelActionSaveId()).is.undefined;
  });

  it('goes back to the save made before the menu', () => {
    const before = game.lastSaveId;
    player.takeAction();
    takeFirstAction();
    expect(player.canCancelAction()).is.true;
    expect(player.cancelActionSaveId()).eq(before);
  });

  it('needs undo on', () => {
    game.setUndoOption(false);
    player.takeAction();
    takeFirstAction();
    expect(player.canCancelAction()).is.false;
    game.setUndoOption(true);
    expect(player.canCancelAction()).is.true;
  });

  it('is not offered once the action is done', () => {
    player.takeAction();
    takeFirstAction();
    player.process({type: 'or', index: 0, response: {type: 'option'}});
    expect(game.fundedAwards).has.length(1);
    expect(player.canCancelAction()).is.false;
  });

  it('is not offered outside the action phase or on another player\'s turn', () => {
    player.takeAction();
    takeFirstAction();
    game.phase = Phase.PRODUCTION;
    expect(player.canCancelAction()).is.false;
    game.phase = Phase.ACTION;
    expect(player.canCancelAction()).is.true;
    expect(opponent.canCancelAction()).is.false;
  });

  it('is not offered to a computer opponent', () => {
    player.bot = 'easy';
    player.takeAction();
    takeFirstAction();
    expect(player.canCancelAction()).is.false;
  });
});
