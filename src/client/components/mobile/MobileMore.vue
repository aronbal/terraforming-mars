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
            @click="openSaves">
            <span class="mobile-row-body">
              <span class="mobile-row-text">
                <span class="mobile-row-title" v-i18n>Go back to an earlier save</span>
                <span class="mobile-row-subtitle mobile-more-wrap" v-i18n>Further back than Undo: pick the move to go back to. Only you, as the one who set up the game, can.</span>
              </span>
              <span class="mobile-row-chevron" aria-hidden="true">&rsaquo;</span>
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
        <!-- An app added to the home screen has no reload button, and the shell holds
             the page still, so it has no pull to refresh either. -->
        <button class="mobile-row mobile-row--button" data-test="more-reload" @click="reload">
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-row-title" v-i18n>Reload</span>
              <span class="mobile-row-subtitle mobile-more-wrap" v-i18n>Loads the page again, with the game as the server has it.</span>
            </span>
          </span>
        </button>
      </div>

      <!-- The rules and the news, read here: a new tab would leave the game. -->
      <h3 class="mobile-eyebrow" v-i18n>Help</h3>
      <div class="mobile-list">
        <button
          v-for="link in helpLinks"
          :key="link.href"
          type="button"
          class="mobile-row mobile-row--button"
          :data-test="link.test"
          @click="openHelp(link.href)">
          <span class="mobile-glyph mobile-glyph--neutral">
            <MobileIcon :name="link.icon" :size="16"/>
          </span>
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-row-title">{{ $t(link.label) }}</span>
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

    <!-- The saves to go back to, newest first, each named by the move made just before it. -->
    <template v-else-if="view === 'saves'">
      <div class="mobile-more-head">
        <button class="mobile-plain-button" data-test="more-back" @click="view = 'menu'" v-i18n>Back</button>
      </div>
      <h3 class="mobile-eyebrow" v-i18n>Go back to just after</h3>
      <p v-if="saves === undefined" class="mobile-section-note" data-test="more-saves-loading" v-i18n>Loading</p>
      <p v-else-if="savesFailed" class="mobile-section-note" data-test="more-saves-failed" v-i18n>The saves could not be loaded. Try again in a moment.</p>
      <p v-else-if="saveRows.length === 0" class="mobile-section-note" data-test="more-saves-empty" v-i18n>There is no earlier save to go back to.</p>
      <div v-else class="mobile-list">
        <button
          v-for="row in saveRows"
          :key="row.saveId"
          class="mobile-row mobile-row--button"
          data-test="more-save"
          :disabled="saving"
          @click="goBackTo(row.saveId)">
          <span class="mobile-glyph" :class="row.glyphClass">
            <MobileIcon :name="row.icon" :size="16"/>
          </span>
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-row-title">{{ row.title }}</span>
              <span class="mobile-row-subtitle">{{ row.subtitle }}</span>
            </span>
          </span>
        </button>
      </div>
      <p class="mobile-section-note" v-i18n>
        Each save is the game just after the move shown. Going back to one takes back every
        move made since, for everyone, and deletes the later saves.
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

import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import MobileSettings from '@/client/components/mobile/MobileSettings.vue';
import {LogPlayer, formatAgo, glyphClassOf, isEventLine, toEvent} from '@/client/components/mobile/MobileLog';
import {MobileIconName} from '@/client/components/mobile/MobileIcons';
import {paths} from '@/common/app/paths';
import {HELP_PAGES, openReaderAt} from '@/client/components/reader/reader';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SaveModel} from '@/common/models/SaveModel';
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

/** A page of the wiki or the README, opened in the app's reader. */
type HelpLink = {
  label: string;
  href: string;
  icon: MobileIconName;
  test: string;
};

/** An earlier save as a row: the move made just before it, and when and where in the game. */
type SaveRow = {
  saveId: number;
  title: string;
  subtitle: string;
  icon: MobileIconName;
  glyphClass: string;
};

type DataModel = {
  view: 'menu' | 'settings' | 'saves';
  /** The saves the game master can go back to, once they have come. */
  saves: ReadonlyArray<SaveModel> | undefined;
  savesFailed: boolean;
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
    MobileIcon,
    MobileSettings,
  },
  data(): DataModel {
    return {
      view: 'menu',
      saves: undefined,
      savesFailed: false,
      saving: false,
      copied: false,
    };
  },
  computed: {
    /* For the game master, while the game runs. */
    canGoBack(): boolean {
      return this.playerView !== undefined && this.playerView.isGameMaster && this.playerView.game.phase !== 'end';
    },
    saveRows(): ReadonlyArray<SaveRow> {
      const players: ReadonlyArray<LogPlayer> = this.playerView?.players.map((player) => ({color: player.color, name: player.name})) ?? [];
      const translate = (text: string) => this.$t(text);
      const now = Date.now();
      return (this.saves ?? []).map((save) => {
        const generation = this.$t('Generation') + ' ' + save.generation;
        const lines = save.log.filter(isEventLine);
        const last = lines[lines.length - 1];
        if (last === undefined) {
          // A save with nothing done since the one before, as at the start of a generation.
          const timestamp = save.log[save.log.length - 1]?.timestamp;
          return {
            saveId: save.saveId,
            title: generation,
            subtitle: timestamp === undefined ? '' : formatAgo(timestamp, now),
            icon: 'undo-2',
            glyphClass: glyphClassOf(undefined),
          };
        }
        const event = toEvent(last, save.generation, lines.length - 1, players, translate);
        const actor = players.find((player) => player.color === event.color)?.name;
        return {
          saveId: save.saveId,
          title: event.title,
          subtitle: [generation, actor, formatAgo(event.timestamp, now)].filter((part) => part !== undefined).join(' · '),
          icon: event.icon,
          glyphClass: glyphClassOf(event.color),
        };
      });
    },
    gameUrl(): string {
      return window.location.origin + '/' + paths.PLAYER + '?id=' + this.playerView?.id;
    },
    helpLinks(): ReadonlyArray<HelpLink> {
      return [
        {label: 'How to Play', href: HELP_PAGES.howToPlay, icon: 'book-open', test: 'more-help-rules'},
        {label: 'Variants', href: HELP_PAGES.variants, icon: 'list', test: 'more-help-variants'},
        {label: 'Whats new?', href: HELP_PAGES.changelog, icon: 'sparkles', test: 'more-help-changelog'},
        {label: 'About us', href: HELP_PAGES.about, icon: 'info', test: 'more-help-about'},
      ];
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
    openHelp(href: string): void {
      openReaderAt(href);
    },
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
    reload(): void {
      window.location.reload();
    },
    /* Fetched afresh each time, since every move makes another. */
    async openSaves(): Promise<void> {
      const playerView = this.playerView;
      if (playerView === undefined) {
        return;
      }
      this.view = 'saves';
      this.saves = undefined;
      this.savesFailed = false;
      try {
        const response = await fetch(paths.API_GAME_SAVES + '?id=' + playerView.id);
        if (response.ok) {
          this.saves = await response.json();
          return;
        }
        console.error(`error fetching the saves, response code ${response.status}`);
      } catch (err) {
        console.error('error fetching the saves, unable to reach server', err);
      }
      this.savesFailed = true;
      this.saves = [];
    },
    /* The later saves are deleted, so this asks first. */
    async goBackTo(saveId: number): Promise<void> {
      const playerView = this.playerView;
      if (playerView === undefined || !window.confirm(this.$t('Go back to this save? Every move made since is taken back, and the later saves are deleted.'))) {
        return;
      }
      this.saving = true;
      try {
        const url = paths.API_GAME_ROLLBACK + '?id=' + playerView.id + '&saveId=' + saveId;
        if (await requestPlayerView(this, playerView, url, {method: 'POST'})) {
          this.view = 'menu';
        }
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
