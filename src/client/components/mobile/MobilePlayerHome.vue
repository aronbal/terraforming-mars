<template>
  <div id="mobile-shell" :style="shellStyle">
    <MobileHeader
      :game="game"
      :player="thisPlayer"
      :view="view"
      :yourTurn="actionWaiting"
      :turnLabel="turnLabel"
      :showTagRow="tagRowVisible"
      :tagRowOpen="tagRowOpen"
      @update:view="selectView($event)"
      @openPlayers="overlay = 'players'"
      @openMenu="overlay = 'menu'"
      @toggleTagRow="toggleTagRow()"/>

    <main class="mobile-stage">
      <section
        v-show="view === 'turn' && !settingUp"
        class="mobile-pane mobile-pane--turn"
        role="tabpanel"
        :aria-label="$t('Turn')">
        <MobileTurnPage
          :playerView="playerView"
          :selected="selected"
          :recent="recentEvents"
          :players="logPlayers"
          :now="now"
          @select="select($event)"
          @openEntry="openEntry($event)"
          @openSheet="setSnap('half')"
          @openMilestones="openMilestones()"
          @showView="selectView($event)"/>
      </section>

      <section
        v-show="view === 'board'"
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
        v-show="view === 'cards'"
        class="mobile-pane mobile-pane--cards"
        role="tabpanel"
        :aria-label="$t('Cards')"
        id="shortkey-hand">
        <MobileCardsPane
          :playerView="playerView"
          :selected="selected"
          @select="select($event)"/>
      </section>

      <section
        v-show="view === 'log'"
        class="mobile-pane mobile-pane--log"
        role="tabpanel"
        :aria-label="$t('Log')">
        <MobileLogPane
          :generations="logGenerations"
          :players="logPlayers"
          :now="now"
          :loading="logLoading"
          @loadEarlier="loadEarlierLog()"/>
      </section>

      <div v-show="scrimVisible" class="mobile-scrim" data-test="sheet-scrim" @click="setSnap('peek')"></div>

      <!-- The card or tile being acted on, over a faded board. The panel below it is
           then only the price and the button. -->
      <MobileFocusStage :playerView="playerView" @dismiss="setSnap('closed')"/>

      <MobileActionPanel
        v-show="panelMode === 'sheet' || view === 'turn'"
        :playerView="playerView"
        :mode="panelMode"
        :snap="snap"
        :cardScale="cardScale"
        :actionWaiting="actionWaiting"
        @update:snap="setSnap($event)"/>
    </main>

    <MobileSelectionBar
      v-if="selection !== undefined"
      :card="selection.card"
      :offer="selection.offer"
      :megacredits="thisPlayer.megacredits"
      @cancel="selected = undefined"
      @confirm="confirmSelection()"
      @inspect="magnified = selection.card"/>
    <div v-else class="mobile-bottom-spacer"></div>

    <!-- Play or Use from the bottom bar: the card large, its payment, and the one
         button that pays and plays it. -->
    <MobilePlaySheet
      v-if="playing !== undefined"
      :playerView="playerView"
      :card="playing.card.name"
      :offer="playing.offer"
      @close="playing = undefined"/>

    <div v-if="magnified !== undefined" class="mobile-magnify" data-test="magnified-card" @click="magnified = undefined">
      <!-- Tapping anywhere puts it back down: the way out is wherever you look. -->
      <div class="mobile-magnify-holder">
        <Card class="cardbox" :card="magnified" :cubeColor="thisPlayer.color"/>
      </div>
    </div>

    <MobileOverlay v-if="overlay === 'players'" :title="$t('Players')" @close="overlay = undefined">
      <MobileFitBlock id="shortkey-playersoverview">
        <PlayersOverview :playerView="playerView" v-trim-whitespace/>
      </MobileFitBlock>
    </MobileOverlay>
    <MobileOverlay v-if="overlay === 'menu'" :title="$t('Menu')" @close="overlay = undefined">
      <MobileMore @settingsChanged="refreshPreferences()"/>
    </MobileOverlay>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Awards from '@/client/components/Awards.vue';
import Card from '@/client/components/card/Card.vue';
import Colony from '@/client/components/colonies/Colony.vue';
import DynamicTitle from '@/client/components/common/DynamicTitle.vue';
import Milestones from '@/client/components/Milestones.vue';
import MobileActionPanel from '@/client/components/mobile/MobileActionPanel.vue';
import MobileBoardPane from '@/client/components/mobile/MobileBoardPane.vue';
import MobileCardsPane from '@/client/components/mobile/MobileCardsPane.vue';
import MobileFitBlock from '@/client/components/mobile/MobileFitBlock.vue';
import MobileFocusStage from '@/client/components/mobile/MobileFocusStage.vue';
import MobileHeader from '@/client/components/mobile/MobileHeader.vue';
import MobileLogPane, {LogGeneration} from '@/client/components/mobile/MobileLogPane.vue';
import MobileMore from '@/client/components/mobile/MobileMore.vue';
import MobileOverlay from '@/client/components/mobile/MobileOverlay.vue';
import MobilePlaySheet from '@/client/components/mobile/MobilePlaySheet.vue';
import MobileSelectionBar from '@/client/components/mobile/MobileSelectionBar.vue';
import MobileTurnPage from '@/client/components/mobile/MobileTurnPage.vue';
import MoonBoard from '@/client/components/moon/MoonBoard.vue';
import PlanetaryTracks from '@/client/components/pathfinders/PlanetaryTracks.vue';
import PlayersOverview from '@/client/components/overview/PlayersOverview.vue';
import Turmoil from '@/client/components/turmoil/Turmoil.vue';

import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {GameModel} from '@/common/models/GameModel';
import {HomeMixin} from '@/client/mixins/HomeMixin';
import {LogEvent, LogPlayer, fetchGenerationLog, isEventLine, sinceLastTurn, toEvent} from '@/client/components/mobile/MobileLog';
import {LogMessage} from '@/common/logs/LogMessage';
import {MobileView, SHEET_PEEK_PX, SheetSnap} from '@/client/components/mobile/MobileView';
import {Phase} from '@/common/Phase';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Preferences, getPreferences} from '@/client/utils/PreferencesManager';
import {ReadyCard, isActionMenu, readyCards} from '@/client/components/mobile/MobileActionMenu';
import {clearPickedCard} from '@/client/utils/cardSelection';
import {BoardThing, boardNamesIn, clearBoardPick, pickBoardThing} from '@/client/utils/boardSelection';
import {clearPickedEntry, pickEntry, pickFocused, setPickFocus} from '@/client/utils/mobileFocus';
import {refreshMobileLayoutPreference} from '@/client/utils/useMobileLayout';
import {selectingSpace} from '@/client/utils/spaceSelection';

type Overlay = 'players' | 'menu';

type DataModel = {
  view: MobileView;
  snap: SheetSnap;
  belowOpen: boolean;
  /** Set when the player opens or closes the tag row by hand, until the next view change. */
  tagRowOverride: boolean | undefined;
  preferences: Preferences;
  /** The card tapped on the turn page or in the Cards view, which the bottom bar is about. */
  selected: CardName | undefined;
  /** The card opened large from the bottom bar. */
  magnified: CardModel | undefined;
  /** The card being paid for and played, or used, in the play sheet. */
  playing: ReadyCard | undefined;
  overlay: Overlay | undefined;
  /** The log lines fetched so far, by generation, oldest line first. */
  logs: Record<number, ReadonlyArray<LogMessage>>;
  logLoading: boolean;
  /** The clock the log's "2 min" is measured against, ticked so it does not go stale. */
  now: number;
};

// How often the log's relative times are brought up to date.
const CLOCK_TICK_MS = 30_000;

let clock: ReturnType<typeof setInterval> | undefined;

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
    Card,
    Colony,
    DynamicTitle,
    Milestones,
    MobileActionPanel,
    MobileBoardPane,
    MobileCardsPane,
    MobileFitBlock,
    MobileFocusStage,
    MobileHeader,
    MobileLogPane,
    MobileMore,
    MobileOverlay,
    MobilePlaySheet,
    MobileSelectionBar,
    MobileTurnPage,
    MoonBoard,
    PlanetaryTracks,
    PlayersOverview,
    Turmoil,
  },
  data(): DataModel {
    return {
      view: 'turn',
      snap: 'closed',
      belowOpen: false,
      tagRowOverride: undefined,
      preferences: {...getPreferences()},
      selected: undefined,
      magnified: undefined,
      playing: undefined,
      overlay: undefined,
      logs: {},
      logLoading: false,
      now: Date.now(),
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
     * while it shows every pane leaves that much room free. Without it the last row
     * of a pane sits under the handle, out of reach.
     */
    shellStyle(): Record<string, string> {
      return {'--mobile-pane-gap': (this.sheetInUse ? SHEET_PEEK_PX : 0) + 'px'};
    },
    tapTargets(): boolean {
      return this.preferences.mobile_tap_targets;
    },
    /* The tags are what card requirements are judged against, so by default they
       show where the hand is: on the Cards view. */
    tagRowVisible(): boolean {
      const mode = this.preferences.tag_row;
      return mode === 'always' || (mode === 'auto' && this.view === 'cards');
    },
    /** Open on the Cards view, where card requirements are judged, unless overridden. */
    tagRowOpen(): boolean {
      if (this.tagRowOverride !== undefined) {
        return this.tagRowOverride;
      }
      return this.preferences.tag_row === 'always' || this.view === 'cards';
    },
    actionWaiting(): boolean {
      const waitingFor = this.playerView.waitingFor;
      return waitingFor !== undefined && !waitingFor.optional;
    },
    turnLabel(): string {
      if (this.game.phase === Phase.END) {
        return 'Game over';
      }
      if (this.actionWaiting) {
        return 'Your turn';
      }
      return this.game.passedPlayers.includes(this.thisPlayer.color) ? 'Passed' : 'Waiting';
    },
    selectingSpace(): boolean {
      return selectingSpace.value;
    },
    waitingFor(): unknown {
      return this.playerView.waitingFor;
    },
    /*
     * The opening hand is not a question asked in the middle of something -- it is the
     * whole of what the player is doing, and four grids of cards deep. It gets the
     * turn view, rather than half of one over a board that has nothing on it yet.
     */
    settingUp(): boolean {
      return this.playerView.waitingFor?.type === 'initialCards';
    },
    panelMode(): 'tab' | 'sheet' {
      return this.settingUp ? 'tab' : 'sheet';
    },
    /**
     * Whether the sheet has anything to say.
     *
     * The turn page is the menu, so the sheet carries only what was opened from it --
     * a card's price, a tile's entry -- and the questions the server asks between
     * moves. Over a bare menu it stays out of the way entirely.
     */
    sheetInUse(): boolean {
      if (this.settingUp || this.playerView.waitingFor === undefined) {
        return false;
      }
      return pickFocused.value || !isActionMenu(this.playerView.waitingFor);
    },
    ready(): ReadonlyArray<ReadyCard> {
      const waitingFor = this.playerView.waitingFor;
      return readyCards(isActionMenu(waitingFor) ? waitingFor : undefined);
    },
    /** The selected card and what can be done with it, while the turn still offers it. */
    selection(): ReadyCard | undefined {
      const selected = this.selected;
      if (selected === undefined || pickFocused.value) {
        return undefined;
      }
      return this.ready.find((item) => item.card.name === selected);
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
    logPlayers(): ReadonlyArray<LogPlayer> {
      return this.playerView.players.map((player) => ({color: player.color, name: player.name}));
    },
    /** Every generation fetched so far, newest first, each newest line first. */
    logGenerations(): ReadonlyArray<LogGeneration> {
      return Object.keys(this.logs)
        .map(Number)
        .sort((a, b) => b - a)
        .map((generation) => ({generation, events: [...this.eventsOf(generation)].reverse()}));
    },
    /*
     * What the others did since this player last acted. Read across the current
     * generation and the one before, because the last thing a player did is often the
     * pass that ended the previous generation.
     */
    recentEvents(): ReadonlyArray<LogEvent> {
      const generation = this.game.generation;
      const events = [...this.eventsOf(generation - 1), ...this.eventsOf(generation)];
      return sinceLastTurn(events, this.thisPlayer.color);
    },
    step(): number {
      return this.game.step;
    },
  },
  watch: {
    /*
     * A thing picked for one input must never be applied to the next one, so a pick
     * lasts exactly as long as the input it was made for. A question that is not the
     * menu interrupts whatever the player was doing, so it comes up to meet them.
     */
    waitingFor() {
      this.forgetPick();
      this.playing = undefined;
      if (this.settingUp) {
        this.view = 'turn';
      }
      this.setSnap(this.sheetInUse ? 'half' : 'closed');
    },
    selectingSpace(selecting: boolean) {
      if (selecting) {
        // Get the sheet off the map, and the map in front of the player.
        this.view = 'board';
        this.scrollBoardPaneTo(0);
        this.setSnap('closed');
      } else {
        this.setSnap(this.sheetInUse ? 'peek' : 'closed');
      }
    },
    // Something happened in the game, so the log has something new to say.
    step() {
      this.refreshLog();
    },
  },
  methods: {
    selectView(view: MobileView): void {
      if (this.snap === 'full') {
        this.setSnap('peek');
      }
      this.view = view;
      this.tagRowOverride = undefined;
    },
    setSnap(snap: SheetSnap): void {
      this.snap = this.sheetInUse || snap === 'closed' ? snap : 'closed';
      /* Putting the panel down abandons what it was raised for: nothing on the turn
         page, on the board or in the hand is still shown as chosen. */
      if (pickFocused.value && snap !== 'half' && snap !== 'full') {
        this.forgetPick();
        this.snap = this.sheetInUse ? 'peek' : 'closed';
      }
    },
    /** A tap on a ready card selects it; a second tap on the same card lets go. */
    select(name: CardName): void {
      this.selected = this.selected === name ? undefined : name;
    },
    /*
     * The bottom bar's button: the card opens in the play sheet, large, with its
     * payment and the button that pays for it. What the server asks after that -- a
     * target, a tile -- arrives in the action sheet like any other question.
     */
    confirmSelection(): void {
      const selection = this.selection;
      if (selection === undefined) {
        return;
      }
      this.selected = undefined;
      this.forgetPick();
      this.playing = selection;
    },
    /** A tile or a button on the turn page: the entry it stands for, opened in the sheet. */
    openEntry(index: number): void {
      this.selected = undefined;
      clearPickedCard();
      clearBoardPick();
      pickEntry(index);
      /* A list to choose from -- the standard projects, the hand to sell -- needs the
         room. A confirmation does not. */
      const input = isActionMenu(this.playerView.waitingFor) ? this.playerView.waitingFor.options[index] : undefined;
      const tall = input !== undefined && (input.type === 'card' || input.type === 'projectCard' || input.type === 'or');
      this.openPick('panel', tall ? 'full' : 'half');
    },
    /* Milestones and awards are printed on the board, so that is where they are claimed. */
    openMilestones(): void {
      this.selectView('board');
      this.$nextTick(() => {
        const below = this.$refs.below as HTMLElement | undefined;
        this.scrollBoardPaneTo(below?.offsetTop ?? 0);
      });
    },
    claimBoardThing(kind: BoardThing, name: string): void {
      clearPickedCard();
      clearPickedEntry();
      pickBoardThing(kind, name);
      /* A colony tile is chosen inside the trade itself, alongside the fee, so there
         is nothing to hold up over the board and the panel needs the whole screen. */
      if (kind === 'colony') {
        this.openPick('panel', 'full');
      } else {
        this.openPick('staged', 'half');
      }
    },
    openPick(mode: 'staged' | 'panel', snap: SheetSnap): void {
      setPickFocus(mode);
      this.setSnap(snap);
    },
    forgetPick(): void {
      setPickFocus('none');
      clearPickedCard();
      clearBoardPick();
      clearPickedEntry();
      if (this.selection === undefined) {
        this.selected = undefined;
      }
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
      refreshMobileLayoutPreference();
    },
    eventsOf(generation: number): ReadonlyArray<LogEvent> {
      const messages = this.logs[generation] ?? [];
      const translate = (text: string) => this.$t(text);
      return messages
        .filter(isEventLine)
        .map((message, index) => toEvent(message, generation, index, this.logPlayers, translate));
    },
    async loadLog(generation: number): Promise<void> {
      if (generation < 1) {
        return;
      }
      const messages = await fetchGenerationLog(this.playerView.id, generation);
      if (messages !== undefined) {
        this.logs = {...this.logs, [generation]: messages};
      }
    },
    /** The current generation, and the one before it until it has been read once. */
    async refreshLog(): Promise<void> {
      const generation = this.game.generation;
      this.now = Date.now();
      const loads = [this.loadLog(generation)];
      if (this.logs[generation - 1] === undefined) {
        loads.push(this.loadLog(generation - 1));
      }
      this.logLoading = true;
      await Promise.all(loads);
      this.logLoading = false;
    },
    async loadEarlierLog(): Promise<void> {
      const loaded = Object.keys(this.logs).map(Number);
      const earliest = loaded.length === 0 ? this.game.generation : Math.min(...loaded);
      this.logLoading = true;
      await this.loadLog(earliest - 1);
      this.logLoading = false;
    },
  },
  mounted() {
    document.body.classList.add('mobile-shell-active');
    this.refreshLog();
    clock = setInterval(() => {
      this.now = Date.now();
    }, CLOCK_TICK_MS);
  },
  unmounted() {
    this.forgetPick();
    if (clock !== undefined) {
      clearInterval(clock);
      clock = undefined;
    }
    document.body.classList.remove('mobile-shell-active');
  },
});
</script>
