import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {groupActions, isActionMenu} from '@/client/components/mobile/MobileActionMenu';
import {clearPickedCard, pickCard, resetPickedCardForTest} from '@/client/utils/cardSelection';

function option(title: string, annotation?: string): PlayerInputModel {
  return {type: 'option', title, buttonLabel: 'Confirm', annotation};
}

function projectCard(annotation: string, ...names: Array<CardName>): PlayerInputModel {
  return {
    type: 'projectCard',
    title: 'Play project card',
    buttonLabel: 'Play',
    annotation,
    cards: names.map((name) => ({name, calculatedCost: 1})),
    paymentOptions: {},
    microbes: 0,
    floaters: 0,
    lunaArchivesScience: 0,
    seeds: 0,
    graphene: 0,
    kuiperAsteroids: 0,
    auroraiData: 0,
    spireScience: 0,
  };
}

function menu(...options: Array<PlayerInputModel>): OrOptionsModel {
  return {type: 'or', title: 'Take your first action', buttonLabel: 'Take action', options};
}

describe('MobileActionMenu', () => {
  beforeEach(() => resetPickedCardForTest());
  afterEach(() => clearPickedCard());

  describe('isActionMenu', () => {
    it('recognises the turn menu by its entries carrying annotations', () => {
      expect(isActionMenu(menu(option('Pass for this generation', 'pass')))).is.true;
    });

    it('is not fooled by an ordinary question that happens to be a choice', () => {
      expect(isActionMenu(menu(option('Steel'), option('Titanium')))).is.false;
    });

    it('is not fooled by an input that is not a menu at all', () => {
      expect(isActionMenu(option('Confirm'))).is.false;
      expect(isActionMenu(undefined)).is.false;
    });
  });

  describe('groupActions', () => {
    it('puts each entry under its heading, in the order the headings are declared', () => {
      const groups = groupActions(menu(
        option('Pass for this generation', 'pass'),
        option('Standard projects', 'standardProject'),
        option('Convert 8 heat into temperature', 'convertHeat')));

      expect(groups.map((group) => group.title)).deep.eq([undefined, 'Build', 'Finish']);
      expect(groups[1].entries[0].annotation).eq('standardProject');
    });

    it('keeps each entry pointing at its own index in the server options', () => {
      const groups = groupActions(menu(
        option('Pass for this generation', 'pass'),
        option('Standard projects', 'standardProject')));

      expect(groups[0].entries[0].index).eq(1);
      expect(groups[1].entries[0].index).eq(0);
    });

    /* A new action added to the game must show up even though this file has never
       heard of it, rather than quietly going missing. */
    it('shows an entry it does not recognise rather than dropping it', () => {
      const groups = groupActions(menu(option('Summon the worm', 'rideTheSandworm')));
      expect(groups).has.length(1);
      expect(groups[0].title).eq('Other');
      expect(groups[0].entries[0].index).eq(0);
    });

    it('sends the card entries to the Cards tab instead of opening them', () => {
      const groups = groupActions(menu(projectCard('projectCard', CardName.ANTS)));
      expect(groups[0].entries[0].elsewhere).deep.eq({
        tab: 'cards',
        hint: 'Tap a card in your hand to play it',
      });
    });

    /* Once a card has been picked over there, this is where the choice is finished --
       so the entry has to open here, or the two tabs point at each other forever. */
    it('opens the card entry here once a card has been picked', () => {
      pickCard(CardName.ANTS);
      const groups = groupActions(menu(projectCard('projectCard', CardName.ANTS)), CardName.ANTS);
      expect(groups[0].entries[0].elsewhere).is.undefined;
    });

    it('still sends the player away for a card the entry does not offer', () => {
      const groups = groupActions(menu(projectCard('projectCard', CardName.ANTS)), CardName.BIRDS);
      expect(groups[0].entries[0].elsewhere?.tab).eq('cards');
    });

    it('counts what an entry has to choose between', () => {
      const groups = groupActions(menu(projectCard('projectCard', CardName.ANTS, CardName.BIRDS)));
      expect(groups[0].entries[0].count).eq(2);
    });
  });
});
