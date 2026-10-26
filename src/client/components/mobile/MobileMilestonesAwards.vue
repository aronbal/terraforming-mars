<template>
  <div class="mobile-ma" data-test="mobile-ma">
    <section v-for="group in groups" :key="group.kind" class="mobile-ma-group" :data-test="'mobile-ma-' + group.kind">
      <div class="mobile-section-head">
        <h3 class="mobile-eyebrow">{{ $t(group.title) }}</h3>
        <span class="mobile-row-trailing">{{ group.note }}</span>
      </div>
      <div class="mobile-list">
        <!-- A row the turn can claim or fund takes a tap, which opens the claim sheet. -->
        <button
          v-for="row in group.rows"
          :key="row.name"
          type="button"
          class="mobile-row mobile-ma-row"
          :class="{'mobile-row--button': row.offered, 'mobile-ma-row--taken': row.owner !== undefined}"
          :disabled="!row.offered"
          data-test="mobile-ma-row"
          @click="$emit('claim', group.kind, row.name)">
          <!-- The board's own medal for it, so it reads as the one printed on the board. -->
          <span class="mobile-ma-art" :style="{backgroundImage: row.art}" aria-hidden="true" data-test="mobile-ma-art"></span>
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-ma-name">
                <span class="mobile-row-title">{{ $t(row.name) }}</span>
                <span v-if="row.owner !== undefined" class="mobile-pill" data-test="mobile-ma-owner">
                  <i class="mobile-choice-standing-dot" :class="'player_bg_color_' + row.owner.color"></i>{{ row.owner.name }}
                </span>
                <span v-else-if="row.offered" class="mobile-pill mobile-pill--accent" data-test="mobile-ma-offered">{{ $t(group.kind === 'milestone' ? 'Claim' : 'Fund') }}</span>
              </span>
              <span class="mobile-row-subtitle mobile-more-wrap">{{ $t(row.description) }}</span>
              <span v-if="row.scores.length > 0" class="mobile-choice-standings" data-test="mobile-ma-scores">
                <span v-for="score in row.scores" :key="score.color" class="mobile-choice-standing">
                  <i class="mobile-choice-standing-dot" :class="'player_bg_color_' + score.color"></i>{{ score.score }}
                </span>
              </span>
            </span>
          </span>
        </button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import {getAward, getMilestone} from '@/client/MilestoneAwardManifest';
import {medalArt} from '@/client/components/mobile/BoardGame';
import {Color} from '@/common/Color';
import {AWARD_COSTS, MAX_AWARDS, MAX_MILESTONES, MILESTONE_COST} from '@/common/constants';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {FundedAwardModel} from '@/common/models/FundedAwardModel';

type Row = {
  name: string;
  description: string;
  /** The board's artwork for it, as a CSS image. */
  art: string;
  /** Who claimed or funded it, if anyone has. */
  owner: {name: string, color: Color} | undefined;
  offered: boolean;
  scores: ReadonlyArray<{color: Color, score: number}>;
};

type Group = {
  kind: 'milestone' | 'award';
  title: string;
  /** What the next one costs, or that there are none left. */
  note: string;
  rows: ReadonlyArray<Row>;
};

/*
 * The milestones and the awards under the board, as two lists: each with the medal
 * printed on the board, its rule, everyone's score, and who has claimed or funded it. The ones the turn can take are
 * marked and open the claim sheet, as the turn page's tile does.
 */
export default defineComponent({
  name: 'MobileMilestonesAwards',
  props: {
    milestones: {
      type: Array as PropType<ReadonlyArray<ClaimedMilestoneModel>>,
      required: true,
    },
    awards: {
      type: Array as PropType<ReadonlyArray<FundedAwardModel>>,
      required: true,
    },
    claimable: {
      type: Array as PropType<ReadonlyArray<string>>,
      default: () => [],
    },
    fundable: {
      type: Array as PropType<ReadonlyArray<string>>,
      default: () => [],
    },
    /** With Turmoil, Terraformer asks for 26 TR, and its medal says so. */
    turmoil: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    claim: (_kind: 'milestone' | 'award', _name: string) => true,
  },
  computed: {
    groups(): ReadonlyArray<Group> {
      const claimed = this.milestones.filter((milestone) => milestone.playerName !== undefined).length;
      const funded = this.awards.filter((award) => award.playerName !== undefined).length;
      const groups: Array<Group> = [];
      if (this.milestones.length > 0) {
        groups.push({
          kind: 'milestone',
          title: 'Milestones',
          note: claimed >= MAX_MILESTONES ? this.$t('All claimed') : `${MAX_MILESTONES - claimed} ${this.$t('left')} · ${MILESTONE_COST} M€`,
          rows: this.milestones.map((milestone) => ({
            name: milestone.name,
            description: getMilestone(milestone.name)?.description ?? '',
            art: this.art(milestone.name),
            owner: this.owner(milestone.playerName, milestone.color),
            offered: this.claimable.includes(milestone.name),
            scores: milestone.playerName === undefined ? milestone.scores : [],
          })),
        });
      }
      if (this.awards.length > 0) {
        groups.push({
          kind: 'award',
          title: 'Awards',
          note: funded >= MAX_AWARDS ? this.$t('All funded') : `${MAX_AWARDS - funded} ${this.$t('left')} · ${AWARD_COSTS[funded]} M€`,
          rows: this.awards.map((award) => ({
            name: award.name,
            description: getAward(award.name)?.description ?? '',
            art: this.art(award.name),
            owner: this.owner(award.playerName, award.color),
            offered: this.fundable.includes(award.name),
            // A funded award is still scored at the end, so its standings stay in view.
            scores: [...award.scores].sort((a, b) => b.score - a.score),
          })),
        });
      }
      return groups;
    },
  },
  methods: {
    art(name: string): string {
      return medalArt(name, this.turmoil);
    },
    owner(name: string | undefined, color: Color | undefined): Row['owner'] {
      return name !== undefined && color !== undefined ? {name, color} : undefined;
    },
  },
});
</script>
