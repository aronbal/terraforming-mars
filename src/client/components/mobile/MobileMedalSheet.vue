<template>
  <div class="mobile-play-sheet" data-test="medal-sheet">
    <div class="mobile-play-sheet-scrim" data-test="medal-sheet-scrim" @click="$emit('close')"></div>
    <section
      ref="panel"
      class="mobile-play-sheet-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="$t(name)"
      tabindex="-1"
      @keydown.esc="$emit('close')">
      <span class="mobile-play-sheet-grabber" aria-hidden="true"></span>
      <div class="mobile-play-sheet-body mobile-medal-sheet-body">
        <!-- The medal at the size the board prints it, its name on its own bar. -->
        <span class="mobile-medal" :style="{backgroundImage: art}" aria-hidden="true" data-test="medal-sheet-art">
          <span class="mobile-medal-name">{{ $t(name) }}</span>
          <i v-if="owner !== undefined" class="board-cube mobile-medal-cube" :class="'board-cube--' + owner.color"></i>
        </span>
        <div class="mobile-medal-sheet-head">
          <h2 class="mobile-play-sheet-title">{{ $t(name) }}<span class="mobile-choice-kind">{{ $t(kind === 'milestone' ? 'Milestone' : 'Award') }}</span></h2>
          <span v-if="owner !== undefined" class="mobile-pill" data-test="medal-sheet-owner">
            <i class="mobile-choice-standing-dot" :class="'player_bg_color_' + owner.color"></i>{{ owner.name }}
          </span>
        </div>
        <p class="mobile-medal-sheet-rule" data-test="medal-sheet-rule">
          {{ $t(description) }}
          <span class="mobile-choice-reward">{{ $t(reward) }}</span>
        </p>
        <div v-if="scores.length > 0" class="mobile-play-sheet-rows" data-test="medal-sheet-scores">
          <div v-for="score in scores" :key="score.color" class="mobile-play-sheet-row">
            <i class="mobile-choice-standing-dot mobile-medal-sheet-dot" :class="'player_bg_color_' + score.color"></i>
            <span class="mobile-play-sheet-row-text">
              <span class="mobile-play-sheet-row-title">{{ score.name }}</span>
            </span>
            <span class="mobile-play-sheet-row-value">{{ score.score }}</span>
          </div>
        </div>
      </div>
      <div class="mobile-play-sheet-actions">
        <!-- The claim itself is the claim sheet's, which this hands the medal to. -->
        <button
          v-if="offered"
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          data-test="medal-sheet-claim"
          @click="$emit('claim')">{{ $t(kind === 'milestone' ? 'Claim' : 'Fund') }}</button>
        <button
          type="button"
          class="mobile-play-sheet-button"
          data-test="medal-sheet-close"
          @click="$emit('close')">{{ $t('Close') }}</button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import {getAward, getMilestone} from '@/client/MilestoneAwardManifest';
import {medalArt} from '@/client/components/mobile/BoardGame';
import {Color} from '@/common/Color';
import {AwardName} from '@/common/ma/AwardName';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {FundedAwardModel} from '@/common/models/FundedAwardModel';
import {ViewModel} from '@/common/models/PlayerModel';

type Score = {color: Color, name: string, score: number};

/*
 * A milestone or an award tapped on the board-game board: the medal, its rule,
 * what it pays and everyone's score, best first.
 *
 * When the turn offers it, the one blue button hands it on to the claim sheet, which
 * claims or funds it exactly as a tap under the modern board does. Nothing is sent
 * from here.
 */
export default defineComponent({
  name: 'MobileMedalSheet',
  props: {
    /* Any view of the game: the board's, or the results', which a spectator sees too. */
    playerView: {
      type: Object as PropType<ViewModel>,
      required: true,
    },
    kind: {
      type: String as PropType<'milestone' | 'award'>,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    /** Whether the turn's menu lets this player claim or fund it now. */
    offered: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close', 'claim'],
  computed: {
    model(): ClaimedMilestoneModel | FundedAwardModel | undefined {
      const game = this.playerView.game;
      const list: ReadonlyArray<ClaimedMilestoneModel | FundedAwardModel> = this.kind === 'milestone' ? game.milestones : game.awards;
      return list.find((each) => each.name === this.name);
    },
    art(): string {
      return medalArt(this.name, this.playerView.game.turmoil !== undefined);
    },
    description(): string {
      const rule = this.kind === 'milestone' ? getMilestone(this.name as MilestoneName) : getAward(this.name as AwardName);
      return rule?.description ?? '';
    },
    owner(): {name: string, color: Color} | undefined {
      const model = this.model;
      return model?.playerName !== undefined && model.color !== undefined ? {name: model.playerName, color: model.color} : undefined;
    },
    /* The same words the choice sheet uses for what it pays. With two players an award
       has no second place. */
    reward(): string {
      if (this.kind === 'milestone') {
        return '5 VP';
      }
      return this.playerView.players.length > 2 ? '1st 5 VP · 2nd 2 VP at the end' : '1st 5 VP at the end';
    },
    scores(): ReadonlyArray<Score> {
      const scores = this.model?.scores ?? [];
      return scores
        .map((score) => ({
          color: score.color,
          name: this.playerView.players.find((player) => player.color === score.color)?.name ?? score.color,
          score: score.score,
        }))
        .sort((a, b) => b.score - a.score);
    },
  },
  mounted() {
    const panel = this.$refs.panel as HTMLElement | undefined;
    panel?.focus({preventScroll: true});
  },
});
</script>
