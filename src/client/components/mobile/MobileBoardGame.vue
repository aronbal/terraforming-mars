<template>
  <div class="mobile-bg" data-test="board-game">
    <!-- The terraform rating track, round the edge as it is printed. A tap anywhere
         on it says who is where. -->
    <div class="mobile-bg-track" data-test="board-game-track" @click="standingsOpen = true">
      <span
        v-for="cell in cells"
        :key="cell.step"
        class="mobile-bg-step"
        :class="{'mobile-bg-step--five': cell.step % 5 === 0}"
        :style="{gridRow: cell.row, gridColumn: cell.column}"
        aria-hidden="true">{{ cell.step }}</span>
    </div>

    <button
      v-for="marker in markers"
      :key="marker.color"
      type="button"
      class="mobile-track-marker mobile-bg-marker"
      :class="['player_bg_color_' + marker.color, 'mobile-track-marker--' + marker.color]"
      :style="markerStyle(marker)"
      :aria-label="marker.name + ' · ' + marker.terraformRating"
      :data-step="marker.cell.step"
      data-test="track-marker"
      @click="standingsOpen = true">{{ symbol(marker.color) }}</button>

    <div class="mobile-bg-inner">
      <!-- Where the planet goes: the shell lays its one board over this, as a picture. -->
      <div class="mobile-bg-window" aria-hidden="true"></div>

      <div v-if="panels.length > 0" class="mobile-bg-panels">
        <button
          v-for="panel in panels"
          :key="panel.kind"
          type="button"
          class="mobile-bg-panel"
          :class="'mobile-bg-panel--' + panel.kind"
          :data-panel="panel.kind"
          :data-test="'board-game-' + panel.kind"
          :aria-label="$t(panel.title)"
          @click="$emit('zoomTo', panel.part)">
          <span class="mobile-bg-panel-head">
            <span class="mobile-bg-plaque">{{ $t(panel.title) }}</span>
            <span class="mobile-bg-costs">
              <span
                v-for="(cost, index) in panel.costs"
                :key="index"
                class="mobile-bg-coin"
                :class="{'mobile-bg-coin--used': cost.used, 'mobile-bg-coin--next': cost.next}"
                data-test="board-game-cost">{{ cost.value }}</span>
            </span>
          </span>
          <span class="mobile-bg-medals">
            <span
              v-for="medal in panel.medals"
              :key="medal.name"
              class="mobile-bg-medal"
              :class="{'mobile-bg-medal--offered': medal.offered}"
              :style="{backgroundImage: medal.art}"
              data-test="board-game-medal">
              <i
                v-if="medal.owner !== undefined"
                class="board-cube mobile-bg-cube"
                :class="'board-cube--' + medal.owner.color"
                data-test="board-game-cube"></i>
            </span>
          </span>
        </button>
      </div>
    </div>

    <!-- A panel zoomed up to the width of the board: tapping beside it, or Back, puts
         it back where it is printed. -->
    <Transition name="mobile-bg-fade">
      <div v-if="zoomed !== undefined" class="mobile-bg-scrim" data-test="board-game-scrim" @click="$emit('zoomTo', 'overview')"></div>
    </Transition>
    <Transition :css="false" @enter="growPanel" @leave="shrinkPanel">
      <section
        v-if="zoomed !== undefined"
        :key="zoomed.kind"
        class="mobile-bg-zoomed"
        :class="'mobile-bg-zoomed--' + zoomed.kind"
        :data-panel="zoomed.kind"
        role="dialog"
        :aria-label="$t(zoomed.title)"
        data-test="board-game-zoomed">
        <header class="mobile-bg-zoomed-head">
          <button type="button" class="mobile-bg-back" data-test="board-game-back" @click="$emit('zoomTo', 'overview')">&lsaquo; <span v-i18n>Board</span></button>
          <span class="mobile-bg-plaque">{{ $t(zoomed.title) }}</span>
          <span class="mobile-bg-costs">
            <span
              v-for="(cost, index) in zoomed.costs"
              :key="index"
              class="mobile-bg-coin"
              :class="{'mobile-bg-coin--used': cost.used, 'mobile-bg-coin--next': cost.next}">{{ cost.value }}</span>
          </span>
        </header>
        <div class="mobile-bg-zoomed-list">
          <button
            v-for="medal in zoomed.medals"
            :key="medal.name"
            type="button"
            class="mobile-bg-row"
            :class="{'mobile-bg-row--offered': medal.offered, 'mobile-bg-row--taken': medal.owner !== undefined}"
            data-test="board-game-row"
            @click="inspecting = {kind: zoomed.kind, name: medal.name}">
            <span class="mobile-medal mobile-medal--row" :style="{backgroundImage: medal.art}" aria-hidden="true">
              <span class="mobile-medal-name">{{ $t(medal.name) }}</span>
              <i v-if="medal.owner !== undefined" class="board-cube mobile-medal-cube" :class="'board-cube--' + medal.owner.color"></i>
            </span>
            <span class="mobile-bg-row-body">
              <span class="mobile-bg-row-rule">{{ $t(medal.description) }}</span>
              <span class="mobile-bg-row-foot">
                <span v-if="medal.scores.length > 0" class="mobile-choice-standings mobile-bg-row-scores">
                  <span v-for="score in medal.scores" :key="score.color" class="mobile-choice-standing">
                    <i class="mobile-choice-standing-dot" :class="'player_bg_color_' + score.color"></i>{{ score.score }}
                  </span>
                </span>
                <span v-if="medal.offered" class="mobile-pill mobile-bg-row-offer" data-test="board-game-offer">{{ $t(zoomed.kind === 'milestone' ? 'Claim' : 'Fund') }}</span>
              </span>
            </span>
          </button>
        </div>
      </section>
    </Transition>

    <MobileMedalSheet
      v-if="inspecting !== undefined"
      :playerView="playerView"
      :kind="inspecting.kind"
      :name="inspecting.name"
      :offered="isOffered(inspecting.kind, inspecting.name)"
      @claim="claim()"
      @close="inspecting = undefined"/>

    <MobileTrackSheet
      v-if="standingsOpen"
      :players="playerView.players"
      :you="playerView.thisPlayer.color"
      @close="standingsOpen = false"/>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import MobileMedalSheet from '@/client/components/mobile/MobileMedalSheet.vue';
import MobileTrackSheet from '@/client/components/mobile/MobileTrackSheet.vue';
import {getAward, getMilestone} from '@/client/MilestoneAwardManifest';
import {
  BoardZoom,
  TRACK_CELLS,
  TRACK_SIDE,
  TrackCell,
  TrackMarker,
  boxOf,
  flipFrame,
  inward,
  medalArt,
  playZoom,
  trackMarkers,
} from '@/client/components/mobile/BoardGame';
import {playerSymbol} from '@/client/utils/playerSymbol';
import {Color} from '@/common/Color';
import {AWARD_COSTS, MAX_MILESTONES, MILESTONE_COST} from '@/common/constants';
import {PlayerViewModel} from '@/common/models/PlayerModel';

type Kind = 'milestone' | 'award';

type Medal = {
  name: string;
  description: string;
  art: string;
  owner: {name: string, color: Color} | undefined;
  offered: boolean;
  scores: ReadonlyArray<{color: Color, score: number}>;
};

type Cost = {
  value: number;
  /** Already spent: a milestone claimed, an award funded at this price. */
  used: boolean;
  /** What the next one costs. */
  next: boolean;
};

type Panel = {
  kind: Kind;
  /** What the board zooms into when it is tapped. */
  part: BoardZoom;
  title: string;
  costs: ReadonlyArray<Cost>;
  medals: ReadonlyArray<Medal>;
};

type DataModel = {
  /** The medal held up in the medal sheet. */
  inspecting: {kind: Kind, name: string} | undefined;
  standingsOpen: boolean;
};

/** How far a marker sharing a step sits from the one before it, towards the middle of the board. */
const MARKER_STEP_PX = 14;

/*
 * The Board tab drawn as the board on the table: the terraform rating track round
 * the edge with a marker per player, the planet in the middle, and the milestones
 * and awards along the bottom with their medals, prices and cubes.
 *
 * The planet is not drawn here. There is one board in the shell, which `SelectSpace`
 * finds by id, so `MobilePlayerHome` lays that one over the window this leaves for
 * it, and zooms it from there.
 *
 * A panel tapped zooms up to the width of the board, each medal large with its rule
 * and the scores; a medal tapped opens the medal sheet, and Claim or Fund there goes
 * on to the shell's claim sheet through `claim`, which is where it is sent from.
 */
export default defineComponent({
  name: 'MobileBoardGame',
  components: {
    MobileMedalSheet,
    MobileTrackSheet,
  },
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    /** The part of the board up close, or the whole of it. */
    part: {
      type: String as PropType<BoardZoom>,
      default: 'overview',
    },
    /** The milestones the turn's menu offers to claim. */
    claimable: {
      type: Array as PropType<ReadonlyArray<string>>,
      default: () => [],
    },
    fundable: {
      type: Array as PropType<ReadonlyArray<string>>,
      default: () => [],
    },
  },
  emits: {
    zoomTo: (_part: BoardZoom) => true,
    claim: (_kind: Kind, _name: string) => true,
  },
  data(): DataModel {
    return {
      inspecting: undefined,
      standingsOpen: false,
    };
  },
  computed: {
    cells(): ReadonlyArray<TrackCell> {
      return TRACK_CELLS;
    },
    markers(): ReadonlyArray<TrackMarker> {
      return trackMarkers(this.playerView.players);
    },
    turmoil(): boolean {
      return this.playerView.game.turmoil !== undefined;
    },
    panels(): ReadonlyArray<Panel> {
      const game = this.playerView.game;
      const panels: Array<Panel> = [];
      if (game.milestones.length > 0) {
        const claimed = game.milestones.filter((milestone) => milestone.playerName !== undefined).length;
        panels.push({
          kind: 'milestone',
          part: 'milestones',
          title: 'Milestones',
          costs: this.costs(Array(MAX_MILESTONES).fill(MILESTONE_COST), claimed),
          medals: game.milestones.map((milestone) => ({
            name: milestone.name,
            description: getMilestone(milestone.name)?.description ?? '',
            art: medalArt(milestone.name, this.turmoil),
            owner: this.owner(milestone.playerName, milestone.color),
            offered: this.claimable.includes(milestone.name),
            scores: milestone.playerName === undefined ? this.best(milestone.scores) : [],
          })),
        });
      }
      if (game.awards.length > 0) {
        const funded = game.awards.filter((award) => award.playerName !== undefined).length;
        panels.push({
          kind: 'award',
          part: 'awards',
          title: 'Awards',
          costs: this.costs(AWARD_COSTS, funded),
          medals: game.awards.map((award) => ({
            name: award.name,
            description: getAward(award.name)?.description ?? '',
            art: medalArt(award.name, this.turmoil),
            owner: this.owner(award.playerName, award.color),
            offered: this.fundable.includes(award.name),
            // A funded award is still scored at the end, so its standings stay in view.
            scores: this.best(award.scores),
          })),
        });
      }
      return panels;
    },
    zoomed(): Panel | undefined {
      return this.panels.find((panel) => panel.part === this.part);
    },
  },
  methods: {
    costs(prices: ReadonlyArray<number>, spent: number): ReadonlyArray<Cost> {
      return prices.map((value, index) => ({value, used: index < spent, next: index === spent}));
    },
    best(scores: ReadonlyArray<{color: Color, score: number}>): ReadonlyArray<{color: Color, score: number}> {
      return [...scores].sort((a, b) => b.score - a.score);
    },
    owner(name: string | undefined, color: Color | undefined): Medal['owner'] {
      return name !== undefined && color !== undefined ? {name, color} : undefined;
    },
    isOffered(kind: Kind, name: string): boolean {
      return (kind === 'milestone' ? this.claimable : this.fundable).includes(name);
    },
    symbol(color: Color): string {
      return playerSymbol(color);
    },
    /* On the middle of its step, then a step's width further in for each marker
       already there. */
    markerStyle(marker: TrackMarker): Record<string, string> {
      const direction = inward(marker.cell);
      const x = ((marker.cell.column - 0.5) / TRACK_SIDE) * 100;
      const y = ((marker.cell.row - 0.5) / TRACK_SIDE) * 100;
      const shift = marker.place * MARKER_STEP_PX;
      return {
        left: `calc(${x}% + ${direction.x * shift}px)`,
        top: `calc(${y}% + ${direction.y * shift}px)`,
        zIndex: String(10 + marker.place),
      };
    },
    claim(): void {
      const inspecting = this.inspecting;
      this.inspecting = undefined;
      if (inspecting !== undefined) {
        this.$emit('claim', inspecting.kind, inspecting.name);
      }
    },
    /* The panel as printed, which a zoomed one grows out of and shrinks back into. */
    printed(element: Element): HTMLElement | undefined {
      const kind = (element as HTMLElement).dataset.panel;
      return (this.$el as HTMLElement).querySelector<HTMLElement>(`.mobile-bg-panel[data-panel="${kind}"]`) ?? undefined;
    },
    growPanel(element: Element, done: () => void): void {
      const from = boxOf(this.printed(element));
      const to = boxOf(element);
      playZoom(element as HTMLElement, from && to ? flipFrame(from, to) : undefined, {fade: true, done});
    },
    shrinkPanel(element: Element, done: () => void): void {
      const into = boxOf(this.printed(element));
      const from = boxOf(element);
      playZoom(element as HTMLElement, into && from ? flipFrame(into, from) : undefined, {fade: true, reverse: true, done});
    },
  },
});
</script>
