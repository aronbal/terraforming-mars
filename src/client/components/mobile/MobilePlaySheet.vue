<template>
  <div v-if="entry !== undefined && model !== undefined" class="mobile-play-sheet" data-test="play-sheet">
    <div class="mobile-play-sheet-scrim" data-test="play-sheet-scrim" @click="cancel"></div>
    <section
      ref="panel"
      class="mobile-play-sheet-panel"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
      @keydown.esc="cancel">
      <span class="mobile-play-sheet-grabber" aria-hidden="true"></span>
      <div class="mobile-play-sheet-body">
        <h2 :id="titleId" class="mobile-play-sheet-title">{{ $t(model.name) }}</h2>
        <!-- A sideways swipe on the card moves to the next card the turn can use. -->
        <div
          class="mobile-play-sheet-card"
          data-test="play-sheet-card"
          @pointerdown="onSwipeStart"
          @pointerup="onSwipeEnd"
          @pointercancel="swipeFrom = undefined">
          <Card :key="card" :card="model" :cubeColor="playerView.thisPlayer.color"/>
        </div>
        <div v-if="count > 1" class="mobile-play-sheet-dots" aria-hidden="true" data-test="play-sheet-dots">
          <span
            v-for="dot in count"
            :key="dot"
            class="mobile-play-sheet-dot"
            :class="{'mobile-play-sheet-dot--on': dot - 1 === position}"></span>
        </div>
        <template v-if="entry.kind === 'play'">
          <template v-if="model.additionalProjectCosts !== undefined">
            <div v-if="model.additionalProjectCosts.aeronGenomicsResources" class="mobile-play-sheet-note"
              v-i18n="[$t(model.name), model.additionalProjectCosts.aeronGenomicsResources, 'animals', $t(CardName.AERON_GENOMICS)]">
              Playing ${0} consumes ${1} ${2} from ${3}
            </div>
            <div v-if="model.additionalProjectCosts.thinkTankResources" class="mobile-play-sheet-note"
              v-i18n="[$t(model.name), model.additionalProjectCosts.thinkTankResources, 'data', $t(CardName.THINK_TANK)]">
              Playing ${0} consumes ${1} ${2} from ${3}
            </div>
            <div v-if="model.additionalProjectCosts.redsCost" class="mobile-play-sheet-note"
              v-i18n="[$t(model.name), model.additionalProjectCosts.redsCost, $t('Reds')]">
              Playing ${0} will cost ${1} M€ more because ${2} are in power
            </div>
          </template>
          <WarningsComponent :warnings="model.warnings"/>
          <MobilePlaySheetPayment
            :key="card"
            :playerView="playerView"
            :playerinput="entry.input"
            :cardName="card"
            @change="onPaymentChange"/>
        </template>
        <WarningsComponent v-else :warnings="model.warnings"/>
      </div>
      <div class="mobile-play-sheet-actions">
        <p v-if="reason !== undefined"
          class="mobile-play-sheet-reason"
          :class="{'mobile-play-sheet-reason--problem': reason.problem}"
          data-test="play-sheet-reason">{{ reason.text }}</p>
        <button
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          :disabled="!canSubmit"
          data-test="play-sheet-submit"
          @click="submit">{{ submitLabel }}</button>
        <button
          type="button"
          class="mobile-play-sheet-button"
          data-test="play-sheet-cancel"
          @click="cancel">{{ $t('Cancel') }}</button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Card from '@/client/components/card/Card.vue';
import WarningsComponent from '@/client/components/WarningsComponent.vue';
import MobilePlaySheetPayment from '@/client/components/mobile/MobilePlaySheetPayment.vue';
import {findPlaySheetEntry, PlaySheetEntry, PlaySheetPaymentState, playSheetResponse, swipeDirection} from '@/client/components/mobile/PlaySheet';
import {CardOffer} from '@/client/utils/cardSelection';
import {postPlayerInput} from '@/client/utils/playerInputRequest';
import {CardName} from '@/common/cards/CardName';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';

type Reason = {text: string, problem: boolean};

type DataModel = {
  paymentState: PlaySheetPaymentState | undefined;
  submitting: boolean;
  titleId: string;
  /** Where a swipe on the card began, while one is under way. */
  swipeFrom: {x: number, y: number} | undefined;
};

let unique = 0;

/*
 * The sheet a card is played from, or its action used.
 *
 * The turn page has already said which card, and whether it is being played or
 * used, so this is only that card held up to read, what it costs, and the button.
 * The answer it sends is the one the desktop's menu would send for the same choice,
 * through the same request `WaitingFor` makes. Anything the server asks after that --
 * a target, a space, a payment for the action -- is the shell's next question, not
 * this sheet's, so it closes once the answer is accepted.
 */
export default defineComponent({
  name: 'MobilePlaySheet',
  components: {
    Card,
    MobilePlaySheetPayment,
    WarningsComponent,
  },
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    /** The card to play, or whose action to use. */
    card: {
      type: String as PropType<CardName>,
      required: true,
    },
    offer: {
      type: String as PropType<CardOffer>,
      required: true,
    },
    /** Where this card sits among the cards the turn can use, for the dots under it. */
    position: {
      type: Number,
      default: 0,
    },
    /** How many cards the turn can use; with more than one, a swipe moves between them. */
    count: {
      type: Number,
      default: 1,
    },
  },
  emits: ['close', 'next', 'previous'],
  data(): DataModel {
    return {
      paymentState: undefined,
      submitting: false,
      titleId: 'mobile-play-sheet-title-' + unique++,
      swipeFrom: undefined,
    };
  },
  computed: {
    CardName(): typeof CardName {
      return CardName;
    },
    entry(): PlaySheetEntry | undefined {
      return findPlaySheetEntry(this.playerView.waitingFor, this.card, this.offer);
    },
    model(): CardModel | undefined {
      return this.entry?.input.cards.find((each) => each.name === this.card);
    },
    canSubmit(): boolean {
      if (this.entry === undefined || this.submitting) {
        return false;
      }
      if (this.entry.kind === 'action') {
        return true;
      }
      return this.paymentState !== undefined && this.paymentState.problem === undefined;
    },
    submitLabel(): string {
      if (this.entry?.kind === 'action') {
        return this.$t('Use');
      }
      return this.$t({
        message: 'Play · ${0} M€',
        data: [{type: LogMessageDataType.RAW_STRING, value: String(this.paymentState?.payment.megacredits ?? 0)}],
      });
    },
    /* The one line above the button: why it cannot be pressed, or what pressing it
       will overpay by. */
    reason(): Reason | undefined {
      const state = this.paymentState;
      if (this.entry?.kind !== 'play' || state === undefined) {
        return undefined;
      }
      if (state.problem !== undefined) {
        return {text: this.$t(state.problem), problem: true};
      }
      if (state.overpaid > 0) {
        return {
          text: this.$t({
            message: 'Overpaying by ${0} M€',
            data: [{type: LogMessageDataType.RAW_STRING, value: String(state.overpaid)}],
          }),
          problem: false,
        };
      }
      return undefined;
    },
  },
  watch: {
    // A card the input no longer offers -- the turn moved on under the sheet -- has
    // nothing to show, so the sheet gives way rather than offering a stale button.
    entry: {
      handler(entry: PlaySheetEntry | undefined) {
        if (entry === undefined) {
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
    onPaymentChange(state: PlaySheetPaymentState): void {
      this.paymentState = state;
    },
    async submit(): Promise<void> {
      const entry = this.entry;
      if (!this.canSubmit || entry === undefined) {
        return;
      }
      const response = playSheetResponse(entry, this.card, this.paymentState?.payment);
      if (response === undefined) {
        return;
      }
      this.submitting = true;
      try {
        if (await postPlayerInput(this, this.playerView, response)) {
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
