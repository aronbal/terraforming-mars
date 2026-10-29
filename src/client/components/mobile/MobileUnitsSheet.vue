<template>
  <div v-if="question !== undefined" class="mobile-play-sheet" data-test="units-sheet">
    <div class="mobile-play-sheet-scrim" data-test="units-sheet-scrim" @click="close"></div>
    <section
      ref="panel"
      class="mobile-play-sheet-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="$t(question.title)"
      tabindex="-1"
      @keydown.esc="close">
      <span class="mobile-play-sheet-grabber" aria-hidden="true"></span>
      <div class="mobile-play-sheet-body">
        <h2 class="mobile-confirm-sheet-title" data-test="units-sheet-title">{{ $t(question.title) }}</h2>
        <div v-if="question.total !== undefined" class="mobile-play-sheet-eyebrow" data-test="units-sheet-total">
          {{ chosen }} / {{ question.total }}
        </div>
        <div class="mobile-play-sheet-rows">
          <div v-for="(row, index) in question.rows" :key="index" class="mobile-play-sheet-row" data-test="units-sheet-row">
            <i v-if="row.resource !== undefined" class="resource_icon mobile-play-sheet-row-icon" :class="'resource_icon--' + row.resource" aria-hidden="true"></i>
            <div class="mobile-play-sheet-row-text">
              <span class="mobile-play-sheet-row-title">{{ $t(row.label) }}</span>
              <span v-if="row.have !== undefined" class="mobile-play-sheet-row-sub">{{ $t('Production') }} {{ row.have }}</span>
            </div>
            <button
              type="button"
              class="mobile-play-sheet-step"
              :aria-label="$t('Less')"
              :disabled="values[index] <= row.min"
              data-test="units-sheet-less"
              @click="step(index, -1)">−</button>
            <span class="mobile-play-sheet-row-value" data-test="units-sheet-value">{{ values[index] }}</span>
            <button
              type="button"
              class="mobile-play-sheet-step mobile-play-sheet-step--more"
              :aria-label="$t('More')"
              :disabled="!canAdd(index)"
              data-test="units-sheet-more"
              @click="step(index, 1)">+</button>
          </div>
        </div>
      </div>
      <div class="mobile-play-sheet-actions">
        <button
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          :disabled="submitting || !complete"
          data-test="units-sheet-submit"
          @click="submit">{{ $t(question.buttonLabel) }}</button>
        <MobileSheetDismiss
          :playerView="playerView"
          :label="(question.optional || entry !== undefined) ? 'Cancel' : 'Close'"
          :asked="entry === undefined"
          data-test="units-sheet-cancel"
          @close="close"/>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import MobileSheetDismiss from '@/client/components/mobile/MobileSheetDismiss.vue';
import {UnitsQuestion, unitsQuestion} from '@/client/components/mobile/UnitsSheet';
import {postPlayerInput} from '@/client/utils/playerInputRequest';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {sum} from '@/common/utils/utils';

type DataModel = {
  /** The number on each row, in the question's order. */
  values: Array<number>;
  submitting: boolean;
};

/*
 * The sheet several numbers are chosen in at once: resources spread over cards,
 * standard resources to gain, production to give up. Each is a row with − and +, as
 * in the payment sheet. Where the rows must add up to a count, the count heads them
 * and the button waits until they do, and a + that would go past it is greyed.
 */
export default defineComponent({
  name: 'MobileUnitsSheet',
  components: {
    MobileSheetDismiss,
  },
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    /** The option of the choice this answers, or undefined for the question itself. */
    entry: {
      type: Number,
      default: undefined,
    },
  },
  emits: ['close'],
  data(): DataModel {
    const question = unitsQuestion(this.playerView.waitingFor, this.entry);
    return {
      values: question?.rows.map((row) => row.start) ?? [],
      submitting: false,
    };
  },
  computed: {
    question(): UnitsQuestion | undefined {
      return unitsQuestion(this.playerView.waitingFor, this.entry);
    },
    chosen(): number {
      return sum(this.values);
    },
    complete(): boolean {
      const total = this.question?.total;
      return total === undefined || this.chosen === total;
    },
  },
  watch: {
    // The question moved on under the sheet: there is nothing left to answer here.
    question: {
      handler(question: UnitsQuestion | undefined) {
        if (question === undefined) {
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
    canAdd(index: number): boolean {
      const row = this.question?.rows[index];
      const total = this.question?.total;
      if (row === undefined || this.values[index] >= row.max) {
        return false;
      }
      return total === undefined || this.chosen < total;
    },
    step(index: number, by: number): void {
      if (by > 0 && !this.canAdd(index)) {
        return;
      }
      const row = this.question?.rows[index];
      if (row !== undefined) {
        this.values[index] = Math.min(row.max, Math.max(row.min, this.values[index] + by));
      }
    },
    async submit(): Promise<void> {
      if (this.submitting || this.question === undefined || !this.complete) {
        return;
      }
      this.submitting = true;
      try {
        if (await postPlayerInput(this, this.playerView, this.question.respond(this.values))) {
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
