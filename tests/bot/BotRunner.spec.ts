import {expect} from 'chai';
import {testGame} from '../TestGame';
import {BotRunner} from '../../src/server/bot/BotRunner';
import {Phase} from '../../src/common/Phase';
import {SelectInitialCards} from '../../src/server/inputs/SelectInitialCards';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {TestPlayer} from '../TestPlayer';

describe('BotRunner', () => {
  it('reports whether a game has computer opponents', () => {
    const [game, , second] = testGame(2, {skipInitialCardSelection: false});

    expect(BotRunner.hasBots(game)).is.false;
    second.bot = 'medium';
    expect(BotRunner.hasBots(game)).is.true;
  });

  it('leaves human players waiting for their own input', () => {
    const [game, human, computer] = testGame(2, {skipInitialCardSelection: false});
    computer.bot = 'medium';

    BotRunner.run(game);

    expect(human.getWaitingFor(), 'the human should still be asked to choose').is.not.undefined;
    expect(computer.getWaitingFor(), 'the computer should have chosen already').is.undefined;
    expect(game.phase).to.not.eq(Phase.END);
  });

  it('does nothing to a game with no computer opponents', () => {
    const [game, first, second] = testGame(2, {skipInitialCardSelection: false});

    BotRunner.run(game);

    expect(first.getWaitingFor()).is.not.undefined;
    expect(second.getWaitingFor()).is.not.undefined;
  });

  it('carries a game to the end once every seat is a computer', () => {
    const [game, ...players] = testGame(2, {skipInitialCardSelection: false}, '-runner');
    players.forEach((player) => player.bot = 'medium');

    BotRunner.run(game);

    expect(game.phase).to.eq(Phase.END);
  });

  it('picks a reloaded game back up mid-turn', () => {
    const [game, human, computer] = testGame(2, {skipInitialCardSelection: false}, '-reload');
    computer.bot = 'medium';
    BotRunner.run(game);
    human.process({type: 'initialCards', responses: initialCardResponses(human)});

    // Simulate a restart: the computer's pending decision survives, but nothing
    // is driving it until someone asks the game for its state again.
    expect(BotRunner.hasBots(game)).is.true;
    BotRunner.run(game);

    expect(computer.getWaitingFor(), 'the computer should not be left holding a decision').is.undefined;
  });
});

/** Answers an initial-card prompt by taking the first corporation and no projects. */
function initialCardResponses(player: TestPlayer): Array<InputResponse> {
  const input = player.getWaitingFor() as SelectInitialCards;
  return input.options.map((option) => {
    if (option === input.inputs.corp) {
      return {type: 'card', cards: [player.dealtCorporationCards[0].name]};
    }
    return {type: 'card', cards: []};
  });
}
