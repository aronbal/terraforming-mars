<template>
  <div v-if="input !== undefined" class="mobile-play-sheet" data-test="choice-sheet">
    <div class="mobile-play-sheet-scrim" data-test="choice-sheet-scrim" @click="close"></div>
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
        <h2 class="mobile-confirm-sheet-title" data-test="choice-sheet-title">{{ $t(input.title) }}</h2>
        <!-- One row per option, each a full-width target; a tap only chooses it. -->
        <div class="mobile-choice-list" role="radiogroup">
          <button
            v-for="(option, index) in input.options"
            :key="index"
            type="button"
            role="radio"
            class="mobile-choice-row"
            :class="{'mobile-choice-row--on': index === chosen}"
            :aria-checked="index === chosen"
            data-test="choice-sheet-option"
            @click="chosen = index">
            <span class="mobile-choice-mark" aria-hidden="true">
              <MobileIcon v-if="index === chosen" name="check" :size="14" :strokeWidth="3"/>
            </span>
            <span class="mobile-choice-text">{{ $t(option.title) }}</span>
          </button>
        </div>
        <WarningsComponent v-if="warnings !== undefined" :warnings="warnings"/>
      </div>
      <div class="mobile-play-sheet-actions">
        <button
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          :disabled="submitting"
          data-test="choice-sheet-submit"
          @click="submit">{{ $t(buttonLabel) }}</button>
        <button
          v-if="input.optional === true"
          type="button"
          class="mobile-play-sheet-button"
          data-test="choice-sheet-cancel"
          @click="close">{{ $t('Cancel') }}</button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import WarningsComponent from '@/client/components/WarningsComponent.vue';
import {choiceInput} from '@/client/components/mobile/ChoiceSheet';
import {postPlayerInput} from '@/client/utils/playerInputRequest';
import {Warning} from '@/common/cards/Warning';
import {OrOptionsModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';

type DataModel = {
  /** The option the button will send. */
  chosen: number;
  submitting: boolean;
};

/*
 * The sheet a choice between plain options is made in: whose plants to remove, whether
 * to pay for something.
 *
 * The options are a stack of full-width rows, and a tap only chooses one, so a finger
 * that slips never sends anything. The one blue button at the bottom sends it -- it
 * is never between two options, where it would be in the way of the second. The
 * server's own default is chosen to start with, as on the desktop.
 */
export default defineComponent({
  name: 'MobileChoiceSheet',
  components: {
    MobileIcon,
    WarningsComponent,
  },
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
  },
  emits: ['close'],
  data(): DataModel {
    return {
      chosen: choiceInput(this.playerView.waitingFor)?.initialIdx ?? 0,
      submitting: false,
    };
  },
  computed: {
    input(): OrOptionsModel | undefined {
      return choiceInput(this.playerView.waitingFor);
    },
    /** The chosen option's own label: `Remove plants`, `Pay`, `Skip`. */
    buttonLabel(): string {
      return this.input?.options[this.chosen]?.buttonLabel ?? this.input?.buttonLabel ?? '';
    },
    warnings(): ReadonlyArray<Warning> | undefined {
      const option = this.input?.options[this.chosen];
      return option?.type === 'option' && option.warnings !== undefined && option.warnings.length > 0 ? option.warnings : undefined;
    },
  },
  watch: {
    // The question moved on under the sheet: there is nothing left to answer here.
    input: {
      handler(input: OrOptionsModel | undefined) {
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
        if (await postPlayerInput(this, this.playerView, {type: 'or', index: this.chosen, response: {type: 'option'}})) {
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
