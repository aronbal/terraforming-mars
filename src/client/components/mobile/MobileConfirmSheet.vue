<template>
  <div v-if="entry !== undefined" class="mobile-play-sheet" data-test="confirm-sheet">
    <div class="mobile-play-sheet-scrim" data-test="confirm-sheet-scrim" @click="cancel"></div>
    <section
      ref="panel"
      class="mobile-play-sheet-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="$t(entry.input.title)"
      tabindex="-1"
      @keydown.esc="cancel">
      <span class="mobile-play-sheet-grabber" aria-hidden="true"></span>
      <div class="mobile-play-sheet-body mobile-confirm-sheet-body">
        <span class="mobile-confirm-sheet-glyph" :class="'mobile-glyph--' + tone" aria-hidden="true">
          <MobileIcon :name="icon" :size="34"/>
        </span>
        <h2 class="mobile-confirm-sheet-title" data-test="confirm-sheet-title">{{ $t(entry.input.title) }}</h2>
        <WarningsComponent :warnings="warnings"/>
      </div>
      <div class="mobile-play-sheet-actions">
        <button
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          :disabled="submitting"
          data-test="confirm-sheet-submit"
          @click="submit">{{ $t(entry.input.buttonLabel) }}</button>
        <button
          type="button"
          class="mobile-play-sheet-button"
          data-test="confirm-sheet-cancel"
          @click="cancel">{{ $t('Cancel') }}</button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import WarningsComponent from '@/client/components/WarningsComponent.vue';
import {ActionEntry, entryFor, isActionMenu} from '@/client/components/mobile/MobileActionMenu';
import {MobileIconName} from '@/client/components/mobile/MobileIcons';
import {ActionAnnotation} from '@/common/input/Annotation';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Warning} from '@/common/cards/Warning';
import {postPlayerInput} from '@/client/utils/playerInputRequest';

type DataModel = {
  submitting: boolean;
};

/*
 * The sheet a one-step action is confirmed from: converting heat, for one.
 *
 * There is nothing to choose, so it is the play sheet with the card taken out -- what
 * the action does, in the server's words, any warning it carries, and its button.
 * The answer is the menu entry's own, exactly as the desktop would send it.
 */
export default defineComponent({
  name: 'MobileConfirmSheet',
  components: {
    MobileIcon,
    WarningsComponent,
  },
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    /** The menu entry to confirm, which must be a plain option. */
    annotation: {
      type: String as PropType<ActionAnnotation>,
      required: true,
    },
    icon: {
      type: String as PropType<MobileIconName>,
      required: true,
    },
    tone: {
      type: String,
      default: 'accent',
    },
  },
  emits: ['close'],
  data(): DataModel {
    return {
      submitting: false,
    };
  },
  computed: {
    entry(): ActionEntry | undefined {
      const waitingFor = this.playerView.waitingFor;
      const entry = entryFor(isActionMenu(waitingFor) ? waitingFor : undefined, this.annotation);
      return entry?.input.type === 'option' ? entry : undefined;
    },
    warnings(): ReadonlyArray<Warning> | undefined {
      const input = this.entry?.input;
      return input?.type === 'option' ? input.warnings : undefined;
    },
  },
  watch: {
    // The turn moved on under the sheet: there is nothing left to confirm.
    entry: {
      handler(entry: ActionEntry | undefined) {
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
    async submit(): Promise<void> {
      const entry = this.entry;
      if (this.submitting || entry === undefined) {
        return;
      }
      this.submitting = true;
      try {
        if (await postPlayerInput(this, this.playerView, {type: 'or', index: entry.index, response: {type: 'option'}})) {
          this.$emit('close');
        }
      } finally {
        this.submitting = false;
      }
    },
    cancel(): void {
      this.$emit('close');
    },
  },
});
</script>
