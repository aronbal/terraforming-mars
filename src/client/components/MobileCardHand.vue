<template>
  <section class="mobile-card-hand" aria-label="Cards in hand">
    <!-- Compact hand overview: a V-shaped fan with only price + tags exposed. -->
    <div class="mobile-card-hand__fan">
      <button
        v-for="item in visibleFanCards"
        :key="`fan-${item.card.name}-${item.index}`"
        class="mobile-card-hand__fan-card"
        :class="{ 'is-focused': item.index === selectedIndex }"
        :style="fanCardStyle(item.position, visibleFanCards.length)"
        type="button"
        :aria-label="`Select ${item.card.name}`"
        @click="selectCard(item.index)"
      >
        <Card :card="item.card" />
      </button>
    </div>

    <div class="mobile-card-hand__focus-label">
      <span>{{ selectedIndex + 1 }} / {{ cards.length }}</span>
      <span class="mobile-card-hand__hint">Swipe kortet</span>
    </div>

    <!-- Full-size focus card: this is the primary interaction surface. -->
    <div
      class="mobile-card-hand__carousel"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
    >
      <button
        v-if="previousCard"
        class="mobile-card-hand__peek mobile-card-hand__peek--previous"
        type="button"
        aria-label="Previous card"
        @click="previous"
      >
        <Card :card="previousCard" />
      </button>

      <div class="mobile-card-hand__focus-card">
        <Card :card="selectedCard" :autoTall="true" />
      </div>

      <button
        v-if="nextCard"
        class="mobile-card-hand__peek mobile-card-hand__peek--next"
        type="button"
        aria-label="Next card"
        @click="next"
      >
        <Card :card="nextCard" />
      </button>
    </div>

    <div class="mobile-card-hand__dots" aria-hidden="true">
      <span
        v-for="(_, index) in cards"
        :key="`dot-${index}`"
        :class="{ 'is-active': index === selectedIndex }"
      ></span>
    </div>
  </section>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {CardModel} from '@/common/models/CardModel';

const MAX_FAN_CARDS = 7;

type FanCard = {
  card: CardModel;
  index: number;
  position: number;
};

export default defineComponent({
  name: 'MobileCardHand',
  components: {Card},
  props: {
    cards: {
      type: Array as () => Array<CardModel>,
      required: true,
    },
  },
  data() {
    return {
      selectedIndex: 0,
      touchStartX: 0,
      touchCurrentX: 0,
    };
  },
  computed: {
    selectedCard(): CardModel {
      return this.cards[this.selectedIndex];
    },
    previousCard(): CardModel | undefined {
      return this.cards[this.selectedIndex - 1];
    },
    nextCard(): CardModel | undefined {
      return this.cards[this.selectedIndex + 1];
    },
    visibleFanCards(): FanCard[] {
      const count = Math.min(MAX_FAN_CARDS, this.cards.length);
      const half = Math.floor(count / 2);
      let start = Math.max(0, this.selectedIndex - half);
      start = Math.min(start, Math.max(0, this.cards.length - count));

      return this.cards.slice(start, start + count).map((card, position) => ({
        card,
        index: start + position,
        position,
      }));
    },
  },
  watch: {
    cards: {
      deep: true,
      handler(cards: Array<CardModel>) {
        if (this.selectedIndex >= cards.length) {
          this.selectedIndex = Math.max(0, cards.length - 1);
        }
      },
    },
  },
  methods: {
    selectCard(index: number): void {
      this.selectedIndex = index;
    },
    previous(): void {
      if (this.selectedIndex > 0) this.selectedIndex--;
    },
    next(): void {
      if (this.selectedIndex < this.cards.length - 1) this.selectedIndex++;
    },
    fanCardStyle(position: number, count: number): Record<string, string> {
      const center = (count - 1) / 2;
      const offset = position - center;
      const rotation = offset * 4;
      // Negative Y moves the outer cards upwards, creating the V shape.
      const verticalOffset = -Math.abs(offset) * 20;
      const horizontalOffset = offset * 54 - 120;
      const isCenter = Math.abs(offset) < 0.1;

      return {
        transform: `translateX(${horizontalOffset}px) translateY(${verticalOffset + (isCenter ? 2 : 0)}px) rotate(${rotation}deg)`,
        zIndex: String(20 - Math.abs(Math.round(offset))),
      };
    },
    onTouchStart(event: TouchEvent): void {
      this.touchStartX = event.touches[0]?.clientX ?? 0;
      this.touchCurrentX = this.touchStartX;
    },
    onTouchMove(event: TouchEvent): void {
      this.touchCurrentX = event.touches[0]?.clientX ?? this.touchCurrentX;
    },
    onTouchEnd(): void {
      const delta = this.touchCurrentX - this.touchStartX;
      if (Math.abs(delta) < 45) return;
      if (delta < 0) this.next();
      else this.previous();
    },
  },
});
</script>

<style scoped lang="less">
.mobile-card-hand {
  position: relative;
  width: 100%;
  padding: 0 0 18px;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;

  // ================================================================
  // HAND OVERVIEW
  // The overview is deliberately not a miniature readable card.
  // It is a visual index: card silhouette + cost + tags.
  // ================================================================
  &__fan {
    position: relative;
    height: 190px;
    margin: 0 -12px 0;
    overflow: visible;
    touch-action: pan-y;
  }

  &__fan-card {
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 240px;
    height: 142px;
    padding: 0;
    border: 0;
    background: transparent;
    transform-origin: 50% 100%;
    cursor: pointer;
    transition: transform 180ms ease, filter 180ms ease;

    &:focus-visible {
      outline: 2px solid white;
      outline-offset: 2px;
      border-radius: 12px;
    }

    &:not(.is-focused) {
      filter: brightness(.72) saturate(.82);
    }

    &.is-focused {
      filter: brightness(1.04) saturate(1.05);
    }
  }

  // Scale the real card down so its visual frame remains authentic.
  &__fan-card :deep(.card-container) {
    width: 240px;
    height: 142px;
    overflow: hidden;
    transform: scale(.54);
    transform-origin: 50% 100%;
  }

  // Hide all reading content. Price and tags are the deliberate exceptions.
  &__fan-card :deep(.card-content-wrapper) {
    visibility: hidden;
  }

  &__fan-card :deep(.card-cost-and-tags) {
    visibility: visible;
  }

  &__fan-card :deep(.card-expansion),
  &__fan-card :deep(.card-points),
  &__fan-card :deep(.card-resources-counter),
  &__fan-card :deep(.card-extra-content),
  &__fan-card :deep(.card-help) {
    opacity: 0;
  }

  &__focus-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin: -2px 0 8px;
    color: rgba(255, 255, 255, .78);
    font: 600 12px/16px Ubuntu, sans-serif;
    letter-spacing: .04em;
    text-transform: uppercase;
  }

  &__hint {
    color: rgba(255, 255, 255, .42);
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
  }

  // ================================================================
  // FOCUS CARD
  // Full card at the bottom. Swipe left/right to browse the hand.
  // ================================================================
  &__carousel {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    min-height: 410px;
    overflow: hidden;
    touch-action: pan-y;
  }

  &__focus-card {
    position: relative;
    z-index: 10;
    width: 290px;
    max-width: 78vw;
    display: flex;
    justify-content: center;
  }

  &__focus-card :deep(.card-container) {
    transform: scale(1.12);
    transform-origin: top center;
    margin-bottom: 45px;
  }

  // Small adjacent cards reinforce that the focus card is part of a deck.
  &__peek {
    position: absolute;
    top: 10px;
    width: 240px;
    height: 300px;
    padding: 0;
    border: 0;
    background: transparent;
    opacity: .42;
    z-index: 2;
    pointer-events: auto;
  }

  &__peek--previous {
    right: calc(50% + 126px);
    transform: scale(.82);
    transform-origin: top right;
  }

  &__peek--next {
    left: calc(50% + 126px);
    transform: scale(.82);
    transform-origin: top left;
  }

  &__peek :deep(.card-container) {
    width: 240px;
    transform: scale(.8);
    transform-origin: top center;
  }

  &__dots {
    display: flex;
    justify-content: center;
    gap: 5px;
    margin-top: -24px;

    span {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: rgba(255, 255, 255, .25);
      transition: transform 160ms ease, opacity 160ms ease;

      &.is-active {
        transform: scale(1.6);
        background: rgba(255, 255, 255, .85);
      }
    }
  }
}

@media (min-width: 701px) {
  .mobile-card-hand {
    display: none;
  }
}

@media (max-width: 420px) {
  .mobile-card-hand {
    &__fan {
      height: 172px;
    }

    &__focus-card {
      max-width: 82vw;
    }

    &__focus-card :deep(.card-container) {
      transform: scale(1.02);
    }

    &__peek {
      opacity: .30;
    }
  }
}
</style>
