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
        :class="{'mobile-global--done': parameter.passed >= parameter.total}"
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
          <!-- At its maximum: a tick in the ring, so a finished parameter is told apart at a glance. -->
          <path v-if="parameter.passed >= parameter.total" class="mobile-ring-check" d="M10 16.5l4 4 8-9" data-test="global-done"/>
        </svg>
        <div class="mobile-stat">
          <span class="mobile-stat-value" :data-test="'global-value-' + parameter.key">{{ parameter.value }}<span class="mobile-stat-goal">/{{ parameter.goal }}</span></span>
          <span class="mobile-stat-label">{{ $t(parameter.label) }}</span>
        </div>
      </div>
      <div class="mobile-stat mobile-stat--tr" data-test="tr">
        <span class="mobile-stat-value">{{ player.terraformRating }}</span>
        <span class="mobile-stat-label" v-i18n>TR</span>
      </div>
    </div>

    <div class="mobile-resources">
      <!-- What the player has beside each icon, and what it makes each generation
           tucked into the icon's corner, the way the tags carry their counts. -->
      <div v-for="resource in resources" :key="resource.type" class="mobile-resource" :data-test="'resource-' + resource.type">
        <span class="mobile-resource-badged">
          <i class="resource_icon mobile-resource-icon" :class="'resource_icon--' + resource.type"></i>
          <!-- What one is worth in M€, on the coin it pays as, marked once an effect
               has raised it. -->
          <span
            v-if="resource.value !== undefined"
            class="mobile-resource-value"
            :class="{'mobile-resource-value--raised': resource.raised}"
            :aria-label="resource.value + ' M€'"
            data-test="resource-value">{{ resource.value }}</span>
          <span
            v-if="resource.production !== 0"
            class="mobile-resource-production"
            :class="{'mobile-resource-production--negative': resource.production < 0}"
            data-test="resource-production">{{ signed(resource.production) }}</span>
        </span>
        <span class="mobile-resource-count">{{ resource.count }}</span>
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
import {CardName} from '@/common/cards/CardName';

/*
 * The shell's header: whose turn it is, how far Mars has come, what the player has,
 * and which tags they hold.
 *
 * Each global parameter is a ring of the steps it has left to go, with its value and
 * its goal beside it -- `-4°/+8°`, `9/14%`, `5/9` -- so how close the game is to
 * ending is read at a glance. A parameter at its goal turns its ring green with a
 * tick in it.
 */

type GlobalParameter = {
  key: string;
  label: string;
  value: string;
  /** The value it ends at, written the way `value` is. */
  goal: string;
  /** Steps taken from the parameter's starting value. */
  passed: number;
  /** Steps from its start to its maximum. */
  total: number;
};

type ResourceReadout = {
  type: Resource;
  count: number;
  production: number;
  /** What one pays in M€, for the resources that pay for things. */
  value?: number;
  /** Whether an effect has made it worth more than it is to begin with. */
  raised?: boolean;
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
          goal: this.signed(constants.MAX_TEMPERATURE) + '°',
          // The temperature moves in steps of two degrees.
          passed: (game.temperature - constants.MIN_TEMPERATURE) / 2,
          total: (constants.MAX_TEMPERATURE - constants.MIN_TEMPERATURE) / 2,
        },
        {
          key: 'oxygen',
          label: 'Oxygen',
          value: String(game.oxygenLevel),
          goal: constants.MAX_OXYGEN_LEVEL + '%',
          passed: game.oxygenLevel - constants.MIN_OXYGEN_LEVEL,
          total: constants.MAX_OXYGEN_LEVEL - constants.MIN_OXYGEN_LEVEL,
        },
        {
          key: 'oceans',
          label: 'Oceans',
          value: String(game.oceans),
          goal: String(constants.MAX_OCEAN_TILES),
          passed: game.oceans,
          total: constants.MAX_OCEAN_TILES,
        },
      ];
      if (game.gameOptions.expansions.venus) {
        parameters.push({
          key: 'venus',
          label: 'Venus',
          value: String(game.venusScaleLevel),
          goal: constants.MAX_VENUS_SCALE + '%',
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
        {
          type: Resource.STEEL, count: player.steel, production: player.steelProduction,
          value: player.steelValue, raised: player.steelValue > constants.DEFAULT_STEEL_VALUE,
        },
        {
          type: Resource.TITANIUM, count: player.titanium, production: player.titaniumProduction,
          value: player.titaniumValue, raised: player.titaniumValue > constants.DEFAULT_TITANIUM_VALUE,
        },
        {type: Resource.PLANTS, count: player.plants, production: player.plantProduction},
        {type: Resource.ENERGY, count: player.energy, production: player.energyProduction},
        {
          type: Resource.HEAT, count: player.heat, production: player.heatProduction,
          // Helion pays with heat as M€, as the desktop's resource panel shows.
          value: this.heatPays ? 1 : undefined,
        },
      ];
    },
    heatPays(): boolean {
      return this.player.tableau.some((card) => card.name === CardName.HELION);
    },
  },
  methods: {
    signed(value: number): string {
      return value > 0 ? '+' + value : String(value);
    },
  },
});
</script>
