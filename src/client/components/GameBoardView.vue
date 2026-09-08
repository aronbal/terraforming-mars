<!-- Common widgets between player and spectator views -->
<template>
  <a name="board" class="player_home_anchor hotkey-target"></a>
  <div class="board-container">
    <Board
      :spaces="game.spaces"
      :expansions="game.gameOptions.expansions"
      :venusScaleLevel="game.venusScaleLevel"
      :boardName ="game.gameOptions.boardName"
      :oceans_count="game.oceans"
      :oxygen_level="game.oxygenLevel"
      :temperature="game.temperature"
      :altVenusBoard="game.gameOptions.altVenusBoard"
      :aresData="game.aresData"
      :tileView="tileView"
      @toggleTileView="$emit('toggleTileView')"
      id="shortkey-board"
    />
  </div>

  <div class="mobile-global-parameters">
    <div class="global-numbers-temperature mobile-parameter">
      <div :class="getScaleCSS(lvl)" v-for="(lvl, idx) in getValuesForParameter('temperature')" :key="idx">{{ lvl.strValue }}</div>
    </div>
    <div class="global-numbers-oxygen mobile-parameter">
      <div :class="getScaleCSS(lvl)" v-for="(lvl, idx) in getValuesForParameter('oxygen')" :key="idx">{{ lvl.strValue }}</div>
    </div>
    <div class="global-numbers-venus mobile-parameter" v-if="game.gameOptions.expansions.venus">
      <div :class="getScaleCSS(lvl)" v-for="(lvl, idx) in getValuesForParameter('venus')" :key="idx">{{ lvl.strValue }}</div>
    </div>
    <div class="global-numbers-oceans mobile-parameter">
      <span v-if="game.oceans === constants.MAX_OCEAN_TILES">
        <img width="20" src="assets/misc/circle-checkmark.png" class="board-ocean-checkmark" :alt="$t('Completed!')">
      </span>
      <span v-else>
        {{ game.oceans }}/{{ constants.MAX_OCEAN_TILES }}
      </span>
    </div>
  </div>

  <template v-if="game.turmoil">
    <a class="hotkey-target"></a>
    <Turmoil :turmoil="game.turmoil"/>
  </template>

  <template v-if="game.moon">
    <a class="hotkey-target"></a>
    <MoonBoard :model="game.moon" :tileView="tileView" id="shortkey-moonBoard"/>
  </template>

  <template v-if="game.gameOptions.expansions.pathfinders">
    <a class="hotkey-target"></a>
    <PlanetaryTracks :tracks="game.pathfinders" :gameOptions="game.gameOptions"/>
  </template>

  <DeltaProjectBoard v-if="game.gameOptions.expansions.deltaProject" :players="players"/>

  <div v-if="players.length > 1" class="player_home_block--milestones-and-awards mobile-milestones-awards">
    <a class="hotkey-target"></a>
    <Milestones :milestones="game.milestones" />
    <Awards :awards="game.awards" />
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import {GameModel} from '@/common/models/GameModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SpaceId} from '@/common/Types';
import Board from '@/client/components/Board.vue';
import DeltaProjectBoard from '@/client/components/delta/DeltaProjectBoard.vue';
import Milestones from '@/client/components/Milestones.vue';
import Awards from '@/client/components/Awards.vue';
import Turmoil from '@/client/components/turmoil/Turmoil.vue';
import MoonBoard from '@/client/components/moon/MoonBoard.vue';
import PlanetaryTracks from '@/client/components/pathfinders/PlanetaryTracks.vue';
import {TileView} from './board/TileView';
import {scrollToSpace} from '@/client/utils/boardScroll';
import * as constants from '@/common/constants';

class GlobalParamLevel {
  constructor(public value: number, public isActive: boolean, public strValue: string) {
  }
}

export default defineComponent({
  name: 'GameBoardView',
  props: {
    game: {
      type: Object as () => GameModel,
      required: true,
    },
    tileView: {
      type: String as () => TileView,
      required: true,
    },
    players: {
      type: Array as PropType<ReadonlyArray<PublicPlayerModel>>,
      required: true,
    },
  },
  emits: ['toggleTileView'],
  components: {
    Board,
    DeltaProjectBoard,
    Milestones,
    Awards,
    Turmoil,
    MoonBoard,
    PlanetaryTracks,
  },
  methods: {
    highlightSpace(spaceId: SpaceId) {
      scrollToSpace(spaceId);

      const regions = ['main_board', 'moon_board', 'moon_board_outer_spaces'];
      for (const region of regions) {
        const board = document.getElementById(region);
        if (board !== null) {
          const array = board.getElementsByClassName('board-log-highlight');
          for (let i = 0, length = array.length; i < length; i++) {
            const element = array[i] as HTMLElement;
            if (element.getAttribute('data_log_highlight_id') === spaceId) {
              element.classList.add('highlight');
              setTimeout(() => {
                element.classList.remove('highlight');
              }, 3000);
              return;
            }
          }
        }
      }
    },
    getValuesForParameter(targetParameter: string): Array<GlobalParamLevel> {
      const values = [];
      let startValue: number;
      let endValue: number;
      let step: number;
      let curValue: number;
      let strValue: string;

      switch (targetParameter) {
      case 'oxygen':
        startValue = constants.MIN_OXYGEN_LEVEL;
        endValue = constants.MAX_OXYGEN_LEVEL;
        step = 1;
        curValue = this.game.oxygenLevel;
        break;
      case 'temperature':
        startValue = constants.MIN_TEMPERATURE;
        endValue = constants.MAX_TEMPERATURE;
        step = 2;
        curValue = this.game.temperature;
        break;
      case 'venus':
        startValue = constants.MIN_VENUS_SCALE;
        endValue = constants.MAX_VENUS_SCALE;
        step = 2;
        curValue = this.game.venusScaleLevel;
        break;
      default:
        throw new Error('Wrong parameter to get values from: ' + targetParameter);
      }

      for (let value = endValue; value >= startValue; value -= step) {
        strValue = (targetParameter === 'temperature' && value > 0) ? '+'+value : value.toString();
        values.push(
          new GlobalParamLevel(value, value === curValue, strValue),
        );
      }
      return values;
    },
    getScaleCSS(paramLevel: GlobalParamLevel): string {
      let css = 'global-numbers-value val-' + paramLevel.value + ' ';
      if (paramLevel.isActive) {
        css += 'val-is-active';
      }
      return css;
    },
  },
  computed: {
    constants() {
      return constants;
    },
  },
});
</script>

<style scoped>
.board-container {
  width: 100%;
  overflow-x: auto;
  margin-bottom: 10px;
}

.mobile-global-parameters {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 5px;
  margin-bottom: 10px;
}

.mobile-parameter {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px;
}

@media (min-width: 769px) {
  .mobile-global-parameters,
  .mobile-milestones-awards {
    display: none;
  }
}
</style>
