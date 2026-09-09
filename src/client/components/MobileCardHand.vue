<template>
  <section class="mobile-card-hand" aria-label="Cards in hand">
    <div class="mobile-card-hand__fan" :style="fanStyle">
      <button
        v-for="(card, index) in cards"
        :key="`fan-${card.name}-${index}`"
        class="mobile-card-hand__fan-card"
        :class="{ 'is-focused': index === selectedIndex }"
        :style="fanCardStyle(index)"
        type="button"
        :aria-label="`Select ${card.name}`"
        @click="selectCard(index)"
      >
        <Card :card="card" />
      </button>
    </div>

    <div class="mobile-card-hand__focus-label">
      <span>{{ selectedIndex + 1 }} / {{ cards.length }}</span>
      <span class="mobile-card-hand__hint">Swipe to browse</span>
    </div>

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
    fanStyle(): Record<string, string> {
      const count = this.cards.length;
      return {'--fan-count': count.toString()};
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
    fanCardStyle(index: number): Record<string, string> {
      const count = this.cards.length;
      const center = (count - 1) / 2;
      const offset = index - center;
      const rotation = Math.max(-20, Math.min(20, offset * 5));
      const lift = Math.abs(offset) * 4;
      const focusLift = index === this.selectedIndex ? -12 : 0;
      return {
        '--fan-index': index.toString(),
        '--fan-offset': offset.toString(),
        transform: `translateX(calc(${offset} * clamp(38px, 10vw, 58px))) translateY(${lift + focusLift}px) rotate(${rotation}deg)`,
        zIndex: index === this.selectedIndex ? '20' : String(10 - Math.abs(Math.round(offset))),
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

  &__fan {
    position: relative;
    height: 148px;
    margin: 0 -12px 4px;
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
      filter: brightness(.78) saturate(.88);
    }
  }

  // The fan is an overview, not a second readable card. Keep the useful
  // information: title, price and tags. The full text lives in the focus card.
  &__fan-card :deep(.card-container) {
    width: 240px;
    height: 142px;
    overflow: hidden;
    transform: translateX(-50%) scale(.54);
    transform-origin: 50% 100%;
  }

  &__fan-card :deep(.card-content) {
    visibility: hidden;
  }

  &__fan-card :deep(.card-expansion),
  &__fan-card :deep(.card-points),
  &__fan-card :deep(.card-resources-counter),
  &__fan-card :deep(.card-extra-content) {
    opacity: .35;
  }

  &__focus-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin: 0 0 8px;
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
    transition: transform 180ms ease;
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
    opacity: .55;
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
    &__carousel {
      min-height: 385px;
    }

    &__focus-card {
      max-width: 82vw;
    }

    &__focus-card :deep(.card-container) {
      transform: scale(1.02);
    }

    &__peek {
      opacity: .35;
    }
  }
}
</style>
