import {CardModel} from '@/common/models/CardModel';
import {CardType} from '@/common/cards/CardType';
import {getCardsByType} from '@/client/utils/CardUtils';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {sortActiveCards} from '@/client/utils/ActiveCardsSortingOrder';

export type CardGroup = {
  title: string;
  cards: ReadonlyArray<CardModel>;
};

/**
 * A tableau the way the shell lists it: the corporation, the cards with an action,
 * the automated cards and the events. A prelude with an action counts as active.
 */
export function playedGroups(tableau: ReadonlyArray<CardModel>): ReadonlyArray<CardGroup> {
  const active = getCardsByType(tableau, [CardType.ACTIVE, CardType.PRELUDE])
    .filter((card) => getCardOrThrow(card.name).type === CardType.ACTIVE || getCardOrThrow(card.name).hasAction);
  const automated = getCardsByType(tableau, [CardType.AUTOMATED, CardType.PRELUDE])
    .filter((card) => !getCardOrThrow(card.name).hasAction);
  return [
    {title: 'Corporation', cards: getCardsByType(tableau, [CardType.CORPORATION, CardType.CEO])},
    {title: 'Active', cards: sortActiveCards(active)},
    {title: 'Automated', cards: automated},
    {title: 'Events', cards: getCardsByType(tableau, [CardType.EVENT])},
  ].filter((group) => group.cards.length > 0);
}
