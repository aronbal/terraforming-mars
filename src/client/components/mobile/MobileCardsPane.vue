<template>
  <div class="mobile-cards mobile-gutter">
    <div class="mobile-segmented mobile-segmented--inline" role="tablist">
      <button
        class="mobile-segmented-option"
        :class="{'mobile-segmented-option--on': view === 'hand'}"
        role="tab"
        :aria-selected="view === 'hand'"
        data-test="segment-hand"
        @click="view = 'hand'">{{ $t('Hand') }} · {{ hand.length }}</button>
      <button
        class="mobile-segmented-option"
        :class="{'mobile-segmented-option--on': view === 'played'}"
        role="tab"
        :aria-selected="view === 'played'"
        data-test="segment-played"
        @click="view = 'played'">{{ $t('Played') }} · {{ player.tableau.length }}</button>
    </div>

    <div class="mobile-card-scaler mobile-cards-body">
      <template v-if="view === 'hand'">
        <div v-if="hand.length === 0" class="mobile-section-note" v-i18n>No cards in hand</div>
        <div v-else class="mobile-card-grid">
          <button
            v-for="card in hand"
            :key="card.name"
            class="mobile-card-button"
            :class="cardClass(card)"
            :disabled="offerFor(card) === undefined"
            data-test="hand-card"
            @click="$emit('select', card.name)">
            <Card class="cardbox" :card="card"/>
          </button>
        </div>
      </template>

      <template v-else>
        <div v-for="group in playedGroups" :key="group.title">
          <h3 class="mobile-eyebrow">{{ $t(group.title) }} · {{ group.cards.length }}</h3>
          <div class="mobile-card-grid">
            <button
              v-for="card in group.cards"
              :key="card.name"
              class="mobile-card-button"
              :class="cardClass(card)"
              :disabled="offerFor(card) === undefined"
              data-test="played-card"
              @click="$emit('select', card.name)">
              <Card
                class="cardbox"
                :card="card"
                :actionUsed="isCardActivated(card, player)"
                :cubeColor="player.color"/>
            </button>
          </div>
        </div>
        <div v-if="player.tableau.length === 0" class="mobile-section-note" v-i18n>No cards played yet</div>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Card from '@/client/components/card/Card.vue';
import {CardModel} from '@/common/models/CardModel';
import {CardType} from '@/common/cards/CardType';
import {CardOrderStorage} from '@/client/utils/CardOrderStorage';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {getCardsByType, isCardActivated} from '@/client/utils/CardUtils';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {sortActiveCards} from '@/client/utils/ActiveCardsSortingOrder';
import {CardOffer, offerIn} from '@/client/utils/cardSelection';

/*
 * The whole hand, and the tableau beside it, two cards to a row.
 *
 * The cards the turn has a move for come first and are the only ones that take a
 * tap; the rest are dimmed in place, because a card you cannot afford this generation
 * is still what you plan the next one around. A tap opens the card in the play
 * sheet, exactly as on the turn page.
 */

type CardGroup = {
  title: string;
  cards: ReadonlyArray<CardModel>;
};

type DataModel = {
  view: 'hand' | 'played';
};

export default defineComponent({
  name: 'MobileCardsPane',
  emits: ['select'],
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
  },
  components: {
    Card,
  },
  data(): DataModel {
    return {
      view: 'hand',
    };
  },
  computed: {
    player(): PublicPlayerModel {
      return this.playerView.thisPlayer;
    },
    /** Whether the server is waiting on this player, which is when readiness matters. */
    actionWaiting(): boolean {
      return this.playerView.waitingFor !== undefined;
    },
    /**
     * The hand, in the desktop's order, but with what the player can do about it
     * first.
     *
     * Sorting is stable, so within each half the order the player arranged their hand
     * in survives; only the line between playable and not moves.
     */
    hand(): ReadonlyArray<CardModel> {
      const playerView = this.playerView;
      const projectCards = CardOrderStorage.getOrdered(
        CardOrderStorage.getCardOrder(playerView.id),
        playerView.cardsInHand);
      const ordered = [
        ...playerView.draftedCards,
        ...playerView.preludeCardsInHand,
        ...playerView.ceoCardsInHand,
        ...projectCards,
      ];
      if (!this.actionWaiting) {
        return ordered;
      }
      const ready = ordered.filter((card) => this.offerFor(card) !== undefined);
      const rest = ordered.filter((card) => this.offerFor(card) === undefined);
      return [...ready, ...rest];
    },
    playedGroups(): ReadonlyArray<CardGroup> {
      const tableau = this.player.tableau;
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
    },
    isCardActivated(): typeof isCardActivated {
      return isCardActivated;
    },
  },
  methods: {
    offerFor(card: CardModel): CardOffer | undefined {
      return offerIn(this.playerView.waitingFor, card.name);
    },
    cardClass(card: CardModel): Record<string, boolean> {
      const ready = this.offerFor(card) !== undefined;
      return {
        'mobile-card-button--idle': this.actionWaiting && !ready,
      };
    },
  },
});
</script>
