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
            :class="cardClass(card)"
            data-test="hand-card"
            @click="tap(card)">
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
              :class="cardClass(card)"
              data-test="played-card"
              @click="tap(card)">
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

    <div v-if="magnified !== undefined" class="mobile-magnify" data-test="magnified-card" @click="close()">
      <!-- Tapping the card puts it back down: the way out is wherever you look. -->
      <div class="mobile-magnify-holder" data-test="magnified-holder" @click="close()">
        <Card class="cardbox" :card="magnified" :cubeColor="player.color"/>
      </div>
      <div class="mobile-magnify-actions" @click.stop>
        <button
          v-if="offer !== undefined"
          class="mobile-button mobile-button--go"
          data-test="magnified-play"
          @click="use()">
          <span v-if="offer === 'play'" v-i18n>Play card</span>
          <span v-else v-i18n>Use action</span>
        </button>
        <button class="mobile-button" data-test="magnified-close" @click="close()" v-i18n>Close</button>
      </div>
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
import {CardTapMode} from '@/client/utils/PreferencesManager';

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
  emits: ['play'],
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    cardScale: {
      type: Number,
      required: true,
    },
    tapMode: {
      type: String as PropType<CardTapMode>,
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
    /** What the player's current input would do with the magnified card, if anything. */
    offer(): CardOffer | undefined {
      return this.magnified === undefined ? undefined : this.offerFor(this.magnified);
    },
  },
  methods: {
    offerFor(card: CardModel): CardOffer | undefined {
      return offerIn(this.playerView.waitingFor, card.name);
    },
    cardClass(card: CardModel): Record<string, boolean> {
      const ready = this.offerFor(card) !== undefined;
      return {
        'mobile-card-button--ready': ready,
        // Dimmed rather than hidden: a card you cannot play this turn is still worth
        // reading, and planning around.
        'mobile-card-button--idle': this.actionWaiting && !ready,
      };
    },
    /*
     * A tap reads the card, or plays it, depending on what the player asked for in
     * settings. Reading first is the default: a mis-tap that plays a card costs a
     * turn, and a card you have not read is not a choice you have made.
     */
    tap(card: CardModel): void {
      if (this.tapMode === 'play' && this.offerFor(card) !== undefined) {
        this.$emit('play', card.name);
        return;
      }
      this.magnified = card;
    },
    close(): void {
      this.magnified = undefined;
    },
    /*
     * Hands the card to the action sheet rather than answering the input here: what
     * comes next is a payment, a placement or a target, and those are the sheet's job.
     */
    use(): void {
      const card = this.magnified;
      this.magnified = undefined;
      if (card !== undefined) {
        this.$emit('play', card.name);
      }
    },
  },
});
</script>
