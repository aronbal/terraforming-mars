<template>
  <div v-if="input !== undefined && turmoil !== undefined" class="mobile-play-sheet" data-test="party-sheet">
    <div class="mobile-play-sheet-scrim" data-test="party-sheet-scrim" @click="close"></div>
    <section
      ref="panel"
      class="mobile-play-sheet-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="$t(input.title)"
      tabindex="-1"
      @keydown.esc="close">
      <span class="mobile-play-sheet-grabber" aria-hidden="true"></span>
      <div class="mobile-play-sheet-body">
        <h2 class="mobile-confirm-sheet-title" data-test="party-sheet-title">{{ $t(input.title) }}</h2>
        <!-- One row per party the delegate may go to; a tap only chooses it. -->
        <div class="mobile-choice-list" role="radiogroup">
          <button
            v-for="party in parties"
            :key="party.name"
            type="button"
            role="radio"
            class="mobile-choice-row"
            :class="{'mobile-choice-row--on': party.name === chosen}"
            :aria-checked="party.name === chosen"
            data-test="party-sheet-option"
            @click="chosen = party.name">
            <span class="mobile-choice-mark" aria-hidden="true">
              <MobileIcon v-if="party.name === chosen" name="check" :size="14" :strokeWidth="3"/>
            </span>
            <span class="mobile-choice-text">
              <MobilePartyRow :party="party" :turmoil="turmoil"/>
            </span>
          </button>
        </div>
      </div>
      <div class="mobile-play-sheet-actions">
        <button
          type="button"
          class="mobile-play-sheet-button mobile-play-sheet-button--primary"
          :disabled="submitting || chosen === undefined"
          data-test="party-sheet-submit"
          @click="submit">{{ $t(input.buttonLabel) }}</button>
        <MobileSheetDismiss
          :playerView="playerView"
          :label="(input.optional || entry !== undefined) ? 'Cancel' : 'Close'"
          :asked="entry === undefined"
          data-test="party-sheet-cancel"
          @close="close"/>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import MobilePartyRow from '@/client/components/mobile/MobilePartyRow.vue';
import MobileSheetDismiss from '@/client/components/mobile/MobileSheetDismiss.vue';
import {entryResponse, partyInput} from '@/client/components/mobile/PickSheet';
import {postPlayerInput} from '@/client/utils/playerInputRequest';
import {SelectPartyModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PartyModel, TurmoilModel} from '@/common/models/TurmoilModel';
import {PartyName} from '@/common/turmoil/PartyName';

type DataModel = {
  /** The party the button will send the delegate to. */
  chosen: PartyName | undefined;
  submitting: boolean;
};

/*
 * The sheet a delegate is sent from: the parties it may go to, each with its
 * delegates, its leader, and what it pays and rules by, so the choice is made on the
 * board's state rather than on a remembered name.
 *
 * As in the choice sheet, a tap on a row only chooses it, and the one blue button
 * sends it. A price, where sending one costs, is asked next in the payment sheet.
 */
export default defineComponent({
  name: 'MobilePartySheet',
  components: {
    MobileIcon,
    MobilePartyRow,
    MobileSheetDismiss,
  },
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    /** The option of the choice this answers, or undefined for the question itself. */
    entry: {
      type: Number,
      default: undefined,
    },
  },
  emits: ['close'],
  data(): DataModel {
    const parties = partyInput(this.playerView.waitingFor, this.entry)?.parties ?? [];
    return {
      // One party to choose from is no choice at all.
      chosen: parties.length === 1 ? parties[0] : undefined,
      submitting: false,
    };
  },
  computed: {
    input(): SelectPartyModel | undefined {
      return partyInput(this.playerView.waitingFor, this.entry);
    },
    turmoil(): TurmoilModel | undefined {
      return this.playerView.game.turmoil;
    },
    parties(): ReadonlyArray<PartyModel> {
      const available = this.input?.parties ?? [];
      return (this.turmoil?.parties ?? []).filter((party) => available.includes(party.name));
    },
  },
  watch: {
    // The question moved on under the sheet: there is nothing left to answer here.
    input: {
      handler(input: SelectPartyModel | undefined) {
        if (input === undefined) {
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
    async submit(): Promise<void> {
      if (this.submitting || this.input === undefined || this.chosen === undefined) {
        return;
      }
      this.submitting = true;
      try {
        const response = entryResponse(this.entry, {type: 'party', partyName: this.chosen});
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
