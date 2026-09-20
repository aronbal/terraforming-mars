<template>
  <div class="mobile-actions" data-test="action-list">
    <!-- The player has already said what they are doing, so this is only the price
         and the confirmation for it. -->
    <template v-if="focused !== undefined">
      <h2 class="mobile-actions-title">{{ $t(focused.input.title) }}</h2>
      <!-- The tile the player tapped, with what it is worth and what it asks for,
           so the choice can be read here rather than back on the board. -->
      <!-- The container classes are what the tile's own styling hangs off; without
           them it comes out as bare score bars with no medal on it. -->
      <div v-if="focusedMilestone !== undefined" class="mobile-focus-tile milestones" data-test="focus-tile">
        <Milestone :milestone="focusedMilestone" :showDescription="true"/>
      </div>
      <div v-else-if="focusedAward !== undefined" class="mobile-focus-tile awards" data-test="focus-tile">
        <Award :award="focusedAward" :showDescription="true"/>
      </div>
      <div class="mobile-action-body mobile-action-body--focused" data-test="focused-body">
        <PlayerInputFactory
          ref="openInput"
          :playerView="playerView"
          :playerinput="focused.input"
          :onsave="saved(focused.index)"
          :showsave="showsave && childSaves(focused.input)"
          :showtitle="false"/>
        <div v-if="showsave && !childSaves(focused.input)" class="wf-action">
          <AppButton :title="$t(focused.input.buttonLabel)" type="submit" size="normal" @click="save()"/>
        </div>
      </div>
    </template>

    <template v-else>
    <h2 class="mobile-actions-title">{{ $t(playerinput.title) }}</h2>

    <div v-for="group in groups" :key="group.title ?? ''" class="mobile-action-group">
      <h3 v-if="group.title !== undefined" class="mobile-action-group-title">{{ $t(group.title) }}</h3>

      <template v-for="entry in group.entries" :key="entry.index">
        <!-- Handled on the tab where the thing itself is drawn. -->
        <button
          v-if="entry.elsewhere !== undefined"
          class="mobile-action mobile-action--elsewhere"
          data-test="action-elsewhere"
          @click="goto(entry.elsewhere.tab)">
          <span class="mobile-action-main">
            <span class="mobile-action-name">{{ $t(entry.input.title) }}</span>
            <span class="mobile-action-note">{{ $t(entry.elsewhere.hint) }}</span>
          </span>
          <span v-if="entry.count !== undefined" class="mobile-action-count mobile-num">{{ entry.count }}</span>
          <span class="mobile-action-chevron">&rsaquo;</span>
        </button>

        <template v-else>
          <button
            class="mobile-action"
            data-test="action-row"
            :aria-expanded="openIndex === entry.index"
            @click="toggle(entry.index)">
            <span class="mobile-action-main">
              <span class="mobile-action-name">{{ $t(entry.input.title) }}</span>
            </span>
            <span v-if="entry.count !== undefined" class="mobile-action-count mobile-num">{{ entry.count }}</span>
            <span class="mobile-action-chevron">{{ openIndex === entry.index ? '&minus;' : '+' }}</span>
          </button>

          <div v-if="openIndex === entry.index" class="mobile-action-body" data-test="action-body">
            <PlayerInputFactory
              ref="openInput"
              :playerView="playerView"
              :playerinput="entry.input"
              :onsave="saved(entry.index)"
              :showsave="showsave && childSaves(entry.input)"
              :showtitle="false"/>
            <div v-if="showsave && !childSaves(entry.input)" class="wf-action">
              <AppButton :title="$t(entry.input.buttonLabel)" type="submit" size="normal" @click="save()"/>
            </div>
          </div>
        </template>
      </template>
    </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import AppButton from '@/client/components/common/AppButton.vue';
import Award from '@/client/components/Award.vue';
import Milestone from '@/client/components/Milestone.vue';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {FundedAwardModel} from '@/common/models/FundedAwardModel';
import {ActionGroup, groupActions} from '@/client/components/mobile/MobileActionMenu';
import {InputResponse, OrOptionsResponse} from '@/common/inputs/InputResponse';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {MobileTab} from '@/client/components/mobile/MobileTab';
import {requestTab} from '@/client/utils/mobileNavigation';
import {CardName} from '@/common/cards/CardName';
import {offerFor, pickedCard} from '@/client/utils/cardSelection';
import {BoardPick, boardOfferFor, pickedBoardThing} from '@/client/utils/boardSelection';
import {ActionEntry} from '@/client/components/mobile/MobileActionMenu';
import {pickFocused, tabRouting} from '@/client/utils/mobileFocus';

/*
 * A turn's action menu, as a phone can read it.
 *
 * The desktop shows every entry as a radio button with the chosen one's whole input
 * unfolded beneath it, which on a phone is a screen of scrolling before the player
 * can see what the second entry even was. Here each entry is a row; one opens at a
 * time; and the entries whose subject lives on another tab are links to that tab
 * rather than a second copy of it.
 */

type DataModel = {
  /** The entry currently unfolded, by its index in the server's options. */
  openIndex: number | undefined;
};

export default defineComponent({
  name: 'MobileActionList',
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    playerinput: {
      type: Object as PropType<OrOptionsModel>,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: OrOptionsResponse) => void,
      required: true,
    },
    showsave: {
      type: Boolean,
      default: true,
    },
  },
  components: {
    AppButton,
    Award,
    Milestone,
  },
  data(): DataModel {
    return {
      openIndex: undefined,
    };
  },
  computed: {
    pickedCard(): CardName | undefined {
      return pickedCard.value;
    },
    pickedBoardThing(): BoardPick | undefined {
      return pickedBoardThing.value;
    },
    groups(): ReadonlyArray<ActionGroup> {
      return groupActions(this.playerinput, {
        card: this.pickedCard,
        board: this.pickedBoardThing,
        routes: tabRouting.value,
      });
    },
    /**
     * The one entry to show, when the shell raised this over the tab a choice was
     * made on. Undefined means show the whole menu, which is the Act tab's job.
     */
    focused(): ActionEntry | undefined {
      return pickFocused.value ? this.pickedEntry() : undefined;
    },
    focusedMilestone(): ClaimedMilestoneModel | undefined {
      const pick = this.focused === undefined ? undefined : this.pickedBoardThing;
      return pick?.kind === 'milestone' ?
        this.playerView.game.milestones.find((milestone) => milestone.name === pick.name) :
        undefined;
    },
    focusedAward(): FundedAwardModel | undefined {
      const pick = this.focused === undefined ? undefined : this.pickedBoardThing;
      return pick?.kind === 'award' ?
        this.playerView.game.awards.find((award) => award.name === pick.name) :
        undefined;
    },
  },
  watch: {
    // A new menu is a new turn, so nothing should still be unfolded from the last one.
    playerinput() {
      this.openIndex = undefined;
    },
    /* A card picked on the Cards tab, or a tile picked under the board, is a choice
       already made, so the entry it belongs to is unfolded and waiting. */
    pickedCard: {
      handler() {
        this.openPickedEntry();
      },
      immediate: true,
    },
    pickedBoardThing: {
      handler() {
        this.openPickedEntry();
      },
      immediate: true,
    },
  },
  methods: {
    /** The entry that answers what the player picked, if the menu holds one. */
    pickedEntry(): ActionEntry | undefined {
      const card = this.pickedCard;
      const board = this.pickedBoardThing;
      if (card === undefined && board === undefined) {
        return undefined;
      }
      for (const group of this.groups) {
        for (const entry of group.entries) {
          if (entry.elsewhere !== undefined) {
            continue;
          }
          const claims = (card !== undefined && offerFor(entry.input, card) !== undefined) ||
            (board !== undefined && boardOfferFor(entry.input, board));
          if (claims) {
            return entry;
          }
        }
      }
      return undefined;
    },
    openPickedEntry(): void {
      const entry = this.pickedEntry();
      if (entry !== undefined) {
        this.openIndex = entry.index;
      }
    },
    goto(tab: MobileTab): void {
      requestTab(tab);
    },
    toggle(index: number): void {
      this.openIndex = this.openIndex === index ? undefined : index;
    },
    /**
     * Whether the entry draws its own confirm button.
     *
     * A multi-select card list labels its button with how many are selected, so it
     * has to own it. A list of choices -- the milestones, the awards -- owns it too,
     * because it puts the button beside the one that is chosen rather than below all
     * six; confirming an award should not mean scrolling past five others first.
     * Everything else is confirmed by the button this draws.
     */
    childSaves(input: PlayerInputModel): boolean {
      if (input.type === 'or') {
        return true;
      }
      return input.type === 'card' && !(input.max === 1 && input.min === 1);
    },
    saved(index: number) {
      return (out: InputResponse) => this.onsave({type: 'or', index, response: out});
    },
    save(): void {
      const open = this.$refs.openInput as Array<{saveData: () => void}> | {saveData: () => void} | undefined;
      if (open === undefined) {
        return;
      }
      (Array.isArray(open) ? open[0] : open).saveData();
    },
  },
});
</script>
