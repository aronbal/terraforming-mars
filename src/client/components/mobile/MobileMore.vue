<template>
  <div class="mobile-more" data-test="mobile-more">
    <template v-if="view === 'menu'">
      <h2 class="mobile-more-title" v-i18n>More</h2>

      <div class="mobile-more-group">
        <button class="mobile-more-row" data-test="more-log" @click="view = 'log'">
          <span class="mobile-more-name" v-i18n>Game log</span>
          <span class="mobile-more-chevron">&rsaquo;</span>
        </button>
        <button class="mobile-more-row" data-test="more-settings" @click="view = 'settings'">
          <span class="mobile-more-name" v-i18n>Settings</span>
          <span class="mobile-more-chevron">&rsaquo;</span>
        </button>
      </div>

      <h3 class="mobile-more-group-title" v-i18n>Games</h3>
      <div class="mobile-more-group">
        <a v-for="link in gameLinks" :key="link.path" class="mobile-more-row" :href="link.path" :data-test="link.test">
          <span class="mobile-more-name">{{ $t(link.label) }}</span>
          <span class="mobile-more-chevron">&rsaquo;</span>
        </a>
      </div>
      <p class="mobile-more-note" v-i18n>
        This game keeps running while you are away, and Continue a game lists the ones you
        have open on this device. These screens are still drawn for a desktop.
      </p>
    </template>

    <template v-else-if="view === 'log'">
      <div class="mobile-more-head">
        <button class="mobile-button" data-test="more-back" @click="view = 'menu'" v-i18n>Back</button>
        <span class="mobile-more-head-title" v-i18n>Game log</span>
      </div>
      <LogPanel
        :viewModel="playerView"
        :color="playerView.thisPlayer.color"
        :step="playerView.game.step"
        @spaceClicked="$emit('spaceClicked', $event)"/>
    </template>

    <template v-else>
      <div class="mobile-more-head">
        <button class="mobile-button" data-test="more-back" @click="view = 'menu'" v-i18n>Back</button>
        <span class="mobile-more-head-title" v-i18n>Settings</span>
      </div>
      <MobileSettings @changed="$emit('settingsChanged')"/>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import LogPanel from '@/client/components/logpanel/LogPanel.vue';
import MobileSettings from '@/client/components/mobile/MobileSettings.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {paths} from '@/common/app/paths';

/*
 * Everything that is not the game in front of you.
 *
 * The log, the settings and the way to another game are all things a player reaches
 * for between decisions rather than during one, so they share the last tab instead of
 * each taking one of the five. Each opens as its own screen, with the way back where
 * a phone expects it.
 */

type GameLink = {
  label: string;
  path: string;
  test: string;
};

type DataModel = {
  view: 'menu' | 'log' | 'settings';
};

export default defineComponent({
  name: 'MobileMore',
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
  },
  emits: ['settingsChanged', 'spaceClicked'],
  components: {
    LogPanel,
    MobileSettings,
  },
  data(): DataModel {
    return {
      view: 'menu',
    };
  },
  computed: {
    gameLinks(): ReadonlyArray<GameLink> {
      return [
        {label: 'New game', path: '/' + paths.NEW_GAME, test: 'more-new-game'},
        {label: 'Continue a game', path: '/' + paths.CONTINUE_GAME, test: 'more-continue'},
        {label: 'All games', path: '/' + paths.GAMES_OVERVIEW, test: 'more-games'},
      ];
    },
  },
});
</script>
