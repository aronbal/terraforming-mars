<template>
  <div id="mobile-shell" :style="shellStyle">
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
          <!-- No fit block: milestone and award tiles wrap on their own, and forcing
               them onto one line would only push the last few off the edge. -->
          <div class="mobile-below-block">
            <Milestones :milestones="game.milestones"/>
            <Awards :awards="game.awards"/>
          </div>
          <MobileFitBlock v-if="game.turmoil" class="mobile-below-block">
            <Turmoil :turmoil="game.turmoil"/>
          </MobileFitBlock>
          <MobileFitBlock v-if="game.moon" class="mobile-below-block">
            <MoonBoard :model="game.moon" :tileView="tileView" id="shortkey-moonBoard"/>
          </MobileFitBlock>
          <MobileFitBlock v-if="game.gameOptions.expansions.pathfinders" class="mobile-below-block">
            <PlanetaryTracks :tracks="game.pathfinders" :gameOptions="game.gameOptions"/>
          </MobileFitBlock>
          <div v-if="game.colonies.length > 0" class="mobile-below-block" id="shortkey-colonies">
            <DynamicTitle title="Colonies" :color="thisPlayer.color"/>
            <div class="player_home_colony_cont mobile-colony-list">
              <MobileFitBlock v-for="colony in game.colonies" :key="colony.name" class="player_home_colony">
                <Colony :colony="colony" :active="colony.isActive"/>
              </MobileFitBlock>
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
        <MobileCardsPane
          :playerView="playerView"
          :cardScale="cardScale"
          :tapMode="preferences.card_tap"
          @play="playCard($event)"/>
      </section>

      <section
        v-show="tab === 'players'"
        class="mobile-pane mobile-pane--players"
        role="tabpanel"
        :aria-label="$t('Players')"
        id="shortkey-playersoverview">
        <MobileFitBlock>
          <PlayersOverview :playerView="playerView" v-trim-whitespace/>
        </MobileFitBlock>
      </section>

      <section
        v-show="tab === 'log'"
        class="mobile-pane mobile-pane--log"
        role="tabpanel"
        :aria-label="$t('Game log')">
        <LogPanel :viewModel="playerView" :color="thisPlayer.color" :step="game.step" @spaceClicked="onSpaceClicked"/>
      </section>

      <div v-show="scrimVisible" class="mobile-scrim" data-test="sheet-scrim" @click="setSnap('peek')"></div>

      <MobileActionPanel
        v-show="panelMode === 'sheet' || tab === 'actions'"
        :playerView="playerView"
        :mode="panelMode"
        :snap="snap"
        :peekEnabled="peekEnabled"
        :cardScale="cardScale"
        :actionWaiting="actionWaiting"
        @update:snap="setSnap($event)"/>
    </main>

    <MobileTabBar
      :tab="tab"
      :sheetOpen="panelMode === 'sheet' && (snap === 'half' || snap === 'full')"
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
import MobileActionPanel from '@/client/components/mobile/MobileActionPanel.vue';
import MobileBoardPane from '@/client/components/mobile/MobileBoardPane.vue';
import MobileCardsPane from '@/client/components/mobile/MobileCardsPane.vue';
import MobileFitBlock from '@/client/components/mobile/MobileFitBlock.vue';
import MobileHeader from '@/client/components/mobile/MobileHeader.vue';
import MobileSettings from '@/client/components/mobile/MobileSettings.vue';
import MobileTabBar from '@/client/components/mobile/MobileTabBar.vue';
import MoonBoard from '@/client/components/moon/MoonBoard.vue';
import PlanetaryTracks from '@/client/components/pathfinders/PlanetaryTracks.vue';
import PlayersOverview from '@/client/components/overview/PlayersOverview.vue';
import Turmoil from '@/client/components/turmoil/Turmoil.vue';

import {GameModel} from '@/common/models/GameModel';
import {HomeMixin} from '@/client/mixins/HomeMixin';
import {MobileTab, SHEET_PEEK_PX, SheetSnap} from '@/client/components/mobile/MobileTab';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Preferences, getPreferences} from '@/client/utils/PreferencesManager';
import {SpaceId} from '@/common/Types';
import {CardName} from '@/common/cards/CardName';
import {clearPickedCard, pickCard} from '@/client/utils/cardSelection';
import {isActionMenu} from '@/client/components/mobile/MobileActionMenu';
import {requestedTab} from '@/client/utils/mobileNavigation';
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
    MobileActionPanel,
    MobileBoardPane,
    MobileCardsPane,
    MobileFitBlock,
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
    /*
     * The sheet's peek handle floats over the bottom of whichever pane is open, so
     * every pane leaves that much room free. Without it the last row of a pane — the
     * final colony tile, the newest log entry — sits under the handle, out of reach.
     */
    shellStyle(): Record<string, string> {
      return {'--mobile-pane-gap': (this.peekEnabled ? SHEET_PEEK_PX : 0) + 'px'};
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
    waitingFor(): unknown {
      return this.playerView.waitingFor;
    },
    /*
     * The menu of what the player may do is somewhere they go, so it is a tab. Every
     * other thing the server asks -- pick a target, pick a resource -- interrupts
     * whatever they were doing, so it arrives as a sheet over it.
     */
    panelMode(): 'tab' | 'sheet' {
      return isActionMenu(this.playerView.waitingFor) ? 'tab' : 'sheet';
    },
    scrimVisible(): boolean {
      return this.panelMode === 'sheet' && this.snap === 'full';
    },
    requestedTab(): unknown {
      return requestedTab.value;
    },
  },
  watch: {
    /* A card picked for one input must never be applied to the next one, so the pick
       lasts exactly as long as the input it was made for. */
    waitingFor() {
      clearPickedCard();
    },
    /* The action menu sends the player to the tab that draws what an entry is about.
       It has no path back up to the shell, so it leaves the request in a store. */
    requestedTab(request: {tab: MobileTab} | undefined) {
      if (request !== undefined) {
        this.selectTab(request.tab);
      }
    },
    /*
     * The panel is a tab or a sheet depending on what the server is asking, and it
     * cannot be both. Becoming a sheet while the player is standing on the Actions
     * tab would leave them on an empty one, so send them back to the board -- which
     * is where a follow-up question usually wants them anyway.
     */
    panelMode(mode: 'tab' | 'sheet') {
      if (mode === 'sheet') {
        if (this.tab === 'actions') {
          this.tab = 'board';
        }
        this.setSnap(this.peekEnabled ? 'peek' : 'closed');
      }
    },
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
      /* While the server is asking a follow-up question the panel is a sheet, and a
         sheet is not somewhere to navigate to -- Act raises it over whichever pane
         is open, the way it always did. */
      if (tab === 'actions' && this.panelMode === 'sheet') {
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
    /*
     * The Cards tab is where a card is chosen; the sheet is where the choice is paid
     * for and confirmed. Raising the sheet all the way puts the payment in front of
     * the player instead of the list they have just chosen from.
     */
    playCard(name: CardName): void {
      pickCard(name);
      this.selectTab('actions');
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
    clearPickedCard();
    document.body.classList.remove('mobile-shell-active');
  },
});
</script>
