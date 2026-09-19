import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerInputModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {
  clearPickedCard,
  offerIn,
  pickCard,
  pickedCard,
  resetPickedCardForTest,
} from '@/client/utils/cardSelection';

function projectCard(...names: Array<CardName>): PlayerInputModel {
  return {
    type: 'projectCard',
    title: 'Play project card',
    buttonLabel: 'Play',
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

function selectCard(selectBlueCardAction: boolean, ...names: Array<CardName>): PlayerInputModel {
  return {
    type: 'card',
    title: 'Perform an action from a played card',
    buttonLabel: 'Take action',
    cards: names.map((name) => ({name, calculatedCost: 1})),
    max: 1,
    min: 1,
    showOnlyInLearnerMode: false,
    selectBlueCardAction,
    showOwner: false,
    showSelectAll: false,
  };
}

function or(...options: Array<PlayerInputModel>): PlayerInputModel {
  return {type: 'or', title: 'Take your first action', buttonLabel: 'Save', options};
}

describe('cardSelection', () => {
  beforeEach(() => resetPickedCardForTest());

  it('remembers and forgets the pick', () => {
    expect(pickedCard.value).is.undefined;
    pickCard(CardName.ANTS);
    expect(pickedCard.value).eq(CardName.ANTS);
    clearPickedCard();
    expect(pickedCard.value).is.undefined;
  });

  it('offers to play a card the turn menu lists as playable', () => {
    const input = or(projectCard(CardName.ANTS, CardName.BIRDS));
    expect(offerIn(input, CardName.BIRDS)).eq('play');
  });

  it('offers a played card its action', () => {
    const input = or(selectCard(true, CardName.ANTS));
    expect(offerIn(input, CardName.ANTS)).eq('action');
  });

  it('offers nothing for a card the menu does not list', () => {
    const input = or(projectCard(CardName.ANTS));
    expect(offerIn(input, CardName.BIRDS)).is.undefined;
  });

  it('offers nothing when there is no input at all', () => {
    expect(offerIn(undefined, CardName.ANTS)).is.undefined;
  });

  /* Selling patents lists the hand too, but a card is what is spent there rather than
     what is played. Tapping a card must never offer to sell it. */
  it('ignores a card list that is not about playing the card', () => {
    const input = or(selectCard(false, CardName.ANTS));
    expect(offerIn(input, CardName.ANTS)).is.undefined;
  });

  it('ignores a card the server has disabled', () => {
    const input = projectCard(CardName.ANTS);
    const cards = (input as SelectProjectCardToPlayModel).cards as Array<CardModel>;
    cards[0].isDisabled = true;
    expect(offerIn(or(input), CardName.ANTS)).is.undefined;
  });

  it('reads an input that is not wrapped in a menu', () => {
    expect(offerIn(projectCard(CardName.ANTS), CardName.ANTS)).eq('play');
  });
});
