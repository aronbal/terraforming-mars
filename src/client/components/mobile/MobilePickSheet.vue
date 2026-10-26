<template>
  <div v-if="question !== undefined" class="mobile-play-sheet" data-test="pick-sheet">
    <div class="mobile-play-sheet-scrim" data-test="pick-sheet-scrim" @click="close"></div>
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
        <h2 class="mobile-confirm-sheet-title" data-test="pick-sheet-title">{{ $t(question.title) }}</h2>
        <!-- One row per answer; a tap only chooses it. -->
        <div class="mobile-choice-list" role="radiogroup">
          <button
            v-for="(row, index) in question.rows"
            :key="index"
            type="button"
            role="radio"
            class="mobile-choice-row"
            :class="{'mobile-choice-row--on': index === chosen}"
            :aria-checked="index === chosen"
            data-test="pick-sheet-option"
            @click="chosen = index">
            <span class="mobile-choice-mark" aria-hidden="true">
              <MobileIcon v-if="index === chosen" name="check" :size="14" :strokeWidth="3"/>
            </span>
            <span class="mobile-choice-text mobile-choice-player">
              <i v-if="row.resource !== undefined" class="resource_icon mobile-pick-icon" :class="'resource_icon--' + row.resource" aria-hidden="true"></i>
              <i v-else-if="row.color !== undefined" class="mobile-choice-standing-dot" :class="dotClass(row.color)"></i>
              {{ $t(row.label) }}
            </span>
          </button>
        </div>
      </div>
      <div class="mobile-play-sheet-actions">
        <button
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          :disabled="submitting || chosen === undefined"
          data-test="pick-sheet-submit"
          @click="submit">{{ $t(question.buttonLabel) }}</button>
        <button
          type="button"
          class="mobile-play-sheet-button"
          data-test="pick-sheet-cancel"
          @click="close">{{ $t((question.optional || entry !== undefined) ? 'Cancel' : 'Close') }}</button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import {PickQuestion, pickQuestion} from '@/client/components/mobile/PickSheet';
import {postPlayerInput} from '@/client/utils/playerInputRequest';
import {ColorWithNeutral} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';

type DataModel = {
  /** The row the button will send. */
  chosen: number | undefined;
  submitting: boolean;
};

/*
 * The sheet one thing is picked from a short list in: a standard resource to gain,
 * whose delegate to remove. As in the choice sheet, a tap on a row only chooses it,
 * and the blue button sends it.
 */
export default defineComponent({
  name: 'MobilePickSheet',
  components: {
    MobileIcon,
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
    const rows = pickQuestion(this.playerView.waitingFor, this.playerView.players, this.entry)?.rows ?? [];
    return {
      // One row to choose from is no choice at all.
      chosen: rows.length === 1 ? 0 : undefined,
      submitting: false,
    };
  },
  computed: {
    question(): PickQuestion | undefined {
      return pickQuestion(this.playerView.waitingFor, this.playerView.players, this.entry);
    },
  },
  watch: {
    // The question moved on under the sheet: there is nothing left to answer here.
    question: {
      handler(question: PickQuestion | undefined) {
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
    dotClass(color: ColorWithNeutral): string {
      // The neutral delegates are drawn grey, as the board draws them.
      return color === 'NEUTRAL' ? 'mobile-choice-standing-dot--unknown' : 'player_bg_color_' + color;
    },
    async submit(): Promise<void> {
      if (this.submitting || this.question === undefined || this.chosen === undefined) {
        return;
      }
      this.submitting = true;
      try {
        if (await postPlayerInput(this, this.playerView, this.question.respond(this.chosen))) {
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
