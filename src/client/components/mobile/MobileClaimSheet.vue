<template>
  <div v-if="optionIndex !== undefined" class="mobile-play-sheet" data-test="claim-sheet">
    <div class="mobile-play-sheet-scrim" data-test="claim-sheet-scrim" @click="cancel"></div>
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
        <!-- A sideways swipe on the tile moves to the next one the turn can claim or fund. -->
        <div
          class="mobile-claim-sheet-tile"
          data-test="claim-sheet-tile"
          @pointerdown="onSwipeStart"
          @pointerup="onSwipeEnd"
          @pointercancel="swipeFrom = undefined">
          <div v-if="milestone !== undefined" :key="name" class="milestones">
            <Milestone :milestone="milestone" :showDescription="true"/>
          </div>
          <div v-else-if="award !== undefined" :key="name" class="awards">
            <Award :award="award" :showDescription="true"/>
          </div>
        </div>
        <div v-if="count > 1" class="mobile-play-sheet-dots" aria-hidden="true" data-test="claim-sheet-dots">
          <span
            v-for="dot in count"
            :key="dot"
            class="mobile-play-sheet-dot"
            :class="{'mobile-play-sheet-dot--on': dot - 1 === position}"></span>
        </div>
      </div>
      <div class="mobile-play-sheet-actions">
        <button
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          :disabled="submitting"
          data-test="claim-sheet-submit"
          @click="submit">{{ submitLabel }}</button>
        <button
          type="button"
          class="mobile-play-sheet-button"
          data-test="claim-sheet-cancel"
          @click="cancel">{{ $t('Cancel') }}</button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Award from '@/client/components/Award.vue';
import Milestone from '@/client/components/Milestone.vue';
import {ActionEntry, entryFor, isActionMenu} from '@/client/components/mobile/MobileActionMenu';
import {swipeDirection} from '@/client/components/mobile/PlaySheet';
import {postPlayerInput} from '@/client/utils/playerInputRequest';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {FundedAwardModel} from '@/common/models/FundedAwardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';

type DataModel = {
  submitting: boolean;
  swipeFrom: {x: number, y: number} | undefined;
};

/*
 * The sheet a milestone is claimed from, or an award funded: the play sheet's
 * counterpart for what is printed on the board.
 *
 * The tile is held up to read, with the one button that claims or funds it, and a
 * swipe moves between the others the turn offers. The answer is the menu entry's own
 * option, exactly as the desktop would send it; the payment the server asks for
 * after that arrives in the action sheet like any other question.
 */
export default defineComponent({
  name: 'MobileClaimSheet',
  components: {
    Award,
    Milestone,
  },
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    kind: {
      type: String as PropType<'milestone' | 'award'>,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    /** Where this one sits among those the turn offers, for the dots under it. */
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
      submitting: false,
      swipeFrom: undefined,
    };
  },
  computed: {
    entry(): ActionEntry | undefined {
      const waitingFor = this.playerView.waitingFor;
      return entryFor(isActionMenu(waitingFor) ? waitingFor : undefined, this.kind);
    },
    /** The option in the entry that names this tile. */
    optionIndex(): number | undefined {
      const input = this.entry?.input;
      if (input?.type !== 'or') {
        return undefined;
      }
      const index = input.options.findIndex((option) => option.title === this.name);
      return index < 0 ? undefined : index;
    },
    milestone(): ClaimedMilestoneModel | undefined {
      return this.kind === 'milestone' ? this.playerView.game.milestones.find((each) => each.name === this.name) : undefined;
    },
    award(): FundedAwardModel | undefined {
      return this.kind === 'award' ? this.playerView.game.awards.find((each) => each.name === this.name) : undefined;
    },
    /* An award's price is in the entry's own title, as the server worked it out. A
       milestone's is not sent, so its button names only what it does. */
    submitLabel(): string {
      if (this.kind === 'milestone') {
        return this.$t('Claim');
      }
      const title = this.entry?.input.title;
      const price = typeof title === 'string' ? undefined : title?.data[0]?.value;
      if (price === undefined) {
        return this.$t('Fund');
      }
      return this.$t({message: 'Fund · ${0} M€', data: [{type: LogMessageDataType.RAW_STRING, value: String(price)}]});
    },
  },
  watch: {
    // The turn moved on under the sheet: there is nothing left to claim here.
    optionIndex: {
      handler(index: number | undefined) {
        if (index === undefined) {
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
      const index = this.optionIndex;
      if (this.submitting || entry === undefined || index === undefined) {
        return;
      }
      this.submitting = true;
      try {
        const response = {type: 'or' as const, index: entry.index, response: {type: 'or' as const, index, response: {type: 'option' as const}}};
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
