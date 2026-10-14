<template>
  <div class="mobile-overlay" data-test="overlay">
    <div class="mobile-overlay-scrim" data-test="overlay-scrim" @click="$emit('close')"></div>
    <section class="mobile-overlay-sheet" role="dialog" :aria-label="title">
      <div class="mobile-overlay-head">
        <h2 class="mobile-overlay-title">{{ title }}</h2>
        <button class="mobile-plain-button" data-test="overlay-close" @click="$emit('close')" v-i18n>Done</button>
      </div>
      <div class="mobile-overlay-body">
        <slot></slot>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

/*
 * A sheet over the whole shell for the things a player reaches for between decisions:
 * the other players, the settings, the way to another game. It is not the action
 * sheet, which belongs to the turn, so it never covers or replaces that one.
 */
export default defineComponent({
  name: 'MobileOverlay',
  props: {
    title: {
      type: String,
      required: true,
    },
  },
  emits: ['close'],
});
</script>
