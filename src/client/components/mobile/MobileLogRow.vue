<template>
  <component
    :is="opensCards ? 'button' : 'div'"
    class="mobile-row"
    :class="{'mobile-row--button': opensCards}"
    data-test="log-row"
    @click="maybeInspect()">
    <span class="mobile-glyph" :class="glyphClass" data-test="log-glyph">
      <MobileIcon :name="event.icon" :size="16"/>
    </span>
    <span class="mobile-row-body">
      <span class="mobile-row-text">
        <span class="mobile-row-title">{{ event.title }}</span>
        <span class="mobile-row-subtitle">{{ subtitle }}</span>
      </span>
      <span v-if="event.effects !== undefined" class="mobile-row-trailing" data-test="log-trailing">{{ event.effects }}</span>
      <span v-if="opensCards" class="mobile-row-chevron" aria-hidden="true">&rsaquo;</span>
    </span>
  </component>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import {LogEvent, LogPlayer, glyphClassOf, subtitleOf} from '@/client/components/mobile/MobileLog';

/*
 * One line of the game log as a row: a glyph in the colour of the player who acted,
 * what they did, and who and when underneath. On the right, what it changed on Mars.
 *
 * A line that names cards is a button that opens them large enough to read. The rest
 * have nothing more to show, so they stay plain rows.
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
  },
  emits: ['inspect'],
  components: {
    MobileIcon,
  },
  computed: {
    opensCards(): boolean {
      return this.event.cards.length > 0;
    },
    glyphClass(): string {
      return glyphClassOf(this.event.color);
    },
    subtitle(): string {
      return subtitleOf(this.event, this.players, this.now);
    },
  },
  methods: {
    maybeInspect(): void {
      if (this.opensCards) {
        this.$emit('inspect', this.event);
      }
    },
  },
});
</script>
