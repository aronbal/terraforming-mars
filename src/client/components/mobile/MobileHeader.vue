<template>
  <header class="mobile-header">
    <div class="mobile-header-top">
      <span class="mobile-header-title">{{ $t('Generation') }} {{ game.generation }}</span>
      <!-- With a question waiting and the sheet put away, the pill is the way back to it
           from any view. -->
      <button
        v-if="canOpenSheet"
        class="mobile-pill mobile-pill--accent mobile-pill--button"
        data-test="turn-pill"
        @click="$emit('openSheet')">{{ $t(turnLabel) }} <span aria-hidden="true">&rsaquo;</span></button>
      <span v-else class="mobile-pill" :class="{'mobile-pill--accent': yourTurn}" data-test="turn-pill">{{ $t(turnLabel) }}</span>
      <div class="mobile-header-tools">
        <button class="mobile-icon-button" :aria-label="$t('Players')" data-test="open-players" @click="$emit('openPlayers')">
          <MobileIcon name="users"/>
        </button>
        <button class="mobile-icon-button" :aria-label="$t('Menu')" data-test="open-menu" @click="$emit('openMenu')">
          <MobileIcon name="ellipsis"/>
        </button>
      </div>
    </div>

    <div class="mobile-header-globals">
      <div
        v-for="parameter in globalParameters"
        :key="parameter.key"
        class="mobile-global"
        :data-test="'global-' + parameter.key">
        <svg class="mobile-ring" width="28" height="28" viewBox="0 0 32 32" role="img" :aria-label="parameter.passed + '/' + parameter.total">
          <circle class="mobile-ring-track" cx="16" cy="16" r="14"/>
          <circle
            class="mobile-ring-arc"
            cx="16"
            cy="16"
            r="14"
            :stroke-dasharray="ringLength"
            :stroke-dashoffset="ringLength * (1 - parameter.passed / parameter.total)"
            transform="rotate(-90 16 16)"/>
        </svg>
        <div class="mobile-stat">
          <span class="mobile-stat-value">{{ parameter.value }}</span>
          <span class="mobile-stat-label">{{ $t(parameter.label) }}</span>
        </div>
      </div>
      <div class="mobile-stat mobile-stat--tr" data-test="tr">
        <span class="mobile-stat-value">{{ player.terraformRating }}</span>
        <span class="mobile-stat-label" v-i18n>TR</span>
      </div>
    </div>

    <div class="mobile-resources">
      <div v-for="resource in resources" :key="resource.type" class="mobile-resource" :data-test="'resource-' + resource.type">
        <div class="mobile-resource-amount">
          <i class="resource_icon mobile-resource-icon" :class="'resource_icon--' + resource.type"></i>
          <span class="mobile-resource-count">{{ resource.count }}</span>
        </div>
        <span class="mobile-resource-production">{{ signed(resource.production) }}</span>
      </div>
    </div>

    <!-- The views moved to the tab bar at the bottom; the tags have their place. -->
    <MobileTagRow v-if="showTagRow" :player="player"/>
  </header>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import * as constants from '@/common/constants';
import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import MobileTagRow from '@/client/components/mobile/MobileTagRow.vue';
import {GameModel} from '@/common/models/GameModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Resource} from '@/common/Resource';

/*
 * The shell's header: whose turn it is, how far Mars has come, what the player has,
 * and which tags they hold.
 *
 * Each global parameter is a ring of the steps it has left to go, with its value
 * beside it, so how close the game is to ending is read at a glance rather than
 * worked out from current-over-maximum. The ring carries no number of its own: the
 * value beside it already says it.
 */

type GlobalParameter = {
  key: string;
  label: string;
  value: string;
  /** Steps taken from the parameter's starting value. */
  passed: number;
  /** Steps from its start to its maximum. */
  total: number;
};

type ResourceReadout = {
  type: Resource;
  count: number;
  production: number;
};

// The ring's circumference, for a radius of 14 in its 32-unit box.
const RING_LENGTH = 2 * Math.PI * 14;

export default defineComponent({
  name: 'MobileHeader',
  props: {
    game: {
      type: Object as PropType<GameModel>,
      required: true,
    },
    player: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
    /** Whether the server is waiting for this player to act. */
    yourTurn: {
      type: Boolean,
      required: true,
    },
    /** The pill beside the generation: `Your turn`, or what the player is waiting on. */
    turnLabel: {
      type: String,
      required: true,
    },
    showTagRow: {
      type: Boolean,
      required: true,
    },
    /** Whether a question is waiting in the sheet while the sheet is put away. */
    canOpenSheet: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['openPlayers', 'openMenu', 'openSheet'],
  components: {
    MobileIcon,
    MobileTagRow,
  },
  computed: {
    ringLength(): number {
      return RING_LENGTH;
    },
    globalParameters(): Array<GlobalParameter> {
      const game = this.game;
      const parameters: Array<GlobalParameter> = [
        {
          key: 'temperature',
          label: 'Temp',
          value: this.signed(game.temperature) + '°',
          // The temperature moves in steps of two degrees.
          passed: (game.temperature - constants.MIN_TEMPERATURE) / 2,
          total: (constants.MAX_TEMPERATURE - constants.MIN_TEMPERATURE) / 2,
        },
        {
          key: 'oxygen',
          label: 'Oxygen',
          value: game.oxygenLevel + '%',
          passed: game.oxygenLevel - constants.MIN_OXYGEN_LEVEL,
          total: constants.MAX_OXYGEN_LEVEL - constants.MIN_OXYGEN_LEVEL,
        },
        {
          key: 'oceans',
          label: 'Oceans',
          value: game.oceans + '/' + constants.MAX_OCEAN_TILES,
          passed: game.oceans,
          total: constants.MAX_OCEAN_TILES,
        },
      ];
      if (game.gameOptions.expansions.venus) {
        parameters.push({
          key: 'venus',
          label: 'Venus',
          value: game.venusScaleLevel + '%',
          // Venus moves in steps of two percent.
          passed: (game.venusScaleLevel - constants.MIN_VENUS_SCALE) / 2,
          total: (constants.MAX_VENUS_SCALE - constants.MIN_VENUS_SCALE) / 2,
        });
      }
      return parameters;
    },
    resources(): Array<ResourceReadout> {
      const player = this.player;
      return [
        {type: Resource.MEGACREDITS, count: player.megacredits, production: player.megacreditProduction},
        {type: Resource.STEEL, count: player.steel, production: player.steelProduction},
        {type: Resource.TITANIUM, count: player.titanium, production: player.titaniumProduction},
        {type: Resource.PLANTS, count: player.plants, production: player.plantProduction},
        {type: Resource.ENERGY, count: player.energy, production: player.energyProduction},
        {type: Resource.HEAT, count: player.heat, production: player.heatProduction},
      ];
    },
  },
  methods: {
    signed(value: number): string {
      return value > 0 ? '+' + value : String(value);
    },
  },
});
</script>
