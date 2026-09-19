<template>
  <div class="mobile-actions" data-test="action-list">
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
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import AppButton from '@/client/components/common/AppButton.vue';
import {ActionGroup, groupActions} from '@/client/components/mobile/MobileActionMenu';
import {InputResponse, OrOptionsResponse} from '@/common/inputs/InputResponse';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {MobileTab} from '@/client/components/mobile/MobileTab';
import {requestTab} from '@/client/utils/mobileNavigation';
import {CardName} from '@/common/cards/CardName';
import {offerFor, pickedCard} from '@/client/utils/cardSelection';

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
    groups(): ReadonlyArray<ActionGroup> {
      return groupActions(this.playerinput, this.pickedCard);
    },
  },
  watch: {
    // A new menu is a new turn, so nothing should still be unfolded from the last one.
    playerinput() {
      this.openIndex = undefined;
    },
    /* A card picked on the Cards tab is a choice already made, so the entry it
       belongs to is unfolded and waiting when the player lands here. */
    pickedCard: {
      handler() {
        this.openPickedEntry();
      },
      immediate: true,
    },
  },
  methods: {
    openPickedEntry(): void {
      if (this.pickedCard === undefined) {
        return;
      }
      for (const group of this.groups) {
        for (const entry of group.entries) {
          if (entry.elsewhere === undefined && offerFor(entry.input, this.pickedCard) !== undefined) {
            this.openIndex = entry.index;
            return;
          }
        }
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
     * has to own it; everything else is confirmed by the button this draws.
     */
    childSaves(input: PlayerInputModel): boolean {
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
