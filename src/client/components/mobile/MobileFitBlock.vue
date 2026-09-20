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
 * `transform: scale()`, not `zoom`: `zoom` shrinks the computed font sizes, and iOS
 * will not draw a glyph below a floor of its own -- without shrinking the line height
 * or the box with it, so the text inside a scaled block grew past both. A transform is
 * a picture operation, so the type keeps the sizes the stylesheet names.
 *
 * What a transform does not do is give back the room it saves, which is the one thing
 * `zoom` was here for. The block takes it back with a negative margin, measured from
 * its own unscaled size.
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
  /** The block's unscaled height, which the reserved room is computed from. */
  natural: number;
  resizeObserver: ResizeObserver | undefined;
};

export default defineComponent({
  name: 'MobileFitBlock',
  data(): DataModel {
    return {
      scale: 1,
      natural: 0,
      resizeObserver: undefined,
    };
  },
  computed: {
    innerStyle(): Record<string, string> {
      if (this.scale >= 1) {
        return {};
      }
      return {
        transform: `scale(${this.scale})`,
        transformOrigin: 'top left',
        // `(scale - 1)` is negative: this pulls the frame's height in from the block's
        // full height to the height it is drawn at.
        marginBottom: `${(this.scale - 1) * this.natural}px`,
      };
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
       * `offsetWidth` and `offsetHeight` are the layout box, which a transform does not
       * touch, so they read the block's full size however small it is being drawn --
       * and the margin computed from the height never feeds back into the measurement.
       */
      const natural = inner.offsetWidth;
      if (available <= 0 || natural <= 0) {
        return;
      }
      this.natural = inner.offsetHeight;
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
