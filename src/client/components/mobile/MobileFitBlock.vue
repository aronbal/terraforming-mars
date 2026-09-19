<template>
  <div class="mobile-fit" ref="frame" data-test="fit-block">
    <div class="mobile-fit-inner" ref="inner" :style="innerStyle">
      <slot></slot>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

/*
 * Scales a block that was drawn for a desktop column down until it fits the phone.
 *
 * Turmoil, the colony tiles and the planetary tracks have no narrow form: they are
 * around 450 to 1000 pixels wide whatever the viewport, so at phone width they either
 * spill past the shell or drag the whole layout sideways with them. Rather than
 * re-flow components the desktop client shares, this shrinks each one as a whole unit
 * — the same treatment the board and the cards already get.
 *
 * `zoom`, not `transform: scale()`: a transform paints the block smaller while it
 * still reserves its full size, which would leave the gap the scaling was meant to
 * close.
 */

/*
 * The point below which the printed numbers on a Turmoil party or a colony track stop
 * being readable. A block that would need less than this is left larger and scrolls
 * inside its own frame instead, which keeps the rest of the shell still.
 */
const MIN_SCALE = 0.55;

/** Ignore differences this small, so a rounding wobble cannot start a render loop. */
const SCALE_EPSILON = 0.005;

type DataModel = {
  scale: number;
  resizeObserver: ResizeObserver | undefined;
};

export default defineComponent({
  name: 'MobileFitBlock',
  data(): DataModel {
    return {
      scale: 1,
      resizeObserver: undefined,
    };
  },
  computed: {
    innerStyle(): Record<string, string> {
      return {zoom: String(this.scale)};
    },
  },
  methods: {
    fit(): void {
      const frame = this.$refs.frame as HTMLElement | undefined;
      const inner = this.$refs.inner as HTMLElement | undefined;
      if (frame === undefined || inner === undefined) {
        return;
      }
      const available = frame.clientWidth;
      /*
       * Bounding rectangles are in visual pixels, so dividing by the scale already in
       * force gives the block's unscaled width. Reading it that way means never having
       * to reset the zoom and measure again, which would flash the full-size layout.
       */
      const natural = inner.getBoundingClientRect().width / this.scale;
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
    if (typeof ResizeObserver !== 'undefined') {
      // The frame changes with the viewport, the block itself when the game state does.
      this.resizeObserver = new ResizeObserver(() => this.fit());
      this.resizeObserver.observe(this.$refs.frame as HTMLElement);
      this.resizeObserver.observe(this.$refs.inner as HTMLElement);
    }
  },
  unmounted() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  },
});
</script>
