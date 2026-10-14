<template>
  <div class="mobile-actions" data-test="action-list">
    <!-- The player has already said what they are doing, so this is only the price
         and the confirmation for it. -->
    <template v-if="focused !== undefined">
      <!-- One line, because the thing it names is already on the stage above or on
           the tile that opened it. It stays for the price, which nothing else says. -->
      <p class="mobile-focus-caption">{{ $t(focused.input.title) }}</p>
      <div
        class="mobile-action-body mobile-action-body--focused"
        :class="{'mobile-action-body--staged': staged}"
        data-test="focused-body">
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
    </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import AppButton from '@/client/components/common/AppButton.vue';
import {ActionEntry, ActionGroup, MenuContext, groupActions, pickedEntryIn} from '@/client/components/mobile/MobileActionMenu';
import {InputResponse, OrOptionsResponse} from '@/common/inputs/InputResponse';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {pickedCard} from '@/client/utils/cardSelection';
import {pickedBoardThing} from '@/client/utils/boardSelection';
import {pickFocus, pickFocused, pickedEntry} from '@/client/utils/mobileFocus';

/*
 * A turn's action menu, inside the shell's sheet.
 *
 * The turn page is where a player chooses what to do, so the sheet nearly always
 * shows one entry: the one the card, the tile or the button they tapped belongs to,
 * with its price and its confirmation. The grouped list is the fallback for a sheet
 * raised over the menu without a pick, where each entry is a row and one opens at a
 * time.
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
    context(): MenuContext {
      return {card: pickedCard.value, board: pickedBoardThing.value, entry: pickedEntry.value};
    },
    /* The thing itself is held up above the panel, so the panel leaves out what would
       repeat it. A tile on the turn page holds nothing up: its list is the choice. */
    staged(): boolean {
      return pickFocus.value === 'staged';
    },
    groups(): ReadonlyArray<ActionGroup> {
      return groupActions(this.playerinput);
    },
    /**
     * The one entry to show, when the shell raised this for something the player
     * picked. Undefined means show the whole menu.
     */
    focused(): ActionEntry | undefined {
      return pickFocused.value ? pickedEntryIn(this.playerinput, this.context) : undefined;
    },
  },
  watch: {
    // A new menu is a new turn, so nothing should still be unfolded from the last one.
    playerinput() {
      this.openIndex = undefined;
    },
    /* A card, a tile under the board or a tile on the turn page is a choice already
       made, so the entry it belongs to is unfolded and waiting. */
    context: {
      handler() {
        const entry = pickedEntryIn(this.playerinput, this.context);
        if (entry !== undefined) {
          this.openIndex = entry.index;
        }
      },
      immediate: true,
    },
  },
  methods: {
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
