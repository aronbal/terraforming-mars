<template>
  <div class="mobile-play-sheet" data-test="track-sheet">
    <div class="mobile-play-sheet-scrim" data-test="track-sheet-scrim" @click="$emit('close')"></div>
    <section
      ref="panel"
      class="mobile-play-sheet-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('Terraform rating')"
      tabindex="-1"
      @keydown.esc="$emit('close')">
      <span class="mobile-play-sheet-grabber" aria-hidden="true"></span>
      <div class="mobile-play-sheet-body">
        <h2 class="mobile-play-sheet-title" v-i18n>Terraform rating</h2>
        <div class="mobile-play-sheet-rows">
          <div
            v-for="player in standings"
            :key="player.color"
            class="mobile-play-sheet-row"
            :class="{'mobile-track-sheet-row--you': player.color === you}"
            data-test="track-sheet-row">
            <span class="mobile-track-sheet-place">{{ player.place }}</span>
            <span class="mobile-track-marker" :class="['player_bg_color_' + player.color, 'mobile-track-marker--' + player.color]" aria-hidden="true">{{ symbol(player.color) }}</span>
            <span class="mobile-play-sheet-row-text">
              <span class="mobile-play-sheet-row-title">{{ player.name }}</span>
            </span>
            <span class="mobile-play-sheet-row-value mobile-track-sheet-rating" data-test="track-sheet-rating">{{ player.terraformRating }}</span>
          </div>
        </div>
      </div>
      <div class="mobile-play-sheet-actions">
        <button
          type="button"
          class="mobile-play-sheet-button"
          data-test="track-sheet-close"
          @click="$emit('close')">{{ $t('Close') }}</button>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import {TrackPlayer, trackStandings} from '@/client/components/mobile/BoardGame';
import {playerSymbol} from '@/client/utils/playerSymbol';
import {Color} from '@/common/Color';

/*
 * Who is where on the terraform rating track, best first: what a tap on the track
 * round the board-game board, or on one of its markers, opens.
 *
 * The markers are read at a glance; this is for the close race, where two of them
 * stand a step apart and the exact numbers matter.
 */
export default defineComponent({
  name: 'MobileTrackSheet',
  props: {
    players: {
      type: Array as PropType<ReadonlyArray<TrackPlayer>>,
      required: true,
    },
    /** The player looking, whose row is picked out. */
    you: {
      type: String as PropType<Color>,
      default: undefined,
    },
  },
  emits: ['close'],
  computed: {
    standings(): ReturnType<typeof trackStandings> {
      return trackStandings(this.players);
    },
  },
  methods: {
    symbol(color: Color): string {
      return playerSymbol(color);
    },
  },
  mounted() {
    const panel = this.$refs.panel as HTMLElement | undefined;
    panel?.focus({preventScroll: true});
  },
});
</script>
