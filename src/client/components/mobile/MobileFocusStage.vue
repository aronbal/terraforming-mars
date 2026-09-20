<template>
  <div v-if="card !== undefined || milestone !== undefined || award !== undefined"
    ref="stage"
    class="mobile-focus-stage"
    data-test="focus-stage"
    @click="$emit('dismiss')">
    <div ref="holder" class="mobile-focus-holder" :style="{zoom: String(scale)}" @click.stop>
      <Card v-if="card !== undefined" class="cardbox" :card="card" :cubeColor="playerView.thisPlayer.color"/>
      <div v-else-if="milestone !== undefined" class="milestones">
        <Milestone :milestone="milestone" :showDescription="true"/>
      </div>
      <div v-else-if="award !== undefined" class="awards">
        <Award :award="award" :showDescription="true"/>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Award from '@/client/components/Award.vue';
import Card from '@/client/components/card/Card.vue';
import Milestone from '@/client/components/Milestone.vue';
import {CardModel} from '@/common/models/CardModel';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {FundedAwardModel} from '@/common/models/FundedAwardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {pickedCard} from '@/client/utils/cardSelection';
import {pickedBoardThing} from '@/client/utils/boardSelection';
import {pickFocused} from '@/client/utils/mobileFocus';

/** Below this the printed numbers on a card stop being worth holding up. */
/** The stage's own padding, which the held-up thing may not eat into. */
const STAGE_PADDING = 28;

/*
 * The share of the stage that is actually free.
 *
 * The panel is raised to its half stop for a staged pick, so it owns the lower half
 * and the stage's own height says nothing about what can be seen. Measuring against
 * the whole stage is what left a card's bottom edge -- where its effect is printed
 * -- under the panel.
 */
const STAGE_FRACTION = 0.5;
const MIN_SCALE = 0.5;
const SCALE_EPSILON = 0.005;

type DataModel = {
  scale: number;
  resizeObserver: ResizeObserver | undefined;
};

/*
 * The thing the player is acting on, held up over a faded board.
 *
 * A card is read at this size before it is played, and a milestone is worth reading
 * for what it asks and what it is worth. Keeping it here, rather than repeating it
 * inside the panel, leaves the panel as what it should be: the price and the button.
 *
 * Nothing is shown unless the shell says the panel is focused on a pick, so this is
 * dark on the Act tab, where the menu draws its own.
 */
export default defineComponent({
  name: 'MobileFocusStage',
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
  },
  emits: ['dismiss'],
  components: {
    Award,
    Card,
    Milestone,
  },
  data(): DataModel {
    return {
      scale: 1,
      resizeObserver: undefined,
    };
  },
  computed: {
    card(): CardModel | undefined {
      const name = pickFocused.value ? pickedCard.value : undefined;
      if (name === undefined) {
        return undefined;
      }
      const playerView = this.playerView;
      const everywhere = [
        ...playerView.cardsInHand,
        ...playerView.preludeCardsInHand,
        ...playerView.ceoCardsInHand,
        ...playerView.draftedCards,
        ...playerView.thisPlayer.tableau,
      ];
      return everywhere.find((each) => each.name === name);
    },
    pick(): {kind: string, name: string} | undefined {
      return pickFocused.value ? pickedBoardThing.value : undefined;
    },
    milestone(): ClaimedMilestoneModel | undefined {
      const pick = this.pick;
      return pick?.kind === 'milestone' ?
        this.playerView.game.milestones.find((each) => each.name === pick.name) :
        undefined;
    },
    award(): FundedAwardModel | undefined {
      const pick = this.pick;
      return pick?.kind === 'award' ?
        this.playerView.game.awards.find((each) => each.name === pick.name) :
        undefined;
    },
    /** What is on the stage, so a change of subject is re-measured. */
    subject(): string | undefined {
      return this.card?.name ?? this.milestone?.name ?? this.award?.name;
    },
  },
  watch: {
    subject() {
      this.$nextTick(() => this.fit());
    },
  },
  methods: {
    /*
     * Scales what is held up to the room above the panel.
     *
     * A project card is 306px tall unscaled and the panel takes the lower half of
     * the screen, so on most phones it would otherwise be cut off at the bottom --
     * which is the one part of a card that carries its effect.
     */
    fit(): void {
      const stage = this.$refs.stage as HTMLElement | null | undefined;
      const holder = this.$refs.holder as HTMLElement | null | undefined;
      if (stage === null || stage === undefined || holder === null || holder === undefined) {
        return;
      }
      const available = stage.clientHeight * STAGE_FRACTION - STAGE_PADDING;
      const natural = holder.getBoundingClientRect().height / this.scale;
      if (available <= 0 || natural <= 0) {
        return;
      }
      const scale = Math.min(1, Math.max(MIN_SCALE, available / natural));
      if (Math.abs(scale - this.scale) > SCALE_EPSILON) {
        this.scale = scale;
      }
    },
  },
  mounted() {
    this.fit();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    // The room above the panel changes as the panel is dragged, so this re-measures.
    this.resizeObserver = new ResizeObserver(() => this.fit());
    const stage = this.$refs.stage as HTMLElement | null | undefined;
    if (stage !== null && stage !== undefined) {
      this.resizeObserver.observe(stage);
    }
  },
  unmounted() {
    this.resizeObserver?.disconnect();
  },
});
</script>
