<template>
  <div class="mobile-row" data-test="log-row">
    <span class="mobile-glyph" :class="glyphClass" data-test="log-glyph">
      <MobileIcon :name="event.icon" :size="16"/>
    </span>
    <span class="mobile-row-body">
      <span class="mobile-row-text">
        <span class="mobile-row-title">{{ event.title }}</span>
        <span class="mobile-row-subtitle">{{ subtitle }}</span>
      </span>
      <span v-if="trailing !== undefined" class="mobile-row-trailing" data-test="log-trailing">{{ trailing }}</span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import {LogEvent, LogPlayer, formatAgo} from '@/client/components/mobile/MobileLog';

/*
 * One line of the game log as a row: a glyph in the colour of the player who acted,
 * what they did, and who and when underneath.
 */
export default defineComponent({
  name: 'MobileLogRow',
  props: {
    event: {
      type: Object as PropType<LogEvent>,
      required: true,
    },
    players: {
      type: Array as PropType<ReadonlyArray<LogPlayer>>,
      required: true,
    },
    /** The time the row is measured against, so every row in a list agrees. */
    now: {
      type: Number,
      required: true,
    },
    /** What the line changed, when the log says. */
    trailing: {
      type: String,
      required: false,
      default: undefined,
    },
  },
  components: {
    MobileIcon,
  },
  computed: {
    glyphClass(): string {
      // The desktop's own player colours, so a player is the same colour everywhere.
      const color = this.event.color;
      return color === undefined ? 'mobile-glyph--neutral' : 'player_bg_color_' + color;
    },
    subtitle(): string {
      const color = this.event.color;
      const ago = formatAgo(this.event.timestamp, this.now);
      if (color === undefined) {
        return ago;
      }
      const name = this.players.find((player) => player.color === color)?.name ?? color;
      return name + ' · ' + ago;
    },
  },
});
</script>
