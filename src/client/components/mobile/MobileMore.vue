<template>
  <div class="mobile-more" data-test="mobile-more">
    <template v-if="view === 'menu'">
      <!-- An installed app shows no address bar, so this is the only way to the link. -->
      <template v-if="playerView !== undefined">
        <h3 class="mobile-eyebrow" v-i18n>This game</h3>
        <div class="mobile-list">
          <div class="mobile-row" data-test="more-game-link">
            <span class="mobile-row-body">
              <span class="mobile-row-text">
                <span class="mobile-row-title" v-i18n>Your link to this game</span>
                <span ref="url" class="mobile-row-subtitle mobile-more-url" data-test="more-game-url">{{ gameUrl }}</span>
              </span>
              <button class="mobile-plain-button" data-test="more-copy-link" @click="copyLink">{{ $t(copied ? 'Copied' : 'Copy') }}</button>
            </span>
          </div>
          <button
            v-if="canGoBack"
            class="mobile-row mobile-row--button"
            data-test="more-rollback"
            :disabled="saving"
            @click="goBack">
            <span class="mobile-row-body">
              <span class="mobile-row-text">
                <span class="mobile-row-title" v-i18n>Go back one save</span>
                <span class="mobile-row-subtitle mobile-more-wrap" v-i18n>Further back than Undo: to the save before the last one. Only you, as the one who set up the game, can.</span>
              </span>
            </span>
          </button>
        </div>
        <p class="mobile-section-note" v-i18n>
          It opens this game as you, in any browser. Share it only with someone who may play for you.
        </p>
      </template>

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
        <h3 class="mobile-eyebrow" v-i18n>This game</h3>
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
  /** Once the game's link is on the clipboard. */
  copied: boolean;
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
      copied: false,
    };
  },
  computed: {
    /* For the game master, while the game runs. */
    canGoBack(): boolean {
      return this.playerView !== undefined && this.playerView.isGameMaster && this.playerView.game.phase !== 'end';
    },
    gameUrl(): string {
      return window.location.origin + '/' + paths.PLAYER + '?id=' + this.playerView?.id;
    },
    gameLinks(): ReadonlyArray<GameLink> {
      return [
        {label: 'New game', path: '/' + paths.NEW_GAME, test: 'more-new-game'},
        {label: 'Continue a game', path: '/' + paths.CONTINUE_GAME, test: 'more-continue'},
        {label: 'All games', path: '/' + paths.GAMES_OVERVIEW, test: 'more-games'},
      ];
    },
  },
  methods: {
    /* Where the clipboard is refused, the link is selected instead, for the phone's own Copy. */
    async copyLink(): Promise<void> {
      try {
        await navigator.clipboard.writeText(this.gameUrl);
        this.copied = true;
      } catch (err) {
        console.warn('Cannot copy the game link', err);
        window.getSelection()?.selectAllChildren(this.$refs.url as HTMLElement);
      }
    },
    /* The save gone back from is deleted, so this asks first. */
    async goBack(): Promise<void> {
      const playerView = this.playerView;
      if (playerView === undefined || !window.confirm(this.$t('Go back one save? The latest save is deleted, and every move made since is taken back.'))) {
        return;
      }
      this.saving = true;
      try {
        await requestPlayerView(this, playerView, paths.API_GAME_ROLLBACK + '?id=' + playerView.id, {method: 'POST'});
      } finally {
        this.saving = false;
      }
    },
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
