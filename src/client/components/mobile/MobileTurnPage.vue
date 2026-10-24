<template>
  <div class="mobile-turn" data-test="turn-page">
    <!-- Not this player's move: say whose it is, and leave the rest readable. -->
    <section v-if="waitingFor === undefined" class="mobile-section mobile-gutter">
      <div class="mobile-list">
        <div class="mobile-row" data-test="turn-waiting">
          <span class="mobile-glyph" :class="activeGlyphClass">
            <MobileIcon name="ellipsis" :size="16"/>
          </span>
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-row-title">{{ waitingTitle }}</span>
              <span class="mobile-row-subtitle" v-i18n>Your moves appear here when it is your turn</span>
            </span>
          </span>
        </div>
      </div>
    </section>

    <!-- The server is asking something other than what to do next: a draft, a
         follow-up. It lives in the sheet; this is the way back to it, so it goes
         while the sheet is up. -->
    <section v-else-if="menu === undefined && !sheetOpen" class="mobile-section mobile-gutter">
      <div class="mobile-list">
        <button class="mobile-row mobile-row--button" data-test="turn-question" @click="$emit('openSheet')">
          <span class="mobile-glyph mobile-glyph--accent">
            <MobileIcon name="play" :size="16"/>
          </span>
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-row-title">{{ $t(waitingFor.title) }}</span>
            </span>
            <span class="mobile-row-chevron" aria-hidden="true">&rsaquo;</span>
          </span>
        </button>
      </div>
    </section>

    <!-- Sections with nothing in them are left out rather than saying so. -->
    <section v-if="recentEvents.length > 0" class="mobile-section mobile-gutter" data-test="since-last-turn">
      <div class="mobile-section-head">
        <h2 class="mobile-eyebrow" v-i18n>Since your last turn</h2>
        <button class="mobile-plain-button" data-test="goto-log" @click="$emit('showView', 'log')" v-i18n>Log</button>
      </div>
      <div class="mobile-list">
        <MobileLogRow
          v-for="event in recentEvents"
          :key="event.key"
          :event="event"
          :players="players"
          :now="now"/>
      </div>
    </section>

    <template v-if="menu !== undefined && ready.length > 0">
      <section class="mobile-section" data-test="ready-now">
        <div class="mobile-section-head mobile-gutter">
          <h2 class="mobile-eyebrow mobile-eyebrow--accent">{{ $t('Ready now') }} · {{ ready.length }}</h2>
          <button class="mobile-plain-button" data-test="goto-cards" @click="$emit('showView', 'cards')" v-i18n>All cards</button>
        </div>
        <div class="mobile-ready-row mobile-card-scaler">
          <button
            v-for="item in ready"
            :key="item.card.name"
            class="mobile-ready-card"
            :class="{'mobile-ready-card--selected': selected === item.card.name}"
            :aria-pressed="selected === item.card.name"
            data-test="ready-card"
            @click="$emit('select', item.card.name)">
            <span class="mobile-ready-frame">
              <Card class="cardbox" :card="item.card" :cubeColor="playerView.thisPlayer.color"/>
            </span>
            <!-- What playing it takes out of the player's stock, in the units it is paid
                 with, rather than a bare M€ figure the steel would have changed. -->
            <span v-if="item.offer === 'play'" class="mobile-pill mobile-pill--price" data-test="ready-price">
              <span v-for="part in priceOf(item)" :key="part.unit" class="mobile-price-part">
                <i class="resource_icon mobile-price-icon" :class="iconClass(part.unit)" aria-hidden="true"></i>
                <span class="mobile-num">{{ part.amount }}</span>
                <span class="mobile-visually-hidden">{{ $t(unitName(part.unit)) }}</span>
              </span>
            </span>
            <span v-else class="mobile-pill mobile-pill--pr">
              <MobileIcon name="zap" :size="12" :strokeWidth="2.4"/>
              {{ $t('Use') }}
            </span>
          </button>
        </div>
      </section>
    </template>

    <section class="mobile-tiles mobile-gutter" data-test="turn-tiles">
      <button
        v-for="tile in tiles"
        :key="tile.key"
        class="mobile-tile"
        :disabled="!tile.usable"
        :data-test="'tile-' + tile.key"
        @click="openTile(tile)">
        <span class="mobile-glyph" :class="'mobile-glyph--' + tile.tone">
          <MobileIcon :name="tile.icon" :size="16"/>
        </span>
        <span class="mobile-tile-text">
          <span class="mobile-tile-title">{{ $t(tile.title) }}</span>
          <span v-if="tile.subtitle !== ''" class="mobile-tile-subtitle">{{ tile.subtitle }}</span>
        </span>
      </button>
    </section>

    <section v-if="others.length > 0" class="mobile-section mobile-gutter" data-test="other-actions">
      <h2 class="mobile-eyebrow" v-i18n>More actions</h2>
      <div class="mobile-list">
        <button
          v-for="entry in others"
          :key="entry.index"
          class="mobile-row mobile-row--button"
          data-test="other-action"
          @click="$emit('openEntry', entry.index)">
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-row-title">{{ $t(entry.input.title) }}</span>
            </span>
            <span class="mobile-row-chevron" aria-hidden="true">&rsaquo;</span>
          </span>
        </button>
      </div>
    </section>

    <section v-if="menu !== undefined" class="mobile-turn-buttons mobile-gutter">
      <button
        class="mobile-block-button"
        :disabled="sellPatents === undefined"
        data-test="sell-patents"
        @click="openEntry(sellPatents)">
        <MobileIcon name="coins" :size="18"/>
        <span v-i18n>Sell patents</span>
      </button>
      <button
        class="mobile-block-button"
        :disabled="pass === undefined"
        data-test="pass"
        @click="openEntry(pass)">
        <span v-i18n>Pass</span>
      </button>
      <button v-if="endTurn !== undefined" class="mobile-block-button" data-test="end-turn" @click="openEntry(endTurn)">
        <MobileIcon name="check-check" :size="18"/>
        <span v-i18n>End turn</span>
      </button>
      <button v-if="undo !== undefined" class="mobile-block-button" data-test="undo" @click="openEntry(undo)">
        <MobileIcon name="undo-2" :size="18"/>
        <span v-i18n>Undo</span>
      </button>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Card from '@/client/components/card/Card.vue';
import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import MobileLogRow from '@/client/components/mobile/MobileLogRow.vue';
import * as constants from '@/common/constants';
import {ActionEntry, ReadyCard, entryFor, isActionMenu, otherEntries, readyCards} from '@/client/components/mobile/MobileActionMenu';
import {ActionAnnotation} from '@/common/input/Annotation';
import {CardName} from '@/common/cards/CardName';
import {LogEvent, LogPlayer} from '@/client/components/mobile/MobileLog';
import {MobileIconName} from '@/client/components/mobile/MobileIcons';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {PAYMENT_UNIT_DESCRIPTIONS, paymentUnitIconClass} from '@/client/components/PaymentLedger';
import {PricePart, pricePreview} from '@/client/components/mobile/PlaySheet';
import {SpendableResource} from '@/common/inputs/Spendable';
import {getCard} from '@/client/cards/ClientCardManifest';
import {translateTextWithParams} from '@/client/directives/i18n';

/*
 * Everything the player can do right now, on one page.
 *
 * The turn's menu is read rather than listed: the cards it lets them play or use are
 * the ready row, the conversions and projects are tiles, and passing is a button. Each
 * opens the menu entry it stands for in the sheet, already chosen, so what is left is
 * the price and the confirmation. What happened since their last move sits on top,
 * because that is what changes what they want to do.
 */

type TileTone = 'warn' | 'ok' | 'accent' | 'pr';

type Tile = {
  key: string;
  icon: MobileIconName;
  tone: TileTone;
  title: string;
  subtitle: string;
  usable: boolean;
  /** The menu entry the tile opens, or undefined for one that opens the board. */
  entry: ActionEntry | undefined;
};

// The rows "Since your last turn" shows. The Log view has the rest.
const RECENT_ROWS = 3;

export default defineComponent({
  name: 'MobileTurnPage',
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    /** The ready card the player has tapped, which the bottom bar is about. */
    selected: {
      type: String as PropType<CardName | undefined>,
      required: false,
      default: undefined,
    },
    /** What other players did since this one last acted, newest first. */
    recent: {
      type: Array as PropType<ReadonlyArray<LogEvent>>,
      required: true,
    },
    players: {
      type: Array as PropType<ReadonlyArray<LogPlayer>>,
      required: true,
    },
    now: {
      type: Number,
      required: true,
    },
    /** Whether the sheet is up, holding the question this page would point to. */
    sheetOpen: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['select', 'openEntry', 'openSheet', 'openMilestones', 'showView'],
  components: {
    Card,
    MobileIcon,
    MobileLogRow,
  },
  computed: {
    player(): PublicPlayerModel {
      return this.playerView.thisPlayer;
    },
    waitingFor(): PlayerInputModel | undefined {
      return this.playerView.waitingFor;
    },
    menu(): OrOptionsModel | undefined {
      const waitingFor = this.waitingFor;
      return isActionMenu(waitingFor) ? waitingFor : undefined;
    },
    recentEvents(): ReadonlyArray<LogEvent> {
      return this.recent.slice(0, RECENT_ROWS);
    },
    ready(): ReadonlyArray<ReadyCard> {
      return readyCards(this.menu);
    },
    others(): ReadonlyArray<ActionEntry> {
      return otherEntries(this.menu);
    },
    sellPatents(): ActionEntry | undefined {
      return this.entry('sellPatents');
    },
    pass(): ActionEntry | undefined {
      return this.entry('pass');
    },
    endTurn(): ActionEntry | undefined {
      return this.entry('endTurn');
    },
    undo(): ActionEntry | undefined {
      return this.entry('undo');
    },
    activePlayer(): PublicPlayerModel | undefined {
      return this.playerView.players.find((player) => player.isActive);
    },
    activeGlyphClass(): string {
      const active = this.activePlayer;
      return active === undefined ? 'mobile-glyph--neutral' : 'player_bg_color_' + active.color;
    },
    waitingTitle(): string {
      const active = this.activePlayer;
      if (active === undefined || active.color === this.player.color) {
        return this.$t('Waiting for the other players');
      }
      return this.say('Waiting for ${0}', active.name);
    },
    tiles(): ReadonlyArray<Tile> {
      const tiles: Array<Tile> = [this.heatTile(), this.greeneryTile(), this.projectsTile(), this.boardTile()];
      const game = this.playerView.game;
      if (game.colonies.length > 0) {
        const entry = this.entry('tradeWithColony');
        tiles.push({
          key: 'trade',
          icon: 'handshake',
          tone: 'accent',
          title: 'Trade',
          subtitle: entry !== undefined ? this.$t('With a colony') : '',
          usable: entry !== undefined,
          entry,
        });
      }
      if (game.turmoil !== undefined) {
        const entry = this.entry('sendDelegate');
        tiles.push({
          key: 'delegate',
          icon: 'landmark',
          tone: 'pr',
          title: 'Delegate',
          subtitle: entry !== undefined ? this.$t('Send a delegate') : '',
          usable: entry !== undefined,
          entry,
        });
        const party = this.entry('turmoilParty');
        if (party !== undefined) {
          tiles.push({
            key: 'party',
            icon: 'landmark',
            tone: 'pr',
            title: 'Party action',
            subtitle: this.$t(party.input.title),
            usable: true,
            entry: party,
          });
        }
      }
      return tiles;
    },
  },
  methods: {
    /** A sentence with numbers or names in it, translated as one piece. */
    say(text: string, ...params: Array<string | number>): string {
      return translateTextWithParams(text, params.map(String));
    },
    entry(annotation: ActionAnnotation): ActionEntry | undefined {
      return entryFor(this.menu, annotation);
    },
    priceOf(item: ReadyCard): ReadonlyArray<PricePart> {
      const input = this.entry('projectCard')?.input;
      if (input?.type !== 'projectCard') {
        const cost = item.card.calculatedCost ?? getCard(item.card.name)?.cost ?? 0;
        return [{unit: 'megacredits', amount: cost}];
      }
      return pricePreview(input, item.card, this.player);
    },
    iconClass(unit: SpendableResource): string {
      return paymentUnitIconClass(unit);
    },
    unitName(unit: SpendableResource): string {
      return PAYMENT_UNIT_DESCRIPTIONS[unit];
    },
    /*
     * How far a conversion is from being possible, as what the player has over what
     * it takes. A tile that is simply not on offer says nothing: dimmed is enough.
     */
    progress(have: number, need: number): string {
      return have + '/' + need;
    },
    heatTile(): Tile {
      const entry = this.entry('convertHeat');
      const heat = this.player.heat;
      const need = constants.HEAT_FOR_TEMPERATURE;
      let subtitle = this.say('${0} of ${1} heat', need, heat);
      if (entry === undefined) {
        const maxed = this.playerView.game.temperature >= constants.MAX_TEMPERATURE;
        subtitle = !maxed && heat < need ? this.progress(heat, need) : '';
      }
      return {key: 'heat', icon: 'thermometer', tone: 'warn', title: 'Heat to temp', subtitle, usable: entry !== undefined, entry};
    },
    greeneryTile(): Tile {
      const entry = this.entry('convertPlants');
      const plants = this.player.plants;
      const need = this.player.plantsNeededForGreenery;
      let subtitle = this.say('${0} of ${1} plants', need, plants);
      if (entry === undefined) {
        subtitle = plants < need ? this.progress(plants, need) : '';
      }
      return {key: 'greenery', icon: 'leaf', tone: 'ok', title: 'Greenery', subtitle, usable: entry !== undefined, entry};
    },
    projectsTile(): Tile {
      const entry = this.entry('standardProject');
      const input = entry?.input;
      // The standard projects arrive as cards to pay for, the way a project card does.
      const affordable = input !== undefined && (input.type === 'card' || input.type === 'projectCard') ?
        input.cards.filter((card) => card.isDisabled !== true).length :
        0;
      return {
        key: 'projects',
        icon: 'hammer',
        tone: 'accent',
        title: 'Standard projects',
        subtitle: affordable > 0 ? this.say(affordable === 1 ? '${0} option' : '${0} options', affordable) : '',
        usable: affordable > 0,
        entry,
      };
    },
    /*
     * Milestones and awards are printed on the board, and are claimed by tapping them
     * there, under the map, where what each is worth can be read first.
     */
    boardTile(): Tile {
      const milestones = this.entry('milestone');
      const awards = this.entry('award');
      const claimable = milestones?.count ?? 0;
      let subtitle = '';
      if (claimable > 0) {
        subtitle = this.say(claimable === 1 ? '${0} milestone to claim' : '${0} milestones to claim', claimable);
      } else if (awards !== undefined) {
        const cost = this.awardCost(awards.input);
        subtitle = cost === undefined ? this.$t('Fund an award') : this.say('Award from ${0} M€', cost);
      }
      return {
        key: 'board',
        icon: 'trophy',
        tone: 'pr',
        title: 'Milestones & awards',
        subtitle,
        usable: milestones !== undefined || awards !== undefined,
        entry: undefined,
      };
    },
    /** The funding price, which the server writes into the entry's title. */
    awardCost(input: PlayerInputModel): number | undefined {
      const title = input.title;
      if (typeof title === 'string') {
        return undefined;
      }
      const value = Number(title.data[0]?.value);
      return Number.isFinite(value) ? value : undefined;
    },
    openTile(tile: Tile): void {
      if (!tile.usable) {
        return;
      }
      if (tile.entry === undefined) {
        this.$emit('openMilestones');
        return;
      }
      this.openEntry(tile.entry);
    },
    openEntry(entry: ActionEntry | undefined): void {
      if (entry !== undefined) {
        this.$emit('openEntry', entry.index);
      }
    },
  },
});
</script>
