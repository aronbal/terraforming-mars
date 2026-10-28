<template>
  <!-- On a phone, drawn in the shell's style: the search pinned at the top, the filters in a sheet. -->
  <div v-if="mobileLayout" class="mobile-card-list" :class="getLanguageCssClass()" data-test="mobile-card-list">
    <div class="mobile-more-head">
      <a class="mobile-plain-button mobile-card-list-back" href="/" data-test="card-list-back">&lsaquo; {{ $t('Back') }}</a>
    </div>
    <header class="mobile-card-list-head">
      <div class="mobile-card-list-eyebrow">{{ APP_NAME }}</div>
      <h1 v-i18n>Cards List</h1>
    </header>

    <div class="mobile-card-list-bar">
      <div class="mobile-card-list-search-row">
        <label class="mobile-card-list-search">
          <MobileIcon name="search" :size="16"/>
          <input
            ref="filter"
            type="search"
            enterkeyhint="search"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            :placeholder="$t('filter')"
            v-model="filterText"
            data-test="card-list-filter">
          <button v-if="filterText !== ''" type="button" class="mobile-card-list-clear" :aria-label="$t('Clear')" @click="filterText = ''">&times;</button>
        </label>
        <button
          type="button"
          class="mobile-card-list-filters"
          :class="{'mobile-card-list-filters--on': filtering}"
          :aria-label="$t('Filters')"
          data-test="card-list-open-filters"
          @click="filtersOpen = true">
          <MobileIcon name="sliders-horizontal" :size="18"/>
        </button>
      </div>
      <div class="mobile-card-list-chips">
        <button type="button" class="mobile-pill mobile-pill--button" data-test="card-list-names-only" @click="toggleNamesOnly()">
          {{ $t(namesOnly ? 'Names only' : 'Full text') }}
        </button>
        <button type="button" class="mobile-pill mobile-pill--button" data-test="card-list-sort" @click="toggleSortOrder()">
          {{ $t(sortOrder === 'a' ? 'A-Z' : '0-9') }} &#x2195;
        </button>
        <button
          type="button"
          class="mobile-pill mobile-pill--button"
          :class="{'mobile-pill--accent': vps !== 0}"
          data-test="card-list-vps"
          @click="toggleVps()">
          {{ $t(vpsLabel) }}
        </button>
      </div>
    </div>

    <section v-for="section in mobileCardSections" v-show="section.cards.length > 0" :key="section.title" class="mobile-card-list-section">
      <h2 class="mobile-eyebrow">{{ $t(section.title) }} · {{ section.cards.length }}</h2>
      <MobileCardListGrid :cards="section.cards" :tallCards="tallCards" @open="magnified = $event"/>
    </section>

    <!-- The rest were drawn for a desktop column; each is shrunk whole to fit. -->
    <section v-show="visibleGlobalEvents.length > 0" class="mobile-card-list-section">
      <h2 class="mobile-eyebrow">{{ $t('Global Events') }} · {{ visibleGlobalEvents.length }}</h2>
      <div class="mobile-card-list-blocks">
        <MobileFitBlock v-for="globalEventName in visibleGlobalEvents" :key="globalEventName" v-memo="[globalEventName]">
          <GlobalEvent :globalEventName="globalEventName" type="distant"/>
        </MobileFitBlock>
      </div>
    </section>

    <section v-show="visibleColonyNames.length > 0" class="mobile-card-list-section">
      <h2 class="mobile-eyebrow">{{ $t('Colonies') }} · {{ visibleColonyNames.length }}</h2>
      <div class="mobile-card-list-blocks">
        <MobileFitBlock v-for="colonyName in visibleColonyNames" :key="colonyName" v-memo="[colonyName, showMetadata]">
          <Colony :colony="colonyModel(colonyName)"/>
        </MobileFitBlock>
      </div>
    </section>

    <section v-show="visibleMilestoneNames.length > 0" class="mobile-card-list-section">
      <h2 class="mobile-eyebrow">{{ $t('Milestones') }} · {{ visibleMilestoneNames.length }}</h2>
      <div class="mobile-card-list-blocks mobile-card-list-blocks--pairs">
        <MobileFitBlock v-for="milestoneName in visibleMilestoneNames" :key="milestoneName" v-memo="[milestoneName]">
          <div class="milestones">
            <Milestone :milestone="milestoneModel(milestoneName)" :showDescription="true"/>
          </div>
        </MobileFitBlock>
      </div>
    </section>

    <section v-show="visibleAwardNames.length > 0" class="mobile-card-list-section">
      <h2 class="mobile-eyebrow">{{ $t('Awards') }} · {{ visibleAwardNames.length }}</h2>
      <div class="mobile-card-list-blocks mobile-card-list-blocks--pairs">
        <MobileFitBlock v-for="awardName in visibleAwardNames" :key="awardName" v-memo="[awardName]">
          <div class="awards">
            <Award :award="awardModel(awardName)" :showDescription="true"/>
          </div>
        </MobileFitBlock>
      </div>
    </section>

    <section v-show="visibleAgendaIds.length > 0" class="mobile-card-list-section">
      <h2 class="mobile-eyebrow">{{ $t('Agendas') }} · {{ visibleAgendaIds.length }}</h2>
      <div class="mobile-card-list-blocks mobile-card-list-blocks--pairs">
        <MobileFitBlock v-for="id in visibleAgendaIds" :key="id" v-memo="[id]">
          <TurmoilAgendaContainer :agendaId="id"/>
        </MobileFitBlock>
      </div>
    </section>

    <div v-if="visibleCount === 0" class="mobile-list">
      <div class="mobile-row mobile-row--empty mobile-card-list-empty" data-test="card-list-empty" v-i18n>No cards match the search and filters.</div>
    </div>

    <!-- A card opened at its printed size; a tap anywhere puts it back. -->
    <div v-if="magnified !== undefined" class="mobile-magnify" role="dialog" data-test="card-list-magnified" @click="magnified = undefined">
      <div class="mobile-magnify-holder">
        <Card class="cardbox" :card="{'name': magnified}" :autoTall="tallCards"/>
      </div>
    </div>

    <MobileOverlay v-if="filtersOpen" :title="$t('Filters')" @close="filtersOpen = false">
      <div class="mobile-card-list-filter-sheet" data-test="card-list-filters">
        <div class="mobile-section-head">
          <h3 class="mobile-eyebrow" v-i18n>Expansions</h3>
          <button type="button" class="mobile-plain-button" @click="setAll(expansions, allModules)">{{ $t(allOn(expansions, allModules) ? 'None' : 'All') }}</button>
        </div>
        <div class="mobile-card-list-options">
          <button
            v-for="expansion in allModules"
            :key="expansion"
            type="button"
            class="mobile-card-list-option"
            :aria-pressed="expansions[expansion]"
            :data-test="'filter-module-' + expansion"
            @click="expansions[expansion] = !expansions[expansion]">
            <span class="mobile-card-list-option-icon expansion-icon" :class="expansionIconClass(expansion)"></span>
            <span class="mobile-card-list-option-label">{{ $t(moduleName(expansion)) }}</span>
          </button>
        </div>

        <div class="mobile-section-head">
          <h3 class="mobile-eyebrow" v-i18n>Types</h3>
          <button type="button" class="mobile-plain-button" @click="setAll(types, allTypes)">{{ $t(allOn(types, allTypes) ? 'None' : 'All') }}</button>
        </div>
        <div class="mobile-card-list-options">
          <button
            v-for="type in allTypes"
            :key="type"
            type="button"
            class="mobile-card-list-option"
            :aria-pressed="types[type]"
            @click="types[type] = !types[type]">
            <span class="mobile-card-list-option-label">{{ $t(typeLabel(type)) }}</span>
          </button>
        </div>

        <div class="mobile-section-head">
          <h3 class="mobile-eyebrow" v-i18n>Tags</h3>
          <button type="button" class="mobile-plain-button" @click="setAllTags()">{{ $t(allTagsOn ? 'None' : 'All') }}</button>
        </div>
        <div class="mobile-card-list-options mobile-card-list-options--icons">
          <!-- The event tag is the event type, as on the desktop list. -->
          <button
            v-for="tag in allTags"
            :key="tag"
            type="button"
            class="mobile-card-list-option"
            :aria-pressed="tagOn(tag)"
            :aria-label="$t(tag)"
            @click="toggleTag(tag)">
            <span class="mobile-card-list-option-icon card-tag" :class="'tag-' + tag"></span>
          </button>
        </div>

        <div class="mobile-section-head">
          <h3 class="mobile-eyebrow" v-i18n>Resources</h3>
          <button type="button" class="mobile-plain-button" @click="setAll(resources, allResources)">{{ $t(allOn(resources, allResources) ? 'None' : 'All') }}</button>
        </div>
        <div class="mobile-card-list-options mobile-card-list-options--icons">
          <button
            v-for="resource in allResources"
            :key="resource"
            type="button"
            class="mobile-card-list-option"
            :aria-pressed="resources[resource]"
            :aria-label="$t(resource)"
            @click="resources[resource] = !resources[resource]">
            <span v-if="resource !== 'none'" class="mobile-card-list-option-icon card-resource" :class="cardResourceCSS[resource]"></span>
            <span v-else class="mobile-card-list-option-icon card-tag tag-none"></span>
          </button>
        </div>

        <h3 class="mobile-eyebrow" v-i18n>Display</h3>
        <div class="mobile-list">
          <label class="mobile-row mobile-more-switch">
            <span class="mobile-row-body">
              <span class="mobile-row-text">
                <span class="mobile-row-title" v-i18n>Tall cards</span>
              </span>
              <span class="form-switch">
                <input type="checkbox" v-model="tallCards">
                <i class="form-icon"></i>
              </span>
            </span>
          </label>
          <label class="mobile-row mobile-more-switch">
            <span class="mobile-row-body">
              <span class="mobile-row-text">
                <span class="mobile-row-title" v-i18n>Colonies with ships</span>
              </span>
              <span class="form-switch">
                <input type="checkbox" v-model="showMetadata">
                <i class="form-icon"></i>
              </span>
            </span>
          </label>
        </div>

        <button v-if="filtering" type="button" class="mobile-plain-button mobile-card-list-reset" data-test="card-list-reset" @click="resetFilters()" v-i18n>Reset filters</button>
      </div>
    </MobileOverlay>
  </div>

  <div v-else class="card-list-container" :class="getLanguageCssClass()">
    <h1 v-i18n>Cards List</h1>

      <!-- start filters -->

      <div class="search-container">
        <input ref="filter" class="filter" :placeholder="$t('filter')" v-model="filterText">
        <button id="namesOnlyToggle" name="namesOnly" @click="toggleNamesOnly()">
            <span v-if="namesOnly === true" v-i18n>Names only</span>
            <span v-else v-i18n>Full text</span>
        </button>

        <button id="sort-order" @click="toggleSortOrder()" style="width: 85px;">
            <span v-if="sortOrder === 'a'" v-i18n>A-Z</span>
            <span v-else v-i18n>0-9</span>
            &#x2195;
        </button>

        <button id="show-vps-only" @click="toggleVps()" style="width: 63px;">
            <span v-if="vps === 0" v-i18n>all</span>
            <span v-if="vps === 1" v-i18n>+VPs</span>
            <span v-if="vps === 2" v-i18n>-VPs</span>
        </button>

        <button id="show-metadata" @click="toggleShowMetadata()" style="width: 60px;" title="Show/hide colony metadata">
            <span v-if="showMetadata === true">🛰️■</span>
            <span v-else>🛰️□</span>
        </button>

        <button id="tall-cards" @click="toggleTallCards()" style="width: 90px;" title="Show tall / short cards">
            <span v-if="tallCards === true">🂠→<span class="small-card">🂠</span></span>
              <span v-else><span class="small-card">🂠</span>→🂠</span>
        </button>

        <button id="advanced-search-collapser" @click="toggleAdvancedSearch()">
            <span v-if="showAdvanced === true" v-i18n>Advanced «</span>
            <span v-else v-i18n>Advanced »</span>
        </button>
      </div>

      <div id="selections" v-show="showAdvanced">
        <!-- expansions -->
        <div class="selection-row">
          <button id="toggle-checkbox" @click="invertExpansions()">-</button>

          <span v-for="expansion in allModules" :key="expansion">
            <input type="checkbox" :name="expansion" :id="`${expansion}-checkbox`" v-model="expansions[expansion]">
            <label :for="`${expansion}-checkbox`" class="expansion-button">
              <div class='expansion-icon' :class="expansionIconClass(expansion)"></div>
            </label>
          </span>
        </div>

        <!-- types -->
        <div class="selection-row">
          <button id="toggle-checkbox" @click="invertTypes()">
              <span v-i18n>-</span>
          </button>

          <span v-for="type in allTypes" :key="type">
            <input type="checkbox" :name="`${type}-cardType`" :id="`${type}-cardType-checkbox`" v-model="types[type]">
            <label :for="`${type}-cardType-checkbox`" class="expansion-button">
                <span v-if="type === 'colonyTiles'" v-i18n>Colony Tiles</span>
                <span v-else-if="type === 'globalEvents'" v-i18n>Global Events</span>
                <span v-else v-i18n>{{type}}</span>
            </label>
          </span>
        </div>

        <!-- tags -->
        <div class="selection-row">
          <button id="toggle-checkbox" @click="invertTags()">
              <span v-i18n>-</span>
          </button>
          <span v-for="tag in allTags" :key="tag">
            <input v-if="tag === 'event'" type="checkbox" :name="`${tag}-cardType`" :id="`${tag}-tag-checkbox`" v-model="types.event">
            <input v-else type="checkbox" :name="`${tag}-cardType`" :id="`${tag}-tag-checkbox`" v-model="tags[tag]">
            <label :for="`${tag}-tag-checkbox`" class="expansion-button">
              <!-- a terrible hack, using expansion-icon because card-tag isn't enough to show the tag.-->
              <div :class="`expansion-icon card-tag tag-${tag}`"></div>
            </label>
          </span>
        </div>

        <!-- card resources -->
        <div class="selection-row">
          <button id="toggle-checkbox" @click="invertResources()">
              <span v-i18n>-</span>
          </button>
          <span v-for="resource in allResources" :key="resource">
            <input type="checkbox" :name="`${resource}-cardType`" :id="`${resource}-resource-checkbox`" v-model="resources[resource]">
            <label :for="`${resource}-resource-checkbox`" class="expansion-button">
              <!-- a terrible hack, using expansion-icon because card-resource isn't enough to show the resource.-->
              <div v-if="resource !== 'none'" class="expansion-icon card-resource" :class="cardResourceCSS[resource]"></div>
              <div v-else class="expansion-icon card-tag tag-none"></div>
            </label>
          </span>
        </div>

      </div>
      <!-- start cards -->

      <section v-show="visibleProjectCards.length > 0" class="card-list-cards-list">
          <h2 v-i18n>Project Cards</h2>
          <div class="cardbox" v-for="card in visibleProjectCards" :key="card" v-memo="[card, tallCards]">
              <Card :card="{'name': card}" :autoTall="tallCards" />
          </div>
          <br>
      </section>
      <section v-show="visibleCorporationCards.length > 0" class="card-list-cards-list">
          <h2 v-i18n>Corporations</h2>
          <div class="cardbox" v-for="card in visibleCorporationCards" :key="card" v-memo="[card, tallCards]">
              <Card :card="{'name': card}" :autoTall="tallCards"/>
          </div>
          <br>
      </section>
      <section v-show="visiblePreludeCards.length > 0" class="card-list-cards-list">
          <h2 v-i18n>Preludes</h2>
          <div class="cardbox" v-for="card in visiblePreludeCards" :key="card" v-memo="[card, tallCards]">
              <Card :card="{'name': card}" :autoTall="tallCards"/>
          </div>
          <br>
      </section>
      <section v-show="visibleCeoCards.length > 0" class="card-list-cards-list">
          <h2 v-i18n>CEOs</h2>
          <div class="cardbox" v-for="card in visibleCeoCards" :key="card" v-memo="[card, tallCards]">
              <Card :card="{'name': card}" :autoTall="tallCards" />
          </div>
          <br>
      </section>
      <section v-show="visibleStandardProjectCards.length > 0" class="card-list-cards-list">
        <h2 v-i18n>Standard Projects</h2>
        <div class="cardbox" v-for="card in visibleStandardProjectCards" :key="card" v-memo="[card, tallCards]">
            <Card :card="{'name': card}" :autoTall="tallCards" />
        </div>
      </section>

      <section v-show="visibleGlobalEvents.length > 0" class="card-list-cards-list">
        <h2 v-i18n>Global Events</h2>
        <div class="cardbox" v-for="globalEventName in visibleGlobalEvents" :key="globalEventName" v-memo="[globalEventName]">
          <GlobalEvent :globalEventName="globalEventName" type="distant"/>
        </div>
      </section>

      <section v-show="visibleColonyNames.length > 0">
        <h2 v-i18n>Colonies</h2>
        <div class="player_home_colony_cont">
          <div class="player_home_colony" v-for="colonyName in visibleColonyNames" :key="colonyName" v-memo="[colonyName, showMetadata]">
            <Colony :colony="colonyModel(colonyName)"/>
          </div>
        </div>
      </section>

      <section v-show="visibleMilestoneNames.length > 0">
        <h2 v-i18n>Milestones</h2>
        <div class="player_home_colony_cont">
          <div class="player_home_colony" v-for="milestoneName in visibleMilestoneNames" :key="milestoneName" v-memo="[milestoneName]">
            <div class="milestones"> <!-- This div is necessary for the CSS. Perhaps find a way to remove that?-->
              <Milestone :milestone="milestoneModel(milestoneName)" :showDescription="true"/>
            </div>
          </div>
        </div>
      </section>

      <section v-show="visibleAwardNames.length > 0">
        <h2 v-i18n>Awards</h2>
        <div class="player_home_colony_cont">
          <div class="player_home_colony" v-for="awardName in visibleAwardNames" :key="awardName" v-memo="[awardName]">
            <div class="awards"> <!-- This div is necessary for the CSS. Perhaps find a way to remove that?-->
              <Award :award="awardModel(awardName)" :showDescription="true"/>
            </div>
          </div>
        </div>
      </section>

      <section v-show="visibleAgendaIds.length > 0">
        <h2 v-i18n>Agendas</h2>
        <div class="player_home_colony_cont">
          <div class="player_home_colony" v-for="id in visibleAgendaIds" :key="id" v-memo="[id]">
            <TurmoilAgendaContainer :agendaId="id" />
          </div>
        </div>
      </section>

      <div class="free-floating-preferences-icon">
        <div v-show="scrolled" class="sidebar_item card-list-scroll-top" title="Scroll to top" @click="scrollToTop()">
          <div class="card-list-scroll-top-arrow">↑</div>
        </div>
        <LanguageIcon class="corner-language-icon"/>
        <PreferencesIcon/>
      </div>
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {CardType} from '@/common/cards/CardType';
import {CardName} from '@/common/cards/CardName';
import {getEnumStringValues, partition, toName} from '@/common/utils/utils';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {GlobalEventName} from '@/common/turmoil/globalEvents/GlobalEventName';
import {allGlobalEventNames, getGlobalEvent} from '@/client/turmoil/ClientGlobalEventManifest';
import {byType, getCard, getCardOrThrow, getCards} from '@/client/cards/ClientCardManifest';
import {COMMUNITY_COLONY_NAMES, OFFICIAL_COLONY_NAMES, PATHFINDERS_COLONY_NAMES} from '@/common/colonies/AllColonies';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyName} from '@/common/colonies/ColonyName';
import {GameModule, GAME_MODULES} from '@/common/cards/GameModule';
import {Tag} from '@/common/cards/Tag';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {ClientCard} from '@/common/cards/ClientCard';
import {translateText} from '@/client/directives/i18n';
import {MilestoneName, milestoneNames} from '@/common/ma/MilestoneName';
import {AwardName, awardNames} from '@/common/ma/AwardName';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {FundedAwardModel} from '@/common/models/FundedAwardModel';
import {TypeOption, CardListModel, hashToModel, modelToHash, ResourceOption, TagOption} from '@/client/components/cardlist/CardListModel';
import {getAward, getMilestone} from '@/client/MilestoneAwardManifest';
import {BonusId, BONUS_IDS, PolicyId, POLICY_IDS, agendaIdDescription} from '@/common/turmoil/Types';
import Card from '@/client/components/card/Card.vue';
import Colony from '@/client/components/colonies/Colony.vue';
import GlobalEvent from '@/client/components/turmoil/GlobalEvent.vue';
import PreferencesIcon from '@/client/components/PreferencesIcon.vue';
import LanguageIcon from '@/client/components/LanguageIcon.vue';
import Milestone from '@/client/components/Milestone.vue';
import Award from '@/client/components/Award.vue';
import TurmoilAgendaContainer from '@/client/components/cardlist/TurmoilAgendaContainer.vue';
import {CardResource} from '@/common/CardResource';
import {cardResourceCSS} from '../common/cardResources';
import {setDocumentTitle} from '@/client/utils/documentTitle';
import {textFitMetrics} from '@/client/utils/textFit';
import {mobileLayout} from '@/client/utils/useMobileLayout';
import {APP_NAME} from '@/common/constants';
import {MODULE_NAMES} from '@/common/cards/GameModule';
import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import MobileOverlay from '@/client/components/mobile/MobileOverlay.vue';
import MobileFitBlock from '@/client/components/mobile/MobileFitBlock.vue';
import MobileCardListGrid from '@/client/components/cardlist/MobileCardListGrid.vue';


type Refs = {
  filter: HTMLInputElement;
};

/** One run of cards on the phone's list, under its own heading. */
type CardSection = {
  title: string;
  cards: ReadonlyArray<CardName>;
};

const TYPE_LABELS: Record<TypeOption, string> = {
  [CardType.EVENT]: 'Event',
  [CardType.ACTIVE]: 'Active',
  [CardType.AUTOMATED]: 'Automated',
  [CardType.PRELUDE]: 'Prelude',
  [CardType.CORPORATION]: 'Corporation',
  [CardType.CEO]: 'CEO',
  [CardType.STANDARD_PROJECT]: 'Standard Projects',
  [CardType.STANDARD_ACTION]: 'Standard Actions',
  [CardType.PROXY]: 'Proxy',
  colonyTiles: 'Colony Tiles',
  globalEvents: 'Global Events',
  milestones: 'Milestones',
  awards: 'Awards',
  agendas: 'Agendas',
};

export default defineComponent({
  name: 'CardList',
  components: {
    Card,
    GlobalEvent,
    Colony,
    Milestone,
    Award,
    TurmoilAgendaContainer,
    PreferencesIcon,
    LanguageIcon,
    MobileIcon,
    MobileOverlay,
    MobileFitBlock,
    MobileCardListGrid,
  },
  data() {
    return {
      ...hashToModel(window.location.hash),
      // Whether the page has been scrolled down at all; gates the "scroll to top" widget.
      scrolled: false,
      // On a phone: whether the filters sheet is open, and the card opened large.
      filtersOpen: false,
      magnified: undefined as CardName | undefined,
      hashTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
  },
  mounted() {
    setDocumentTitle('Cards List');
    // A phone would raise its keyboard over the list before anyone asked to search.
    if (!this.mobileLayout) {
      this.typedRefs.filter.focus();
    }
    this.delayedSetLocationHash();
    this.measureTitleFit();
    window.addEventListener('scroll', this.handleScroll, {passive: true});
  },
  beforeUnmount() {
    clearTimeout(this.hashTimer);
    window.removeEventListener('scroll', this.handleScroll);
  },
  computed: {
    typedRefs(): Refs {
      return this.$refs as unknown as Refs;
    },
    mobileLayout(): boolean {
      return mobileLayout.value;
    },
    APP_NAME(): string {
      return APP_NAME;
    },
    mobileCardSections(): ReadonlyArray<CardSection> {
      return [
        {title: 'Project Cards', cards: this.visibleProjectCards},
        {title: 'Corporations', cards: this.visibleCorporationCards},
        {title: 'Preludes', cards: this.visiblePreludeCards},
        {title: 'CEOs', cards: this.visibleCeoCards},
        {title: 'Standard Projects', cards: this.visibleStandardProjectCards},
      ];
    },
    /** How many things the search and filters leave on the page, of every kind. */
    visibleCount(): number {
      return this.mobileCardSections.reduce((sum, section) => sum + section.cards.length, 0) +
        this.visibleGlobalEvents.length +
        this.visibleColonyNames.length +
        this.visibleMilestoneNames.length +
        this.visibleAwardNames.length +
        this.visibleAgendaIds.length;
    },
    vpsLabel(): string {
      switch (this.vps) {
      case 1: return '+VPs';
      case 2: return '-VPs';
      default: return 'all';
      }
    },
    allTagsOn(): boolean {
      return this.allTags.every((tag) => this.tagOn(tag));
    },
    /** Whether the filters sheet hides anything, which its button shows. */
    filtering(): boolean {
      return !this.allOn(this.expansions, this.allModules) ||
        !this.allOn(this.types, this.allTypes) ||
        !this.allTagsOn ||
        !this.allOn(this.resources, this.allResources);
    },
    allModules(): ReadonlyArray<GameModule> {
      return GAME_MODULES;
    },
    allTypes(): Array<TypeOption> {
      return [
        CardType.EVENT,
        CardType.ACTIVE,
        CardType.AUTOMATED,
        CardType.PRELUDE,
        CardType.CORPORATION,
        CardType.STANDARD_PROJECT,
        CardType.CEO,
        'colonyTiles',
        'globalEvents',
        'milestones',
        'awards',
        'agendas',
      ];
    },
    allTags(): Array<TagOption> {
      const results: Array<TagOption> = [];
      for (const tag in Tag) {
        if (Object.hasOwn(Tag, tag)) {
          results.push((<any>Tag)[tag]);
        }
      }
      return results.concat('none');
    },
    allResources(): Array<ResourceOption> {
      return [...getEnumStringValues(CardResource), 'none'];
    },
    allMilestoneNames(): ReadonlyArray<MilestoneName> {
      return milestoneNames.toSorted();
    },
    allAwardNames(): ReadonlyArray<AwardName> {
      return awardNames.toSorted();
    },
    allAgendaIds(): ReadonlyArray<PolicyId | BonusId> {
      const ids = (POLICY_IDS as ReadonlyArray<PolicyId | BonusId>).concat(BONUS_IDS);
      const [official, expansion] = partition(ids, (id) => id.endsWith('01'));
      official.sort(); // This puts matching party content together.
      expansion.sort();
      return [...official, ...expansion];
    },
    cardResourceCSS(): typeof cardResourceCSS {
      return cardResourceCSS;
    },
    visibleProjectCards(): Array<CardName> {
      return this.getAllProjectCards().filter((c) => this.showCard(c));
    },
    visibleCorporationCards(): Array<CardName> {
      return this.getAllCorporationCards().filter((c) => this.showCard(c));
    },
    visiblePreludeCards(): Array<CardName> {
      return this.getAllPreludeCards().filter((c) => this.showCard(c));
    },
    visibleCeoCards(): Array<CardName> {
      return this.getAllCeoCards().filter((c) => this.showCard(c));
    },
    visibleStandardProjectCards(): Array<CardName> {
      return this.getAllStandardProjectCards().filter((c) => this.showCard(c));
    },
    visibleGlobalEvents(): Array<GlobalEventName> {
      if (!this.types.globalEvents) {
        return [];
      }
      return this.getAllGlobalEvents().filter((e) => this.showGlobalEvent(e));
    },
    visibleColonyNames(): Array<ColonyName> {
      if (!this.types.colonyTiles) {
        return [];
      }
      return this.getAllColonyNames().filter((c) => this.showColony(c));
    },
    visibleMilestoneNames(): Array<MilestoneName> {
      if (!this.types.milestones) {
        return [];
      }
      return this.allMilestoneNames.filter((m) => this.showMilestone(m));
    },
    visibleAwardNames(): Array<AwardName> {
      if (!this.types.awards) {
        return [];
      }
      return this.allAwardNames.filter((a) => this.showAward(a));
    },
    visibleAgendaIds(): Array<PolicyId | BonusId> {
      if (!this.types.agendas) {
        return [];
      }
      return this.allAgendaIds.filter((id) => this.include(id, 'agenda'));
    },
    agendaIdDescription(): typeof agendaIdDescription {
      return agendaIdDescription;
    },
  },
  methods: {
    delayedSetLocationHash(delayms: number = 200) {
      this.hashTimer = setTimeout(() => {
        const changed = this.setLocationHash();
        this.delayedSetLocationHash(changed ? 10 : 100);
      }, delayms);
    },
    setLocationHash(): boolean {
      const hash = modelToHash(this as unknown as CardListModel);
      const changed = hash !== window.location.hash;
      window.location.hash = hash;
      return changed;
    },
    invertExpansions() {
      GAME_MODULES.forEach((module) => this.expansions[module] = !this.expansions[module]);
    },
    invertTags() {
      this.allTags.forEach((tag) => this.tags[tag] = !this.tags[tag]);
    },
    invertResources() {
      this.allResources.forEach((resource) => this.resources[resource] = !this.resources[resource]);
    },
    invertTypes() {
      this.allTypes.forEach((type) => this.types[type] = !this.types[type]);
    },
    sort<T extends string>(names: Array<T>): Array<T> {
      if (this.sortOrder === 'a') {
        const translated = names.map((name) => ({name: name, text: translateText(name)}));
        translated.sort((a, b) => a.text.localeCompare(b.text));
        return translated.map((e) => e.name);
      } else {
        const numbered = names.map((name) => ({name: name, number: getCardOrThrow(name as CardName).metadata.cardNumber ?? ''}));
        numbered.sort((a, b) => a.number.localeCompare(b.number));
        return numbered.map((e) => e.name);
      }
    },
    getAllStandardProjectCards() {
      const names = getCards(byType(CardType.STANDARD_PROJECT)).map(toName);
      return this.sort(names);
    },
    getAllProjectCards() {
      const names: Array<CardName> = [];
      names.push(...getCards(byType(CardType.AUTOMATED)).map(toName));
      names.push(...getCards(byType(CardType.ACTIVE)).map(toName));
      names.push(...getCards(byType(CardType.EVENT)).map(toName));
      return this.sort(names);
    },
    getAllCorporationCards() {
      const names = getCards(byType(CardType.CORPORATION)).map(toName);
      return this.sort(names);
    },
    getAllPreludeCards() {
      const names = getCards(byType(CardType.PRELUDE)).map(toName);
      return this.sort(names);
    },
    getAllCeoCards() {
      const names = getCards(byType(CardType.CEO)).map(toName);
      return this.sort(names);
    },
    getAllGlobalEvents() {
      if (this.sortOrder === 'a') {
        return this.sort(Array.from(allGlobalEventNames()));
      } else {
        return Array.from(allGlobalEventNames());
      }
    },
    getAllColonyNames() {
      return OFFICIAL_COLONY_NAMES.concat(COMMUNITY_COLONY_NAMES).concat(PATHFINDERS_COLONY_NAMES);
    },
    include(name: string, type: 'card' | 'globalEvent' | 'colony' | 'ma' | 'agenda') {
      const normalized = this.filterText.toLocaleUpperCase();
      if (normalized.length === 0) {
        return true;
      }
      if (this.namesOnly) {
        if (normalized.startsWith('^')) {
          return name.toLocaleUpperCase().startsWith(normalized.substring(1));
        }
        return name.toLocaleUpperCase().includes(normalized);
      } else {
        return this.searchIndex.matches(this.filterText, type, name);
      }
    },
    expansionIconClass(expansion: GameModule): string {
      switch (expansion) {
      case 'base': return 'expansion-icon-base';
      case 'corpera': return 'expansion-icon-CE';
      case 'colonies': return 'expansion-icon-colony';
      case 'moon': return 'expansion-icon-themoon';
      default: return `expansion-icon-${expansion}`;
      }
    },
    filterByTags(card: ClientCard): boolean {
      if (card.tags.length === 0) {
        return this.tags['none'] === true;
      }

      let matches = false;
      for (const tag of card.tags) {
        if (this.tags[tag]) {
          matches = true;
        }
      }
      return matches;
    },
    showCard(cardName: CardName): boolean {
      if (!this.include(cardName, 'card')) {
        return false;
      }

      const card = getCard(cardName);
      if (card === undefined) {
        return false;
      }

      if (!this.filterByTags(card)) {
        return false;
      }
      if (!this.types[card.type]) {
        return false;
      }
      if (card.resourceType === undefined) {
        if (this.resources.none === false) {
          return false;
        }
      } else {
        if (!this.resources[card.resourceType]) {
          return false;
        }
      }
      switch (this.vps) {
      case 1:
        if (card.victoryPoints === undefined) {
          return false;
        }
        break;
      case 2:
        if (card.victoryPoints !== undefined) {
          return false;
        }
        break;
      }
      return this.expansions[card.module] === true;
    },
    showGlobalEvent(name: GlobalEventName): boolean {
      if (!this.include(name, 'globalEvent')) {
        return false;
      }
      const globalEvent = getGlobalEvent(name);
      return globalEvent !== undefined && this.expansions[globalEvent.module] === true;
    },
    showColony(name: ColonyName): boolean {
      if (!this.include(name, 'colony')) {
        return false;
      }
      const colony = getColony(name);
      return colony !== undefined && this.expansions[colony.module ?? 'base'] === true;
    },
    showMilestone(name: MilestoneName): boolean {
      if (!this.include(name, 'ma')) {
        return false;
      }
      return this.expansions[getMilestone(name).requirements ?? 'base'] === true;
    },
    showAward(name: AwardName): boolean {
      if (!this.include(name, 'ma')) {
        return false;
      }
      return this.expansions[getAward(name).requirements ?? 'base'] === true;
    },
    getLanguageCssClass() {
      const language = getPreferences().lang;
      return 'language-' + language;
    },
    colonyModel(colonyName: ColonyName): ColonyModel {
      return {
        colonies: this.showMetadata ? ['red', 'blue'] : [],
        isActive: this.showMetadata,
        name: colonyName,
        trackPosition: 3,
        visitor: undefined,
      };
    },
    milestoneModel(name: MilestoneName): ClaimedMilestoneModel {
      return {name, playerName: undefined, color: undefined, scores: []};
    },
    awardModel(name: AwardName): FundedAwardModel {
      return {name, playerName: undefined, color: undefined, scores: []};
    },
    // experimentalUI might not be used at the moment, but it's fine to just leave it here.
    experimentalUI(): boolean {
      return getPreferences().experimental_ui;
    },
    // Reports how long it took to resize every card title once they've all been
    // fitted. Each CardTitle defers its fit until document.fonts.ready, so we
    // wait on the same signal: our child components register their fit callbacks
    // before this parent mounted hook runs, so by the time this resolves they
    // have all recorded their timings.
    measureTitleFit(): void {
      textFitMetrics.reset();
      const report = () => console.log(`Resized ${textFitMetrics.count} card titles in ${textFitMetrics.total.toFixed(1)}ms`);
      // document.fonts is unavailable outside a real browser (e.g. JSDOM tests).
      if (document.fonts === undefined) {
        report();
      } else {
        document.fonts.ready.then(report);
      }
    },
    scrollToTop(): void {
      window.scrollTo({top: 0, behavior: 'smooth'});
    },
    handleScroll(): void {
      this.scrolled = window.scrollY > 0;
    },
    toggleNamesOnly(): void {
      this.namesOnly = !this.namesOnly;
    },
    toggleAdvancedSearch(): void {
      this.showAdvanced = !this.showAdvanced;
    },
    toggleSortOrder(): void {
      this.sortOrder = this.sortOrder === 'a' ? '1' : 'a';
    },
    toggleVps(): void {
      this.vps = (this.vps + 1) % 3;
    },
    toggleShowMetadata(): void {
      this.showMetadata = !this.showMetadata;
    },
    toggleTallCards(): void {
      this.tallCards = !this.tallCards;
    },
    moduleName(module: GameModule): string {
      return MODULE_NAMES[module];
    },
    typeLabel(type: TypeOption): string {
      return TYPE_LABELS[type];
    },
    allOn<T extends string>(values: Record<T, boolean>, keys: ReadonlyArray<T>): boolean {
      return keys.every((key) => values[key]);
    },
    /** Turns every option in a group on, or, when they all are already, off. */
    setAll<T extends string>(values: Record<T, boolean>, keys: ReadonlyArray<T>): void {
      const on = !this.allOn(values, keys);
      keys.forEach((key) => values[key] = on);
    },
    // The event tag filters by the event type, as its checkbox does on the desktop list.
    tagOn(tag: TagOption): boolean {
      return tag === 'event' ? this.types.event : this.tags[tag];
    },
    toggleTag(tag: TagOption): void {
      if (tag === 'event') {
        this.types.event = !this.types.event;
      } else {
        this.tags[tag] = !this.tags[tag];
      }
    },
    setAllTags(): void {
      const on = !this.allTagsOn;
      this.allTags.forEach((tag) => this.tags[tag] = on);
      this.types.event = on;
    },
    resetFilters(): void {
      const defaults = hashToModel('');
      this.expansions = defaults.expansions;
      this.types = defaults.types;
      this.tags = defaults.tags;
      this.resources = defaults.resources;
    },
  },
});
</script>
