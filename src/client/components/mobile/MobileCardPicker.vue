<template>
  <div class="mobile-card-grid" data-test="card-picker">
    <!-- A tap chooses a card or puts it back, as in the card chooser. -->
    <button
      v-for="card in cards"
      :key="card.name"
      type="button"
      class="mobile-card-grid-item"
      :class="{'mobile-card-grid-item--chosen': chosen.includes(card.name)}"
      :disabled="card.isDisabled === true"
      :aria-pressed="chosen.includes(card.name)"
      data-test="card-picker-card"
      @click="toggle(card.name)">
      <Card :card="card" :cubeColor="cubeColor"/>
      <span v-if="chosen.includes(card.name)" class="mobile-card-chooser-check" data-test="card-picker-check">
        <MobileIcon name="check" :size="18" :strokeWidth="3"/>
      </span>
    </button>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Card from '@/client/components/card/Card.vue';
import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';

type DataModel = {
  chosen: Array<CardName>;
};

/*
 * Cards side by side, any of them chosen with a tap: the grid the card chooser draws,
 * without its sheet, for a screen that holds several picks at once -- the opening hand.
 *
 * With `max` 1 a tap moves the choice to the card tapped; otherwise a tap adds the
 * card until `max` are chosen, and a tap on a chosen card puts it back.
 */
export default defineComponent({
  name: 'MobileCardPicker',
  components: {
    Card,
    MobileIcon,
  },
  props: {
    cards: {
      type: Array as PropType<ReadonlyArray<CardModel>>,
      required: true,
    },
    /** The most cards that may be chosen; with none given, any number. */
    max: {
      type: Number,
      default: Number.POSITIVE_INFINITY,
    },
    cubeColor: {
      type: String as PropType<Color>,
      default: undefined,
    },
  },
  emits: {
    cardschanged: (_cards: Array<CardName>) => true,
  },
  data(): DataModel {
    return {
      chosen: [],
    };
  },
  methods: {
    toggle(name: CardName): void {
      if (this.chosen.includes(name)) {
        this.chosen = this.chosen.filter((each) => each !== name);
      } else if (this.max === 1) {
        this.chosen = [name];
      } else if (this.chosen.length < this.max) {
        this.chosen = [...this.chosen, name];
      } else {
        return;
      }
      this.$emit('cardschanged', [...this.chosen]);
    },
  },
});
</script>
