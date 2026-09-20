import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import * as constants from '@/common/constants';
import {getCard, getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';
import {SelectInitialCardsResponse} from '@/common/inputs/InputResponse';
import {sum} from '@/common/utils/utils';

/**
 * The opening hand as the player has it so far.
 *
 * The corporation and the CEO end up as one card each, but a player deciding between
 * two holds both, so every field is a list.
 */
export type InitialCardsSelection = {
  corporations: ReadonlyArray<CardName>;
  preludes: ReadonlyArray<CardName>;
  ceos: ReadonlyArray<CardName>;
  cards: ReadonlyArray<CardName>;
};

/** Which of the four selections this game asks for. Corporations and cards always are. */
export type InitialCardsOffered = {
  prelude: boolean;
  ceo: boolean;
};

export const EMPTY_SELECTION: InitialCardsSelection = {
  corporations: [],
  preludes: [],
  ceos: [],
  cards: [],
};

/** The corporation, once the player is down to one. */
function chosenCorporation(selection: InitialCardsSelection): CardName | undefined {
  return selection.corporations.length === 1 ? selection.corporations[0] : undefined;
}

/**
 * What a prelude is worth beyond its own printed megacredits, given the corporation.
 *
 * Every case here is a corporation whose effect fires on something a prelude does
 * during setup, so the money is in hand before the first turn.
 */
function extra(prelude: CardName, selection: InitialCardsSelection): number {
  const card = getCardOrThrow(prelude);
  switch (chosenCorporation(selection)) {
  // For each step you increase the production of a resource ... you also gain that resource.
  case CardName.MANUTECH:
    return card.productionBox?.megacredits ?? 0;

  // When you place a city tile, gain 3 M€.
  case CardName.THARSIS_REPUBLIC:
    switch (prelude) {
    case CardName.SELF_SUFFICIENT_SETTLEMENT:
    case CardName.EARLY_SETTLEMENT:
    case CardName.STRATEGIC_BASE_PLANNING:
      return 3;
    }
    return 0;

  // When ANY microbe tag is played ... lose 4 M€ or as much as possible.
  case CardName.PHARMACY_UNION: {
    const tags = card.tags.filter((tag) => tag === Tag.MICROBE).length;
    return (-4 * tags);
  }

  // When a microbe tag is played, incl. this, THAT PLAYER gains 2 M€,
  case CardName.SPLICE: {
    const microbeTags = card.tags.filter((tag) => tag === Tag.MICROBE).length;
    return (2 * microbeTags);
  }

  // Whenever Venus is terraformed 1 step, you gain 2 M€
  case CardName.APHRODITE:
    switch (prelude) {
    case CardName.VENUS_FIRST:
      return 4;
    case CardName.HYDROGEN_BOMBARDMENT:
      return 2;
    }
    return 0;

  // When any player raises any Moon Rate, gain 1M€ per step.
  case CardName.LUNA_FIRST_INCORPORATED:
    switch (prelude) {
    case CardName.FIRST_LUNAR_SETTLEMENT:
    case CardName.CORE_MINE:
    case CardName.BASIC_INFRASTRUCTURE:
      return 1;
    case CardName.MINING_COMPLEX:
      return 2;
    }
    return 0;

  // When you place an ocean tile, gain 4MC
  case CardName.POLARIS:
    switch (prelude) {
    case CardName.AQUIFER_TURBINES:
    case CardName.POLAR_INDUSTRIES:
      return 4;
    case CardName.GREAT_AQUIFER:
      return 8;
    }
    return 0;

  // Gain 2 MC for each project card in hand.
  case CardName.HEAD_START:
    return selection.cards.length * 2;

  // Gain 4MC for playing a card with no tags.
  // Gain 1MC for playing a card with 1 tag.
  case CardName.SAGITTA_FRONTIER_SERVICES: {
    const count = card.tags.filter((tag) => tag !== Tag.WILD).length;
    return count === 0 ? 4 : count === 1 ? 1 : 0;
  }

  default:
    return 0;
  }
}

/** What the preludes add on top of the starting megacredits. */
export function afterPreludes(selection: InitialCardsSelection): number {
  return sum(selection.preludes.map((prelude) => {
    const card = getCardOrThrow(prelude);
    const base = card.startingMegaCredits ?? 0;
    return base + extra(prelude, selection);
  }));
}

/**
 * What the player starts the game with, once the cards they are buying are paid for.
 *
 * `NaN` while the corporation is still undecided, because there is no number to show
 * until there is one corporation.
 */
export function startingMegacredits(selection: InitialCardsSelection): number {
  const corpName = chosenCorporation(selection);
  if (corpName === undefined) {
    return NaN;
  }
  const corporation = getCardOrThrow(corpName);
  // The ?? 0 is only because IClientCard applies to _all_ cards.

  let starting = corporation.startingMegaCredits ?? 0;
  const cardCost = corporation.cardCost === undefined ? constants.CARD_COST : corporation.cardCost;
  starting -= selection.cards.length * cardCost;

  if (corpName === CardName.SAGITTA_FRONTIER_SERVICES) {
    // Effect for playing itself.
    starting += 4;
  }

  return starting;
}

/** The project cards being bought, which is what the "buying nothing?" alert asks about. */
export function projectCards(selection: InitialCardsSelection): ReadonlyArray<CardName> {
  return selection.cards.filter((name) => getCard(name)?.type !== CardType.PRELUDE);
}

/**
 * Whether the selection may be submitted, and what is standing in the way.
 *
 * Buying no project cards is a legal opening, so it warns without blocking; everything
 * else is a count the server would reject.
 */
export function validate(selection: InitialCardsSelection, offered: InitialCardsOffered): {valid: boolean, warning: string | undefined} {
  if (selection.corporations.length === 0) {
    return {valid: false, warning: 'Select a corporation'};
  }
  if (selection.corporations.length > 1) {
    return {valid: false, warning: 'You selected too many corporations'};
  }
  if (offered.prelude) {
    if (selection.preludes.length < 2) {
      return {valid: false, warning: 'Select 2 preludes'};
    }
    if (selection.preludes.length > 2) {
      return {valid: false, warning: 'You selected too many preludes'};
    }
  }
  if (offered.ceo) {
    if (selection.ceos.length < 1) {
      return {valid: false, warning: 'Select 1 CEO'};
    }
    if (selection.ceos.length > 1) {
      return {valid: false, warning: 'You selected too many CEOs'};
    }
  }
  if (selection.cards.length === 0) {
    return {valid: true, warning: 'You haven\'t selected any project cards'};
  }
  return {valid: true, warning: undefined};
}

/** The four answers, in the order the server's own options were built. */
export function buildResponse(selection: InitialCardsSelection, offered: InitialCardsOffered): SelectInitialCardsResponse {
  const result: SelectInitialCardsResponse = {
    type: 'initialCards',
    responses: [],
  };

  if (selection.corporations.length === 1) {
    result.responses.push({type: 'card', cards: [selection.corporations[0]]});
  }
  if (offered.prelude) {
    result.responses.push({type: 'card', cards: [...selection.preludes]});
  }
  if (offered.ceo) {
    result.responses.push({type: 'card', cards: [...selection.ceos]});
  }
  result.responses.push({type: 'card', cards: [...selection.cards]});
  return result;
}

export function getOption(options: Array<PlayerInputModel>, title: string): SelectCardModel {
  const option = options.find((option) => option.title === title);
  if (option === undefined) {
    throw new Error('invalid input, missing option');
  }
  if (option.type !== 'card') {
    throw new Error('invalid input, Not a SelectCard option');
  }
  return option;
}

export function hasOption(options: Array<PlayerInputModel>, title: string): boolean {
  return options.some((option) => option.title === title);
}
