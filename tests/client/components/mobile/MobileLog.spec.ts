import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {LogEvent, actorOf, cardsOf, formatAgo, iconFor, isEventLine, sinceLastTurn, subtitleOf, titleOf, toEvent} from '@/client/components/mobile/MobileLog';
import {Color} from '@/common/Color';

const players = [{color: 'red' as Color, name: 'Mette'}, {color: 'blue' as Color, name: 'You'}];
const identity = (text: string) => text;

function played(color: Color, card: CardName): LogMessage {
  return {
    message: '${0} played ${1}',
    data: [{type: LogMessageDataType.PLAYER, value: color}, {type: LogMessageDataType.CARD, value: card}],
    timestamp: 0,
  } as LogMessage;
}

function event(color: Color | undefined, key: string): LogEvent {
  return {key, generation: 1, title: key, color, icon: 'layers', timestamp: 0, private: false, effects: undefined, cards: []};
}

describe('MobileLog', () => {
  it('takes the acting player out of the sentence', () => {
    expect(titleOf(played('red', CardName.COMET), players, identity)).eq('Played Comet');
    expect(actorOf(played('red', CardName.COMET))).eq('red');
  });

  it('keeps a sentence whole when it does not start with a player', () => {
    const message = {
      message: 'Generation ${0}',
      data: [{type: LogMessageDataType.RAW_STRING, value: '5'}],
      timestamp: 0,
    } as LogMessage;
    expect(titleOf(message, players, identity)).eq('Generation 5');
    expect(actorOf(message)).is.undefined;
  });

  it('names other players inside the sentence', () => {
    const message = {
      message: '${0} removed 3 plants from ${1}',
      data: [{type: LogMessageDataType.PLAYER, value: 'red'}, {type: LogMessageDataType.PLAYER, value: 'blue'}],
      timestamp: 0,
    } as LogMessage;
    expect(titleOf(message, players, identity)).eq('Removed 3 plants from You');
  });

  it('picks a glyph from what the line says', () => {
    expect(iconFor('${0} played ${1}')).eq('layers');
    expect(iconFor('${0} used ${1} action')).eq('zap');
    expect(iconFor('${0} passed')).eq('skip-forward');
    expect(iconFor('${0} claimed ${1} milestone')).eq('trophy');
    expect(iconFor('${0} funded ${1} award')).eq('award');
    expect(iconFor('Something nobody planned for')).eq('ellipsis');
  });

  it('leaves the generation headings out of the rows', () => {
    expect(isEventLine(played('red', CardName.COMET))).is.true;
    expect(isEventLine({...played('red', CardName.COMET), type: LogMessageType.NEW_GENERATION} as LogMessage)).is.false;
  });

  it('sums up what the action changed on Mars, when the server recorded it', () => {
    const message = {
      ...played('red', CardName.COMET),
      effects: [{type: 'global', parameter: 'temperature', steps: 1}, {type: 'tile', tile: 'ocean', count: 1}],
    } as LogMessage;
    expect(toEvent(message, 3, 0, players, identity).effects).eq('+1 temp · ocean');
    expect(toEvent(played('red', CardName.COMET), 3, 0, players, identity).effects).is.undefined;
  });

  it('marks a line only this player can see', () => {
    const message = {...played('blue', CardName.COMET), playerId: 'p-blue'} as LogMessage;
    expect(toEvent(message, 3, 0, players, identity)).deep.include({key: '3:0', generation: 3, private: true});
  });

  it('carries the cards a line names, each once', () => {
    expect(toEvent(played('red', CardName.COMET), 3, 0, players, identity).cards).deep.eq([CardName.COMET]);
    const message = {
      message: '${0} drafted ${1} and ${2}',
      data: [
        {type: LogMessageDataType.PLAYER, value: 'red'},
        {type: LogMessageDataType.CARDS, value: [CardName.ANTS, CardName.COMET]},
        {type: LogMessageDataType.CARD, value: CardName.ANTS},
      ],
      timestamp: 0,
    } as LogMessage;
    expect(cardsOf(message)).deep.eq([CardName.ANTS, CardName.COMET]);
  });

  it('carries no cards for a line that names none', () => {
    const message = {
      message: '${0} passed',
      data: [{type: LogMessageDataType.PLAYER, value: 'red'}],
      timestamp: 0,
    } as LogMessage;
    expect(toEvent(message, 3, 0, players, identity).cards).deep.eq([]);
  });

  it('names who acted and when, under the line', () => {
    expect(subtitleOf(event('red', 'a'), players, 2 * 60_000)).eq('Mette · 2 min');
    expect(subtitleOf(event(undefined, 'a'), players, 0)).eq('now');
  });

  it('says how long ago, as short as a subtitle needs', () => {
    const minute = 60_000;
    expect(formatAgo(0, 30_000)).eq('now');
    expect(formatAgo(0, 4 * minute)).eq('4 min');
    expect(formatAgo(0, 125 * minute)).eq('2 h');
    expect(formatAgo(0, 50 * 60 * minute)).eq('2 d');
  });

  it('collects what others did after this player last acted, newest first', () => {
    const events = [event('red', 'a'), event('blue', 'mine'), event('red', 'b'), event(undefined, 'note'), event('red', 'c')];
    expect(sinceLastTurn(events, 'blue').map((each) => each.key)).deep.eq(['c', 'b']);
  });

  it('counts everything when this player has not acted yet', () => {
    const events = [event('red', 'a'), event('red', 'b')];
    expect(sinceLastTurn(events, 'blue').map((each) => each.key)).deep.eq(['b', 'a']);
  });
});
