<template>
  <div class="mobile-players" data-test="mobile-players">
    <template v-if="shown === undefined">
      <section
        v-for="(player, index) in players"
        :key="player.color"
        class="mobile-player"
        :class="{'mobile-player--you': isYou(player)}"
        data-test="mobile-player">
        <div class="mobile-player-head">
          <span class="mobile-choice-standing-dot mobile-player-dot" :class="'player_bg_color_' + player.color"></span>
          <span class="mobile-player-names">
            <span class="mobile-player-name" data-test="mobile-player-name">{{ player.name }}</span>
            <span v-if="corporations(player).length > 0" class="mobile-player-corp">{{ corporations(player).map((name) => $t(name)).join(' · ') }}</span>
          </span>
          <span class="mobile-player-badges">
            <span v-if="index === 0 && players.length > 1" class="mobile-pill" data-test="mobile-player-first" v-i18n>1st</span>
            <span
              v-if="label(player) !== 'none'"
              class="mobile-pill"
              :class="labelClass(player)"
              data-test="mobile-player-status">{{ $t(labelText(player)) }}</span>
            <span v-if="showTimers" class="mobile-pill mobile-player-timer">
              <PlayerTimer :timer="player.timer" :live="playerView.game.phase !== 'end'"/>
            </span>
          </span>
        </div>

        <div class="mobile-player-stats">
          <div v-for="stat in stats(player)" :key="stat.label" class="mobile-stat" :data-test="'mobile-player-' + stat.key">
            <span class="mobile-player-stat-value">{{ stat.value }}</span>
            <span class="mobile-stat-label">{{ $t(stat.label) }}</span>
          </div>
        </div>

        <div class="mobile-resources">
          <div v-for="resource in resources(player)" :key="resource.type" class="mobile-resource">
            <span class="mobile-resource-badged">
              <i class="resource_icon mobile-resource-icon" :class="'resource_icon--' + resource.type"></i>
              <span
                v-if="resource.production !== 0"
                class="mobile-resource-production"
                :class="{'mobile-resource-production--negative': resource.production < 0}">{{ signed(resource.production) }}</span>
            </span>
            <span class="mobile-resource-count">{{ resource.count }}</span>
          </div>
        </div>

        <MobileTagRow :player="player"/>

        <button
          class="mobile-player-more"
          data-test="mobile-player-played"
          :disabled="player.tableau.length === 0"
          @click="shown = player.color">
          <span>{{ $t('Played cards') }} · {{ player.tableau.length }}</span>
          <span class="mobile-row-chevron" aria-hidden="true">&rsaquo;</span>
        </button>
      </section>
    </template>

    <!-- One player's tableau, drawn the way the Cards view draws the player's own. -->
    <template v-else-if="shownPlayer !== undefined">
      <div class="mobile-more-head">
        <button class="mobile-plain-button" data-test="mobile-players-back" @click="shown = undefined" v-i18n>Back</button>
        <span class="mobile-choice-standing-dot mobile-player-dot" :class="'player_bg_color_' + shownPlayer.color"></span>
        <span class="mobile-player-name">{{ shownPlayer.name }}</span>
      </div>
      <div class="mobile-card-scaler mobile-players-cards">
        <div v-for="group in shownGroups" :key="group.title">
          <h3 class="mobile-eyebrow">{{ $t(group.title) }} · {{ group.cards.length }}</h3>
          <div class="mobile-card-grid">
            <div v-for="card in group.cards" :key="card.name" data-test="mobile-players-card">
              <Card
                class="cardbox"
                :card="card"
                :actionUsed="isCardActivated(card, shownPlayer)"
                :cubeColor="shownPlayer.color"/>
            </div>
          </div>
        </div>
        <template v-if="shownPlayer.selfReplicatingRobotsCards.length > 0">
          <h3 class="mobile-eyebrow" v-i18n>Self-replicating Robots cards</h3>
          <div class="mobile-card-grid">
            <div v-for="card in shownPlayer.selfReplicatingRobotsCards" :key="card.name">
              <Card class="cardbox" :card="card"/>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Card from '@/client/components/card/Card.vue';
import MobileTagRow from '@/client/components/mobile/MobileTagRow.vue';
import PlayerTimer from '@/client/components/overview/PlayerTimer.vue';
import {ActionLabel, actionLabel} from '@/client/components/overview/ActionLabel';
import {CardGroup, playedGroups} from '@/client/components/mobile/PlayedCards';
import {getCardsByType, isCardActivated} from '@/client/utils/CardUtils';
import {CardType} from '@/common/cards/CardType';
import {Color} from '@/common/Color';
import {PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';
import {Resource} from '@/common/Resource';

/*
 * Everyone at the table, one card each, in turn order: what they are doing, how they
 * score, what they have and make, and their tags. A tap on a player's played cards
 * opens their tableau in place, with Back to return to the table.
 *
 * It says what the desktop's players overview says, laid out for a phone rather
 * than scaled down to one.
 */

type Stat = {
  key: string;
  label: string;
  value: string | number;
};

type ResourceReadout = {
  type: Resource;
  count: number;
  production: number;
};

const LABEL_TEXT: Record<ActionLabel, string> = {
  'active': 'Active',
  'passed': 'Passed',
  'next': 'Next',
  'drafting': 'Drafting',
  'researching': 'Researching',
  'none': '',
  '': '',
};

type DataModel = {
  /** The player whose tableau is open, if one is. */
  shown: Color | undefined;
};

export default defineComponent({
  name: 'MobilePlayersOverview',
  props: {
    playerView: {
      type: Object as PropType<ViewModel>,
      required: true,
    },
  },
  components: {
    Card,
    MobileTagRow,
    PlayerTimer,
  },
  data(): DataModel {
    return {
      shown: undefined,
    };
  },
  watch: {
    // The overlay scrolls as a whole, so a tableau opened from the last player down
    // would open with its Back button out of sight.
    shown() {
      this.$nextTick(() => {
        const el = this.$el as HTMLElement;
        el.scrollIntoView?.({block: 'start'});
      });
    },
  },
  computed: {
    players(): ReadonlyArray<PublicPlayerModel> {
      return this.playerView.players;
    },
    showTimers(): boolean {
      return this.playerView.game.gameOptions.showTimers;
    },
    shownPlayer(): PublicPlayerModel | undefined {
      return this.players.find((player) => player.color === this.shown);
    },
    shownGroups(): ReadonlyArray<CardGroup> {
      return this.shownPlayer === undefined ? [] : playedGroups(this.shownPlayer.tableau);
    },
    isCardActivated(): typeof isCardActivated {
      return isCardActivated;
    },
  },
  methods: {
    isYou(player: PublicPlayerModel): boolean {
      return player.color === this.playerView.thisPlayer?.color;
    },
    label(player: PublicPlayerModel): ActionLabel {
      return actionLabel(this.playerView, player);
    },
    labelText(player: PublicPlayerModel): string {
      return LABEL_TEXT[this.label(player)];
    },
    labelClass(player: PublicPlayerModel): Record<string, boolean> {
      const label = this.label(player);
      return {
        'mobile-pill--accent': label === 'active' || label === 'drafting' || label === 'researching',
      };
    },
    corporations(player: PublicPlayerModel): Array<string> {
      return getCardsByType(player.tableau, [CardType.CORPORATION]).map((card) => card.name);
    },
    stats(player: PublicPlayerModel): Array<Stat> {
      const hideVp = !this.playerView.game.gameOptions.showOtherPlayersVP && !this.isYou(player);
      const stats: Array<Stat> = [
        {key: 'vp', label: 'VP', value: hideVp ? '?' : player.victoryPointsBreakdown.total},
        {key: 'tr', label: 'TR', value: player.terraformRating},
        {key: 'hand', label: 'Hand', value: player.cardsInHandNbr},
        {key: 'actions', label: 'Actions', value: player.availableBlueCardActionCount},
      ];
      if (this.playerView.game.turmoil !== undefined) {
        stats.push({key: 'influence', label: 'Influence', value: player.influence});
      }
      return stats;
    },
    resources(player: PublicPlayerModel): Array<ResourceReadout> {
      return [
        {type: Resource.MEGACREDITS, count: player.megacredits, production: player.megacreditProduction},
        {type: Resource.STEEL, count: player.steel, production: player.steelProduction},
        {type: Resource.TITANIUM, count: player.titanium, production: player.titaniumProduction},
        {type: Resource.PLANTS, count: player.plants, production: player.plantProduction},
        {type: Resource.ENERGY, count: player.energy, production: player.energyProduction},
        {type: Resource.HEAT, count: player.heat, production: player.heatProduction},
      ];
    },
    signed(value: number): string {
      return value > 0 ? '+' + value : String(value);
    },
  },
});
</script>
