<template>
  <div class="mobile-more" data-test="mobile-more">
    <template v-if="view === 'menu'">
      <div class="mobile-list">
        <button class="mobile-row mobile-row--button" data-test="more-settings" @click="view = 'settings'">
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-row-title" v-i18n>Settings</span>
            </span>
            <span class="mobile-row-chevron" aria-hidden="true">&rsaquo;</span>
          </span>
        </button>
      </div>

      <h3 class="mobile-eyebrow" v-i18n>Games</h3>
      <div class="mobile-list">
        <a v-for="link in gameLinks" :key="link.path" class="mobile-row mobile-row--button" :href="link.path" :data-test="link.test">
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-row-title">{{ $t(link.label) }}</span>
            </span>
            <span class="mobile-row-chevron" aria-hidden="true">&rsaquo;</span>
          </span>
        </a>
      </div>
      <p class="mobile-section-note" v-i18n>
        This game keeps running while you are away, and Continue a game lists the ones you
        have open on this device. These screens are still drawn for a desktop.
      </p>
    </template>

    <template v-else>
      <div class="mobile-more-head">
        <button class="mobile-plain-button" data-test="more-back" @click="view = 'menu'" v-i18n>Back</button>
      </div>
      <MobileSettings @changed="$emit('settingsChanged')"/>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

import MobileSettings from '@/client/components/mobile/MobileSettings.vue';
import {paths} from '@/common/app/paths';

/*
 * Everything that is not the game in front of you: the settings and the way to
 * another game. The log is a view of its own, beside the turn.
 */

type GameLink = {
  label: string;
  path: string;
  test: string;
};

type DataModel = {
  view: 'menu' | 'settings';
};

export default defineComponent({
  name: 'MobileMore',
  emits: ['settingsChanged'],
  components: {
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
