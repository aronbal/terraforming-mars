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
      <!-- The game's own settings, which everyone in it shares, ahead of this device's. -->
      <template v-if="playerView !== undefined && playerView.game.phase !== 'end'">
        <h3 class="mobile-settings-group" v-i18n>This game</h3>
        <div class="mobile-list">
          <label class="mobile-row mobile-more-switch" data-test="more-undo">
            <span class="mobile-row-body">
              <span class="mobile-row-text">
                <span class="mobile-row-title" v-i18n>Undo</span>
                <span class="mobile-row-subtitle" v-i18n>Take back your last action. Works from your next action on.</span>
              </span>
              <span class="form-switch">
                <input
                  type="checkbox"
                  :checked="playerView.game.gameOptions.undoOption"
                  :disabled="saving"
                  data-test="more-undo-switch"
                  @change="setUndo($event)">
                <i class="form-icon"></i>
              </span>
            </span>
          </label>
        </div>
      </template>
      <MobileSettings @changed="$emit('settingsChanged')"/>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import MobileSettings from '@/client/components/mobile/MobileSettings.vue';
import {paths} from '@/common/app/paths';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {requestPlayerView} from '@/client/utils/playerInputRequest';

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
  /** While a change to the game's own settings is on its way to the server. */
  saving: boolean;
};

export default defineComponent({
  name: 'MobileMore',
  props: {
    /** The game being played, whose own settings head the menu. */
    playerView: {
      type: Object as PropType<PlayerViewModel | undefined>,
      default: undefined,
    },
  },
  emits: ['settingsChanged'],
  components: {
    MobileSettings,
  },
  data(): DataModel {
    return {
      view: 'menu',
      saving: false,
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
  methods: {
    /* Undo is the game's, not this device's: it is set on the server, which answers
       with the game as it now stands, and everyone sees in the log who changed it. */
    async setUndo(event: Event): Promise<void> {
      const playerView = this.playerView;
      if (playerView === undefined) {
        return;
      }
      const enabled = (event.target as HTMLInputElement).checked;
      this.saving = true;
      try {
        const url = paths.API_GAME_UNDO + '?id=' + playerView.id + '&undo=' + enabled;
        if (!await requestPlayerView(this, playerView, url, {method: 'POST'})) {
          (event.target as HTMLInputElement).checked = !enabled;
        }
      } finally {
        this.saving = false;
      }
    },
  },
});
</script>
