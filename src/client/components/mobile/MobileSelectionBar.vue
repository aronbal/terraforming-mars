<template>
  <div class="mobile-selection-bar" role="region" :aria-label="$t('Selected card')" data-test="selection-bar">
    <button class="mobile-selection-text" data-test="selection-inspect" @click="$emit('inspect')">
      <span class="mobile-selection-name">{{ $t(cardName) }}</span>
      <span class="mobile-selection-sub" data-test="selection-sub">{{ subtitle }}</span>
    </button>
    <button class="mobile-bar-button" data-test="selection-cancel" @click="$emit('cancel')" v-i18n>Cancel</button>
    <button class="mobile-bar-button mobile-bar-button--primary" data-test="selection-confirm" @click="$emit('confirm')">
      {{ $t(offer === 'play' ? 'Play' : 'Use') }}
    </button>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import {CardModel} from '@/common/models/CardModel';
import {CardOffer} from '@/client/utils/cardSelection';
import {actionTextOf} from '@/client/components/mobile/MobileActionMenu';
import {getCard} from '@/client/cards/ClientCardManifest';
import {translateTextWithParams} from '@/client/directives/i18n';

/*
 * The bar a selected card raises: what it is, what it costs or does, and the one
 * button that does it.
 *
 * One clear action at a time. The card itself stays ringed where the player tapped it,
 * so the bar only names it; tapping the name opens the card large enough to read.
 */
export default defineComponent({
  name: 'MobileSelectionBar',
  props: {
    card: {
      type: Object as PropType<CardModel>,
      required: true,
    },
    offer: {
      type: String as PropType<CardOffer>,
      required: true,
    },
    /** The player's M€, which a card's price is read against. */
    megacredits: {
      type: Number,
      required: true,
    },
  },
  emits: ['cancel', 'confirm', 'inspect'],
  computed: {
    cardName(): string {
      // Some card names carry a suffix after a colon to tell variants apart.
      return this.card.name.split(':')[0];
    },
    subtitle(): string {
      if (this.offer === 'action') {
        const text = actionTextOf(this.card.name);
        return text === undefined ? this.$t('Use this card\'s action') : this.$t(text);
      }
      const cost = this.card.calculatedCost ?? getCard(this.card.name)?.cost ?? 0;
      return translateTextWithParams('${0} M€ · ${1} available', [String(cost), String(this.megacredits)]);
    },
  },
});
</script>
