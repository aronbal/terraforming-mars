<template>
  <div class="mobile-card-scaler">
    <div class="mobile-card-grid mobile-card-list-grid">
      <button
        v-for="card in cards"
        :key="card"
        v-memo="[card, tallCards]"
        type="button"
        class="mobile-card-button"
        data-test="card-list-card"
        @click="$emit('open', card)">
        <Card class="cardbox" :card="{'name': card}" :autoTall="tallCards"/>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import Card from '@/client/components/card/Card.vue';

/*
 * One section of the cards list on a phone, the cards at the Cards tab's scale.
 *
 * A component of its own so that each card can be memoised: `v-memo` does not work
 * inside the `v-for` over the sections, and without it every keystroke in the search
 * would redraw every card on the page.
 */
export default defineComponent({
  name: 'MobileCardListGrid',
  components: {
    Card,
  },
  props: {
    cards: {
      type: Array as PropType<ReadonlyArray<CardName>>,
      required: true,
    },
    tallCards: {
      type: Boolean,
      required: true,
    },
  },
  emits: {
    open: (_card: CardName) => true,
  },
});
</script>
