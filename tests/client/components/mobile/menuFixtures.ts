import {CardName} from '@/common/cards/CardName';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {TurmoilModel} from '@/common/models/TurmoilModel';
import {PartyName} from '@/common/turmoil/PartyName';

/* Turn menus as the server sends them, for the mobile shell's specs. */

export function option(title: string, annotation?: string): PlayerInputModel {
  return {type: 'option', title, buttonLabel: 'Confirm', annotation};
}

export function projectCard(...names: Array<CardName>): PlayerInputModel {
  return payable('projectCard', names);
}

/** The standard projects, which the server sends as cards to pay for, like the hand. */
export function standardProjects(...names: Array<CardName>): PlayerInputModel {
  return payable('standardProject', names);
}

function payable(annotation: string, names: Array<CardName>): PlayerInputModel {
  return {
    type: 'projectCard',
    title: 'Play project card',
    buttonLabel: 'Play',
    annotation,
    cards: names.map((name) => ({name, calculatedCost: 9})),
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

/** Cards chosen from a list: a played card's action, a CEO's, or the standard projects. */
export function cardList(annotation: string, names: Array<CardName>, options: {action?: boolean, disabled?: Array<CardName>} = {}): PlayerInputModel {
  return {
    type: 'card',
    title: annotation,
    buttonLabel: 'Take action',
    annotation,
    cards: names.map((name) => ({name, isDisabled: options.disabled?.includes(name)})),
    max: 1,
    min: 1,
    showOnlyInLearnerMode: false,
    selectBlueCardAction: options.action ?? false,
    showOwner: false,
    showSelectAll: false,
  };
}

export function namedChoices(annotation: string, title: string, ...names: Array<string>): PlayerInputModel {
  return {
    type: 'or',
    title,
    buttonLabel: 'Confirm',
    annotation,
    options: names.map((name) => option(name)),
  };
}

export function menu(...options: Array<PlayerInputModel>): OrOptionsModel {
  return {type: 'or', title: 'Take your first action', buttonLabel: 'Take action', options};
}

/** A trade: the fee, paid one of `fees` ways, and the colony tile, as one `and`. */
export function trade(colonies: Array<string>, fees: Array<string> = ['Pay 3 energy', 'Pay 9 M€']): PlayerInputModel {
  return {
    type: 'and',
    title: 'Trade with a colony tile',
    buttonLabel: 'Trade',
    annotation: 'tradeWithColony',
    options: [
      {type: 'or', title: 'Pay trade fee', buttonLabel: 'Pay', options: fees.map((fee) => option(fee))},
      {type: 'colony', title: 'Select colony tile for trade', buttonLabel: 'trade', coloniesModel: colonies.map((name) => ({name}))},
    ],
  } as unknown as PlayerInputModel;
}

/** A pick among cards, as the draft, the research phase or selling patents asks it. */
export function cardChoice(names: Array<CardName>, options: {min?: number, max?: number, buttonLabel?: string, annotation?: string, optional?: boolean} = {}): PlayerInputModel {
  return {
    type: 'card',
    title: 'Select a card',
    buttonLabel: options.buttonLabel ?? 'Select',
    annotation: options.annotation,
    optional: options.optional,
    cards: names.map((name) => ({name})),
    max: options.max ?? 1,
    min: options.min ?? 1,
    showOnlyInLearnerMode: false,
    selectBlueCardAction: false,
    showOwner: false,
    showSelectAll: false,
  };
}

/** Turmoil with Mars First dominant and the Greens in power, for the party sheet and panel. */
export function fakeTurmoil(): TurmoilModel {
  return {
    dominant: PartyName.MARS,
    ruling: PartyName.GREENS,
    chairman: 'neutral',
    parties: [
      {name: PartyName.MARS, partyLeader: 'red', delegates: [{color: 'green', number: 1}, {color: 'red', number: 2}]},
      {name: PartyName.SCIENTISTS, partyLeader: undefined, delegates: []},
      {name: PartyName.GREENS, partyLeader: undefined, delegates: []},
    ],
    lobby: ['red'],
    reserve: [{color: 'red', number: 5}],
    distant: undefined,
    coming: undefined,
    current: undefined,
    politicalAgendas: undefined,
    policyActionUsers: [],
  };
}
