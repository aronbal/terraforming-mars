<template>
  <div id="mobile-shell" :class="{'mobile-shell--short': screenGap > 0}" :style="shellStyle">
    <MobileHeader
      :game="game"
      :player="thisPlayer"
      :yourTurn="actionWaiting"
      :turnLabel="turnLabel"
      :showTagRow="tagRowVisible"
      :canOpenSheet="sheetInUse && snap === 'closed'"
      @openSheet="raiseSheet()"
      @openPlayers="overlay = 'players'"
      @openMenu="overlay = 'menu'"/>

    <main class="mobile-stage">
      <section
        v-show="view === 'turn' && !settingUp"
        class="mobile-pane mobile-pane--turn"
        role="tabpanel"
        :aria-label="$t('Turn')">
        <MobileTurnPage
          :playerView="playerView"
          :recent="recentEvents"
          :players="logPlayers"
          :now="now"
          :sheetOpen="snap !== 'closed'"
          @select="select($event)"
          @openEntry="openEntry($event)"
          @openSheet="raiseSheet()"
          @openMilestones="openMilestones()"
          @showView="selectView($event)"
          @inspect="magnifiedLine = $event"/>
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
          @toggleTileView="cycleTileView()"
          @showActions="raiseSheet()"/>

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
          @loadEarlier="loadEarlierLog()"
          @inspect="magnifiedLine = $event"/>
      </section>

      <div v-show="scrimVisible" class="mobile-scrim" data-test="sheet-scrim" @click="setSnap('closed')"></div>

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

    <div class="mobile-bottom">
      <MobileTabBar :view="view" :badges="tabBadges" @update:view="selectView($event)"/>
    </div>

    <!-- A tapped card, large, with its payment and the one button that pays for it and
         plays it, or uses its action. -->
    <MobilePlaySheet
      v-if="playing !== undefined"
      :playerView="playerView"
      :card="playing.card.name"
      :offer="playing.offer"
      :position="playingIndex"
      :count="ready.length"
      @next="turnCard(1)"
      @previous="turnCard(-1)"
      @close="playing = undefined"/>

    <!-- A milestone or award, held up with the one button that claims or funds it. -->
    <MobileClaimSheet
      v-if="claiming !== undefined"
      :key="claiming.kind + claiming.name"
      :playerView="playerView"
      :kind="claiming.kind"
      :name="claiming.name"
      :position="claimingIndex"
      :count="claimables.length"
      @next="turnClaim(1)"
      @previous="turnClaim(-1)"
      @close="claiming = undefined"/>

    <MobileLogCards
      v-if="magnifiedLine !== undefined"
      :event="magnifiedLine"
      :players="logPlayers"
      :now="now"
      @close="magnifiedLine = undefined"/>

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
import Colony from '@/client/components/colonies/Colony.vue';
import DynamicTitle from '@/client/components/common/DynamicTitle.vue';
import Milestones from '@/client/components/Milestones.vue';
import MobileActionPanel from '@/client/components/mobile/MobileActionPanel.vue';
import MobileBoardPane from '@/client/components/mobile/MobileBoardPane.vue';
import MobileCardsPane from '@/client/components/mobile/MobileCardsPane.vue';
import MobileFitBlock from '@/client/components/mobile/MobileFitBlock.vue';
import MobileClaimSheet from '@/client/components/mobile/MobileClaimSheet.vue';
import MobileFocusStage from '@/client/components/mobile/MobileFocusStage.vue';
import MobileHeader from '@/client/components/mobile/MobileHeader.vue';
import MobileLogCards from '@/client/components/mobile/MobileLogCards.vue';
import MobileLogPane, {LogGeneration} from '@/client/components/mobile/MobileLogPane.vue';
import MobileMore from '@/client/components/mobile/MobileMore.vue';
import MobileOverlay from '@/client/components/mobile/MobileOverlay.vue';
import MobilePlaySheet from '@/client/components/mobile/MobilePlaySheet.vue';
import MobileTabBar from '@/client/components/mobile/MobileTabBar.vue';
import MobileTurnPage from '@/client/components/mobile/MobileTurnPage.vue';
import MoonBoard from '@/client/components/moon/MoonBoard.vue';
import PlanetaryTracks from '@/client/components/pathfinders/PlanetaryTracks.vue';
import PlayersOverview from '@/client/components/overview/PlayersOverview.vue';
import Turmoil from '@/client/components/turmoil/Turmoil.vue';

import {CardName} from '@/common/cards/CardName';
import {GameModel} from '@/common/models/GameModel';
import {HomeMixin} from '@/client/mixins/HomeMixin';
import {LogEvent, LogPlayer, fetchGenerationLog, isEventLine, sinceLastTurn, toEvent} from '@/client/components/mobile/MobileLog';
import {LogMessage} from '@/common/logs/LogMessage';
import {MobileView, SheetSnap} from '@/client/components/mobile/MobileView';
import {Phase} from '@/common/Phase';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Preferences, getPreferences} from '@/client/utils/PreferencesManager';
import {ReadyCard, asksForCards, isActionMenu, readyCards} from '@/client/components/mobile/MobileActionMenu';
import {clearPickedCard} from '@/client/utils/cardSelection';
import {BoardThing, boardNamesIn, clearBoardPick, pickBoardThing} from '@/client/utils/boardSelection';
import {clearPickedEntry, pickEntry, pickFocused, setPickFocus} from '@/client/utils/mobileFocus';
import {refreshMobileLayoutPreference} from '@/client/utils/useMobileLayout';
import {readViewport, standaloneGap} from '@/client/utils/standaloneHeight';
import {selectingSpace} from '@/client/utils/spaceSelection';

type Overlay = 'players' | 'menu';

type Claimable = {kind: 'milestone' | 'award', name: string};

type DataModel = {
  view: MobileView;
  snap: SheetSnap;
  preferences: Preferences;
  /** The log line tapped open for the cards it names. */
  magnifiedLine: LogEvent | undefined;
  /** The card being paid for and played, or used, in the play sheet. */
  playing: ReadyCard | undefined;
  /** The milestone or award in the claim sheet. */
  claiming: Claimable | undefined;
  overlay: Overlay | undefined;
  /** The log lines fetched so far, by generation, oldest line first. */
  logs: Record<number, ReadonlyArray<LogMessage>>;
  logLoading: boolean;
  /** The clock the log's "2 min" is measured against, ticked so it does not go stale. */
  now: number;
  /** The screen height to fill on an iOS home screen whose viewport stops short. */
  screenGap: number;
};

// The largest count a tab badge spells out.
const MAX_BADGE = 9;

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
    Colony,
    DynamicTitle,
    Milestones,
    MobileActionPanel,
    MobileBoardPane,
    MobileCardsPane,
    MobileFitBlock,
    MobileClaimSheet,
    MobileFocusStage,
    MobileHeader,
    MobileLogCards,
    MobileLogPane,
    MobileMore,
    MobileOverlay,
    MobilePlaySheet,
    MobileTabBar,
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
      preferences: {...getPreferences()},
      magnifiedLine: undefined,
      playing: undefined,
      claiming: undefined,
      overlay: undefined,
      logs: {},
      logLoading: false,
      now: Date.now(),
      screenGap: 0,
    };
  },
  computed: {
    game(): GameModel {
      return this.playerView.game;
    },
    thisPlayer(): PublicPlayerModel {
      return this.playerView.thisPlayer;
    },
    shellStyle(): Record<string, string> {
      return this.screenGap === 0 ? {} : {'--mobile-screen-gap': this.screenGap + 'px'};
    },
    cardScale(): number {
      return this.preferences.card_scale;
    },
    tapTargets(): boolean {
      return this.preferences.mobile_tap_targets;
    },
    /* The tags are what card requirements are judged against -- whether a card
       needing three science tags is worth drafting turns on them -- so they sit in
       the header on every view, unless the player turns them off. */
    tagRowVisible(): boolean {
      return this.preferences.tag_row !== 'never';
    },
    /* Whether the sheet is asking which cards to keep or buy: a draft, the research
       phase, a card's own pick. */
    choosingCards(): boolean {
      const waitingFor = this.playerView.waitingFor;
      return this.sheetInUse && !isActionMenu(waitingFor) && asksForCards(waitingFor);
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
    /** Every milestone the turn lets this player claim, then every award it lets them fund. */
    claimables(): ReadonlyArray<Claimable> {
      return [
        ...this.claimableMilestones.map((name) => ({kind: 'milestone' as const, name})),
        ...this.fundableAwards.map((name) => ({kind: 'award' as const, name})),
      ];
    },
    claimingIndex(): number {
      const claiming = this.claiming;
      return Math.max(0, this.claimables.findIndex((each) => each.kind === claiming?.kind && each.name === claiming?.name));
    },
    /** Where the card in the play sheet sits among the ready cards. */
    playingIndex(): number {
      const name = this.playing?.card.name;
      return Math.max(0, this.ready.findIndex((item) => item.card.name === name));
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
    /* What is waiting behind a tab: the cards that can be played or used, and what
       happened since this player last acted. */
    tabBadges(): Partial<Record<MobileView, string>> {
      const badges: Partial<Record<MobileView, string>> = {};
      if (this.ready.length > 0) {
        badges.cards = String(this.ready.length);
      }
      const recent = this.recentEvents.length;
      if (recent > 0) {
        badges.log = recent > MAX_BADGE ? MAX_BADGE + '+' : String(recent);
      }
      return badges;
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
      this.claiming = undefined;
      if (this.settingUp) {
        this.view = 'turn';
      }
      if (this.sheetInUse) {
        this.raiseSheet();
      } else {
        this.setSnap('closed');
      }
    },
    selectingSpace(selecting: boolean) {
      if (selecting) {
        // Get the sheet off the map, and the map in front of the player.
        this.view = 'board';
        this.scrollBoardPaneTo(0);
        this.setSnap('closed');
      } else if (this.sheetInUse) {
        this.raiseSheet();
      } else {
        this.setSnap('closed');
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
        this.setSnap('closed');
      }
      this.view = view;
    },
    setSnap(snap: SheetSnap): void {
      this.snap = this.sheetInUse || snap === 'closed' ? snap : 'closed';
      /* Putting the panel down abandons what it was raised for: nothing on the turn
         page, on the board or in the hand is still shown as chosen. */
      if (pickFocused.value && snap !== 'half' && snap !== 'full') {
        this.forgetPick();
        this.snap = 'closed';
      }
    },
    /* A choice between cards needs every card on screen; anything else leaves the
       board readable above it. */
    raiseSheet(): void {
      this.setSnap(this.choosingCards ? 'full' : 'half');
    },
    /*
     * A tap on a card the turn can use opens it in the play sheet straight away: the
     * card large, its payment, and the one button that plays or uses it. That sheet is
     * the confirmation, so nothing is played by the tap itself. What the server asks
     * after that -- a target, a tile -- arrives in the action sheet like any other
     * question.
     */
    select(name: CardName): void {
      const item = this.ready.find((each) => each.card.name === name);
      if (item === undefined) {
        return;
      }
      this.forgetPick();
      this.playing = item;
    },
    /** Swiping in the play sheet: the next or previous ready card, round and round. */
    turnCard(step: number): void {
      const count = this.ready.length;
      if (this.playing === undefined || count < 2) {
        return;
      }
      this.playing = this.ready[(this.playingIndex + step + count) % count];
    },
    /** A tile or a button on the turn page: the entry it stands for, opened in the sheet. */
    openEntry(index: number): void {
      clearPickedCard();
      clearBoardPick();
      pickEntry(index);
      /* A list to choose from -- the standard projects, the hand to sell -- needs the
         room. A confirmation does not. */
      const input = isActionMenu(this.playerView.waitingFor) ? this.playerView.waitingFor.options[index] : undefined;
      const tall = input !== undefined && (input.type === 'card' || input.type === 'projectCard' || input.type === 'or');
      this.openPick('panel', tall ? 'full' : 'half');
    },
    /* The turn page's tile: straight into the claim sheet at the first milestone or
       award on offer, with the rest a swipe away. With none on offer, the board shows
       where they stand. */
    openMilestones(): void {
      const first = this.claimables[0];
      if (first !== undefined) {
        this.forgetPick();
        this.claiming = first;
        return;
      }
      this.selectView('board');
      this.$nextTick(() => {
        const below = this.$refs.below as HTMLElement | undefined;
        this.scrollBoardPaneTo(below?.offsetTop ?? 0);
      });
    },
    claimBoardThing(kind: BoardThing, name: string): void {
      /* A milestone or an award opens in the claim sheet, the way a card opens in the
         play sheet. */
      if (kind !== 'colony') {
        this.forgetPick();
        this.claiming = {kind, name};
        return;
      }
      /* A colony tile is chosen inside the trade itself, alongside the fee, so there
         is nothing to hold up over the board and the panel needs the whole screen. */
      clearPickedCard();
      clearPickedEntry();
      pickBoardThing(kind, name);
      this.openPick('panel', 'full');
    },
    /** Swiping in the claim sheet: the next or previous one on offer, round and round. */
    turnClaim(step: number): void {
      const count = this.claimables.length;
      if (this.claiming === undefined || count < 2) {
        return;
      }
      this.claiming = this.claimables[(this.claimingIndex + step + count) % count];
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
    },
    scrollBoardPaneTo(top: number): void {
      const pane = this.$refs.boardPane as HTMLElement | undefined;
      if (pane !== undefined) {
        pane.scrollTop = top;
      }
    },
    fitToScreen(): void {
      this.screenGap = standaloneGap(readViewport());
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
    this.fitToScreen();
    window.addEventListener('resize', this.fitToScreen);
    /* Every answer the server accepts redraws the shell from scratch, so the watcher
       that raises a question never sees it arrive. A draft pick, the cards to buy, a
       follow-up: whatever is waiting is up in front of the player from the start,
       rather than behind a row they must tap first. */
    if (this.sheetInUse) {
      this.raiseSheet();
    }
    this.refreshLog();
    clock = setInterval(() => {
      this.now = Date.now();
    }, CLOCK_TICK_MS);
  },
  unmounted() {
    window.removeEventListener('resize', this.fitToScreen);
    this.forgetPick();
    if (clock !== undefined) {
      clearInterval(clock);
      clock = undefined;
    }
    document.body.classList.remove('mobile-shell-active');
  },
});
</script>
