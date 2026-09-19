<template>
  <header class="mobile-header">
    <div class="mobile-header-row">
      <div class="mobile-stat">
        <span class="mobile-stat-label" v-i18n>Gen</span>
        <span class="mobile-stat-value mobile-num">{{ game.generation }}</span>
      </div>
      <div class="mobile-stat mobile-stat--tr">
        <span class="mobile-stat-label" v-i18n>TR</span>
        <span class="mobile-stat-value mobile-num">{{ player.terraformRating }}</span>
      </div>
      <div class="mobile-globals">
        <div
          v-for="parameter in globalParameters"
          :key="parameter.key"
          class="mobile-global"
          :class="'mobile-global--' + parameter.key">
          <span class="mobile-num">
            <span class="mobile-global-value">{{ parameter.current }}</span>
            <span class="mobile-global-max">/{{ parameter.max }}</span>
          </span>
          <span class="mobile-global-key">{{ parameter.label }}</span>
        </div>
      </div>
    </div>

    <div class="mobile-header-row">
      <div class="mobile-resources">
        <div v-for="resource in resources" :key="resource.type" class="mobile-resource">
          <i class="resource_icon" :class="'resource_icon--' + resource.type"></i>
          <span class="mobile-resource-count mobile-num">{{ resource.count }}</span>
          <span class="mobile-resource-production mobile-num">{{ productionLabel(resource.production) }}</span>
        </div>
      </div>
      <button class="mobile-gear" :aria-label="$t('Settings')" @click="$emit('openSettings')">&#9881;</button>
    </div>

    <MobileTagRow v-if="showTagRow" :player="player" :open="tagRowOpen" @toggle="$emit('toggleTagRow')"/>
  </header>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import * as constants from '@/common/constants';
import MobileTagRow from '@/client/components/mobile/MobileTagRow.vue';
import {GameModel} from '@/common/models/GameModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Resource} from '@/common/Resource';

type GlobalParameter = {
  key: string;
  label: string;
  current: string;
  max: string;
};

type ResourceReadout = {
  type: Resource;
  count: number;
  production: number;
};

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
    showTagRow: {
      type: Boolean,
      required: true,
    },
    tagRowOpen: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['openSettings', 'toggleTagRow'],
  components: {
    MobileTagRow,
  },
  computed: {
    globalParameters(): Array<GlobalParameter> {
      const parameters: Array<GlobalParameter> = [
        {
          key: 'temperature',
          label: this.$t('Temp'),
          current: this.signed(this.game.temperature) + '°',
          max: this.signed(constants.MAX_TEMPERATURE) + '°',
        },
        {
          key: 'oxygen',
          label: this.$t('Oxy'),
          current: this.game.oxygenLevel + '%',
          max: constants.MAX_OXYGEN_LEVEL + '%',
        },
        {
          key: 'ocean',
          label: this.$t('Ocean'),
          current: String(this.game.oceans),
          max: String(constants.MAX_OCEAN_TILES),
        },
      ];
      if (this.game.gameOptions.expansions.venus) {
        parameters.push({
          key: 'venus',
          label: this.$t('Venus'),
          current: String(this.game.venusScaleLevel),
          max: String(constants.MAX_VENUS_SCALE),
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
    productionLabel(production: number): string {
      return this.signed(production);
    },
  },
});
</script>
