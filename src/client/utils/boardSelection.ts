import {computed, ComputedRef, ref} from 'vue';

import {PlayerInputModel} from '@/common/models/PlayerInputModel';

/*
 * The thing on the board the player picked, outside the input that asks for it.
 *
 * Milestones, awards and the colony tiles are all drawn under the board, and the menu
 * entry that acts on one is a list of exactly the same names. Reading the list on the
 * board and then finding the name again in a menu is the step this removes: the
 * player taps the tile, and the entry opens with that option already chosen.
 *
 * This is the same arrangement as `cardSelection`, and for the same reason -- the
 * inputs are built by the server and nested several components deep, with no handle
 * for the shell to reach in by -- but it is kept apart from it because the two picks
 * mean different things and must never be mistaken for one another.
 */

/** The kinds of thing under the board a player can act on by tapping it. */
export type BoardThing = 'milestone' | 'award' | 'colony';

export type BoardPick = {
  kind: BoardThing;
  name: string;
};

/** The menu entry each kind of pick belongs to. */
const ANNOTATIONS: Record<BoardThing, string> = {
  milestone: 'milestone',
  award: 'award',
  colony: 'tradeWithColony',
};

const picked = ref<BoardPick | undefined>(undefined);

export const pickedBoardThing: ComputedRef<BoardPick | undefined> = computed(() => picked.value);

export function pickBoardThing(kind: BoardThing, name: string): void {
  picked.value = {kind, name};
}

/**
 * Forgets the pick. The shell does this once the turn it was made for is over, so a
 * milestone chosen for one input can never be applied to the next one.
 */
export function clearBoardPick(): void {
  picked.value = undefined;
}

export function resetBoardPickForTest(): void {
  picked.value = undefined;
}

/** The colony tiles an input lists, looking through the payment it is bundled with. */
function coloniesIn(input: PlayerInputModel): ReadonlyArray<string> {
  if (input.type === 'colony') {
    return input.coloniesModel.map((colony) => colony.name);
  }
  if (input.type === 'and') {
    return input.options.flatMap((option) => coloniesIn(option));
  }
  return [];
}

/** The names an input offers for `kind`, which is what the board can make tappable. */
export function namesOffered(input: PlayerInputModel, kind: BoardThing): ReadonlyArray<string> {
  if (input.annotation !== ANNOTATIONS[kind]) {
    return [];
  }
  if (kind === 'colony') {
    return coloniesIn(input);
  }
  /* A milestone or an award entry is a list of the names themselves, so the option
     titles are the names -- there is nothing else to match on, and nothing else to. */
  return input.type === 'or' ?
    input.options.map((option) => option.title).filter((title): title is string => typeof title === 'string') :
    [];
}

/** The names the player's current input offers for `kind`, looking one level into a menu. */
export function boardNamesIn(input: PlayerInputModel | undefined, kind: BoardThing): ReadonlyArray<string> {
  if (input === undefined) {
    return [];
  }
  const direct = namesOffered(input, kind);
  if (direct.length > 0) {
    return direct;
  }
  if (input.type === 'or') {
    for (const option of input.options) {
      const names = namesOffered(option, kind);
      if (names.length > 0) {
        return names;
      }
    }
  }
  return [];
}

/** Whether `input` is the entry a pick would be answered by. */
export function boardOfferFor(input: PlayerInputModel, pick: BoardPick): boolean {
  return namesOffered(input, pick.kind).includes(pick.name);
}
