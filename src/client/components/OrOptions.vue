<template>
  <div class='wf-options'>
    <label v-if="showtitle"><div>{{ $t(playerinput.title) }}</div></label>
    <label v-if="playerinput.warning !== undefined" class="card-warning"><div>({{ $t(playerinput.warning) }})</div></label>
    <div v-for="(option, idx) in displayedOptions" :key="idx">
      <label class="form-radio" ref="optionLabels">
        <input v-model="selectedOption" type="radio" :name="radioElementName" :value="option" >
        <i class="form-icon" ></i>
        <span>{{ $t(option.title) }}</span>
      </label>
      <div v-if="selectedIdx === idx" class="wf-option-body">
        <PlayerInputFactory ref="inputfactory"
                              :playerView="playerView"
                              :playerinput="option"
                              :onsave="playerFactorySaved(idx)"
                              :showsave="showsave && showChildSaveButton(option)"
                              :showtitle="false" />
      </div>
      <!-- On a phone the options are a full-width stack, so a button under the whole
           menu is a screen of scrolling away from the option it acts on. -->
      <div v-if="selectedIdx === idx && showOwnSaveButton && saveBesideOption" class="wf-action wf-option-save">
        <AppButton :title="$t(selectedOption.buttonLabel)" type="submit" size="normal" @click="saveData" />
      </div>
    </div>
    <div v-if="showOwnSaveButton && !saveBesideOption">
      <div class="wf-action wf-option-save">
        <AppButton :title="$t(selectedOption.buttonLabel)" type="submit" size="normal" @click="saveData" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {isHTMLElement} from '@/client/utils/vueUtils';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {InputResponse, OrOptionsResponse} from '@/common/inputs/InputResponse';
import {CardName} from '@/common/cards/CardName';
import {mobileLayout} from '@/client/utils/useMobileLayout';
import {offerFor, pickedCard} from '@/client/utils/cardSelection';
import {BoardPick, pickedBoardThing} from '@/client/utils/boardSelection';

let unique = 0;

export default defineComponent({
  name: 'OrOptions',
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => OrOptionsModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: OrOptionsResponse) => void,
      required: true,
    },
    showsave: {
      type: Boolean,
    },
    showtitle: {
      type: Boolean,
    },
  },
  components: {
    AppButton,
  },
  data() {
    const displayedOptions: Array<PlayerInputModel> = [];
    const originalIndices: Array<number> = [];
    this.playerinput.options.forEach((option, i) => {
      if (option.type === 'card' && option.showOnlyInLearnerMode !== false && !getPreferences().learner_mode) {
        return;
      }
      displayedOptions.push(option);
      originalIndices.push(i);
    });
    const initialIdx = this.playerinput.initialIdx ?? 0;
    // Special case: If the first recommended displayed option is SelectProjectCardToPlay, and none of them are enabled, skip it.
    let selectedIdx = initialIdx;
    if (displayedOptions.length > 1 &&
      displayedOptions[initialIdx].type === 'projectCard' &&
      !displayedOptions[initialIdx].cards.some((card) => card.isDisabled !== true)) {
      selectedIdx = initialIdx + 1;
    }
    return {
      displayedOptions,
      originalIndices,
      radioElementName: 'selectOption' + unique++,
      selectedOption: displayedOptions[selectedIdx],
      selectedIdx,
    };
  },
  computed: {
    pickedCard(): CardName | undefined {
      return pickedCard.value;
    },
    pickedBoardThing(): BoardPick | undefined {
      return pickedBoardThing.value;
    },
    showOwnSaveButton(): boolean {
      const selected = this.selectedOption;
      return this.showsave && selected !== undefined && !this.showChildSaveButton(selected);
    },
    saveBesideOption(): boolean {
      return mobileLayout.value;
    },
  },
  watch: {
    // A card picked elsewhere -- on the mobile shell's Cards tab -- names the option
    // the player meant, so open that one rather than making them find it again. A
    // milestone or an award tapped under the board says the same thing.
    pickedCard: {
      handler() {
        this.selectPickedOption();
      },
      immediate: true,
    },
    pickedBoardThing: {
      handler() {
        this.selectPickedOption();
      },
      immediate: true,
    },
    selectedOption(newOption: PlayerInputModel) {
      this.selectedIdx = this.displayedOptions.indexOf(newOption);
      // Clicking the option can shift elements on the page.
      // This preserves the location of the option button the user just clicked by
      // tracking where it was on the screen, where it moved, and then repositioning it.
      const anchorTop = this.getSelectedOptionTop();
      this.$nextTick(() => {
        const newTop = this.getSelectedOptionTop();
        if (anchorTop !== undefined && newTop !== undefined) {
          const delta = newTop - anchorTop;
          if (Math.abs(delta) > 0.5) {
            window.scrollBy(0, delta);
          }
        }
      });
    },
  },
  methods: {
    selectPickedOption(): void {
      const option = this.pickedOption();
      if (option !== undefined) {
        this.selectedOption = option;
      }
    },
    pickedOption(): PlayerInputModel | undefined {
      const name = this.pickedCard;
      if (name !== undefined) {
        const offered = this.displayedOptions.find((each) => offerFor(each, name) !== undefined);
        if (offered !== undefined) {
          return offered;
        }
      }
      const board = this.pickedBoardThing;
      if (board === undefined) {
        return undefined;
      }
      /* A list of milestones or awards is a list of the names themselves, so the
         option the player tapped under the board is the one titled after it. */
      return this.displayedOptions.find((each) => each.title === board.name);
    },
    getSelectedOptionTop(): number | undefined {
      const element = this.getSelectedOptionLabelElement();
      return element?.getBoundingClientRect().top;
    },
    getSelectedOptionLabelElement(): HTMLElement | undefined {
      const idx = this.selectedIdx;
      const optionLabels = this.$refs.optionLabels as HTMLElement | HTMLElement[] | undefined;
      if (idx === -1 || !optionLabels) {
        return undefined;
      }

      const val = Array.isArray(optionLabels) ? optionLabels[idx] : optionLabels;
      return isHTMLElement(val) ? val : undefined;
    },
    playerFactorySaved(displayedIdx: number) {
      const idx = this.originalIndices[displayedIdx];
      return (out: InputResponse) => {
        this.onsave({
          type: 'or',
          index: idx,
          response: out,
        });
      };
    },
    // When the child component is a multi-select card, let it render its own save button.
    // This allows the child to control the button label (e.g. "Sell 3 patents").
    showChildSaveButton(option: PlayerInputModel): boolean {
      return option.type === 'card' && !(option.max === 1 && option.min === 1);
    },
    saveData() {
      let ref = this.$refs['inputfactory'] as {saveData: () => void} | Array<{saveData: () => void}>;
      if (Array.isArray(ref)) {
        ref = ref[0];
      }
      ref.saveData();
    },
  },
});

</script>

