import {expect} from 'chai';
import {testGame} from '@tests/TestGame';
import {TestPlayer} from '@tests/TestPlayer';
import {runAllActions} from '@tests/TestingUtils';
import {IGame} from '@/server/IGame';
import {Game} from '@/server/Game';
import {CardName} from '@/common/cards/CardName';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {GlobalParameter} from '@/common/GlobalParameter';
import {summarizeLogEffects} from '@/common/logs/logEffects';
import {cast} from '@/common/utils/utils';
import {Payment} from '@/common/inputs/Payment';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {SelectCard} from '@/server/inputs/SelectCard';
import {Comet} from '@/server/cards/base/Comet';
import {CaretakerContract} from '@/server/cards/base/CaretakerContract';
import {GreeneryStandardProject} from '@/server/cards/base/standardProjects/GreeneryStandardProject';
import {AquiferStandardProject} from '@/server/cards/base/standardProjects/AquiferStandardProject';
import {ConvertHeat} from '@/server/cards/base/standardActions/ConvertHeat';
import {GameLogs} from '@/server/routes/GameLogs';

/** Returns the latest log message whose template is `template` and that mentions `cardName`. */
function findMessage(game: IGame, template: string, cardName: CardName): LogMessage {
  const message = game.gameLog.findLast((m) => m.message === template && m.data.some((d) => d.type === LogMessageDataType.CARD && d.value === cardName));
  if (message === undefined) {
    throw new Error(`No message ${template} for ${cardName}`);
  }
  return message;
}

function placeOnFirstSpace(player: TestPlayer) {
  const selectSpace = cast(player.popWaitingFor(), SelectSpace);
  selectSpace.cb(selectSpace.spaces[0]);
  runAllActions(player.game);
}

describe('LogEffects', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  beforeEach(() => {
    [game, player, player2] = testGame(2);
  });

  it('attaches the effects of an event, including its follow-up ocean, to the played message', () => {
    player.playCard(new Comet());
    runAllActions(game);
    placeOnFirstSpace(player);

    const message = findMessage(game, '${0} played ${1}', CardName.COMET);
    expect(message.effects).to.have.deep.members([
      {type: 'global', parameter: GlobalParameter.TEMPERATURE, steps: 1},
      {type: 'tile', tile: 'ocean', count: 1},
      {type: 'tr', steps: 2},
    ]);
    expect(summarizeLogEffects(message.effects)).eq('+1 temp · ocean');
  });

  it('greenery standard project', () => {
    const card = new GreeneryStandardProject();
    player.megaCredits = card.cost;
    card.payAndExecute(player, Payment.of({megacredits: card.cost}));
    runAllActions(game);
    placeOnFirstSpace(player);

    const message = findMessage(game, '${0} used ${1} standard project', CardName.GREENERY_STANDARD_PROJECT);
    expect(summarizeLogEffects(message.effects)).eq('+1 oxygen · greenery');
    expect(message.effects).to.deep.include({type: 'tr', steps: 1});
  });

  it('aquifer standard project', () => {
    const card = new AquiferStandardProject();
    player.megaCredits = card.cost;
    card.payAndExecute(player, Payment.of({megacredits: card.cost}));
    runAllActions(game);
    placeOnFirstSpace(player);

    const message = findMessage(game, '${0} used ${1} standard project', CardName.AQUIFER_STANDARD_PROJECT);
    expect(message.effects).to.have.deep.members([
      {type: 'tile', tile: 'ocean', count: 1},
      {type: 'tr', steps: 1},
    ]);
    expect(summarizeLogEffects(message.effects)).eq('ocean');
  });

  it('convert heat', () => {
    player.heat = 8;
    new ConvertHeat().action(player);
    runAllActions(game);

    const message = findMessage(game, '${0} used ${1} standard action', CardName.CONVERT_HEAT);
    expect(summarizeLogEffects(message.effects)).eq('+1 temp');
  });

  it('card action', () => {
    const card = new CaretakerContract();
    player.playedCards.push(card);
    player.heat = 8;
    const selectCard = cast(player.playActionCard(), SelectCard);
    selectCard.cb([card]);
    runAllActions(game);

    const message = findMessage(game, '${0} used ${1} action', CardName.CARETAKER_CONTRACT);
    expect(message.effects).deep.eq([{type: 'tr', steps: 1}]);
    expect(summarizeLogEffects(message.effects)).eq('+1 TR');
  });

  it('ignores TR changes of other players', () => {
    player.playCard(new Comet());
    player2.increaseTerraformRating(3);
    runAllActions(game);
    placeOnFirstSpace(player);

    const message = findMessage(game, '${0} played ${1}', CardName.COMET);
    expect(message.effects).to.deep.include({type: 'tr', steps: 2});
  });

  it('drops effects outside an action', () => {
    game.increaseTemperature(player, 1);
    player.increaseTerraformRating();

    expect(game.gameLog.filter((m) => m.effects !== undefined)).is.empty;
  });

  it('starting the next action ends the previous one', () => {
    player.heat = 8;
    new ConvertHeat().action(player);
    runAllActions(game);
    player.takeAction();

    game.increaseTemperature(player, 1);

    const message = findMessage(game, '${0} used ${1} standard action', CardName.CONVERT_HEAT);
    expect(summarizeLogEffects(message.effects)).eq('+1 temp');
  });

  it('only messages with effects carry the field', () => {
    player.heat = 8;
    new ConvertHeat().action(player);
    runAllActions(game);
    expect(game.gameLog.filter((m) => Object.hasOwn(m, 'effects'))).has.length(1);
  });

  it('loads a saved game whose log predates effects', () => {
    player.heat = 8;
    new ConvertHeat().action(player);
    runAllActions(game);
    const serialized = JSON.parse(JSON.stringify(game.serialize()));
    for (const message of serialized.gameLog) {
      delete message.effects;
    }

    const restored = Game.deserialize(serialized);
    const restoredPlayer = restored.getPlayerById(player.id);
    expect(restored.gameLog.filter((m) => m.effects !== undefined)).is.empty;
    expect(restored.loggedAction).is.undefined;
    const view = new GameLogs().getLogsForGameView(player.id, restored, null);
    expect(view.map((m) => summarizeLogEffects(m.effects)).filter((s) => s !== undefined)).is.empty;

    // New actions still record effects on the plain, deserialized messages.
    restoredPlayer.heat = 8;
    new ConvertHeat().action(restoredPlayer);
    runAllActions(restored);
    const message = findMessage(restored, '${0} used ${1} standard action', CardName.CONVERT_HEAT);
    expect(summarizeLogEffects(message.effects)).eq('+1 temp');
  });

  it('keeps effects through serialization', () => {
    player.heat = 8;
    new ConvertHeat().action(player);
    runAllActions(game);

    const restored = Game.deserialize(JSON.parse(JSON.stringify(game.serialize())));
    const message = findMessage(restored, '${0} used ${1} standard action', CardName.CONVERT_HEAT);
    expect(summarizeLogEffects(message.effects)).eq('+1 temp');
  });
});
