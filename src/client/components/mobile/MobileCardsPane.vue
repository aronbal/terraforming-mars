<template>
  <div>
    <div class="mobile-segment" role="tablist">
      <button
        class="mobile-segment-button"
        role="tab"
        :aria-selected="view === 'hand'"
        data-test="segment-hand"
        @click="view = 'hand'">
        <span v-i18n>Hand</span>
        <span class="mobile-segment-count mobile-num">{{ hand.length }}</span>
      </button>
      <button
        class="mobile-segment-button"
        role="tab"
        :aria-selected="view === 'played'"
        data-test="segment-played"
        @click="view = 'played'">
        <span v-i18n>Played</span>
        <span class="mobile-segment-count mobile-num">{{ player.tableau.length }}</span>
      </button>
    </div>

    <div class="mobile-cards-body mobile-card-scaler" :style="scaleStyle">
      <template v-if="view === 'hand'">
        <div v-if="hand.length === 0" class="mobile-cards-empty" v-i18n>No cards in hand</div>
        <div v-else class="mobile-card-grid">
          <button
            v-for="card in hand"
            :key="card.name"
            class="mobile-card-button"
            data-test="hand-card"
            @click="magnified = card">
            <Card class="cardbox" :card="card"/>
          </button>
        </div>
      </template>

      <template v-else>
        <div v-for="group in playedGroups" :key="group.title">
          <h3 class="mobile-cards-group-title">{{ $t(group.title) }} · {{ group.cards.length }}</h3>
          <div class="mobile-card-grid">
            <button
              v-for="card in group.cards"
              :key="card.name"
              class="mobile-card-button"
              data-test="played-card"
              @click="magnified = card">
              <Card
                class="cardbox"
                :card="card"
                :actionUsed="isCardActivated(card, player)"
                :cubeColor="player.color"/>
            </button>
          </div>
        </div>
        <div v-if="player.tableau.length === 0" class="mobile-cards-empty" v-i18n>No cards played yet</div>
      </template>
    </div>

    <div v-if="magnified !== undefined" class="mobile-magnify" data-test="magnified-card" @click="magnified = undefined">
      <div class="mobile-magnify-holder">
        <Card class="cardbox" :card="magnified" :cubeColor="player.color"/>
      </div>
      <button class="mobile-button" v-i18n>Close</button>
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

type CardGroup = {
  title: string;
  cards: ReadonlyArray<CardModel>;
};

type DataModel = {
  view: 'hand' | 'played';
  magnified: CardModel | undefined;
};

export default defineComponent({
  name: 'MobileCardsPane',
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    cardScale: {
      type: Number,
      required: true,
    },
  },
  components: {
    Card,
  },
  data(): DataModel {
    return {
      view: 'hand',
      magnified: undefined,
    };
  },
  computed: {
    player(): PublicPlayerModel {
      return this.playerView.thisPlayer;
    },
    scaleStyle(): Record<string, string> {
      return {'--mobile-card-scale': String(this.cardScale)};
    },
    /** The hand in the same order the desktop hand uses, preludes and CEOs first. */
    hand(): ReadonlyArray<CardModel> {
      const playerView = this.playerView;
      const projectCards = CardOrderStorage.getOrdered(
        CardOrderStorage.getCardOrder(playerView.id),
        playerView.cardsInHand);
      return [
        ...playerView.draftedCards,
        ...playerView.preludeCardsInHand,
        ...playerView.ceoCardsInHand,
        ...projectCards,
      ];
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
});
</script>
