import {ActionAnnotation} from '@/common/input/Annotation';
import {CardName} from '@/common/cards/CardName';
import {offerFor} from '@/client/utils/cardSelection';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';

/*
 * How the mobile shell arranges a turn's action menu.
 *
 * `Player.getActions` always builds the same fifteen entries, each tagged with a
 * stable `ActionAnnotation`. Shown as one flat list they are hard to read, because
 * five of them are about a card, three are about something printed on the board, and
 * only the rest are actions with nothing on screen to point at.
 *
 * So the entries a card is the subject of are not offered here at all: they send the
 * player to the Cards tab, where the card itself is what they tap. The rest are rows
 * that open in place, grouped, and the menu fits on a phone.
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
  /** Set when the entry is handled on another tab rather than opened here. */
  elsewhere: Elsewhere | undefined;
  /** How many things the entry has to choose between, when that is worth saying. */
  count: number | undefined;
};

export type Elsewhere = {
  /** The tab that owns this action. */
  tab: 'board' | 'cards';
  /** What the player does when they get there. */
  hint: string;
};

/*
 * The entries a card is the subject of. Each is reached by tapping the card itself,
 * on the Cards tab, where the player can read it before committing to it.
 */
const ON_CARDS_TAB: Partial<Record<ActionAnnotation, string>> = {
  projectCard: 'Tap a card in your hand to play it',
  actionCard: 'Tap a played card to use its action',
  ceoAction: 'Tap your CEO to use its action',
  sellPatents: 'Choose the cards to sell',
};

/** The headings, and which annotations fall under each. */
const GROUPS: ReadonlyArray<{title: string | undefined, annotations: ReadonlyArray<ActionAnnotation>}> = [
  {title: undefined, annotations: ['convertHeat', 'convertPlants']},
  {title: 'Build', annotations: ['standardProject', 'milestone', 'award']},
  {title: 'Cards', annotations: ['projectCard', 'actionCard', 'ceoAction', 'sellPatents']},
  {title: 'The rest of Mars', annotations: ['tradeWithColony', 'sendDelegate', 'turmoilParty']},
  {title: 'Finish', annotations: ['endTurn', 'pass', 'undo']},
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

function elsewhereFor(annotation: ActionAnnotation | undefined): Elsewhere | undefined {
  if (annotation === undefined) {
    return undefined;
  }
  const cards = ON_CARDS_TAB[annotation];
  return cards === undefined ? undefined : {tab: 'cards', hint: cards};
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
 * Arranges a menu into the groups above.
 *
 * An entry the server sends that this does not know about still appears, in a group
 * of its own at the end, rather than going missing because a new action was added to
 * the game and nobody thought of this file.
 */
export function groupActions(menu: OrOptionsModel, picked?: CardName): ReadonlyArray<ActionGroup> {
  const entries: Array<ActionEntry> = menu.options.map((input, index) => {
    const annotation = input.annotation as ActionAnnotation | undefined;
    /*
     * A card entry sends the player to the Cards tab -- until they come back from it
     * having picked one. Then this is where the choice is finished, so the entry
     * opens here instead, and the row stops pointing at the tab they just left.
     */
    const claimed = picked !== undefined && offerFor(input, picked) !== undefined;
    return {
      index,
      input,
      annotation,
      elsewhere: claimed ? undefined : elsewhereFor(annotation),
      count: countFor(input),
    };
  });

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
