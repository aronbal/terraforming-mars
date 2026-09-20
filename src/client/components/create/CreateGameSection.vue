<template>
  <div class="create-game-page-column" :class="{'create-game-page-column--collapsed': !open}">
    <h4 class="create-game-section-head">
      <button
        v-if="collapsible"
        type="button"
        class="create-game-section-toggle"
        :aria-expanded="open"
        :data-test="'section-' + title"
        @click="expanded = !expanded">
        <span>{{ $t(title) }}</span>
        <span class="create-game-section-mark" aria-hidden="true">{{ open ? '−' : '+' }}</span>
      </button>
      <template v-else>{{ $t(title) }}</template>
    </h4>
    <div v-show="open" class="create-game-section-body">
      <slot></slot>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {mobileLayout} from '@/client/utils/useMobileLayout';

type DataModel = {
  expanded: boolean;
};

/**
 * One headed section of the create-game form.
 *
 * The form is five columns of settings, and the grid stacks them at phone width into
 * a scroll several screens long -- twenty expansion switches and thirty options
 * between the player count at the top and the button at the bottom. On a phone the
 * heading becomes the control that opens its own section, so the five headings are
 * one screen and a player opens the one they came for.
 *
 * On a desktop there is room for the columns side by side, so the heading stays a
 * heading and every section is open.
 */
export default defineComponent({
  name: 'CreateGameSection',
  props: {
    title: {
      type: String,
      required: true,
    },
    /** Open on arrival, where there is a choice. The player count always is. */
    initiallyOpen: {
      type: Boolean,
      default: false,
    },
  },
  data(): DataModel {
    return {
      expanded: this.initiallyOpen,
    };
  },
  computed: {
    collapsible(): boolean {
      return mobileLayout.value;
    },
    open(): boolean {
      return !this.collapsible || this.expanded;
    },
  },
});
</script>
