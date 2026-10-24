<template>
  <div v-if="plan !== undefined && colony !== undefined" class="mobile-play-sheet" data-test="trade-sheet">
    <div class="mobile-play-sheet-scrim" data-test="trade-sheet-scrim" @click="cancel"></div>
    <section
      ref="panel"
      class="mobile-play-sheet-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="$t(name)"
      tabindex="-1"
      @keydown.esc="cancel">
      <span class="mobile-play-sheet-grabber" aria-hidden="true"></span>
      <div class="mobile-play-sheet-body">
        <!-- A sideways swipe on the tile moves to the next colony the turn can trade with. -->
        <div
          class="mobile-trade-sheet-tile"
          data-test="trade-sheet-tile"
          @pointerdown="onSwipeStart"
          @pointerup="onSwipeEnd"
          @pointercancel="swipeFrom = undefined">
          <MobileFitBlock :key="name">
            <Colony :colony="colony" :active="colony.isActive"/>
          </MobileFitBlock>
        </div>
        <div v-if="count > 1" class="mobile-play-sheet-dots" aria-hidden="true" data-test="trade-sheet-dots">
          <span
            v-for="dot in count"
            :key="dot"
            class="mobile-play-sheet-dot"
            :class="{'mobile-play-sheet-dot--on': dot - 1 === position}"></span>
        </div>
        <!-- What the trade is paid with, when there is more than one way. -->
        <div v-if="plan.fees.length > 1" class="mobile-segmented" role="radiogroup" data-test="trade-sheet-fees">
          <button
            v-for="(fee, index) in plan.fees"
            :key="index"
            type="button"
            role="radio"
            class="mobile-segmented-option"
            :class="{'mobile-segmented-option--on': index === feeIndex}"
            :aria-checked="index === feeIndex"
            data-test="trade-sheet-fee"
            @click="feeIndex = index">{{ $t(fee) }}</button>
        </div>
      </div>
      <div class="mobile-play-sheet-actions">
        <button
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          :disabled="submitting"
          data-test="trade-sheet-submit"
          @click="submit">{{ $t('Trade') }}</button>
        <button
          type="button"
          class="mobile-play-sheet-button"
          data-test="trade-sheet-cancel"
          @click="cancel">{{ $t('Cancel') }}</button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Colony from '@/client/components/colonies/Colony.vue';
import MobileFitBlock from '@/client/components/mobile/MobileFitBlock.vue';
import {TradePlan, tradePlan, tradeResponse} from '@/client/components/mobile/TradeSheet';
import {swipeDirection} from '@/client/components/mobile/PlaySheet';
import {postPlayerInput} from '@/client/utils/playerInputRequest';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyName} from '@/common/colonies/ColonyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';

type DataModel = {
  /** Which of the fees the trade is paid with. */
  feeIndex: number;
  submitting: boolean;
  swipeFrom: {x: number, y: number} | undefined;
};

/*
 * The sheet a colony is traded with: the colony tile held up to read what it pays out,
 * the fee to pay with, and the button.
 *
 * The server asks for both halves of a trade at once -- the fee and the tile -- so
 * this answers both in one go, the way the desktop's form does, and a swipe moves to
 * the next colony the turn can trade with.
 */
export default defineComponent({
  name: 'MobileTradeSheet',
  components: {
    Colony,
    MobileFitBlock,
  },
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    /** The colony to trade with. */
    name: {
      type: String as PropType<ColonyName>,
      required: true,
    },
    position: {
      type: Number,
      default: 0,
    },
    count: {
      type: Number,
      default: 1,
    },
  },
  emits: ['close', 'next', 'previous'],
  data(): DataModel {
    return {
      feeIndex: 0,
      submitting: false,
      swipeFrom: undefined,
    };
  },
  computed: {
    plan(): TradePlan | undefined {
      return tradePlan(this.playerView.waitingFor, this.name);
    },
    colony(): ColonyModel | undefined {
      return this.playerView.game.colonies.find((each) => each.name === this.name);
    },
  },
  watch: {
    // The turn moved on under the sheet: there is nothing left to trade with here.
    plan: {
      handler(plan: TradePlan | undefined) {
        if (plan === undefined) {
          this.$emit('close');
        }
      },
      immediate: true,
    },
  },
  mounted() {
    const panel = this.$refs.panel as HTMLElement | undefined;
    panel?.focus({preventScroll: true});
  },
  methods: {
    async submit(): Promise<void> {
      const plan = this.plan;
      if (this.submitting || plan === undefined) {
        return;
      }
      this.submitting = true;
      try {
        if (await postPlayerInput(this, this.playerView, tradeResponse(plan, this.feeIndex, this.name))) {
          this.$emit('close');
        }
      } finally {
        this.submitting = false;
      }
    },
    cancel(): void {
      this.$emit('close');
    },
    onSwipeStart(event: PointerEvent): void {
      this.swipeFrom = {x: event.clientX, y: event.clientY};
    },
    onSwipeEnd(event: PointerEvent): void {
      const from = this.swipeFrom;
      this.swipeFrom = undefined;
      if (from === undefined || this.count < 2) {
        return;
      }
      const direction = swipeDirection(from, {x: event.clientX, y: event.clientY});
      if (direction !== undefined) {
        this.$emit(direction);
      }
    },
  },
});
</script>
