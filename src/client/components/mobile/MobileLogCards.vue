<template>
  <div class="mobile-magnify" role="dialog" :aria-label="event.title" data-test="log-cards" @click="$emit('close')">
    <!-- Tapping anywhere puts it back down, as with a card opened from the bottom bar. -->
    <div class="mobile-log-cards-caption">
      <span class="mobile-glyph" :class="glyphClass" data-test="log-cards-glyph">
        <MobileIcon :name="event.icon" :size="16"/>
      </span>
      <span class="mobile-row-text">
        <span class="mobile-row-title">{{ event.title }}</span>
        <span class="mobile-row-subtitle">{{ subtitle }}</span>
      </span>
    </div>
    <div class="mobile-log-cards-row">
      <div v-for="name in event.cards" :key="name" class="mobile-log-cards-card" data-test="log-cards-card">
        <Card class="cardbox" :card="{name}"/>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import Card from '@/client/components/card/Card.vue';
import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import {LogEvent, LogPlayer, glyphClassOf, subtitleOf} from '@/client/components/mobile/MobileLog';

/*
 * The cards a log line names, opened large over everything.
 *
 * The line itself sits above them, so a card is read with what was done with it and
 * by whom. Several cards sit side by side and scroll sideways.
 */
export default defineComponent({
  name: 'MobileLogCards',
  props: {
    event: {
      type: Object as PropType<LogEvent>,
      required: true,
    },
    players: {
      type: Array as PropType<ReadonlyArray<LogPlayer>>,
      required: true,
    },
    now: {
      type: Number,
      required: true,
    },
  },
  emits: ['close'],
  components: {
    Card,
    MobileIcon,
  },
  computed: {
    glyphClass(): string {
      return glyphClassOf(this.event.color);
    },
    subtitle(): string {
      return subtitleOf(this.event, this.players, this.now);
    },
  },
});
</script>
