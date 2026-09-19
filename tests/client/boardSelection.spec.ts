import {expect} from 'chai';
import {ColonyName} from '@/common/colonies/ColonyName';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {simpleColonyModel} from '@/common/models/ColonyModel';
import {
  boardNamesIn,
  boardOfferFor,
  clearBoardPick,
  namesOffered,
  pickBoardThing,
  pickedBoardThing,
  resetBoardPickForTest,
} from '@/client/utils/boardSelection';

function option(title: string): PlayerInputModel {
  return {type: 'option', title, buttonLabel: 'Confirm'};
}

function named(annotation: string, ...titles: Array<string>): PlayerInputModel {
  return {type: 'or', title: 'Claim a milestone', buttonLabel: 'Claim', annotation, options: titles.map(option)};
}

function trade(...names: Array<ColonyName>): PlayerInputModel {
  return {
    type: 'and',
    title: 'Trade with a colony',
    buttonLabel: 'Trade',
    annotation: 'tradeWithColony',
    options: [
      {type: 'or', title: 'Pay trade fee', buttonLabel: 'Pay', options: [option('Pay 9 M€')]},
      {
        type: 'colony',
        title: 'Select colony tile for trade',
        buttonLabel: 'Trade',
        coloniesModel: names.map(simpleColonyModel),
      },
    ],
  };
}

function menu(...options: Array<PlayerInputModel>): PlayerInputModel {
  return {type: 'or', title: 'Take your first action', buttonLabel: 'Take action', options};
}

describe('boardSelection', () => {
  beforeEach(() => resetBoardPickForTest());
  afterEach(() => clearBoardPick());

  it('remembers a pick until it is cleared', () => {
    expect(pickedBoardThing.value).is.undefined;

    pickBoardThing('milestone', 'Builder');
    expect(pickedBoardThing.value).deep.eq({kind: 'milestone', name: 'Builder'});

    clearBoardPick();
    expect(pickedBoardThing.value).is.undefined;
  });

  describe('namesOffered', () => {
    it('reads a milestone entry as the list of names it is', () => {
      expect(namesOffered(named('milestone', 'Builder', 'Gardener'), 'milestone'))
        .deep.eq(['Builder', 'Gardener']);
    });

    /* Milestone and award entries look alike, so only the annotation keeps a claim
       from being read as a funding. */
    it('does not read one kind of entry as another', () => {
      expect(namesOffered(named('award', 'Landlord'), 'milestone')).is.empty;
      expect(namesOffered(named('award', 'Landlord'), 'award')).deep.eq(['Landlord']);
    });

    it('finds the colonies through the payment they are bundled with', () => {
      expect(namesOffered(trade(ColonyName.EUROPA, ColonyName.TRITON), 'colony'))
        .deep.eq([ColonyName.EUROPA, ColonyName.TRITON]);
    });
  });

  describe('boardNamesIn', () => {
    it('looks one level into the turn menu', () => {
      const input = menu(option('Pass for this generation'), named('milestone', 'Builder'));
      expect(boardNamesIn(input, 'milestone')).deep.eq(['Builder']);
      expect(boardNamesIn(input, 'award')).is.empty;
    });

    it('offers nothing when the player is not being asked anything', () => {
      expect(boardNamesIn(undefined, 'milestone')).is.empty;
    });
  });

  describe('boardOfferFor', () => {
    it('matches the entry a pick would be answered by', () => {
      const entry = named('milestone', 'Builder', 'Gardener');
      expect(boardOfferFor(entry, {kind: 'milestone', name: 'Builder'})).is.true;
      expect(boardOfferFor(entry, {kind: 'milestone', name: 'Planner'})).is.false;
      expect(boardOfferFor(entry, {kind: 'award', name: 'Builder'})).is.false;
    });
  });
});
