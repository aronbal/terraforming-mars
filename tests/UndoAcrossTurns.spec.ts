import {expect} from 'chai';
import {testGame} from './TestGame';
import {cast} from '../src/common/utils/utils';
import {OrOptions} from '../src/server/inputs/OrOptions';
import {UndoActionOption} from '../src/server/inputs/UndoActionOption';
import {IGame} from '../src/server/IGame';
import {Game} from '../src/server/Game';
import {Phase} from '../src/common/Phase';
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
  });

  it('turning undo on mid-turn offers it at once', () => {
    opponent.bot = 'easy';
    game.setUndoOption(false);
    const before = game.lastSaveId;
    decideTwice();
    expect(offersUndo()).is.false;

    game.setUndoOption(true);
    expect(offersUndo()).is.true;
    expect(player.undoSaveId()).eq(before);

    game.setUndoOption(false);
    expect(offersUndo()).is.false;
  });

  it('turned on after an unsaved action, goes back to the start of the turn', () => {
    game.setUndoOption(false);
    player.actionsTakenThisRound = 0;
    player.takeAction();
    const turnStart = game.lastSaveId;
    game.lastSaveId++;
    player.actionsTakenThisRound = 1;
    player.takeAction();

    game.setUndoOption(true);
    expect(offersUndo()).is.true;
    expect(player.undoSaveId()).eq(turnStart);
  });

  it('keeps its undo points through a save and load', () => {
    opponent.bot = 'easy';
    // Past generation 1, where a load without corporations goes back to research.
    game.generation = 2;
    game.phase = Phase.ACTION;
    const before = game.lastSaveId;
    decideTwice();
    const loaded = Game.deserialize(game.serialize());
    const loadedPlayer = loaded.getPlayerById(player.id);
    expect(loadedPlayer.undoSaveId()).eq(before);
    expect(cast(loadedPlayer.getWaitingFor(), OrOptions).options.some((option) => option instanceof UndoActionOption)).is.true;
  });

  it('records nothing for a computer opponent', () => {
    opponent.bot = 'easy';
    opponent.actionsTakenThisRound = 0;
    opponent.takeAction();
    opponent.takeAction();
    expect(opponent.undoSaveId()).is.undefined;
  });
});
