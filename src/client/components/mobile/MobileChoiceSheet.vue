<template>
  <div v-if="title !== undefined" class="mobile-play-sheet" data-test="choice-sheet">
    <div class="mobile-play-sheet-scrim" data-test="choice-sheet-scrim" @click="close"></div>
    <section
      ref="panel"
      class="mobile-play-sheet-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="$t(title)"
      tabindex="-1"
      @keydown.esc="close">
      <span class="mobile-play-sheet-grabber" aria-hidden="true"></span>
      <div class="mobile-play-sheet-body">
        <h2 class="mobile-confirm-sheet-title" data-test="choice-sheet-title">{{ $t(title) }}</h2>
        <!-- One row per option, each a full-width target; a tap only chooses it. -->
        <div class="mobile-choice-list" role="radiogroup">
          <!-- A player, by their colour and name. -->
          <button
            v-for="(color, index) in playerQuestion?.players ?? []"
            :key="color"
            type="button"
            role="radio"
            class="mobile-choice-row"
            :class="{'mobile-choice-row--on': index === chosen}"
            :aria-checked="index === chosen"
            data-test="choice-sheet-player"
            @click="chosen = index">
            <span class="mobile-choice-mark" aria-hidden="true">
              <MobileIcon v-if="index === chosen" name="check" :size="14" :strokeWidth="3"/>
            </span>
            <span class="mobile-choice-text mobile-choice-player">
              <i class="mobile-choice-standing-dot" :class="'player_bg_color_' + color"></i>{{ playerName(color) }}
            </span>
          </button>
          <button
            v-for="(option, index) in input?.options ?? []"
            :key="index"
            type="button"
            role="radio"
            class="mobile-choice-row"
            :class="{'mobile-choice-row--on': index === chosen}"
            :aria-checked="index === chosen"
            data-test="choice-sheet-option"
            @click="chosen = index">
            <span class="mobile-choice-mark" aria-hidden="true">
              <MobileIcon v-if="index === chosen" name="check" :size="14" :strokeWidth="3"/>
            </span>
            <!-- An award or a milestone reads as its name and everyone's score, and the
                 chosen one says what it is won by, so the choice can be made on the rules
                 rather than on a remembered name. -->
            <span v-if="rules[index] !== undefined" class="mobile-choice-text" data-test="choice-sheet-rule">
              <span class="mobile-choice-name">
                {{ $t(rules[index].name) }}
                <small class="mobile-choice-kind">{{ $t(rules[index].kind === 'award' ? 'Award' : 'Milestone') }}</small>
              </span>
              <span v-if="rules[index].standings.length > 0" class="mobile-choice-standings">
                <span v-for="standing in rules[index].standings" :key="standing.name" class="mobile-choice-standing">
                  <i class="mobile-choice-standing-dot" :class="standing.color !== undefined ? 'player_bg_color_' + standing.color : 'mobile-choice-standing-dot--unknown'"></i>{{ standing.score }}
                </span>
              </span>
              <span v-if="index === chosen" class="mobile-choice-rule" data-test="choice-sheet-rule-text">
                {{ $t(rules[index].description) }}
                <span class="mobile-choice-reward">{{ $t(reward(rules[index].kind)) }}</span>
              </span>
            </span>
            <span v-else class="mobile-choice-text">{{ $t(option.title) }}</span>
          </button>
        </div>
        <WarningsComponent v-if="warnings !== undefined" :warnings="warnings"/>
      </div>
      <div class="mobile-play-sheet-actions">
        <button
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          :disabled="submitting"
          data-test="choice-sheet-submit"
          @click="submit">{{ $t(buttonLabel) }}</button>
        <button
          v-if="optional"
          type="button"
          class="mobile-play-sheet-button"
          data-test="choice-sheet-cancel"
          @click="close">{{ $t('Cancel') }}</button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import WarningsComponent from '@/client/components/WarningsComponent.vue';
import {BoardRule, NestedStep, boardRuleIn, choiceInput, nestedKind, playerChoiceInput} from '@/client/components/mobile/ChoiceSheet';
import {postPlayerInput} from '@/client/utils/playerInputRequest';
import {Warning} from '@/common/cards/Warning';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {OrOptionsModel, SelectPlayerModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';

type DataModel = {
  /** The option the button will send. */
  chosen: number;
  submitting: boolean;
};

/*
 * The sheet a choice is made in: whose plants to remove, whether to pay for something,
 * which player loses production.
 *
 * An option that is itself a question -- a card to discard, a number, a price -- is
 * chosen here and answered next in the sheet that asks it, which sends the two together.
 *
 * The options are a stack of full-width rows, and a tap only chooses one, so a finger
 * that slips never sends anything. The one blue button at the bottom sends it -- it
 * is never between two options, where it would be in the way of the second. The
 * server's own default is chosen to start with, as on the desktop.
 */
export default defineComponent({
  name: 'MobileChoiceSheet',
  components: {
    MobileIcon,
    WarningsComponent,
  },
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
  },
  emits: {
    close: () => true,
    next: (_step: NestedStep) => true,
  },
  data(): DataModel {
    return {
      chosen: choiceInput(this.playerView.waitingFor)?.initialIdx ?? 0,
      submitting: false,
    };
  },
  computed: {
    input(): OrOptionsModel | undefined {
      return choiceInput(this.playerView.waitingFor);
    },
    playerQuestion(): SelectPlayerModel | undefined {
      return playerChoiceInput(this.playerView.waitingFor);
    },
    title(): string | Message | undefined {
      return (this.input ?? this.playerQuestion)?.title;
    },
    optional(): boolean {
      return (this.input ?? this.playerQuestion)?.optional === true;
    },
    /** The award or milestone each option is about, where it is about one. */
    rules(): Array<BoardRule | undefined> {
      const players = this.playerView.players;
      return (this.input?.options ?? []).map((option) => boardRuleIn(option, players));
    },
    /** The chosen option's own label: `Remove plants`, `Pay`, `Skip`; or on to its sheet. */
    buttonLabel(): string {
      if (this.playerQuestion !== undefined) {
        return this.playerQuestion.buttonLabel;
      }
      const option = this.input?.options[this.chosen];
      if (option !== undefined && nestedKind(option) !== undefined) {
        return 'Continue';
      }
      return option?.buttonLabel ?? this.input?.buttonLabel ?? '';
    },
    warnings(): ReadonlyArray<Warning> | undefined {
      const option = this.input?.options[this.chosen];
      return option?.type === 'option' && option.warnings !== undefined && option.warnings.length > 0 ? option.warnings : undefined;
    },
  },
  watch: {
    // The question moved on under the sheet: there is nothing left to answer here.
    title: {
      handler(title: string | Message | undefined) {
        if (title === undefined) {
          this.$emit('close');
        }
      },
      immediate: true,
    },
  },
  mounted() {
    const panel = this.$refs.panel as HTMLElement | undefined;
    panel?.focus({preventScroll: true});
  },
  methods: {
    /* What it pays. With two players an award has no second place: the scoring
       gives 2 VP only to the best of those left once first place is taken out, and
       with two that leaves no one to compare. */
    reward(kind: BoardRule['kind']): string {
      if (kind === 'milestone') {
        return '5 VP';
      }
      return this.playerView.players.length > 2 ? '1st 5 VP · 2nd 2 VP at the end' : '1st 5 VP at the end';
    },
    playerName(color: Color): string {
      return this.playerView.players.find((player) => player.color === color)?.name ?? color;
    },
    async submit(): Promise<void> {
      if (this.submitting) {
        return;
      }
      const option = this.input?.options[this.chosen];
      const kind = option === undefined ? undefined : nestedKind(option);
      if (kind !== undefined) {
        this.$emit('next', {kind, index: this.chosen});
        return;
      }
      const player = this.playerQuestion?.players[this.chosen];
      if (this.input === undefined && player === undefined) {
        return;
      }
      this.submitting = true;
      try {
        const response = player !== undefined ?
          {type: 'player' as const, player} :
          {type: 'or' as const, index: this.chosen, response: {type: 'option' as const}};
        if (await postPlayerInput(this, this.playerView, response)) {
          this.$emit('close');
        }
      } finally {
        this.submitting = false;
      }
    },
    close(): void {
      this.$emit('close');
    },
  },
});
</script>
