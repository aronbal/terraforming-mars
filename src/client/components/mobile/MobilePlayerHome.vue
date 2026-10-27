<template>
  <div id="mobile-shell" :class="{'mobile-shell--short': screenGap > 0}" :style="shellStyle">
    <MobileHeader
      :game="game"
      :player="thisPlayer"
      :yourTurn="actionWaiting"
      :turnLabel="turnLabel"
      :showTagRow="tagRowVisible"
      :canOpenSheet="sheetInUse && snap === 'closed' && choosing === undefined && asking === undefined"
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
          :sheetOpen="snap !== 'closed' || choosing !== undefined || asking !== undefined"
          @select="select($event)"
          @openEntry="openEntry($event)"
          @openSheet="raiseSheet()"
          @openMilestones="openMilestones()"
          @openProjects="openProjects()"
          @openTrade="openTrade()"
          @openChooser="openChooser($event)"
          @confirm="confirming = $event"
          @showView="selectView($event)"
          @inspect="magnifiedLine = $event"/>
      </section>

      <section
        v-show="view === 'board'"
        ref="boardPane"
        class="mobile-pane mobile-pane--board"
        :class="{'mobile-pane--zoomed': boardFraming === 'zoomed'}"
        role="tabpanel"
        :aria-label="$t('Board')">
        <!-- In the board-game style the frame is drawn round the same board, which is
             laid over the window it leaves for the planet. The board is never
             remounted for a change of style: `SelectSpace` holds on to its spaces. -->
        <div :class="{'mobile-bg-host': boardGame}">
          <MobileBoardGame
            v-if="boardGame"
            :playerView="playerView"
            :part="boardZoom"
            :claimable="claimableMilestones"
            :fundable="fundableAwards"
            @zoomTo="zoomBoard($event)"
            @claim="claimBoardThing"/>
          <MobileBoardPane
            ref="board"
            :game="game"
            :tileView="tileView"
            :tapTargets="tapTargets"
            :framing="boardFraming"
            :backLabel="placementBack"
            @toggleTileView="cycleTileView()"
            @open="zoomBoard('planet')"
            @close="zoomBoard('overview')"
            @back="leavePlacement()"/>
        </div>

        <div class="mobile-below" ref="below">
          <!-- The board-game frame prints them along its bottom edge instead. -->
          <div v-if="!boardGame" class="mobile-below-block">
            <MobileMilestonesAwards
              :milestones="game.milestones"
              :awards="game.awards"
              :claimable="claimableMilestones"
              :fundable="fundableAwards"
              :turmoil="game.turmoil !== undefined"
              @claim="claimBoardThing"/>
          </div>
          <div v-if="game.turmoil" class="mobile-below-block">
            <MobileTurmoilPanel :turmoil="game.turmoil"/>
          </div>
          <MobileFitBlock v-if="game.moon" class="mobile-below-block">
            <MoonBoard :model="game.moon" :tileView="tileView" id="shortkey-moonBoard"/>
          </MobileFitBlock>
          <MobileFitBlock v-if="game.gameOptions.expansions.pathfinders" class="mobile-below-block">
            <PlanetaryTracks :tracks="game.pathfinders" :gameOptions="game.gameOptions"/>
          </MobileFitBlock>
          <div v-if="game.colonies.length > 0" class="mobile-below-block" id="shortkey-colonies">
            <h3 class="mobile-eyebrow mobile-below-title" v-i18n>Colonies</h3>
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
        :hostsInput="panelHostsInput"
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
      :count="playList.length"
      :choices="playSet !== 'ready' ? playList.map((item) => item.card.name) : []"
      @choose="choose($event)"
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

    <!-- A colony, held up with the fee to pay and the one button that trades with it. -->
    <MobileTradeSheet
      v-if="trading !== undefined"
      :playerView="playerView"
      :name="trading"
      :position="tradingIndex"
      :count="tradeableColonies.length"
      @next="turnTrade(1)"
      @previous="turnTrade(-1)"
      @close="trading = undefined"/>

    <!-- An action with nothing to choose -- converting heat, passing -- and its one button. -->
    <MobileConfirmSheet
      v-if="confirming !== undefined"
      :playerView="playerView"
      :annotation="confirming"
      :icon="confirmGlyph.icon"
      :tone="confirmGlyph.tone"
      @close="confirming = undefined"/>

    <!-- A pick among cards: the draft, the cards to buy, the patents to sell. -->
    <MobileCardChooser
      v-if="choosing !== undefined"
      :key="String(choosing.entry)"
      :playerView="playerView"
      :entry="choosing.entry"
      @close="choosing = undefined"/>

    <!-- A number to choose: how much production to give up, how many to spend. -->
    <MobileAmountSheet
      v-if="asking === 'amount'"
      :playerView="playerView"
      :entry="askingEntry"
      @close="putDownAsking()"/>

    <!-- A price to pay: the cards just bought, a fee. -->
    <MobilePaymentSheet
      v-if="asking === 'payment' && paymentQuestion !== undefined"
      :playerView="playerView"
      :playerinput="paymentQuestion"
      :entry="askingEntry"
      @close="putDownAsking()"/>

    <!-- A party to send a delegate to. -->
    <MobilePartySheet
      v-if="asking === 'party'"
      :playerView="playerView"
      :entry="askingEntry"
      @close="putDownAsking()"/>

    <!-- A colony to build on. -->
    <MobileColonySheet
      v-if="asking === 'colony'"
      :playerView="playerView"
      :entry="askingEntry"
      @close="putDownAsking()"/>

    <!-- Several numbers at once: resources spread over cards, production to lose. -->
    <MobileUnitsSheet
      v-if="asking === 'units'"
      :playerView="playerView"
      :entry="askingEntry"
      @close="putDownAsking()"/>

    <!-- One of a short list: a standard resource, whose delegate to remove. -->
    <MobilePickSheet
      v-if="asking === 'pick'"
      :playerView="playerView"
      :entry="askingEntry"
      @close="putDownAsking()"/>

    <!-- A space on the board, chosen as an option of a choice: the board takes the tap,
         and this sends it as that option's answer. It draws nothing itself. -->
    <SelectSpace
      v-if="asking === 'space' && nestedSpace !== undefined"
      v-show="false"
      :playerView="playerView"
      :playerinput="nestedSpace"
      :onsave="sendNestedSpace"
      :showsave="false"
      :showtitle="false"/>

    <!-- A choice: whose plants to remove, whether to pay, which player loses production. -->
    <MobileChoiceSheet
      v-if="asking === 'choice'"
      :playerView="playerView"
      @next="openNested($event)"
      @close="closeAsking()"/>

    <MobileLogCards
      v-if="magnifiedLine !== undefined"
      :event="magnifiedLine"
      :players="logPlayers"
      :now="now"
      @close="magnifiedLine = undefined"/>

    <MobileOverlay v-if="overlay === 'players'" :title="$t('Players')" @close="overlay = undefined">
      <MobilePlayersOverview id="shortkey-playersoverview" :playerView="playerView"/>
    </MobileOverlay>
    <MobileOverlay v-if="overlay === 'menu'" :title="$t('Menu')" @close="overlay = undefined">
      <MobileMore :playerView="playerView" @settingsChanged="refreshPreferences()"/>
    </MobileOverlay>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Colony from '@/client/components/colonies/Colony.vue';
import MobileActionPanel from '@/client/components/mobile/MobileActionPanel.vue';
import MobileBoardGame from '@/client/components/mobile/MobileBoardGame.vue';
import MobileBoardPane from '@/client/components/mobile/MobileBoardPane.vue';
import MobileCardsPane from '@/client/components/mobile/MobileCardsPane.vue';
import MobileFitBlock from '@/client/components/mobile/MobileFitBlock.vue';
import MobileAmountSheet from '@/client/components/mobile/MobileAmountSheet.vue';
import MobileChoiceSheet from '@/client/components/mobile/MobileChoiceSheet.vue';
import MobileColonySheet from '@/client/components/mobile/MobileColonySheet.vue';
import MobilePartySheet from '@/client/components/mobile/MobilePartySheet.vue';
import MobilePickSheet from '@/client/components/mobile/MobilePickSheet.vue';
import MobileUnitsSheet from '@/client/components/mobile/MobileUnitsSheet.vue';
import MobilePaymentSheet from '@/client/components/mobile/MobilePaymentSheet.vue';
import MobileCardChooser from '@/client/components/mobile/MobileCardChooser.vue';
import MobileClaimSheet from '@/client/components/mobile/MobileClaimSheet.vue';
import MobileConfirmSheet from '@/client/components/mobile/MobileConfirmSheet.vue';
import MobileFocusStage from '@/client/components/mobile/MobileFocusStage.vue';
import MobileHeader from '@/client/components/mobile/MobileHeader.vue';
import MobileLogCards from '@/client/components/mobile/MobileLogCards.vue';
import MobileLogPane, {LogGeneration} from '@/client/components/mobile/MobileLogPane.vue';
import MobileMilestonesAwards from '@/client/components/mobile/MobileMilestonesAwards.vue';
import MobileMore from '@/client/components/mobile/MobileMore.vue';
import MobileOverlay from '@/client/components/mobile/MobileOverlay.vue';
import MobilePlaySheet from '@/client/components/mobile/MobilePlaySheet.vue';
import MobilePlayersOverview from '@/client/components/mobile/MobilePlayersOverview.vue';
import MobileTabBar from '@/client/components/mobile/MobileTabBar.vue';
import MobileTradeSheet from '@/client/components/mobile/MobileTradeSheet.vue';
import MobileTurnPage from '@/client/components/mobile/MobileTurnPage.vue';
import MobileTurmoilPanel from '@/client/components/mobile/MobileTurmoilPanel.vue';
import MoonBoard from '@/client/components/moon/MoonBoard.vue';
import PlanetaryTracks from '@/client/components/pathfinders/PlanetaryTracks.vue';
import SelectSpace from '@/client/components/SelectSpace.vue';

import {CardName} from '@/common/cards/CardName';
import {GameModel} from '@/common/models/GameModel';
import {HomeMixin} from '@/client/mixins/HomeMixin';
import {LogEvent, LogPlayer, fetchGenerationLog, isEventLine, sinceLastTurn, toEvent} from '@/client/components/mobile/MobileLog';
import {LogMessage} from '@/common/logs/LogMessage';
import {MobileView, SheetSnap} from '@/client/components/mobile/MobileView';
import {Phase} from '@/common/Phase';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Preferences, getPreferences} from '@/client/utils/PreferencesManager';
import {ReadyCard, askedCards, asksForCards, isActionMenu, readyCards, standardProjects} from '@/client/components/mobile/MobileActionMenu';
import {isCardChoice} from '@/client/components/mobile/CardChooser';
import {amountInput} from '@/client/components/mobile/AmountSheet';
import {colonyInput, entryResponse, partyInput, pickQuestion, questionAt} from '@/client/components/mobile/PickSheet';
import {unitsQuestion} from '@/client/components/mobile/UnitsSheet';
import {NestedStep, choiceInput, playerChoiceInput} from '@/client/components/mobile/ChoiceSheet';
import {paymentInput} from '@/client/components/mobile/PaymentSheet';
import {PlayerInputModel, SelectPaymentModel, SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {SelectSpaceResponse} from '@/common/inputs/InputResponse';
import {postPlayerInput} from '@/client/utils/playerInputRequest';
import {ActionAnnotation} from '@/common/input/Annotation';
import {MobileIconName} from '@/client/components/mobile/MobileIcons';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Color} from '@/common/Color';
import {clearPickedCard} from '@/client/utils/cardSelection';
import {BoardThing, boardNamesIn, clearBoardPick} from '@/client/utils/boardSelection';
import {clearPickedEntry, pickEntry, pickFocused, setPickFocus} from '@/client/utils/mobileFocus';
import {refreshMobileLayoutPreference} from '@/client/utils/useMobileLayout';
import {readViewport, standaloneGap} from '@/client/utils/standaloneHeight';
import {selectingSpace} from '@/client/utils/spaceSelection';
import {BoardFraming, BoardZoom, boxOf, flipFrame, playZoom} from '@/client/components/mobile/BoardGame';

type Overlay = 'players' | 'menu';

type Claimable = {kind: 'milestone' | 'award', name: string};

/* The ready cards, the standard projects, or the cards the server asks one of to be
   played, as Eccentric Sponsor does. */
type PlaySet = 'ready' | 'projects' | 'asked';

type DataModel = {
  view: MobileView;
  snap: SheetSnap;
  preferences: Preferences;
  /** The log line tapped open for the cards it names. */
  magnifiedLine: LogEvent | undefined;
  /** The card being paid for and played, or used, in the play sheet. */
  playing: ReadyCard | undefined;
  /** What a swipe in the play sheet moves through. */
  playSet: PlaySet;
  /** The colony in the trade sheet. */
  trading: ColonyName | undefined;
  /** The menu entry in the confirmation sheet. */
  confirming: ActionAnnotation | undefined;
  /** The pick among cards in the card chooser: a menu entry's, or the waiting question's. */
  choosing: {entry: number | undefined} | undefined;
  /** The sheet of its own a plain question is answered in, while it is up. */
  asking: 'amount' | 'choice' | 'payment' | 'party' | 'colony' | 'units' | 'pick' | 'space' | undefined;
  /** The option of the choice that sheet answers, when it was chosen in the choice sheet. */
  askingEntry: number | undefined;
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
  /** What the board-game Board tab is zoomed into. */
  boardZoom: BoardZoom;
};

/** Whether one of the shell's own sheets answers `input`, rather than the panel. */
function answeredBySheet(input: PlayerInputModel, players: ReadonlyArray<{color: Color, name: string}>): boolean {
  return askedCards(input).length > 0 ||
    isCardChoice(input) ||
    paymentInput(input) !== undefined ||
    amountInput(input) !== undefined ||
    partyInput(input) !== undefined ||
    colonyInput(input) !== undefined ||
    unitsQuestion(input) !== undefined ||
    pickQuestion(input, players) !== undefined ||
    choiceInput(input) !== undefined ||
    playerChoiceInput(input) !== undefined;
}

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
    Colony,
    MobileActionPanel,
    MobileBoardGame,
    MobileBoardPane,
    MobileColonySheet,
    MobilePartySheet,
    MobilePickSheet,
    MobileUnitsSheet,
    MobileCardsPane,
    MobileFitBlock,
    MobileAmountSheet,
    MobileChoiceSheet,
    MobilePaymentSheet,
    MobileCardChooser,
    MobileClaimSheet,
    MobileConfirmSheet,
    MobileFocusStage,
    MobileMilestonesAwards,
    MobileHeader,
    MobileLogCards,
    MobileLogPane,
    MobileMore,
    MobileOverlay,
    MobilePlaySheet,
    MobileTabBar,
    MobileTradeSheet,
    MobileTurnPage,
    MobileTurmoilPanel,
    MoonBoard,
    PlanetaryTracks,
    SelectSpace,
    MobilePlayersOverview,
  },
  data(): DataModel {
    return {
      view: 'turn',
      snap: 'closed',
      preferences: {...getPreferences()},
      magnifiedLine: undefined,
      playing: undefined,
      playSet: 'ready',
      trading: undefined,
      confirming: undefined,
      choosing: undefined,
      asking: undefined,
      askingEntry: undefined,
      claiming: undefined,
      overlay: undefined,
      logs: {},
      logLoading: false,
      now: Date.now(),
      screenGap: 0,
      boardZoom: 'overview',
    };
  },
  computed: {
    /* The glyph the confirm sheet heads the action with. */
    confirmGlyph(): {icon: MobileIconName, tone: string} {
      switch (this.confirming) {
      case 'pass':
        return {icon: 'skip-forward', tone: 'warn'};
      case 'endTurn':
        return {icon: 'check-check', tone: 'ok'};
      case 'undo':
        return {icon: 'undo-2', tone: 'accent'};
      case 'turmoilParty':
        return {icon: 'landmark', tone: 'pr'};
      default:
        return {icon: 'thermometer', tone: 'warn'};
      }
    },
    /*
     * The placement bar's way out, when there is one. A space chosen for an option of a
     * choice goes back to the choice; one for a menu entry the player opened -- a
     * greenery, a standard project -- gives the entry up. A space the server asks for
     * after something was already done has none: what is done stays done, and the
     * tabs are still there to look at the hand.
     */
    placementBack(): string | undefined {
      if (this.asking === 'space') {
        return 'Back';
      }
      return pickFocused.value ? 'Cancel' : undefined;
    },
    /* The space on the board asked for as the option chosen in the choice sheet. */
    nestedSpace(): SelectSpaceModel | undefined {
      const input = questionAt(this.playerView.waitingFor, this.askingEntry);
      return this.askingEntry !== undefined && input?.type === 'space' ? input : undefined;
    },
    /*
     * Whether the panel draws the question itself. A question one of the shell's own
     * sheets answers is not drawn there as well: the desktop's copy of it, behind the
     * sheet, would start a placement of its own the moment its first option was a
     * space, and take the board away from the choice being made.
     *
     * A question the player may leave unanswered keeps the panel, which is what
     * listens for the other players while they do.
     */
    panelHostsInput(): boolean {
      const waitingFor = this.playerView.waitingFor;
      return waitingFor === undefined || waitingFor.optional === true || !answeredBySheet(waitingFor, this.playerView.players);
    },
    /* The price the server is asking to be paid: the question, or the option chosen of it. */
    paymentQuestion(): SelectPaymentModel | undefined {
      return paymentInput(this.playerView.waitingFor, this.askingEntry);
    },
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
    /* The Board tab drawn as the printed board, which the player turns on in Settings. */
    boardGame(): boolean {
      return this.preferences.mobile_board_style === 'boardgame';
    },
    boardFraming(): BoardFraming {
      if (!this.boardGame) {
        return 'column';
      }
      return this.boardZoom === 'planet' ? 'zoomed' : 'picture';
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
    /** The cards a swipe in the play sheet moves through. */
    playList(): ReadonlyArray<ReadyCard> {
      if (this.playSet === 'projects') {
        const waitingFor = this.playerView.waitingFor;
        return standardProjects(isActionMenu(waitingFor) ? waitingFor : undefined);
      }
      if (this.playSet === 'asked') {
        return askedCards(this.playerView.waitingFor);
      }
      return this.ready;
    },
    /** Where the card in the play sheet sits among them. */
    playingIndex(): number {
      const name = this.playing?.card.name;
      return Math.max(0, this.playList.findIndex((item) => item.card.name === name));
    },
    tradingIndex(): number {
      const trading = this.trading;
      return trading === undefined ? 0 : Math.max(0, this.tradeableColonies.indexOf(trading));
    },
    /** The milestones the turn's menu offers, which are the ones worth tapping. */
    claimableMilestones(): ReadonlyArray<string> {
      return boardNamesIn(this.playerView.waitingFor, 'milestone');
    },
    fundableAwards(): ReadonlyArray<string> {
      return boardNamesIn(this.playerView.waitingFor, 'award');
    },
    tradeableColonies(): ReadonlyArray<ColonyName> {
      return boardNamesIn(this.playerView.waitingFor, 'colony') as ReadonlyArray<ColonyName>;
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
      this.trading = undefined;
      this.confirming = undefined;
      this.choosing = undefined;
      this.asking = undefined;
      this.askingEntry = undefined;
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
        this.showPlacement();
        return;
      }
      // The space is chosen, or given up: the board-game board is a picture again.
      if (this.boardZoom === 'planet') {
        this.zoomBoard('overview');
      }
      if (this.sheetInUse) {
        this.raiseSheet();
      } else {
        this.setSnap('closed');
      }
    },
    /* A style changed in Settings while a space is being chosen still leaves the map
       in front, rather than a picture of it that takes no tap. */
    boardGame(boardGame: boolean) {
      this.boardZoom = boardGame && selectingSpace.value ? 'planet' : 'overview';
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
    closeAsking(): void {
      this.asking = undefined;
      this.askingEntry = undefined;
    },
    /* The board, and nothing over it: a space is being chosen. In the board-game
       style that is the planet zoomed in, since the overview only shows it as a
       picture. */
    showPlacement(): void {
      this.view = 'board';
      if (this.boardGame) {
        this.zoomBoard('planet');
      }
      this.scrollBoardPaneTo(0);
      this.setSnap('closed');
    },
    /*
     * Zooms the board-game board into one of its parts, or back out.
     *
     * A panel zooms itself. The planet is the shell's own board, so it is zoomed here:
     * measured where it is, laid out where it goes, fitted, and then drawn from where
     * it was to where it is now, so it grows out of its window rather than jumping.
     * Off screen there is nothing to measure, and it simply changes.
     */
    async zoomBoard(part: BoardZoom): Promise<void> {
      if (part === this.boardZoom) {
        return;
      }
      const planet = part === 'planet' || this.boardZoom === 'planet';
      const board = this.$refs.board as InstanceType<typeof MobileBoardPane> | undefined;
      const section = board?.$el as HTMLElement | undefined;
      const first = boxOf(section);
      const firstStage = boxOf(section?.querySelector('.mobile-board-stage'));
      this.boardZoom = part;
      // The zoomed planet fills the pane from its top, so the pane has to be there.
      this.scrollBoardPaneTo(0);
      if (!planet || board === undefined || section === undefined || first === undefined || firstStage === undefined || first.width === 0) {
        return;
      }
      await this.$nextTick();
      board.fit();
      await this.$nextTick();
      const last = boxOf(section);
      const lastStage = boxOf(section.querySelector('.mobile-board-stage'));
      if (last !== undefined && lastStage !== undefined) {
        playZoom(section, flipFrame(first, last, {first: firstStage, last: lastStage}));
      }
    },
    /* The placement bar's way out: back to the choice the space was chosen from, or
       the menu entry given up and the turn page back. */
    leavePlacement(): void {
      if (this.asking === 'space') {
        this.putDownAsking();
        return;
      }
      this.forgetPick();
      this.setSnap('closed');
      this.view = 'turn';
    },
    /* A sheet answering an option of a choice, put down: the choice comes back, so
       Cancel is a step back rather than out of the question altogether. */
    putDownAsking(): void {
      const fromChoice = this.askingEntry !== undefined && choiceInput(this.playerView.waitingFor) !== undefined;
      this.closeAsking();
      if (fromChoice) {
        this.asking = 'choice';
      }
    },
    async sendNestedSpace(response: SelectSpaceResponse): Promise<void> {
      const entry = this.askingEntry;
      if (entry !== undefined) {
        await postPlayerInput(this, this.playerView, entryResponse(entry, response));
      }
    },
    /* An option chosen in the choice sheet that is a question of its own goes on to the
       sheet that asks it, which sends the answer as that option's. */
    openNested(step: NestedStep): void {
      this.closeAsking();
      if (step.kind === 'card') {
        this.choosing = {entry: step.index};
        return;
      }
      this.asking = step.kind;
      this.askingEntry = step.index;
    },
    /* A choice between cards needs every card on screen; anything else leaves the
       board readable above it. */
    raiseSheet(): void {
      /* A space is chosen on the board. Each answer redraws the shell from scratch, on
         its turn page, so a second tile to place -- Ice Asteroid's two oceans -- would
         otherwise come up as the panel's bare 'Select space', away from the map. */
      if (selectingSpace.value) {
        this.showPlacement();
        return;
      }
      // A card the server asks to be played is paid for in the play sheet, as one from the hand is.
      const asked = askedCards(this.playerView.waitingFor);
      if (asked.length > 0) {
        this.setSnap('closed');
        this.playSet = 'asked';
        this.playing = asked[0];
        return;
      }
      // A plain pick among cards has a sheet of its own, every card at once.
      if (isCardChoice(this.playerView.waitingFor)) {
        this.setSnap('closed');
        this.choosing = {entry: undefined};
        return;
      }
      // So do a number, a price, a party, a colony, resources and a choice between plain options.
      if (paymentInput(this.playerView.waitingFor) !== undefined) {
        this.setSnap('closed');
        this.asking = 'payment';
        return;
      }
      if (amountInput(this.playerView.waitingFor) !== undefined) {
        this.setSnap('closed');
        this.asking = 'amount';
        return;
      }
      if (partyInput(this.playerView.waitingFor) !== undefined) {
        this.setSnap('closed');
        this.asking = 'party';
        return;
      }
      if (colonyInput(this.playerView.waitingFor) !== undefined) {
        this.setSnap('closed');
        this.asking = 'colony';
        return;
      }
      if (unitsQuestion(this.playerView.waitingFor) !== undefined) {
        this.setSnap('closed');
        this.asking = 'units';
        return;
      }
      if (pickQuestion(this.playerView.waitingFor, this.playerView.players) !== undefined) {
        this.setSnap('closed');
        this.asking = 'pick';
        return;
      }
      if (choiceInput(this.playerView.waitingFor) !== undefined || playerChoiceInput(this.playerView.waitingFor) !== undefined) {
        this.setSnap('closed');
        this.asking = 'choice';
        return;
      }
      /* A choice between options has its button pinned to the sheet's bottom edge,
         which at `half` is off the screen. */
      const choice = this.playerView.waitingFor?.type === 'or';
      this.setSnap(this.choosingCards || choice ? 'full' : 'half');
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
      this.playSet = 'ready';
      this.playing = item;
    },
    /* The turn page's tile: the play sheet with every standard project the player can
       pay for side by side, the first one picked. */
    openProjects(): void {
      this.playSet = 'projects';
      const first = this.playList[0];
      if (first !== undefined) {
        this.forgetPick();
        this.playing = first;
      }
    },
    /** A tap on one of the cards the play sheet shows side by side. */
    choose(name: CardName): void {
      const item = this.playList.find((each) => each.card.name === name);
      if (item !== undefined) {
        this.playing = item;
      }
    },
    /** Swiping in the play sheet: the next or previous card, round and round. */
    turnCard(step: number): void {
      const count = this.playList.length;
      if (this.playing === undefined || count < 2) {
        return;
      }
      this.playing = this.playList[(this.playingIndex + step + count) % count];
    },
    /* The turn page's tile: the trade sheet at the first colony on offer. */
    openTrade(): void {
      const first = this.tradeableColonies[0];
      if (first !== undefined) {
        this.forgetPick();
        this.trading = first;
      }
    },
    /** Swiping in the trade sheet: the next or previous colony, round and round. */
    turnTrade(step: number): void {
      const count = this.tradeableColonies.length;
      if (this.trading === undefined || count < 2) {
        return;
      }
      this.trading = this.tradeableColonies[(this.tradingIndex + step + count) % count];
    },
    /** A menu entry that is a pick among cards -- selling patents -- in the card chooser. */
    openChooser(entry: number): void {
      this.forgetPick();
      this.choosing = {entry};
    },
    /** A tile or a button on the turn page: the entry it stands for, opened in the sheet. */
    openEntry(index: number): void {
      const option = isActionMenu(this.playerView.waitingFor) ? this.playerView.waitingFor.options[index] : undefined;
      // Sending a delegate has a sheet of its own, like any party to choose.
      if (option?.type === 'party') {
        this.forgetPick();
        this.asking = 'party';
        this.askingEntry = index;
        return;
      }
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
      // The board-game board prints them along its foot, and zooms in on them there.
      if (this.boardGame) {
        this.zoomBoard('milestones');
        return;
      }
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
      // A colony opens in the trade sheet, the fee alongside it.
      this.forgetPick();
      this.trading = name as ColonyName;
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
