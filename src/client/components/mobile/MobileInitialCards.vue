<template>
  <div class="mobile-initial" data-test="mobile-initial">
    <ConfirmDialog
      message="Continue without buying any project cards?"
      ref="confirmation"
      @accept="saveData" />

    <div class="mobile-segment mobile-initial-steps" role="tablist">
      <button
        v-for="step in steps"
        :key="step.id"
        class="mobile-segment-button"
        role="tab"
        :aria-selected="step.id === current"
        :data-test="'initial-step-' + step.id"
        @click="current = step.id">
        <span>{{ $t(step.label) }}</span>
        <span class="mobile-segment-count mobile-num">{{ step.chosen }}/{{ step.needed }}</span>
      </button>
    </div>

    <!-- Every step stays mounted: a `SelectCard` holds the player's picks itself, so
         tearing one down to show another would throw its selection away. -->
    <div class="mobile-initial-body mobile-card-scaler">
      <div v-show="current === 'corporation'" data-test="initial-pane-corporation">
        <SelectCard
          :playerView="playerView"
          :playerinput="corpCardOption"
          :showtitle="false"
          :onsave="noop"
          @cardschanged="corporationChanged"/>
        <div v-if="playerCanChooseAridor" class="mobile-initial-aridor">
          <h3 class="mobile-cards-group-title" v-i18n>These are the colony tiles Aridor may choose from:</h3>
          <div class="player_home_colony_cont mobile-colony-list">
            <div
              class="player_home_colony small_colony"
              v-for="colonyName in playerView.game.discardedColonies"
              :key="colonyName">
              <MobileFitBlock>
                <Colony :colony="getColony(colonyName)" :active="getColony(colonyName).isActive"/>
              </MobileFitBlock>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasPrelude" v-show="current === 'prelude'" data-test="initial-pane-prelude">
        <SelectCard
          :playerView="playerView"
          :playerinput="preludeCardOption"
          :showtitle="false"
          :onsave="noop"
          @cardschanged="preludesChanged"/>
      </div>

      <div v-if="hasCeo" v-show="current === 'ceo'" data-test="initial-pane-ceo">
        <SelectCard
          :playerView="playerView"
          :playerinput="ceoCardOption"
          :showtitle="false"
          :onsave="noop"
          @cardschanged="ceosChanged"/>
      </div>

      <div v-show="current === 'cards'" data-test="initial-pane-cards">
        <SelectCard
          :playerView="playerView"
          :playerinput="projectCardOption"
          :showtitle="false"
          :onsave="noop"
          @cardschanged="cardsChanged"/>
      </div>
    </div>

    <!-- The money and what is still missing are the two things every step is judged
         against, so they stay on screen while the cards scroll behind them. -->
    <div class="mobile-initial-bar" data-test="initial-bar">
      <div class="mobile-initial-state">
        <div v-if="corporationChosen" class="mobile-initial-money" data-test="initial-money">
          <span class="mobile-initial-money-label" v-i18n>Start</span>
          <div class="megacredits">{{ startingMegacredits }}</div>
          <template v-if="hasPrelude">
            <span class="mobile-initial-money-label" v-i18n>After preludes</span>
            <div class="megacredits">{{ startingMegacredits + afterPreludes }}</div>
          </template>
        </div>
        <div v-if="warning !== undefined" class="mobile-initial-warning" data-test="initial-warning">{{ $t(warning) }}</div>
      </div>
      <button
        v-if="!onLastStep"
        class="mobile-button mobile-button--go"
        data-test="initial-next"
        @click="goToNextStep()"
        v-i18n>Next</button>
      <button
        v-else-if="showsave"
        class="mobile-button mobile-button--go"
        :disabled="!valid"
        data-test="initial-submit"
        @click="saveIfConfirmed()">{{ $t(playerinput.buttonLabel) }}</button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Colony from '@/client/components/colonies/Colony.vue';
import ConfirmDialog from '@/client/components/common/ConfirmDialog.vue';
import MobileFitBlock from '@/client/components/mobile/MobileFitBlock.vue';
import SelectCard from '@/client/components/SelectCard.vue';

import {CardName} from '@/common/cards/CardName';
import {ColonyModel, simpleColonyModel} from '@/common/models/ColonyModel';
import {ColonyName} from '@/common/colonies/ColonyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectInitialCardsModel} from '@/common/models/PlayerInputModel';
import {SelectInitialCardsResponse} from '@/common/inputs/InputResponse';
import {Preferences, PreferencesManager, getPreferences} from '@/client/utils/PreferencesManager';
import * as titles from '@/common/inputs/SelectInitialCards';
import {
  InitialCardsOffered,
  InitialCardsSelection,
  afterPreludes,
  buildResponse,
  getOption,
  hasOption,
  projectCards,
  startingMegacredits,
  validate,
} from '@/client/components/InitialCards';

/** The four selections, in the order the game asks for them. */
type Step = 'corporation' | 'prelude' | 'ceo' | 'cards';

type StepModel = {
  id: Step;
  label: string;
  /** How many the player has picked, and how many the game wants. */
  chosen: number;
  needed: number;
};

type DataModel = {
  current: Step;
  selectedCards: Array<CardName>;
  selectedCeos: Array<CardName>;
  selectedCorporations: Array<CardName>;
  selectedPreludes: Array<CardName>;
};

type Refs = {
  confirmation: InstanceType<typeof ConfirmDialog>;
};

/**
 * The opening hand on a phone.
 *
 * The desktop screen is four `SelectCard` grids stacked on one page — a corporation,
 * two preludes, a CEO and ten project cards. At phone width that is five screens of
 * scrolling, with the money it all adds up to at the very bottom, so the number the
 * decision turns on is never on screen beside the cards. Here each selection is a
 * step, and the money and the missing count sit in a bar that does not scroll away.
 *
 * The selections themselves are the same `SelectCard` the desktop uses, and the
 * arithmetic is the same module `SelectInitialCards.vue` calls.
 */
export default defineComponent({
  name: 'MobileInitialCards',
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    playerinput: {
      type: Object as PropType<SelectInitialCardsModel>,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectInitialCardsResponse) => void,
      required: true,
    },
    showsave: {
      type: Boolean,
      required: true,
    },
    showtitle: {
      type: Boolean,
      default: true,
    },
    preferences: {
      type: Object as () => Readonly<Preferences>,
      default: () => PreferencesManager.INSTANCE.values(),
    },
  },
  components: {
    Colony,
    ConfirmDialog,
    MobileFitBlock,
    SelectCard,
  },
  data(): DataModel {
    return {
      current: 'corporation',
      selectedCards: [],
      selectedCeos: [],
      selectedCorporations: [],
      selectedPreludes: [],
    };
  },
  methods: {
    noop() {
      throw new Error('should not be called');
    },
    cardsChanged(cards: Array<CardName>) {
      this.selectedCards = cards;
    },
    ceosChanged(cards: Array<CardName>) {
      this.selectedCeos = cards;
    },
    corporationChanged(cards: Array<CardName>) {
      this.selectedCorporations = cards;
    },
    preludesChanged(cards: Array<CardName>) {
      this.selectedPreludes = cards;
    },
    goToNextStep() {
      const index = this.steps.findIndex((step) => step.id === this.current);
      const next = this.steps[index + 1];
      if (next !== undefined) {
        this.current = next.id;
      }
    },
    saveIfConfirmed() {
      if (this.preferences.show_alerts && projectCards(this.selection).length === 0) {
        this.typedRefs.confirmation.show();
      } else {
        this.saveData();
      }
    },
    saveData() {
      this.onsave(buildResponse(this.selection, this.offered));
    },
    getColony(colonyName: ColonyName): ColonyModel {
      return simpleColonyModel(colonyName);
    },
  },
  computed: {
    typedRefs(): Refs {
      return this.$refs as Refs;
    },
    selection(): InitialCardsSelection {
      return {
        corporations: this.selectedCorporations,
        preludes: this.selectedPreludes,
        ceos: this.selectedCeos,
        cards: this.selectedCards,
      };
    },
    offered(): InitialCardsOffered {
      return {prelude: this.hasPrelude, ceo: this.hasCeo};
    },
    validation(): {valid: boolean, warning: string | undefined} {
      return validate(this.selection, this.offered);
    },
    valid(): boolean {
      return this.validation.valid;
    },
    warning(): string | undefined {
      return this.validation.warning;
    },
    corporationChosen(): boolean {
      return this.selectedCorporations.length === 1;
    },
    startingMegacredits(): number {
      return startingMegacredits(this.selection);
    },
    afterPreludes(): number {
      return afterPreludes(this.selection);
    },
    /*
     * The project cards have no fixed count -- a player may buy none -- so that step
     * shows what it has rather than a target.
     */
    steps(): ReadonlyArray<StepModel> {
      const steps: Array<StepModel> = [
        {id: 'corporation', label: 'Corp', chosen: this.selectedCorporations.length, needed: 1},
      ];
      if (this.hasPrelude) {
        steps.push({id: 'prelude', label: 'Preludes', chosen: this.selectedPreludes.length, needed: 2});
      }
      if (this.hasCeo) {
        steps.push({id: 'ceo', label: 'CEO', chosen: this.selectedCeos.length, needed: 1});
      }
      steps.push({id: 'cards', label: 'Cards', chosen: this.selectedCards.length, needed: this.projectCardOption.cards.length});
      return steps;
    },
    onLastStep(): boolean {
      return this.current === this.steps[this.steps.length - 1].id;
    },
    playerCanChooseAridor(): boolean {
      return this.playerView.dealtCorporationCards.some((card) => card.name === CardName.ARIDOR);
    },
    hasPrelude(): boolean {
      return hasOption(this.playerinput.options, titles.SELECT_PRELUDE_TITLE);
    },
    hasCeo(): boolean {
      return hasOption(this.playerinput.options, titles.SELECT_CEO_TITLE);
    },
    corpCardOption() {
      const option = getOption(this.playerinput.options, titles.SELECT_CORPORATION_TITLE);
      if (getPreferences().experimental_ui) {
        option.min = 1;
        option.max = option.cards.length;
      }
      return option;
    },
    preludeCardOption() {
      const option = getOption(this.playerinput.options, titles.SELECT_PRELUDE_TITLE);
      if (getPreferences().experimental_ui) {
        option.max = option.cards.length;
      }
      return option;
    },
    ceoCardOption() {
      const option = getOption(this.playerinput.options, titles.SELECT_CEO_TITLE);
      if (getPreferences().experimental_ui) {
        option.max = option.cards.length;
      }
      return option;
    },
    projectCardOption() {
      return getOption(this.playerinput.options, titles.SELECT_PROJECTS_TITLE);
    },
  },
});
</script>
