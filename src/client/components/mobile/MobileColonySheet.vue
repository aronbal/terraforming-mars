<template>
  <div v-if="input !== undefined" class="mobile-play-sheet" data-test="colony-sheet">
    <div class="mobile-play-sheet-scrim" data-test="colony-sheet-scrim" @click="close"></div>
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
        <h2 class="mobile-confirm-sheet-title" data-test="colony-sheet-title">{{ $t(input.title) }}</h2>
        <!-- Each colony as its tile, the whole tile the target; a tap only chooses it. -->
        <div class="mobile-colony-options" role="radiogroup">
          <button
            v-for="colony in input.coloniesModel"
            :key="colony.name"
            type="button"
            role="radio"
            class="mobile-colony-option"
            :class="{'mobile-colony-option--on': colony.name === chosen}"
            :aria-checked="colony.name === chosen"
            :aria-label="$t(colony.name)"
            data-test="colony-sheet-option"
            @click="chosen = colony.name">
            <MobileFitBlock>
              <Colony :colony="colony" :active="colony.isActive"/>
            </MobileFitBlock>
            <span v-if="colony.name === chosen" class="mobile-colony-option-mark" aria-hidden="true">
              <MobileIcon name="check" :size="14" :strokeWidth="3"/>
            </span>
          </button>
        </div>
      </div>
      <div class="mobile-play-sheet-actions">
        <button
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          :disabled="submitting || chosen === undefined"
          data-test="colony-sheet-submit"
          @click="submit">{{ $t(input.buttonLabel) }}</button>
        <button
          v-if="input.optional || entry !== undefined"
          type="button"
          class="mobile-play-sheet-button"
          data-test="colony-sheet-cancel"
          @click="close">{{ $t('Cancel') }}</button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Colony from '@/client/components/colonies/Colony.vue';
import MobileFitBlock from '@/client/components/mobile/MobileFitBlock.vue';
import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import {colonyInput, entryResponse} from '@/client/components/mobile/PickSheet';
import {postPlayerInput} from '@/client/utils/playerInputRequest';
import {ColonyName} from '@/common/colonies/ColonyName';
import {SelectColonyModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';

type DataModel = {
  /** The colony the button will build on, or otherwise act on. */
  chosen: ColonyName | undefined;
  submitting: boolean;
};

/*
 * The sheet a colony is chosen in: where to build one, or which colony a card moves
 * or adds to. Each colony is its own tile, scaled to the phone's width, so its bonus
 * and its track are read before choosing. A tap chooses; the blue button sends.
 */
export default defineComponent({
  name: 'MobileColonySheet',
  components: {
    Colony,
    MobileFitBlock,
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
    const colonies = colonyInput(this.playerView.waitingFor, this.entry)?.coloniesModel ?? [];
    return {
      chosen: colonies.length === 1 ? colonies[0].name : undefined,
      submitting: false,
    };
  },
  computed: {
    input(): SelectColonyModel | undefined {
      return colonyInput(this.playerView.waitingFor, this.entry);
    },
  },
  watch: {
    // The question moved on under the sheet: there is nothing left to answer here.
    input: {
      handler(input: SelectColonyModel | undefined) {
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
      if (this.submitting || this.input === undefined || this.chosen === undefined) {
        return;
      }
      this.submitting = true;
      try {
        const response = entryResponse(this.entry, {type: 'colony', colonyName: this.chosen});
        if (await postPlayerInput(this, this.playerView, response)) {
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
