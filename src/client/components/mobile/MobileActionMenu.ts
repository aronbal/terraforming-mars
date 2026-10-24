import {ActionAnnotation} from '@/common/input/Annotation';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardOffer, offerFor} from '@/client/utils/cardSelection';
import {BoardPick, boardOfferFor} from '@/client/utils/boardSelection';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {getCard} from '@/client/cards/ClientCardManifest';

/*
 * How the mobile shell reads a turn's action menu.
 *
 * `Player.getActions` always builds the same entries, each tagged with a stable
 * `ActionAnnotation`. The turn page draws most of them as the thing they are about --
 * a card to play, a tile to convert heat, a button to pass -- so this file answers the
 * questions the page asks of the menu: which cards are ready, which entry is behind a
 * tile, and which entries nothing on the page draws.
 *
 * When the player opens an entry, the sheet shows that entry alone. The grouped list
 * below is what the sheet falls back to if it is ever raised over the menu without
 * one: every entry unfolds in place there.
 */

/** A group of menu entries, in the order they are shown. */
export type ActionGroup = {
  /** The heading above the group, or undefined for the first, unlabelled one. */
  title: string | undefined;
  entries: ReadonlyArray<ActionEntry>;
};

export type ActionEntry = {
  /** Where this entry sits in the server's `options`, which is what a response names. */
  index: number;
  input: PlayerInputModel;
  annotation: ActionAnnotation | undefined;
  /** How many things the entry has to choose between, when that is worth saying. */
  count: number | undefined;
};

/** The headings, and which annotations fall under each. */
const GROUPS: ReadonlyArray<{title: string | undefined, annotations: ReadonlyArray<ActionAnnotation>}> = [
  {title: undefined, annotations: ['convertHeat', 'convertPlants']},
  {title: 'Build', annotations: ['standardProject', 'milestone', 'award']},
  {title: 'Cards', annotations: ['projectCard', 'actionCard', 'ceoAction', 'sellPatents']},
  {title: 'The rest of Mars', annotations: ['tradeWithColony', 'sendDelegate', 'turmoilParty']},
  {title: 'Finish', annotations: ['endTurn', 'pass', 'undo']},
];

/*
 * The entries the turn page draws as something of their own: a card in the ready
 * row, a tile, or a button. Anything else the server sends is listed under the tiles
 * by its title, so an action added to the game later is never unreachable.
 */
const DRAWN_ON_TURN_PAGE: ReadonlyArray<ActionAnnotation> = [
  'projectCard', 'actionCard', 'ceoAction',
  'convertHeat', 'convertPlants', 'standardProject', 'milestone', 'award',
  'tradeWithColony', 'sendDelegate', 'turmoilParty',
  'sellPatents', 'pass', 'endTurn', 'undo',
];

/** How many choices an entry holds, for the entries where the number tells you something. */
function countFor(input: PlayerInputModel): number | undefined {
  if (input.type === 'projectCard' || input.type === 'card') {
    return input.cards.length;
  }
  if (input.type === 'or') {
    return input.options.length;
  }
  return undefined;
}

/**
 * Whether `input` is a turn's action menu rather than an ordinary question.
 *
 * The menu is the only `or` whose entries carry annotations, which is what makes this
 * exact rather than a guess at the title.
 */
export function isActionMenu(input: PlayerInputModel | undefined): input is OrOptionsModel {
  return input !== undefined &&
    input.type === 'or' &&
    input.options.some((option) => option.annotation !== undefined);
}

/**
 * Whether `input` asks the player to choose among cards, directly or as one of the
 * parts of an `or` or an `and`.
 */
export function asksForCards(input: PlayerInputModel | undefined): boolean {
  if (input === undefined) {
    return false;
  }
  if (input.type === 'card' || input.type === 'projectCard') {
    return true;
  }
  if (input.type === 'or' || input.type === 'and') {
    return input.options.some(asksForCards);
  }
  return false;
}

/** Every entry of the menu, in the server's order. */
export function menuEntries(menu: OrOptionsModel): ReadonlyArray<ActionEntry> {
  return menu.options.map((input, index) => ({
    index,
    input,
    annotation: input.annotation as ActionAnnotation | undefined,
    count: countFor(input),
  }));
}

/** The entry carrying `annotation`, if the menu offers it this turn. */
export function entryFor(menu: OrOptionsModel | undefined, annotation: ActionAnnotation): ActionEntry | undefined {
  if (menu === undefined) {
    return undefined;
  }
  return menuEntries(menu).find((entry) => entry.annotation === annotation);
}

/** The entries nothing on the turn page draws, which it lists by title instead. */
export function otherEntries(menu: OrOptionsModel | undefined): ReadonlyArray<ActionEntry> {
  if (menu === undefined) {
    return [];
  }
  return menuEntries(menu).filter((entry) =>
    entry.annotation === undefined || !DRAWN_ON_TURN_PAGE.includes(entry.annotation));
}

/** A card the player can do something with right now. */
export type ReadyCard = {
  card: CardModel;
  offer: CardOffer;
};

/**
 * The cards the turn page offers in its ready row: the hand cards that can be played,
 * then the played cards whose action can be used, then a CEO's once-per-game action.
 *
 * Read off the menu rather than recomputed: the server has already worked out what
 * this player can afford and reach, and a second opinion here could only be wrong.
 */
export function readyCards(menu: OrOptionsModel | undefined): ReadonlyArray<ReadyCard> {
  if (menu === undefined) {
    return [];
  }
  const ready: Array<ReadyCard> = [];
  for (const annotation of ['projectCard', 'actionCard', 'ceoAction'] as const) {
    const input = entryFor(menu, annotation)?.input;
    if (input === undefined || (input.type !== 'projectCard' && input.type !== 'card')) {
      continue;
    }
    for (const card of input.cards) {
      const offer = offerFor(input, card.name);
      if (offer !== undefined && !ready.some((each) => each.card.name === card.name)) {
        ready.push({card, offer});
      }
    }
  }
  return ready;
}

/** What the shell knows that the menu itself does not. */
export type MenuContext = {
  /** The card picked on the turn page or the Cards view, if any. */
  card?: CardName;
  /** The tile tapped under the board, if any. */
  board?: BoardPick;
  /** The entry opened from a tile or a button on the turn page, by index, if any. */
  entry?: number;
};

/** The entry that answers what the player picked, if the menu holds one. */
export function pickedEntryIn(menu: OrOptionsModel, context: MenuContext): ActionEntry | undefined {
  const {card, board, entry} = context;
  const entries = menuEntries(menu);
  if (entry !== undefined) {
    return entries.find((each) => each.index === entry);
  }
  return entries.find((each) =>
    (card !== undefined && offerFor(each.input, card) !== undefined) ||
    (board !== undefined && boardOfferFor(each.input, board)));
}

/**
 * Arranges a menu into the groups above.
 *
 * An entry the server sends that this does not know about still appears, in a group
 * of its own at the end, rather than going missing because a new action was added to
 * the game and nobody thought of this file.
 */
export function groupActions(menu: OrOptionsModel): ReadonlyArray<ActionGroup> {
  const entries = menuEntries(menu);
  const taken = new Set<number>();
  const groups: Array<ActionGroup> = [];
  for (const group of GROUPS) {
    const found = entries.filter((entry) =>
      entry.annotation !== undefined && group.annotations.includes(entry.annotation));
    for (const entry of found) {
      taken.add(entry.index);
    }
    if (found.length > 0) {
      groups.push({title: group.title, entries: found});
    }
  }

  const rest = entries.filter((entry) => !taken.has(entry.index));
  if (rest.length > 0) {
    groups.push({title: 'Other', entries: rest});
  }
  return groups;
}

/*
 * Walks a card's rendering for the first text written as an action. The renderer
 * keeps each block's printed description as a line inside the block, which is the
 * text the card itself shows players, so there is nothing to rephrase.
 */
function findActionDescription(node: unknown): string | undefined {
  if (typeof node === 'string') {
    return node.startsWith('Action: ') ? node : undefined;
  }
  if (node === null || typeof node !== 'object') {
    return undefined;
  }
  for (const value of Object.values(node)) {
    const found = findActionDescription(value);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/**
 * What a card's action does, as its own text says it, without the leading `Action:`.
 * Undefined for a card whose action is drawn but not written out.
 */
export function actionTextOf(name: CardName): string | undefined {
  const text = findActionDescription(getCard(name)?.metadata.renderData);
  return text?.substring('Action: '.length);
}
