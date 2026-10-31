<template>
  <div class="mobile-end" data-test="game-end">
    <header class="mobile-end-hero">
      <span class="mobile-end-trophy" :class="'player_bg_color_' + winnerColor" aria-hidden="true">
        <MobileIcon name="trophy" :size="34"/>
      </span>
      <h1 class="mobile-end-headline" data-test="end-headline">{{ headline }}</h1>
      <p class="mobile-end-subline">{{ say('After ${0} generations', String(game.generation)) }}</p>
    </header>

    <!-- The totals, best first. -->
    <section class="mobile-section mobile-gutter">
      <h2 class="mobile-eyebrow" v-i18n>Final score</h2>
      <div class="mobile-list">
        <div
          v-for="(player, index) in ranked"
          :key="player.color"
          class="mobile-row mobile-end-player"
          :class="{'mobile-end-player--me': player.color === myColor}"
          data-test="end-player">
          <span class="mobile-end-place" :class="'player_bg_color_' + player.color">{{ index + 1 }}</span>
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-row-title">{{ player.name }}</span>
              <span class="mobile-row-subtitle">{{ corporations(player) }} · {{ say('${0} M€', String(player.megacredits)) }}</span>
            </span>
            <span class="mobile-end-total" data-test="end-total">{{ player.victoryPointsBreakdown.total }} <small v-i18n>VP</small></span>
          </span>
        </div>
      </div>
    </section>

    <!-- Each source of points as a tile with everyone's share of it, so who did better
         where is read across the grid. The lead, in the leader's colour, says by how much. -->
    <section class="mobile-section mobile-gutter">
      <h2 class="mobile-eyebrow" v-i18n>By category</h2>
      <div class="mobile-end-tiles">
        <div v-for="category in byCategory" :key="category.key" class="mobile-end-tile" :data-test="'end-category-' + category.key">
          <div class="mobile-end-tile-head">
            <span>{{ $t(category.label) }}</span>
            <b
              class="mobile-end-tile-lead"
              :class="category.leader === undefined ? 'mobile-end-tile-lead--tie' : 'mobile-end-ink--' + category.leader"
              data-test="end-category-lead">{{ category.leader === undefined ? '=' : '+' + category.margin }}</b>
          </div>
          <div
            v-for="score in category.scores"
            :key="score.color"
            class="mobile-end-tile-row"
            :class="{'mobile-end-tile-row--trailing': !score.leading}">
            <span class="mobile-end-tile-track">
              <span class="mobile-end-tile-fill" :class="'player_bg_color_' + score.color" :style="{width: (100 * Math.max(0, score.points) / categoryMax) + '%'}"></span>
            </span>
            <span class="mobile-end-tile-points">{{ score.points }}</span>
          </div>
        </div>
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
              <!-- A card's line opens the card, a milestone's or an award's its rule: a
                   picture or the rule says more than a name. -->
              <button
                v-if="line.card !== undefined || line.medal !== undefined"
                type="button"
                class="mobile-end-line-button"
                :data-test="line.card !== undefined ? 'end-card-line' : 'end-medal-line'"
                @click="open(line)">
                <span class="mobile-end-line-points" :class="{'mobile-end-line-points--minus': line.points < 0}">{{ line.points }}</span>
                <span class="mobile-end-line-text">{{ line.text }}</span>
                <MobileIcon class="mobile-end-line-mark" :name="line.card !== undefined ? 'layers' : 'award'" :size="14"/>
              </button>
              <template v-else>
                <span class="mobile-end-line-points" :class="{'mobile-end-line-points--minus': line.points < 0}">{{ line.points }}</span>
                <span class="mobile-end-line-text">{{ line.text }}</span>
              </template>
            </li>
          </ul>
        </details>
      </div>
    </section>

    <!-- The card a line names, large over everything; a tap anywhere puts it down. -->
    <div v-if="shown !== undefined" class="mobile-magnify mobile-end-magnify" role="dialog" :aria-label="$t(shown.card.name)" data-test="end-card" @click="shown = undefined">
      <div class="mobile-log-cards-card">
        <Card class="cardbox" :card="shown.card"/>
      </div>
      <p class="mobile-end-card-caption">{{ say('${0} VP', String(shown.points)) }}</p>
      <!-- Vermin scores against everyone; say whose card it is when it is not this player's. -->
      <p v-if="shown.owner !== undefined" class="mobile-end-card-owner" data-test="end-card-owner">
        <span class="mobile-end-card-owner-dot" :class="'player_bg_color_' + shown.owner.color" aria-hidden="true"></span>
        {{ say('${0}\'s card', shown.owner.name) }}
      </p>
    </div>

    <MobileMedalSheet
      v-if="medal !== undefined"
      :playerView="viewModel"
      :kind="medal.kind"
      :name="medal.name"
      @close="medal = undefined"/>

    <div class="mobile-end-actions mobile-gutter">
      <a class="mobile-play-sheet-button mobile-play-sheet-button--primary" href="new-game" data-test="end-new-game" v-i18n>New game</a>
      <a class="mobile-play-sheet-button" :href="'player?id=' + viewModel.id + '&noredirect'" data-test="end-board" v-i18n>See the final board</a>
      <a class="mobile-play-sheet-button" href="." v-i18n>Main page</a>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Card from '@/client/components/card/Card.vue';
import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import MobileMedalSheet from '@/client/components/mobile/MobileMedalSheet.vue';
import {CHART, Category, categories, chartPoints, chartStep, standings, winners} from '@/client/components/mobile/GameEnd';
import {translateAwardDetails, translateMilestoneDetails} from '@/client/components/gameend/maDetails';
import {getCard} from '@/client/cards/ClientCardManifest';
import {translateTextWithParams} from '@/client/directives/i18n';
import {setDocumentTitle} from '@/client/utils/documentTitle';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {GameModel} from '@/common/models/GameModel';
import {PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';

/** The least distance between two final scores written at the chart's right edge. */
const LABEL_GAP = 11;

type DetailLine = {
  key: string;
  points: number;
  text: string;
  /** The card the points came from, as it lay on the table. */
  card?: CardModel;
  /** Who played that card, when it is not the player the points went to. */
  owner?: Owner;
  /** Or the milestone or award they came from. */
  medal?: Medal;
};

type Medal = {
  kind: 'milestone' | 'award';
  name: string;
};

type Owner = {
  name: string;
  color: Color;
};

type ShownCard = {
  card: CardModel;
  points: number;
  owner?: Owner;
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
 * Who won, said once and large; then the totals; then every source of points as a
 * tile with each player's share of it, so where each did better reads across the
 * grid; the score over the generations; and, folded away, the cards and awards
 * behind it. The buttons to
 * move on sit at the bottom, where a thumb is.
 */
export default defineComponent({
  name: 'MobileGameEnd',
  components: {
    Card,
    MobileIcon,
    MobileMedalSheet,
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
  data(): {shown: ShownCard | undefined, medal: Medal | undefined} {
    return {
      shown: undefined,
      medal: undefined,
    };
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
    byCategory(): Array<Category> {
      return categories(this.ranked);
    },
    /** The most anyone scored in any one category, which every tile's bars are measured against. */
    categoryMax(): number {
      return Math.max(1, ...this.byCategory.flatMap((category) => category.scores.map((score) => score.points)));
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
    corporations(player: PublicPlayerModel): string {
      return player.tableau
        .filter((card) => getCard(card.name)?.type === CardType.CORPORATION)
        .map((card) => this.$t(card.name))
        .join(' · ');
    },
    /*
     * The card behind a line of points: as it lay on the table, with its resources, or
     * as printed. Not every line is a card -- Turmoil, colonies and a few expansions
     * score under their own names -- and those have nothing to show.
     *
     * A card can score for a player who did not play it: Vermin costs every player VP
     * per city. Then it is shown from its owner's table, with the owner named, so its
     * resources are the ones that counted.
     */
    cardFor(player: PublicPlayerModel, name: string): {card?: CardModel, owner?: Owner} {
      const onTable = player.tableau.find((model) => model.name === name);
      if (onTable !== undefined) {
        return {card: onTable};
      }
      for (const other of this.viewModel.players) {
        const theirs = other.tableau.find((model) => model.name === name);
        if (theirs !== undefined) {
          return {card: theirs, owner: {name: other.name, color: other.color}};
        }
      }
      const card = getCard(name as CardName);
      return card === undefined ? {} : {card: {name: card.name}};
    },
    /* A milestone or award this game had, by name; anything else has no rule to show. */
    medalFor(kind: Medal['kind'], name: string | undefined): Medal | undefined {
      const list: ReadonlyArray<{name: string}> = kind === 'milestone' ? this.game.milestones : this.game.awards;
      return name !== undefined && list.some((each) => each.name === name) ? {kind, name} : undefined;
    },
    open(line: DetailLine): void {
      if (line.card !== undefined) {
        this.shown = {card: line.card, points: line.points, owner: line.owner};
      } else {
        this.medal = line.medal;
      }
    },
    detailLines(player: PublicPlayerModel): Array<DetailLine> {
      const vp = player.victoryPointsBreakdown;
      return [
        ...vp.detailsCards
          .toSorted((a, b) => b.victoryPoint - a.victoryPoint)
          .map((card) => ({
            key: 'card-' + card.cardName,
            points: card.victoryPoint,
            text: this.$t(card.cardName),
            ...this.cardFor(player, card.cardName),
          })),
        // "Claimed ${0} milestone" names the milestone first; "${0} place for ${1} award" the award second.
        ...vp.detailsMilestones.map((detail) => ({
          key: 'm-' + detail.message + detail.messageArgs?.join(),
          points: detail.victoryPoint,
          text: translateMilestoneDetails(detail),
          medal: this.medalFor('milestone', detail.messageArgs?.[0]),
        })),
        ...vp.detailsAwards.map((detail) => ({
          key: 'a-' + detail.message + detail.messageArgs?.join(),
          points: detail.victoryPoint,
          text: translateAwardDetails(detail),
          medal: this.medalFor('award', detail.messageArgs?.[1]),
        })),
      ];
    },
  },
});
</script>
