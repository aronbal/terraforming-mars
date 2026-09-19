<template>
  <div
    ref="panel"
    class="mobile-action-panel"
    :class="mode === 'tab' ? 'mobile-pane mobile-pane--actions' : 'mobile-sheet'"
    :style="mode === 'sheet' ? sheetStyle : undefined"
    :role="mode === 'sheet' ? 'dialog' : 'tabpanel'"
    :aria-label="$t('Your actions')"
    :data-drag="dragging ? '1' : '0'"
    :data-snap="snap"
    :data-mode="mode"
    data-test="action-panel">
    <!-- Only a sheet has a head: as a tab the panel is already the whole screen, and
         the tab bar says where you are. -->
    <div v-if="mode === 'sheet'" ref="head" class="mobile-sheet-head" data-test="sheet-head" @click="onHeadClick">
      <span class="mobile-sheet-grip"></span>
      <div class="mobile-sheet-title-row">
        <h2 class="mobile-sheet-title mobile-sheet-title--waiting">{{ title }}</h2>
        <span class="mobile-sheet-hint" v-i18n>Drag to resize</span>
      </div>
    </div>
    <div class="mobile-panel-body mobile-card-scaler" :style="cardScaleStyle" data-test="sheet-body">
      <WaitingFor
        v-if="playerView.game.phase !== 'end'"
        :playerView="playerView"
        :waitingfor="playerView.waitingFor"/>
      <div v-else v-i18n>This game is over.</div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import WaitingFor from '@/client/components/WaitingFor.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SheetSnap, SHEET_PEEK_PX, SHEET_SNAPS} from '@/client/components/mobile/MobileTab';

/** How much of the sheet the `half` and `full` stops leave off screen. */
const HALF_FRACTION = 0.5;
const FULL_FRACTION = 0.04;

type DataModel = {
  dragging: boolean;
  dragStartY: number;
  dragStartOffset: number;
  dragOffset: number;
  /** The sheet's height, measured on open so the stops can be computed in pixels. */
  height: number;
  /** The head the drag listeners are on, so they come off the same element. */
  boundHead: HTMLElement | undefined;
};

export default defineComponent({
  name: 'MobileActionPanel',
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    /*
     * `tab` while the server is waiting for the player to choose what to do: the
     * menu is where they are going, so it is a screen of its own. `sheet` while the
     * server is asking a follow-up question, which is an interruption and belongs
     * over whatever they were looking at.
     */
    mode: {
      type: String as PropType<'tab' | 'sheet'>,
      required: true,
    },
    snap: {
      type: String as PropType<SheetSnap>,
      required: true,
    },
    peekEnabled: {
      type: Boolean,
      required: true,
    },
    cardScale: {
      type: Number,
      required: true,
    },
    actionWaiting: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['update:snap'],
  components: {
    WaitingFor,
  },
  data(): DataModel {
    return {
      dragging: false,
      dragStartY: 0,
      dragStartOffset: 0,
      dragOffset: 0,
      height: 0,
      boundHead: undefined,
    };
  },
  computed: {
    /* The head is all that shows at the peek stop, so it says whose move it is rather
       than repeating the tab's own label. */
    title(): string {
      return this.actionWaiting ? this.$t('Your turn') : this.$t('Actions');
    },
    /* Cards are chosen and played from in here, so they scale exactly as they do on
       the Cards tab. Unscaled, a corporation card is wider than the phone. */
    cardScaleStyle(): Record<string, string> {
      return {'--mobile-card-scale': String(this.cardScale)};
    },
    sheetStyle(): Record<string, string> {
      const offset = this.dragging ? this.dragOffset : this.offsetFor(this.snap);
      return {transform: `translateY(${offset}px)`};
    },
  },
  methods: {
    /** How far down the sheet sits at a stop, in pixels from its open position. */
    offsetFor(snap: SheetSnap): number {
      const height = this.height;
      switch (snap) {
      case 'closed':
        return height;
      case 'peek':
        return this.peekEnabled ? Math.max(0, height - SHEET_PEEK_PX) : height;
      case 'half':
        return Math.round(height * HALF_FRACTION);
      default:
        return Math.round(height * FULL_FRACTION);
      }
    },
    measure(): void {
      const panel = this.$refs.panel as HTMLElement | undefined;
      this.height = panel?.offsetHeight ?? 0;
    },
    nearestSnap(offset: number): SheetSnap {
      let best: SheetSnap = 'half';
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of SHEET_SNAPS) {
        const distance = Math.abs(this.offsetFor(candidate) - offset);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = candidate;
        }
      }
      return best;
    },
    onHeadClick(): void {
      if (this.dragOffset !== this.dragStartOffset) {
        return;
      }
      this.$emit('update:snap', this.snap === 'half' || this.snap === 'full' ? 'peek' : 'half');
    },
    onPointerDown(event: PointerEvent): void {
      const head = this.$refs.head as HTMLElement | undefined;
      head?.setPointerCapture(event.pointerId);
      this.measure();
      this.dragging = true;
      this.dragStartY = event.clientY;
      this.dragStartOffset = this.offsetFor(this.snap);
      this.dragOffset = this.dragStartOffset;
    },
    onPointerMove(event: PointerEvent): void {
      if (!this.dragging) {
        return;
      }
      const moved = this.dragStartOffset + (event.clientY - this.dragStartY);
      this.dragOffset = Math.max(this.offsetFor('full'), Math.min(this.offsetFor('closed'), moved));
    },
    onPointerUp(): void {
      if (!this.dragging) {
        return;
      }
      this.dragging = false;
      if (this.dragOffset !== this.dragStartOffset) {
        this.$emit('update:snap', this.nearestSnap(this.dragOffset));
      }
    },
    captureHead(): void {
      const head = this.$refs.head as HTMLElement | undefined;
      if (head === undefined || this.boundHead === head) {
        return;
      }
      head.addEventListener('pointerdown', this.onPointerDown);
      head.addEventListener('pointermove', this.onPointerMove);
      head.addEventListener('pointerup', this.onPointerUp);
      head.addEventListener('pointercancel', this.onPointerUp);
      this.boundHead = head;
    },
    releaseHead(): void {
      const head = this.boundHead;
      if (head === undefined) {
        return;
      }
      head.removeEventListener('pointerdown', this.onPointerDown);
      head.removeEventListener('pointermove', this.onPointerMove);
      head.removeEventListener('pointerup', this.onPointerUp);
      head.removeEventListener('pointercancel', this.onPointerUp);
      this.boundHead = undefined;
    },
  },
  watch: {
    // The head only exists in sheet mode, so its listeners follow the mode.
    mode: {
      handler() {
        this.$nextTick(() => {
          this.releaseHead();
          this.captureHead();
          this.measure();
        });
      },
      immediate: true,
    },
  },
  mounted() {
    this.measure();
    this.captureHead();
  },
  unmounted() {
    this.releaseHead();
  },
});
</script>
