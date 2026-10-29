<template>
  <button
    type="button"
    class="mobile-play-sheet-button"
    :disabled="cancelling"
    @click="dismiss">{{ $t(cancels ? 'Cancel' : label) }}</button>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import {cancelAction} from '@/client/utils/playerInputRequest';
import {PlayerViewModel} from '@/common/models/PlayerModel';

type DataModel = {
  cancelling: boolean;
};

/*
 * A sheet's way out, under its button.
 *
 * Most of the time it only puts the sheet down: `Cancel` for a question that can be
 * given up, `Close` for one that will be asked again. But a question the server asks
 * part way through an action chosen from the turn's menu -- an award for Vitor to
 * fund, a space for a tile, a card for a project -- has nothing on the phone to go
 * back to. Where Undo is allowed the server can take that action back, and then this
 * button is `Cancel` and does that, so the player has the menu again and can choose
 * something else: pass, say.
 */
export default defineComponent({
  name: 'MobileSheetDismiss',
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    /** What the button says when it only puts the sheet down. */
    label: {
      type: String as PropType<'Cancel' | 'Close'>,
      required: true,
    },
    /*
     * Whether the sheet answers the server's own question. One answering a menu entry
     * the player opened, or an option of a choice, steps back to that instead.
     */
    asked: {
      type: Boolean,
      required: true,
    },
  },
  emits: {
    close: () => true,
  },
  data(): DataModel {
    return {
      cancelling: false,
    };
  },
  computed: {
    cancels(): boolean {
      return this.asked && this.playerView.canCancelAction;
    },
  },
  methods: {
    async dismiss(): Promise<void> {
      if (!this.cancels) {
        this.$emit('close');
        return;
      }
      this.cancelling = true;
      try {
        // Accepted, the shell is drawn afresh from the menu, and this sheet with it.
        await cancelAction(this, this.playerView);
      } finally {
        this.cancelling = false;
      }
    },
  },
});
</script>
