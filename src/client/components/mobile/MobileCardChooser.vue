<template>
  <div v-if="input !== undefined" class="mobile-play-sheet" data-test="card-chooser">
    <!-- Light, and not blurred: the tags in the header are what a pick is weighed against. -->
    <div class="mobile-play-sheet-scrim mobile-play-sheet-scrim--clear" data-test="card-chooser-scrim" @click="close"></div>
    <section
      ref="panel"
      class="mobile-play-sheet-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="$t(input.title)"
      tabindex="-1"
      @keydown.esc="close">
      <span class="mobile-play-sheet-grabber" aria-hidden="true"></span>
      <div class="mobile-play-sheet-body">
        <h2 class="mobile-play-sheet-title mobile-card-chooser-title" data-test="card-chooser-title">{{ $t(input.title) }}</h2>
        <!-- Every card at once, side by side to compare; a tap chooses one or puts it back. -->
        <div class="mobile-card-grid">
          <button
            v-for="card in cards"
            :key="card.name"
            type="button"
            class="mobile-card-grid-item"
            :class="{'mobile-card-grid-item--chosen': isChosen(card.name)}"
            :disabled="card.isDisabled === true"
            :aria-pressed="isChosen(card.name)"
            data-test="card-chooser-card"
            @click="toggle(card.name)">
            <Card :card="card" :cubeColor="playerView.thisPlayer.color"/>
            <span v-if="isChosen(card.name)" class="mobile-card-chooser-check" data-test="card-chooser-check">
              <MobileIcon name="check" :size="18" :strokeWidth="3"/>
            </span>
          </button>
        </div>
      </div>
      <!-- One card offered, take it or leave it: two buttons that each say what they
           do, so leaving it is never the one button there is before a card is tapped. -->
      <div v-if="yesOrNo" class="mobile-play-sheet-actions">
        <button
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          :disabled="submitting || cards[0].isDisabled === true"
          data-test="card-chooser-take"
          @click="submit([cards[0].name])">{{ $t(input.buttonLabel) }}</button>
        <button
          type="button"
          class="mobile-play-sheet-button"
          :disabled="submitting"
          data-test="card-chooser-leave"
          @click="submit([])">{{ $t('Skip') }}</button>
      </div>
      <div v-else class="mobile-play-sheet-actions">
        <button
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          :disabled="!canSubmit"
          data-test="card-chooser-submit"
          @click="submit()">{{ submitLabel }}</button>
        <button
          v-if="cancellable"
          type="button"
          class="mobile-play-sheet-button"
          data-test="card-chooser-cancel"
          @click="close">{{ $t('Cancel') }}</button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Card from '@/client/components/card/Card.vue';
import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import {chooserInput, chooserPrice, chooserResponse} from '@/client/components/mobile/CardChooser';
import {postPlayerInput} from '@/client/utils/playerInputRequest';
import {CardName} from '@/common/cards/CardName';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {CardModel} from '@/common/models/CardModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';

type DataModel = {
  /** The cards chosen so far, in the order they were chosen. */
  chosen: Array<CardName>;
  submitting: boolean;
};

/*
 * The sheet cards are chosen from: the draft, the cards to buy, the patents to sell,
 * and any other question that is a pick among cards.
 *
 * Every card is on screen at once, two abreast, so they can be weighed against each
 * other and against the tags in the header. A tap chooses a card -- for a question
 * that takes one, it replaces the last choice -- and a second tap puts it back. The
 * one button then says what the pick comes to: how many and, when cards are bought
 * or sold, for how much.
 */
export default defineComponent({
  name: 'MobileCardChooser',
  components: {
    Card,
    MobileIcon,
  },
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    /** The menu entry the cards are chosen for, or undefined for the waiting question itself. */
    entry: {
      type: Number as PropType<number | undefined>,
      default: undefined,
    },
  },
  emits: ['close'],
  data(): DataModel {
    return {
      chosen: [],
      submitting: false,
    };
  },
  computed: {
    input(): SelectCardModel | undefined {
      return chooserInput(this.playerView.waitingFor, this.entry);
    },
    cards(): ReadonlyArray<CardModel> {
      return this.input?.cards ?? [];
    },
    /** One card that may be taken or left: Board of Directors' prelude, say. */
    yesOrNo(): boolean {
      const input = this.input;
      return input !== undefined && input.cards.length === 1 && input.min === 0 && input.max === 1;
    },
    /** A question that takes one card, where a tap moves the choice rather than adding to it. */
    single(): boolean {
      return this.input?.max === 1;
    },
    canSubmit(): boolean {
      const input = this.input;
      if (input === undefined || this.submitting) {
        return false;
      }
      return this.chosen.length >= input.min && this.chosen.length <= input.max;
    },
    /* Something to put back for a question that need not be answered now. One that
       must be answered is put down with the scrim, and the turn page brings it back. */
    cancellable(): boolean {
      return this.entry !== undefined || this.input?.optional === true;
    },
    submitLabel(): string {
      const input = this.input;
      if (input === undefined) {
        return '';
      }
      const label = this.$t(input.buttonLabel);
      const count = this.chosen.length;
      if (count === 0) {
        // Nothing chosen is an answer only where none is allowed: buying no cards.
        return input.min === 0 ? this.$t('Skip') : label;
      }
      const price = chooserPrice(input, count, this.playerView.thisPlayer.cardCost);
      if (price === undefined) {
        return this.single ? label : label + ' · ' + count;
      }
      return this.$t({
        message: price < 0 ? '${0} ${1} · +${2} M€' : '${0} ${1} · ${2} M€',
        data: [
          {type: LogMessageDataType.RAW_STRING, value: label},
          {type: LogMessageDataType.RAW_STRING, value: String(count)},
          {type: LogMessageDataType.RAW_STRING, value: String(Math.abs(price))},
        ],
      });
    },
  },
  watch: {
    // The question moved on under the sheet: there is nothing left to choose here.
    input: {
      handler(input: SelectCardModel | undefined) {
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
    isChosen(name: CardName): boolean {
      return this.chosen.includes(name);
    },
    toggle(name: CardName): void {
      const card = this.cards.find((each) => each.name === name);
      if (card === undefined || card.isDisabled === true) {
        return;
      }
      if (this.isChosen(name)) {
        this.chosen = this.chosen.filter((each) => each !== name);
      } else if (this.single) {
        this.chosen = [name];
      } else if (this.chosen.length < (this.input?.max ?? 0)) {
        this.chosen = [...this.chosen, name];
      }
    },
    /** Sends `cards`, or the cards chosen so far. */
    async submit(cards?: ReadonlyArray<CardName>): Promise<void> {
      if (cards === undefined && !this.canSubmit) {
        return;
      }
      if (this.submitting) {
        return;
      }
      this.submitting = true;
      try {
        if (await postPlayerInput(this, this.playerView, chooserResponse(this.entry, cards ?? this.chosen))) {
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
