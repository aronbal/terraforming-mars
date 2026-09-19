<template>
  <div class="mobile-board-section">
    <div ref="viewport" class="mobile-board-viewport" data-test="board-viewport">
      <div
        class="mobile-board-stage"
        :class="{'mobile-board-stage--tap-targets': tapTargets}"
        :style="stageStyle">
        <Board
          :spaces="game.spaces"
          :expansions="game.gameOptions.expansions"
          :venusScaleLevel="game.venusScaleLevel"
          :boardName="game.gameOptions.boardName"
          :oceans_count="game.oceans"
          :oxygen_level="game.oxygenLevel"
          :temperature="game.temperature"
          :altVenusBoard="game.gameOptions.altVenusBoard"
          :aresData="game.aresData"
          :tileView="tileView"
          @toggleTileView="$emit('toggleTileView')"
          id="shortkey-board"/>
      </div>

      <div class="mobile-board-readout mobile-num" data-test="zoom-readout">
        {{ zoomPercent }}% · {{ hexPixels }}px
      </div>

      <div class="mobile-board-hud">
        <button class="mobile-hud-button" :aria-label="$t('Fit board to screen')" data-test="zoom-fit" @click="fit()"><small>FIT</small></button>
        <button class="mobile-hud-button" :aria-label="$t('Zoom in')" @click="zoomByStep(zoomStep)">+</button>
        <button class="mobile-hud-button" :aria-label="$t('Zoom out')" @click="zoomByStep(1 / zoomStep)">&minus;</button>
      </div>

      <div v-if="selectingSpace" class="mobile-confirm-bar" data-test="placement-bar">
        <div>
          <div class="mobile-confirm-title" v-i18n>Choose a space</div>
          <div class="mobile-confirm-sub" v-i18n>Tap a blinking hex on the map</div>
        </div>
        <button class="mobile-button mobile-confirm-back" @click="$emit('showActions')" v-i18n>Actions</button>
      </div>
    </div>

    <button class="mobile-below-handle" data-test="below-handle" @click="$emit('toggleBelow')">
      <span v-i18n>Milestones &amp; awards</span>
      <span class="mobile-below-handle-chevron">{{ belowOpen ? '&#9650;' : '&#9660;' }}</span>
    </button>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Board from '@/client/components/Board.vue';
import {GameModel} from '@/common/models/GameModel';
import {TileView} from '@/client/components/board/TileView';
import {selectingSpace} from '@/client/utils/spaceSelection';

/*
 * The stage: the 620x600 board artwork plus the bleed `mobile_shell.less` leaves on
 * each side, kept in step with `@mobile-stage-bleed` there.
 *
 * The oxygen, temperature and Venus tracks are printed into `mars.png` as arcs around
 * the planet, and the hex field is only the middle of the picture. Scaling `.board`
 * alone throws those tracks out of frame, so the whole image is the unit that moves.
 * The bleed is for what hangs off the artwork: the colony space captions reach 25px
 * past its left edge, and Ares and Venus markers past its right.
 */
const STAGE_BLEED = 26;
const BOARD_WIDTH = 620 + 2 * STAGE_BLEED;
const BOARD_HEIGHT = 600;

/** The hex box from `.board-space`, used to report the real tap-target size. */
const HEX_WIDTH = 46;

const MAX_SCALE = 2.6;
const ZOOM_STEP = 1.35;
const DOUBLE_TAP_SCALE = 1.6;
const DOUBLE_TAP_MS = 320;
const TAP_MS = 400;

/** Movement, in CSS pixels, past which a gesture is a pan rather than a tap. */
const DRAG_SLOP = 12;

type Point = {x: number, y: number};

type Pinch = {
  distance: number;
  scale: number;
  x: number;
  y: number;
};

type DataModel = {
  scale: number;
  minScale: number;
  offsetX: number;
  offsetY: number;
  /** Set while a drag is in flight, and read once to swallow the click it ends with. */
  panning: boolean;
  pointers: Map<number, Point>;
  pinch: Pinch | undefined;
  panFrom: Point | undefined;
  gestureMoved: number;
  gestureStartedAt: number;
  lastTapAt: number;
  resizeObserver: ResizeObserver | undefined;
};

export default defineComponent({
  name: 'MobileBoardPane',
  props: {
    game: {
      type: Object as PropType<GameModel>,
      required: true,
    },
    tileView: {
      type: String as PropType<TileView>,
      required: true,
    },
    tapTargets: {
      type: Boolean,
      required: true,
    },
    belowOpen: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['toggleTileView', 'toggleBelow', 'showActions'],
  components: {
    Board,
  },
  data(): DataModel {
    return {
      scale: 1,
      minScale: 0.2,
      offsetX: 0,
      offsetY: 0,
      panning: false,
      pointers: new Map<number, Point>(),
      pinch: undefined,
      panFrom: undefined,
      gestureMoved: 0,
      gestureStartedAt: 0,
      lastTapAt: 0,
      resizeObserver: undefined,
    };
  },
  computed: {
    stageStyle(): Record<string, string> {
      return {transform: `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`};
    },
    zoomPercent(): number {
      return Math.round(this.scale * 100);
    },
    hexPixels(): number {
      return Math.round(HEX_WIDTH * this.scale);
    },
    selectingSpace(): boolean {
      return selectingSpace.value;
    },
    zoomStep(): number {
      return ZOOM_STEP;
    },
    viewport(): HTMLElement | undefined {
      return this.$refs.viewport as HTMLElement | undefined;
    },
  },
  methods: {
    /** Scales the artwork to fill the viewport, and makes that scale the floor. */
    fit(): void {
      const viewport = this.viewport;
      if (viewport === undefined) {
        return;
      }
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (width === 0 || height === 0) {
        return;
      }
      this.minScale = Math.min(width / BOARD_WIDTH, height / BOARD_HEIGHT);
      this.scale = this.minScale;
      this.clamp();
    },
    clamp(): void {
      const viewport = this.viewport;
      if (viewport === undefined) {
        return;
      }
      const viewWidth = viewport.clientWidth;
      const viewHeight = viewport.clientHeight;
      const width = BOARD_WIDTH * this.scale;
      const height = BOARD_HEIGHT * this.scale;
      this.offsetX = width <= viewWidth ?
        (viewWidth - width) / 2 :
        Math.min(0, Math.max(viewWidth - width, this.offsetX));
      this.offsetY = height <= viewHeight ?
        (viewHeight - height) / 2 :
        Math.min(0, Math.max(viewHeight - height, this.offsetY));
    },
    /** Zooms towards a point in client coordinates, so a pinch stays anchored to the fingers. */
    zoomAt(nextScale: number, clientX: number, clientY: number): void {
      const viewport = this.viewport;
      if (viewport === undefined) {
        return;
      }
      const bounded = Math.max(this.minScale, Math.min(MAX_SCALE, nextScale));
      const rect = viewport.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      this.offsetX = x - (x - this.offsetX) * (bounded / this.scale);
      this.offsetY = y - (y - this.offsetY) * (bounded / this.scale);
      this.scale = bounded;
      this.clamp();
    },
    zoomByStep(factor: number): void {
      const viewport = this.viewport;
      if (viewport === undefined) {
        return;
      }
      const rect = viewport.getBoundingClientRect();
      this.zoomAt(this.scale * factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
    },
    onPointerDown(event: PointerEvent): void {
      this.pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
      if (this.pointers.size === 1) {
        // The click from any previous pan has been and gone by now.
        this.panning = false;
        this.panFrom = {x: event.clientX, y: event.clientY};
        this.gestureStartedAt = Date.now();
        this.gestureMoved = 0;
      } else if (this.pointers.size === 2) {
        const [first, second] = [...this.pointers.values()];
        this.pinch = {
          distance: Math.hypot(first.x - second.x, first.y - second.y),
          scale: this.scale,
          x: (first.x + second.x) / 2,
          y: (first.y + second.y) / 2,
        };
        this.panFrom = undefined;
        this.gestureMoved = Number.MAX_SAFE_INTEGER;
      }
    },
    onPointerMove(event: PointerEvent): void {
      if (!this.pointers.has(event.pointerId)) {
        return;
      }
      this.pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});

      const pinch = this.pinch;
      if (this.pointers.size >= 2 && pinch !== undefined) {
        const [first, second] = [...this.pointers.values()];
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        if (pinch.distance > 0) {
          this.zoomAt(pinch.scale * (distance / pinch.distance), pinch.x, pinch.y);
        }
        return;
      }

      const panFrom = this.panFrom;
      if (panFrom === undefined) {
        return;
      }
      const dx = event.clientX - panFrom.x;
      const dy = event.clientY - panFrom.y;
      this.gestureMoved += Math.abs(dx) + Math.abs(dy);
      if (this.gestureMoved <= DRAG_SLOP) {
        // Still within tap distance, so the space underneath keeps its click.
        return;
      }
      this.panning = true;
      this.offsetX += dx;
      this.offsetY += dy;
      this.panFrom = {x: event.clientX, y: event.clientY};
      this.clamp();
    },
    onPointerUp(event: PointerEvent): void {
      if (!this.pointers.has(event.pointerId)) {
        return;
      }
      this.pointers.delete(event.pointerId);

      if (this.pointers.size === 1) {
        const [only] = [...this.pointers.values()];
        this.panFrom = {x: only.x, y: only.y};
        this.pinch = undefined;
        return;
      }
      if (this.pointers.size > 1) {
        return;
      }

      const wasTap = Date.now() - this.gestureStartedAt < TAP_MS && this.gestureMoved <= DRAG_SLOP;
      // Double-tap zoom would fight tap-to-place, so the board holds still while a
      // space is being chosen.
      if (wasTap && !this.selectingSpace) {
        const now = Date.now();
        if (now - this.lastTapAt < DOUBLE_TAP_MS) {
          this.zoomAt(this.scale < 1.1 ? DOUBLE_TAP_SCALE : this.minScale, event.clientX, event.clientY);
          this.lastTapAt = 0;
        } else {
          this.lastTapAt = now;
        }
      }
      this.pinch = undefined;
      this.panFrom = undefined;
    },
    /** Swallows the click a pan ends with, so panning never places a tile. */
    onClickCapture(event: MouseEvent): void {
      if (this.panning) {
        event.stopPropagation();
        event.preventDefault();
      }
    },
    onWheel(event: WheelEvent): void {
      event.preventDefault();
      this.zoomAt(this.scale * (event.deltaY < 0 ? 1.12 : 0.89), event.clientX, event.clientY);
    },
  },
  mounted() {
    const viewport = this.viewport;
    if (viewport === undefined) {
      return;
    }
    viewport.addEventListener('pointerdown', this.onPointerDown);
    viewport.addEventListener('pointermove', this.onPointerMove);
    viewport.addEventListener('pointerup', this.onPointerUp);
    viewport.addEventListener('pointercancel', this.onPointerUp);
    viewport.addEventListener('click', this.onClickCapture, true);
    viewport.addEventListener('wheel', this.onWheel, {passive: false});
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.fit());
      this.resizeObserver.observe(viewport);
    }
    this.fit();
  },
  unmounted() {
    this.resizeObserver?.disconnect();
    const viewport = this.viewport;
    if (viewport === undefined) {
      return;
    }
    viewport.removeEventListener('pointerdown', this.onPointerDown);
    viewport.removeEventListener('pointermove', this.onPointerMove);
    viewport.removeEventListener('pointerup', this.onPointerUp);
    viewport.removeEventListener('pointercancel', this.onPointerUp);
    viewport.removeEventListener('click', this.onClickCapture, true);
    viewport.removeEventListener('wheel', this.onWheel);
  },
});
</script>
