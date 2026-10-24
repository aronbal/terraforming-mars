<template>
  <div class="mobile-log mobile-gutter" data-test="log-pane">
    <section v-for="group in generations" :key="group.generation" class="mobile-section" data-test="log-generation">
      <h2 class="mobile-eyebrow">{{ $t('Generation') }} {{ group.generation }}</h2>
      <div class="mobile-list">
        <MobileLogRow
          v-for="event in group.events"
          :key="event.key"
          :event="event"
          :players="players"
          :now="now"
          @inspect="$emit('inspect', $event)"/>
        <div v-if="group.events.length === 0" class="mobile-row mobile-row--empty" v-i18n>Nothing has happened yet</div>
      </div>
    </section>
    <div v-if="loading" class="mobile-section-note" v-i18n>Loading the log…</div>
    <button
      v-else-if="earliest > 1"
      class="mobile-block-button"
      data-test="log-earlier"
      @click="$emit('loadEarlier')">{{ say('Show generation ${0}', earliest - 1) }}</button>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import MobileLogRow from '@/client/components/mobile/MobileLogRow.vue';
import {LogEvent, LogPlayer} from '@/client/components/mobile/MobileLog';
import {translateTextWithParams} from '@/client/directives/i18n';

export type LogGeneration = {
  generation: number;
  /** Newest first. */
  events: ReadonlyArray<LogEvent>;
};

/*
 * The whole game log, a group per generation, newest first.
 *
 * The same rows as "Since your last turn", so a line reads the same in both places.
 * Earlier generations are fetched one at a time, when asked for: most of the time the
 * player wants to know what just happened, not what happened in generation two.
 */
export default defineComponent({
  name: 'MobileLogPane',
  props: {
    /** Newest generation first. */
    generations: {
      type: Array as PropType<ReadonlyArray<LogGeneration>>,
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
    loading: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['loadEarlier', 'inspect'],
  components: {
    MobileLogRow,
  },
  computed: {
    earliest(): number {
      const last = this.generations[this.generations.length - 1];
      return last?.generation ?? 1;
    },
  },
  methods: {
    say(text: string, value: number): string {
      return translateTextWithParams(text, [String(value)]);
    },
  },
});
</script>
