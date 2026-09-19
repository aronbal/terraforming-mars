import {computed, ComputedRef, ref} from 'vue';

import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

/*
 * The card the player picked outside the input that asks for it.
 *
 * On a phone the hand and the tableau are a tab of their own, so a player looking at a
 * card there has already made the choice the action sheet would go on to ask for.
 * Asking again -- open the sheet, choose "Play project card", scroll the same hand a
 * second time -- is the step this removes.
 *
 * The sheet's contents are built by the server and nested several components deep,
 * with no handle for the shell to reach in by, so the pick is announced here and the
 * inputs that offer that card act on it as they render. Nothing reads it unless a card
 * has been picked, so the ordinary flow of opening the sheet and choosing from the
 * list behaves exactly as it did.
 */
const picked = ref<CardName | undefined>(undefined);

export const pickedCard: ComputedRef<CardName | undefined> = computed(() => picked.value);

export function pickCard(name: CardName): void {
  picked.value = name;
}

/**
 * Forgets the pick. The shell does this once the turn it was made for is over, so a
 * card chosen for one input can never be applied to the next one.
 */
export function clearPickedCard(): void {
  picked.value = undefined;
}

export function resetPickedCardForTest(): void {
  picked.value = undefined;
}

/** What an input would do with a card, or `undefined` if it does not offer it. */
export type CardOffer = 'play' | 'action';

function has(cards: ReadonlyArray<CardModel>, name: CardName): boolean {
  return cards.some((card) => card.name === name && card.isDisabled !== true);
}

/**
 * Whether `input` is one the player could reach by picking `name`.
 *
 * Only the two inputs a card is the subject of count. Selling patents also lists the
 * hand, but a card is what is spent there rather than what is played, and treating a
 * tap as an offer to sell it would be a nasty surprise.
 */
export function offerFor(input: PlayerInputModel, name: CardName): CardOffer | undefined {
  if (input.type === 'projectCard' && has(input.cards, name)) {
    return 'play';
  }
  if (input.type === 'card' && input.selectBlueCardAction && has(input.cards, name)) {
    return 'action';
  }
  return undefined;
}

/**
 * The offer the player's current input makes for `name`, looking one level into an
 * `or`: the turn's menu is an `or` of everything the player may do.
 */
export function offerIn(input: PlayerInputModel | undefined, name: CardName): CardOffer | undefined {
  if (input === undefined) {
    return undefined;
  }
  const direct = offerFor(input, name);
  if (direct !== undefined) {
    return direct;
  }
  if (input.type === 'or') {
    for (const option of input.options) {
      const offer = offerFor(option, name);
      if (offer !== undefined) {
        return offer;
      }
    }
  }
  return undefined;
}
