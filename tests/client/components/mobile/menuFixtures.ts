import {CardName} from '@/common/cards/CardName';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';

/* Turn menus as the server sends them, for the mobile shell's specs. */

export function option(title: string, annotation?: string): PlayerInputModel {
  return {type: 'option', title, buttonLabel: 'Confirm', annotation};
}

export function projectCard(...names: Array<CardName>): PlayerInputModel {
  return {
    type: 'projectCard',
    title: 'Play project card',
    buttonLabel: 'Play',
    annotation: 'projectCard',
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
