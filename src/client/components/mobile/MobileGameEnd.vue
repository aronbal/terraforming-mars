<template>
  <div class="mobile-end" data-test="game-end">
    <header class="mobile-end-hero">
      <span class="mobile-end-trophy" :class="'player_bg_color_' + winnerColor" aria-hidden="true">
        <MobileIcon name="trophy" :size="34"/>
      </span>
      <h1 class="mobile-end-headline" data-test="end-headline">{{ headline }}</h1>
      <p class="mobile-end-subline">{{ say('After ${0} generations', String(game.generation)) }}</p>
    </header>

    <!-- The scores, best first: each a total with what it is made of under it. -->
    <section class="mobile-section mobile-gutter">
      <h2 class="mobile-eyebrow" v-i18n>Final score</h2>
      <div class="mobile-end-players">
        <article
          v-for="(player, index) in ranked"
          :key="player.color"
          class="mobile-end-player"
          :class="{'mobile-end-player--me': player.color === myColor}"
          data-test="end-player">
          <div class="mobile-end-player-head">
            <span class="mobile-end-place" :class="'player_bg_color_' + player.color">{{ index + 1 }}</span>
            <span class="mobile-end-player-name">
              <span class="mobile-row-title">{{ player.name }}</span>
              <span class="mobile-row-subtitle">{{ corporations(player) }}</span>
            </span>
            <span class="mobile-end-total" data-test="end-total">
              {{ player.victoryPointsBreakdown.total }}
              <small v-i18n>VP</small>
            </span>
          </div>
          <!-- The score as a bar of its parts, as long as the best score is. -->
          <div class="mobile-end-bar" aria-hidden="true">
            <span
              v-for="part in parts(player)"
              :key="part.key"
              class="mobile-end-bar-part"
              :class="'mobile-end-part--' + part.key"
              :style="{width: (100 * Math.max(0, part.points) / best) + '%'}"></span>
          </div>
          <ul class="mobile-end-parts">
            <li v-for="part in parts(player)" :key="part.key" class="mobile-end-part" :data-test="'end-part-' + part.key">
              <span class="mobile-end-part-dot" :class="'mobile-end-part--' + part.key"></span>
              <span class="mobile-end-part-label">{{ $t(part.label) }}</span>
              <span class="mobile-end-part-points">{{ part.points }}</span>
            </li>
          </ul>
          <p class="mobile-end-tiebreak">{{ say('${0} M€ left', String(player.megacredits)) }}</p>
        </article>
      </div>
    </section>

    <!-- Each player's score generation by generation. -->
    <section v-if="game.generation > 1" class="mobile-section mobile-gutter">
      <h2 class="mobile-eyebrow" v-i18n>Points by generation</h2>
      <div class="mobile-end-card">
        <svg class="mobile-end-chart" :viewBox="'0 0 ' + chart.width + ' ' + chart.height" role="img" :aria-label="$t('Points by generation')" data-test="end-chart">
          <g class="mobile-end-chart-grid">
            <template v-for="tick in ticks" :key="tick.value">
              <line :x1="chart.left" :x2="chart.width - chart.right" :y1="tick.y" :y2="tick.y"/>
              <text :x="chart.left - 6" :y="tick.y + 3" text-anchor="end">{{ tick.value }}</text>
            </template>
            <text :x="chart.left" :y="chart.height - 6" text-anchor="start">1</text>
            <text :x="chart.width - chart.right" :y="chart.height - 6" text-anchor="end">{{ game.generation }}</text>
          </g>
          <g v-for="line in lines" :key="line.color" class="mobile-end-chart-line" :class="'mobile-end-ink--' + line.color">
            <polyline :points="line.points"/>
            <text :x="chart.width - chart.right + 4" :y="line.labelY + 4">{{ line.last }}</text>
          </g>
        </svg>
      </div>
    </section>

    <!-- Where the points beyond the board came from, one player at a time. -->
    <section class="mobile-section mobile-gutter">
      <h2 class="mobile-eyebrow" v-i18n>Points from cards and awards</h2>
      <div class="mobile-list">
        <details v-for="player in ranked" :key="player.color" class="mobile-end-details" data-test="end-details">
          <summary class="mobile-row mobile-row--button">
            <span class="mobile-glyph" :class="'player_bg_color_' + player.color">
              <MobileIcon name="layers" :size="16"/>
            </span>
            <span class="mobile-row-body">
              <span class="mobile-row-text">
                <span class="mobile-row-title">{{ player.name }}</span>
              </span>
              <span class="mobile-row-chevron" aria-hidden="true">&rsaquo;</span>
            </span>
          </summary>
          <ul class="mobile-end-lines">
            <li v-for="line in detailLines(player)" :key="line.key" class="mobile-end-line">
              <span class="mobile-end-line-points" :class="{'mobile-end-line-points--minus': line.points < 0}">{{ line.points }}</span>
              <span class="mobile-end-line-text">{{ line.text }}</span>
            </li>
          </ul>
        </details>
      </div>
    </section>

    <div class="mobile-end-actions mobile-gutter">
      <a class="mobile-play-sheet-button mobile-play-sheet-button--primary" href="new-game" data-test="end-new-game" v-i18n>New game</a>
      <a class="mobile-play-sheet-button" :href="'player?id=' + viewModel.id + '&noredirect'" data-test="end-board" v-i18n>See the final board</a>
      <a class="mobile-play-sheet-button" href="." v-i18n>Main page</a>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import {CHART, ScorePart, chartPoints, chartStep, scoreParts, standings, winners} from '@/client/components/mobile/GameEnd';
import {translateAwardDetails, translateMilestoneDetails} from '@/client/components/gameend/maDetails';
import {getCard} from '@/client/cards/ClientCardManifest';
import {translateTextWithParams} from '@/client/directives/i18n';
import {setDocumentTitle} from '@/client/utils/documentTitle';
import {CardType} from '@/common/cards/CardType';
import {Color} from '@/common/Color';
import {GameModel} from '@/common/models/GameModel';
import {PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';

/** The least distance between two final scores written at the chart's right edge. */
const LABEL_GAP = 11;

type DetailLine = {
  key: string;
  points: number;
  text: string;
};

type ChartLine = {
  color: Color;
  points: string;
  last: number;
  /** Where its final score is written: level with the line's end, unless that would overlap another's. */
  labelY: number;
};

/*
 * The results, on a phone.
 *
 * Who won, said once and large; then each player's total with what it is made of,
 * as numbers and as a bar, so a close game reads as close; the score over the
 * generations; and, folded away, the cards and awards behind it. The buttons to
 * move on sit at the bottom, where a thumb is.
 */
export default defineComponent({
  name: 'MobileGameEnd',
  components: {
    MobileIcon,
  },
  props: {
    viewModel: {
      type: Object as PropType<ViewModel>,
      required: true,
    },
    /** The player looking, if it is one of them. */
    myColor: {
      type: String as PropType<Color | undefined>,
      default: undefined,
    },
  },
  computed: {
    game(): GameModel {
      return this.viewModel.game;
    },
    ranked(): Array<PublicPlayerModel> {
      return standings(this.viewModel.players);
    },
    winnerColor(): Color {
      return this.ranked[0]?.color ?? 'neutral';
    },
    headline(): string {
      const won = winners(this.viewModel.players);
      if (won.some((p) => p.color === this.myColor)) {
        return won.length > 1 ? this.$t('You shared the win!') : this.$t('You won!');
      }
      return this.say('${0} won!', won.map((p) => p.name).join(' & '));
    },
    /** The best total, which every bar is measured against. */
    best(): number {
      return Math.max(1, ...this.ranked.map((p) => p.victoryPointsBreakdown.total));
    },
    chart(): typeof CHART {
      return CHART;
    },
    chartMax(): number {
      const top = Math.max(1, ...this.ranked.flatMap((p) => p.victoryPointsByGeneration));
      return Math.ceil(top / chartStep(top)) * chartStep(top);
    },
    ticks(): Array<{value: number, y: number}> {
      const step = chartStep(this.chartMax);
      const plot = CHART.height - CHART.top - CHART.bottom;
      const ticks = [];
      for (let value = 0; value <= this.chartMax; value += step) {
        ticks.push({value, y: CHART.top + plot * (1 - value / this.chartMax)});
      }
      return ticks;
    },
    lines(): Array<ChartLine> {
      const plot = CHART.height - CHART.top - CHART.bottom;
      const lines = this.ranked.map((player) => {
        const scores = player.victoryPointsByGeneration;
        const last = scores[scores.length - 1] ?? 0;
        return {
          color: player.color,
          points: chartPoints(scores, this.game.generation, this.chartMax),
          last,
          labelY: CHART.top + plot * (1 - last / this.chartMax),
        };
      });
      // Best first, so top down: push each label below the one above it if they would touch.
      for (let i = 1; i < lines.length; i++) {
        lines[i].labelY = Math.max(lines[i].labelY, lines[i - 1].labelY + LABEL_GAP);
      }
      return lines;
    },
  },
  mounted() {
    setDocumentTitle('🏁 | ' + this.game.name);
  },
  methods: {
    say(message: string, ...args: Array<string>): string {
      return translateTextWithParams(message, args);
    },
    parts(player: PublicPlayerModel): Array<ScorePart> {
      return scoreParts(player);
    },
    corporations(player: PublicPlayerModel): string {
      return player.tableau
        .filter((card) => getCard(card.name)?.type === CardType.CORPORATION)
        .map((card) => this.$t(card.name))
        .join(' · ');
    },
    detailLines(player: PublicPlayerModel): Array<DetailLine> {
      const vp = player.victoryPointsBreakdown;
      return [
        ...vp.detailsCards
          .toSorted((a, b) => b.victoryPoint - a.victoryPoint)
          .map((card) => ({key: 'card-' + card.cardName, points: card.victoryPoint, text: this.$t(card.cardName)})),
        ...vp.detailsMilestones.map((detail) => ({key: 'm-' + detail.message + detail.messageArgs?.join(), points: detail.victoryPoint, text: translateMilestoneDetails(detail)})),
        ...vp.detailsAwards.map((detail) => ({key: 'a-' + detail.message + detail.messageArgs?.join(), points: detail.victoryPoint, text: translateAwardDetails(detail)})),
      ];
    },
  },
});
</script>
