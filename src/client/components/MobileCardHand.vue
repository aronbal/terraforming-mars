<template>
  <section class="mobile-card-hand" aria-label="Cards in hand">
    <!--
      The hand is a compact overview, not a miniature set of readable cards.
      The selected card sits at the bottom of the V. At either end of the hand
      the same layout naturally becomes / or \\.
    -->
    <div class="mobile-card-hand__fan">
      <button
        v-for="item in visibleFanCards"
        :key="`fan-${item.card.name}-${item.index}`"
        class="mobile-card-hand__fan-card"
        :class="{ 'is-focused': item.index === selectedIndex }"
        :style="fanCardStyle(item.index, item.position, visibleFanCards.length)"
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

    <!-- Full-size focus card: the primary interaction surface. -->
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

    <div class="mobile-card-hand__position" aria-hidden="true">
      <span class="mobile-card-hand__position-current">{{ selectedIndex + 1 }}</span>
      <span>/ {{ cards.length }}</span>
    </div>
  </section>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {CardModel} from '@/common/models/CardModel';

const MAX_FAN_CARDS = 7;
const SWIPE_THRESHOLD = 45;
const SWIPE_DISTANCE = 170;
const MAX_DRAG_FOCUS_SHIFT = 1;

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
      touchDragX: 0,
      isDragging: false,
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
    fanFocusShift(): number {
      if (!this.isDragging) return 0;
      const rawShift = -this.touchDragX / SWIPE_DISTANCE;
      return Math.max(-MAX_DRAG_FOCUS_SHIFT, Math.min(MAX_DRAG_FOCUS_SHIFT, rawShift));
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
    fanCardStyle(index: number, position: number, count: number): Record<string, string> {
      const selectedPosition = this.visibleFanCards.findIndex((item) => item.index === this.selectedIndex);
      const relativePosition = position - selectedPosition - this.fanFocusShift;
      const distance = Math.abs(relativePosition);

      // The selected card is the lowest point. Moving the focus left/right
      // morphs the whole fan continuously between \\, V and / while dragging.
      const verticalOffset = -Math.pow(distance, 1.12) * 25;
      const horizontalOffset = relativePosition * 54 - 120;
      const rotation = relativePosition * 4.2;
      const isCenter = distance < 0.15;

      return {
        transform: `translateX(${horizontalOffset}px) translateY(${verticalOffset + (isCenter ? 2 : 0)}px) rotate(${rotation}deg)`,
        zIndex: String(30 - Math.round(distance * 2)),
      };
    },
    onTouchStart(event: TouchEvent): void {
      this.touchStartX = event.touches[0]?.clientX ?? 0;
      this.touchCurrentX = this.touchStartX;
      this.touchDragX = 0;
      this.isDragging = true;
    },
    onTouchMove(event: TouchEvent): void {
      if (!this.isDragging) return;
      this.touchCurrentX = event.touches[0]?.clientX ?? this.touchCurrentX;
      this.touchDragX = this.touchCurrentX - this.touchStartX;
    },
    onTouchEnd(): void {
      const delta = this.touchCurrentX - this.touchStartX;
      this.isDragging = false;
      this.touchDragX = 0;

      if (Math.abs(delta) < SWIPE_THRESHOLD) return;
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
  // Selected card = bottom of V. At the first/last card this becomes
  // a clean diagonal (\\ or /). The whole fan follows the finger.
  // ================================================================
  &__fan {
    position: relative;
    height: 190px;
    margin: 0 -12px;
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
    transition: transform 240ms cubic-bezier(.22, .8, .2, 1), filter 180ms ease;
    will-change: transform;

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

  // Keep the real card artwork, but make the overview compact.
  &__fan-card :deep(.card-container) {
    width: 240px;
    height: 142px;
    overflow: hidden;
    transform: scale(.54);
    transform-origin: 50% 100%;
  }

  // Only the cost/tags layer remains visible in the overview.
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

  &__position {
    display: flex;
    justify-content: center;
    gap: 3px;
    margin-top: -24px;
    color: rgba(255, 255, 255, .35);
    font: 500 11px/16px Ubuntu, sans-serif;
  }

  &__position-current {
    color: rgba(255, 255, 255, .78);
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
