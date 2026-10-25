import {expect} from 'chai';
import {testGame} from './TestGame';
import {cast} from '../src/common/utils/utils';
import {OrOptions} from '../src/server/inputs/OrOptions';
import {UndoActionOption} from '../src/server/inputs/UndoActionOption';
import {IGame} from '../src/server/IGame';
import {TestPlayer} from './TestPlayer';

/*
 * Undo against computer opponents reaches back past their moves to before your last
 * action, because their moves are replayed; against people it stays within your turn.
 */
describe('Undo across turns', () => {
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;

  beforeEach(() => {
    [game, player, opponent] = testGame(2, {undoOption: true});
  });

  function offersUndo(): boolean {
    return cast(player.getWaitingFor(), OrOptions).options.some((option) => option instanceof UndoActionOption);
  }

  /* Two decisions at the start of a turn: the last action, the computers' moves, then this. */
  function decideTwice(): void {
    player.actionsTakenThisRound = 0;
    player.takeAction();
    game.lastSaveId++;
    player.actionsTakenThisRound = 0;
    player.takeAction();
  }

  it('goes back past computer opponents to before the last action', () => {
    opponent.bot = 'easy';
    const before = game.lastSaveId;
    decideTwice();
    expect(offersUndo()).is.true;
    expect(player.undoSaveId()).eq(before);
  });

  it('stays within the turn against people', () => {
    decideTwice();
    expect(offersUndo()).is.false;
  });

  it('stays within the generation', () => {
    opponent.bot = 'easy';
    player.actionsTakenThisRound = 0;
    player.takeAction();
    game.generation++;
    player.actionsTakenThisRound = 0;
    player.takeAction();
    expect(offersUndo()).is.false;
  });

  it('needs undo on', () => {
    opponent.bot = 'easy';
    game.setUndoOption(false);
    decideTwice();
    expect(offersUndo()).is.false;
    expect(player.undoSaveId()).is.undefined;
  });

  it('records nothing for a computer opponent', () => {
    opponent.bot = 'easy';
    opponent.actionsTakenThisRound = 0;
    opponent.takeAction();
    opponent.takeAction();
    expect(opponent.undoSaveId()).is.undefined;
  });
});
