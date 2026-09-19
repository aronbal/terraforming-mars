<template>
  <div id="mobile-shell">
    <MobileHeader
      :game="game"
      :player="thisPlayer"
      :showTagRow="tagRowVisible"
      :tagRowOpen="tagRowOpen"
      @openSettings="settingsOpen = true"
      @toggleTagRow="toggleTagRow()"/>

    <main class="mobile-stage">
      <section
        v-show="tab === 'board'"
        ref="boardPane"
        class="mobile-pane mobile-pane--board"
        role="tabpanel"
        :aria-label="$t('Board')">
        <MobileBoardPane
          :game="game"
          :tileView="tileView"
          :tapTargets="tapTargets"
          :belowOpen="belowOpen"
          @toggleTileView="cycleTileView()"
          @toggleBelow="toggleBelow()"
          @showActions="setSnap('half')"/>

        <div class="mobile-below" ref="below">
          <div class="mobile-below-block">
            <Milestones :milestones="game.milestones"/>
            <Awards :awards="game.awards"/>
          </div>
          <div v-if="game.turmoil" class="mobile-below-block">
            <Turmoil :turmoil="game.turmoil"/>
          </div>
          <div v-if="game.moon" class="mobile-below-block">
            <MoonBoard :model="game.moon" :tileView="tileView" id="shortkey-moonBoard"/>
          </div>
          <div v-if="game.gameOptions.expansions.pathfinders" class="mobile-below-block">
            <PlanetaryTracks :tracks="game.pathfinders" :gameOptions="game.gameOptions"/>
          </div>
          <div v-if="game.colonies.length > 0" class="mobile-below-block" id="shortkey-colonies">
            <DynamicTitle title="Colonies" :color="thisPlayer.color"/>
            <div class="player_home_colony_cont">
              <div class="player_home_colony" v-for="colony in game.colonies" :key="colony.name">
                <Colony :colony="colony" :active="colony.isActive"/>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        v-show="tab === 'cards'"
        class="mobile-pane mobile-pane--cards"
        role="tabpanel"
        :aria-label="$t('Cards')"
        id="shortkey-hand">
        <MobileCardsPane :playerView="playerView" :cardScale="cardScale"/>
      </section>

      <section
        v-show="tab === 'players'"
        class="mobile-pane mobile-pane--players"
        role="tabpanel"
        :aria-label="$t('Players')"
        id="shortkey-playersoverview">
        <PlayersOverview :playerView="playerView" v-trim-whitespace/>
      </section>

      <section
        v-show="tab === 'log'"
        class="mobile-pane mobile-pane--log"
        role="tabpanel"
        :aria-label="$t('Game log')">
        <LogPanel :viewModel="playerView" :color="thisPlayer.color" :step="game.step" @spaceClicked="onSpaceClicked"/>
      </section>

      <div v-show="snap === 'full'" class="mobile-scrim" data-test="sheet-scrim" @click="setSnap('peek')"></div>

      <MobileActionSheet
        :playerView="playerView"
        :snap="snap"
        :peekEnabled="peekEnabled"
        :cardScale="cardScale"
        :actionWaiting="actionWaiting"
        @update:snap="setSnap($event)"/>
    </main>

    <MobileTabBar
      :tab="tab"
      :sheetOpen="snap === 'half' || snap === 'full'"
      :cardsInHandCount="cardsInHandCount"
      :actionWaiting="actionWaiting"
      @select="selectTab($event)"/>

    <MobileSettings v-if="settingsOpen" @close="closeSettings()"/>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Awards from '@/client/components/Awards.vue';
import Colony from '@/client/components/colonies/Colony.vue';
import DynamicTitle from '@/client/components/common/DynamicTitle.vue';
import LogPanel from '@/client/components/logpanel/LogPanel.vue';
import Milestones from '@/client/components/Milestones.vue';
import MobileActionSheet from '@/client/components/mobile/MobileActionSheet.vue';
import MobileBoardPane from '@/client/components/mobile/MobileBoardPane.vue';
import MobileCardsPane from '@/client/components/mobile/MobileCardsPane.vue';
import MobileHeader from '@/client/components/mobile/MobileHeader.vue';
import MobileSettings from '@/client/components/mobile/MobileSettings.vue';
import MobileTabBar from '@/client/components/mobile/MobileTabBar.vue';
import MoonBoard from '@/client/components/moon/MoonBoard.vue';
import PlanetaryTracks from '@/client/components/pathfinders/PlanetaryTracks.vue';
import PlayersOverview from '@/client/components/overview/PlayersOverview.vue';
import Turmoil from '@/client/components/turmoil/Turmoil.vue';

import {GameModel} from '@/common/models/GameModel';
import {HomeMixin} from '@/client/mixins/HomeMixin';
import {MobileTab, SheetSnap} from '@/client/components/mobile/MobileTab';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Preferences, getPreferences} from '@/client/utils/PreferencesManager';
import {SpaceId} from '@/common/Types';
import {refreshMobileLayoutPreference} from '@/client/utils/useMobileLayout';
import {selectingSpace} from '@/client/utils/spaceSelection';

type DataModel = {
  tab: MobileTab;
  snap: SheetSnap;
  settingsOpen: boolean;
  belowOpen: boolean;
  /** Set when the player opens or closes the tag row by hand, until the next tab change. */
  tagRowOverride: boolean | undefined;
  preferences: Preferences;
};

export default defineComponent({
  name: 'MobilePlayerHome',
  mixins: [HomeMixin],
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
  },
  components: {
    Awards,
    Colony,
    DynamicTitle,
    LogPanel,
    Milestones,
    MobileActionSheet,
    MobileBoardPane,
    MobileCardsPane,
    MobileHeader,
    MobileSettings,
    MobileTabBar,
    MoonBoard,
    PlanetaryTracks,
    PlayersOverview,
    Turmoil,
  },
  data(): DataModel {
    return {
      tab: 'board',
      snap: getPreferences().action_sheet_peek ? 'peek' : 'closed',
      settingsOpen: false,
      belowOpen: false,
      tagRowOverride: undefined,
      preferences: {...getPreferences()},
    };
  },
  computed: {
    game(): GameModel {
      return this.playerView.game;
    },
    thisPlayer(): PublicPlayerModel {
      return this.playerView.thisPlayer;
    },
    cardScale(): number {
      return this.preferences.card_scale;
    },
    peekEnabled(): boolean {
      return this.preferences.action_sheet_peek;
    },
    tapTargets(): boolean {
      return this.preferences.mobile_tap_targets;
    },
    tagRowVisible(): boolean {
      return this.preferences.tag_row !== 'never';
    },
    /** Open on the Cards tab, where card requirements are judged, unless overridden. */
    tagRowOpen(): boolean {
      if (this.tagRowOverride !== undefined) {
        return this.tagRowOverride;
      }
      return this.preferences.tag_row === 'always' || this.tab === 'cards';
    },
    cardsInHandCount(): number {
      const playerView = this.playerView;
      return playerView.cardsInHand.length +
        playerView.preludeCardsInHand.length +
        playerView.ceoCardsInHand.length +
        playerView.draftedCards.length;
    },
    actionWaiting(): boolean {
      const waitingFor = this.playerView.waitingFor;
      return waitingFor !== undefined && !waitingFor.optional;
    },
    selectingSpace(): boolean {
      return selectingSpace.value;
    },
  },
  watch: {
    selectingSpace(selecting: boolean) {
      if (selecting) {
        // Get the sheet off the map, and the map in front of the player.
        this.tab = 'board';
        this.scrollBoardPaneTo(0);
        this.setSnap('closed');
      } else {
        this.setSnap(this.peekEnabled ? 'peek' : 'closed');
      }
    },
  },
  methods: {
    selectTab(tab: MobileTab): void {
      if (tab === 'actions') {
        // Act is not a destination: it raises the sheet over whichever pane is open.
        this.setSnap(this.snap === 'half' || this.snap === 'full' ? 'peek' : 'half');
        return;
      }
      if (this.snap === 'full') {
        this.setSnap('peek');
      }
      this.tab = tab;
      this.tagRowOverride = undefined;
    },
    setSnap(snap: SheetSnap): void {
      this.snap = snap;
    },
    toggleTagRow(): void {
      this.tagRowOverride = !this.tagRowOpen;
    },
    scrollBoardPaneTo(top: number): void {
      const pane = this.$refs.boardPane as HTMLElement | undefined;
      if (pane !== undefined) {
        pane.scrollTop = top;
      }
      this.belowOpen = top > 0;
    },
    /*
     * Scrolls between the board and what sits under it.
     *
     * The board viewport takes `touch-action: none` for pinch and pan, so dragging on
     * the map cannot scroll the column. The header is the handle that does.
     */
    toggleBelow(): void {
      const pane = this.$refs.boardPane as HTMLElement | undefined;
      const below = this.$refs.below as HTMLElement | undefined;
      if (pane === undefined || below === undefined) {
        return;
      }
      this.scrollBoardPaneTo(pane.scrollTop > 8 ? 0 : below.offsetTop);
    },
    closeSettings(): void {
      this.settingsOpen = false;
      this.preferences = {...getPreferences()};
      refreshMobileLayoutPreference();
    },
    /* Brings the space a log entry names into view, the way the desktop log does. */
    onSpaceClicked(spaceId: SpaceId): void {
      this.tab = 'board';
      this.scrollBoardPaneTo(0);
      const board = document.getElementById('main_board');
      const highlights = board?.getElementsByClassName('board-log-highlight');
      if (highlights === undefined) {
        return;
      }
      for (const element of highlights) {
        if (element.getAttribute('data_log_highlight_id') === spaceId) {
          element.classList.add('highlight');
          setTimeout(() => element.classList.remove('highlight'), 3000);
          return;
        }
      }
    },
  },
  mounted() {
    document.body.classList.add('mobile-shell-active');
  },
  unmounted() {
    document.body.classList.remove('mobile-shell-active');
  },
});
</script>
