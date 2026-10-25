<template>
  <div v-if="input !== undefined" class="mobile-play-sheet" data-test="amount-sheet">
    <div class="mobile-play-sheet-scrim" data-test="amount-sheet-scrim" @click="close"></div>
    <section
      ref="panel"
      class="mobile-play-sheet-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="$t(input.title)"
      tabindex="-1"
      @keydown.esc="close">
      <span class="mobile-play-sheet-grabber" aria-hidden="true"></span>
      <div class="mobile-play-sheet-body mobile-amount-sheet-body">
        <h2 class="mobile-confirm-sheet-title" data-test="amount-sheet-title">{{ $t(input.title) }}</h2>
        <div class="mobile-amount-sheet-dial">
          <button
            type="button"
            class="mobile-play-sheet-step"
            :aria-label="$t('Less')"
            :disabled="amount <= input.min"
            data-test="amount-sheet-less"
            @click="amount--">−</button>
          <span class="mobile-amount-sheet-value" data-test="amount-sheet-value">{{ amount }}</span>
          <button
            type="button"
            class="mobile-play-sheet-step mobile-play-sheet-step--more"
            :aria-label="$t('More')"
            :disabled="amount >= input.max"
            data-test="amount-sheet-more"
            @click="amount++">+</button>
        </div>
        <!-- The ends of the range, a tap away: most answers are one or the other. -->
        <div v-if="input.max > input.min" class="mobile-segmented mobile-amount-sheet-ends" data-test="amount-sheet-ends">
          <button
            type="button"
            class="mobile-segmented-option"
            :class="{'mobile-segmented-option--on': amount === input.min}"
            data-test="amount-sheet-min"
            @click="amount = input.min">{{ $t('Min') }} {{ input.min }}</button>
          <button
            type="button"
            class="mobile-segmented-option"
            :class="{'mobile-segmented-option--on': amount === input.max}"
            data-test="amount-sheet-max"
            @click="amount = input.max">{{ $t('Max') }} {{ input.max }}</button>
        </div>
      </div>
      <div class="mobile-play-sheet-actions">
        <button
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          :disabled="submitting"
          data-test="amount-sheet-submit"
          @click="submit">{{ $t(input.buttonLabel) }} · {{ amount }}</button>
        <button
          v-if="input.optional === true || entry !== undefined"
          type="button"
          class="mobile-play-sheet-button"
          data-test="amount-sheet-cancel"
          @click="close">{{ $t('Cancel') }}</button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import {amountInput, amountResponse} from '@/client/components/mobile/AmountSheet';
import {postPlayerInput} from '@/client/utils/playerInputRequest';
import {SelectAmountModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';

type DataModel = {
  amount: number;
  submitting: boolean;
};

/*
 * The sheet a number is chosen in: how many steps of heat production to give up, how
 * many resources to spend.
 *
 * The number is the one thing on it, large, with a − and a + either side and the two
 * ends of the range a tap away. The button says what it will send. A question that
 * must be answered is only put down with the scrim; the turn page brings it back.
 */
export default defineComponent({
  name: 'MobileAmountSheet',
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    /** The option of the choice the number is asked for, or undefined for the question itself. */
    entry: {
      type: Number,
      default: undefined,
    },
  },
  emits: ['close'],
  data(): DataModel {
    const input = amountInput(this.playerView.waitingFor, this.entry);
    return {
      amount: input === undefined ? 0 : (input.maxByDefault ? input.max : input.min),
      submitting: false,
    };
  },
  computed: {
    input(): SelectAmountModel | undefined {
      return amountInput(this.playerView.waitingFor, this.entry);
    },
  },
  watch: {
    // The question moved on under the sheet: there is nothing left to answer here.
    input: {
      handler(input: SelectAmountModel | undefined) {
        if (input === undefined) {
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
      if (this.submitting || this.input === undefined) {
        return;
      }
      this.submitting = true;
      try {
        if (await postPlayerInput(this, this.playerView, amountResponse(this.entry, this.amount))) {
          this.$emit('close');
        }
      } finally {
        this.submitting = false;
      }
    },
    close(): void {
      this.$emit('close');
    },
  },
});
</script>
