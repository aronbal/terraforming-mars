<template>
  <div id="mobile-shell" :style="shellStyle">
    <MobileHeader
      :game="game"
      :player="thisPlayer"
      :showTagRow="tagRowVisible"
      :tagRowOpen="tagRowOpen"
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
            <Milestones
              :milestones="game.milestones"
              :claimable="claimableMilestones"
              @claim="claimBoardThing('milestone', $event)"/>
            <Awards
              :awards="game.awards"
              :fundable="fundableAwards"
              @fund="claimBoardThing('award', $event)"/>
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
              <button
                v-for="colony in game.colonies"
                :key="colony.name"
                class="player_home_colony mobile-board-thing"
                :class="{'mobile-board-thing--offered': tradeableColonies.includes(colony.name)}"
                :disabled="!tradeableColonies.includes(colony.name)"
                data-test="board-colony"
                @click="claimBoardThing('colony', colony.name)">
                <MobileFitBlock>
                  <Colony :colony="colony" :active="colony.isActive"/>
                </MobileFitBlock>
              </button>
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
        v-show="tab === 'more'"
        class="mobile-pane mobile-pane--more"
        role="tabpanel"
        :aria-label="$t('More')">
        <MobileMore
          :playerView="playerView"
          @settingsChanged="refreshPreferences()"
          @spaceClicked="onSpaceClicked"/>
      </section>

      <div v-show="scrimVisible" class="mobile-scrim" data-test="sheet-scrim" @click="setSnap('peek')"></div>

      <!-- The card or tile being acted on, over a faded board. The panel below it is
           then only the price and the button. -->
      <MobileFocusStage :playerView="playerView" @dismiss="setSnap('peek')"/>

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

  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Awards from '@/client/components/Awards.vue';
import Colony from '@/client/components/colonies/Colony.vue';
import DynamicTitle from '@/client/components/common/DynamicTitle.vue';
import Milestones from '@/client/components/Milestones.vue';
import MobileActionPanel from '@/client/components/mobile/MobileActionPanel.vue';
import MobileBoardPane from '@/client/components/mobile/MobileBoardPane.vue';
import MobileCardsPane from '@/client/components/mobile/MobileCardsPane.vue';
import MobileFitBlock from '@/client/components/mobile/MobileFitBlock.vue';
import MobileFocusStage from '@/client/components/mobile/MobileFocusStage.vue';
import MobileHeader from '@/client/components/mobile/MobileHeader.vue';
import MobileMore from '@/client/components/mobile/MobileMore.vue';
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
import {BoardThing, boardNamesIn, clearBoardPick, pickBoardThing} from '@/client/utils/boardSelection';
import {pickFocused, setPickFocus, setTabRouting} from '@/client/utils/mobileFocus';
import {isActionMenu} from '@/client/components/mobile/MobileActionMenu';
import {requestedTab} from '@/client/utils/mobileNavigation';
import {refreshMobileLayoutPreference} from '@/client/utils/useMobileLayout';
import {selectingSpace} from '@/client/utils/spaceSelection';

type DataModel = {
  tab: MobileTab;
  snap: SheetSnap;
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
    Milestones,
    MobileActionPanel,
    MobileBoardPane,
    MobileCardsPane,
    MobileFitBlock,
    MobileFocusStage,
    MobileHeader,
    MobileMore,
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
    /**
     * Whether the menu is raised over the tab the player picked something on, rather
     * than sitting on the Act tab where it otherwise lives.
     *
     * The action list reads the same flag to show that one entry alone, so it is kept
     * where both can see it rather than in this component's own data.
     */
    overTab(): boolean {
      return pickFocused.value;
    },
    panelMode(): 'tab' | 'sheet' {
      if (!isActionMenu(this.playerView.waitingFor)) {
        return 'sheet';
      }
      return this.overTab ? 'sheet' : 'tab';
    },
    /** The milestones the turn's menu offers, which are the ones worth tapping. */
    claimableMilestones(): ReadonlyArray<string> {
      return boardNamesIn(this.playerView.waitingFor, 'milestone');
    },
    fundableAwards(): ReadonlyArray<string> {
      return boardNamesIn(this.playerView.waitingFor, 'award');
    },
    tradeableColonies(): ReadonlyArray<string> {
      return boardNamesIn(this.playerView.waitingFor, 'colony');
    },
    scrimVisible(): boolean {
      return this.panelMode === 'sheet' && this.snap === 'full';
    },
    requestedTab(): unknown {
      return requestedTab.value;
    },
  },
  watch: {
    /* A thing picked for one input must never be applied to the next one, so a pick
       lasts exactly as long as the input it was made for. */
    waitingFor() {
      this.forgetPick();
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
      if (mode !== 'sheet' || this.overTab) {
        return;
      }
      if (this.tab === 'actions') {
        this.tab = 'board';
      }
      this.setSnap(this.peekEnabled ? 'peek' : 'closed');
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
      /* Putting the panel down abandons what it was raised for: the menu goes back to
         being a tab, and nothing on the board or in the hand is still shown as chosen. */
      if (this.overTab && snap !== 'half' && snap !== 'full') {
        this.forgetPick();
      }
    },
    /*
     * A card in hand and a milestone under the board are the same move: the tab is
     * where the thing is chosen, and the menu entry is where the choice is paid for
     * and confirmed.
     */
    playCard(name: CardName): void {
      clearBoardPick();
      pickCard(name);
      this.openPick(true);
    },
    claimBoardThing(kind: BoardThing, name: string): void {
      clearPickedCard();
      pickBoardThing(kind, name);
      /* A colony tile is chosen inside the trade itself, alongside the fee, so there
         is nothing to hold up over the board and the panel needs the whole screen. */
      this.openPick(kind !== 'colony');
    },
    /*
     * Where the player finishes what they just started, which is theirs to choose.
     *
     * Over the tab they are standing on, they never leave the cards or the board they
     * were reading; on the Act tab, the rest of the menu is in reach beside it.
     */
    openPick(staged: boolean): void {
      if (this.preferences.play_from === 'actions') {
        setPickFocus('none');
        this.selectTab('actions');
        return;
      }
      setPickFocus(staged ? 'staged' : 'panel');
      this.setSnap(staged ? 'half' : 'full');
    },
    forgetPick(): void {
      setPickFocus('none');
      clearPickedCard();
      clearBoardPick();
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
    refreshPreferences(): void {
      this.preferences = {...getPreferences()};
      /* The menu is drawn several components deep and cannot be told through props,
         so where the player wants to act is left where it can read it. */
      setTabRouting(this.preferences.play_from === 'tabs');
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
  created() {
    setTabRouting(this.preferences.play_from === 'tabs');
  },
  mounted() {
    document.body.classList.add('mobile-shell-active');
  },
  unmounted() {
    this.forgetPick();
    document.body.classList.remove('mobile-shell-active');
  },
});
</script>
