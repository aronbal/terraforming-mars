import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  actionTextOf,
  entryFor,
  groupActions,
  isActionMenu,
  otherEntries,
  pickedEntryIn,
  readyCards,
  standardProjects,
} from '@/client/components/mobile/MobileActionMenu';
import {cardList, menu, namedChoices, option, projectCard, standardProjects as standardProjectEntry} from './menuFixtures';

describe('MobileActionMenu', () => {
  describe('isActionMenu', () => {
    it('recognises the turn menu by its entries carrying annotations', () => {
      expect(isActionMenu(menu(option('Pass for this generation', 'pass')))).is.true;
    });

    it('is not fooled by an ordinary question that happens to be a choice', () => {
      expect(isActionMenu(menu(option('Steel'), option('Titanium')))).is.false;
    });

    it('is not fooled by annotations that are not the menu\'s own', () => {
      // World Government Terraforming marks its options for the computer opponent.
      expect(isActionMenu(menu(option('Increase temperature', 'temperature'), option('Increase oxygen', 'oxygen')))).is.false;
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

    it('counts what an entry has to choose between', () => {
      const groups = groupActions(menu(projectCard(CardName.ANTS, CardName.BIRDS)));
      expect(groups[0].entries[0].count).eq(2);
    });
  });

  describe('readyCards', () => {
    it('lists the playable hand cards, then the actions, then the CEO', () => {
      const ready = readyCards(menu(
        cardList('ceoAction', [CardName.KAREN], {action: true}),
        cardList('actionCard', [CardName.SPACE_ELEVATOR], {action: true}),
        projectCard(CardName.ANTS, CardName.BIRDS)));

      expect(ready.map((item) => [item.card.name, item.offer])).deep.eq([
        [CardName.ANTS, 'play'],
        [CardName.BIRDS, 'play'],
        [CardName.SPACE_ELEVATOR, 'action'],
        [CardName.KAREN, 'action'],
      ]);
    });

    // Pharmacy Union and the like send cards the player may not choose.
    it('leaves out a card the server sent disabled', () => {
      const ready = readyCards(menu(
        cardList('actionCard', [CardName.SPACE_ELEVATOR, CardName.AI_CENTRAL], {action: true, disabled: [CardName.AI_CENTRAL]})));
      expect(ready.map((item) => item.card.name)).deep.eq([CardName.SPACE_ELEVATOR]);
    });

    it('is empty when nothing is offered', () => {
      expect(readyCards(menu(option('Pass for this generation', 'pass')))).is.empty;
      expect(readyCards(undefined)).is.empty;
    });
  });

  describe('entries', () => {
    it('finds an entry by what it is', () => {
      const turn = menu(option('Pass for this generation', 'pass'), option('Convert heat', 'convertHeat'));
      expect(entryFor(turn, 'convertHeat')?.index).eq(1);
      expect(entryFor(turn, 'convertPlants')).is.undefined;
      expect(entryFor(undefined, 'pass')).is.undefined;
    });

    it('lists only the entries the turn page draws nothing for', () => {
      const turn = menu(
        option('Pass for this generation', 'pass'),
        option('Summon the worm', 'rideTheSandworm'),
        option('Unannotated'));
      expect(otherEntries(turn).map((entry) => entry.index)).deep.eq([1, 2]);
    });

    it('answers a pick by card, by board tile, or by position', () => {
      const turn = menu(
        option('Pass for this generation', 'pass'),
        projectCard(CardName.ANTS),
        namedChoices('award', 'Fund an award (8 M€)', 'Landlord'));

      expect(pickedEntryIn(turn, {card: CardName.ANTS})?.index).eq(1);
      expect(pickedEntryIn(turn, {board: {kind: 'award', name: 'Landlord'}})?.index).eq(2);
      expect(pickedEntryIn(turn, {entry: 0})?.index).eq(0);
      expect(pickedEntryIn(turn, {card: CardName.BIRDS})).is.undefined;
    });

    /* Milestone and award entries are both a list of names, so only the annotation
       keeps a milestone tap from opening the awards. */
    it('does not answer a milestone pick with the awards', () => {
      const turn = menu(namedChoices('award', 'Fund an award (8 M€)', 'Landlord'));
      expect(pickedEntryIn(turn, {board: {kind: 'milestone', name: 'Landlord'}})).is.undefined;
    });
  });

  describe('actionTextOf', () => {
    it('reads a card action as the card prints it', () => {
      expect(actionTextOf(CardName.SPACE_ELEVATOR)).eq('Spend 1 steel to gain 5 M€.');
    });

    it('is undefined for a card without an action', () => {
      expect(actionTextOf(CardName.COMET)).is.undefined;
    });
  });

  describe('standardProjects', () => {
    it('lists the standard projects the turn can pay for, in order', () => {
      const projects = standardProjectEntry(CardName.POWER_PLANT_STANDARD_PROJECT, CardName.CITY_STANDARD_PROJECT, CardName.ASTEROID_STANDARD_PROJECT);
      (projects as unknown as {cards: Array<{isDisabled?: boolean}>}).cards[1].isDisabled = true;
      const names = standardProjects(menu(projectCard(CardName.ANTS), projects)).map((item) => item.card.name);
      expect(names).deep.eq([CardName.POWER_PLANT_STANDARD_PROJECT, CardName.ASTEROID_STANDARD_PROJECT]);
    });

    it('is empty without the menu', () => {
      expect(standardProjects(undefined)).is.empty;
    });
  });
});
