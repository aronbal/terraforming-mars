<template>
  <nav class="mobile-tabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.name"
      class="mobile-tab"
      role="tab"
      :aria-selected="isSelected(tab.name)"
      :data-test="'tab-' + tab.name"
      @click="$emit('select', tab.name)">
      <svg class="mobile-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path v-for="(d, idx) in tab.paths" :key="idx" :d="d"/>
      </svg>
      <span class="mobile-tab-label">{{ $t(tab.label) }}</span>
      <span v-if="badge(tab.name) !== ''" class="mobile-tab-badge">{{ badge(tab.name) }}</span>
    </button>
  </nav>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import {MobileTab} from '@/client/components/mobile/MobileTab';

type TabSpec = {
  name: MobileTab;
  label: string;
  paths: ReadonlyArray<string>;
};

const TABS: ReadonlyArray<TabSpec> = [
  {
    name: 'board',
    label: 'Board',
    paths: ['M12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5Z', 'M12 8 15.5 10 15.5 14 12 16 8.5 14 8.5 10Z'],
  },
  {
    name: 'cards',
    label: 'Cards',
    paths: ['M3 8a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z', 'M8 4h9a2 2 0 0 1 2 2v12'],
  },
  {
    name: 'actions',
    label: 'Act',
    paths: ['M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Z', 'M12 7.5v9M7.5 12h9'],
  },
  {
    name: 'players',
    label: 'Players',
    paths: ['M9 5.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z', 'M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5', 'M17 5.1a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z', 'M15 13.6c2.6-.6 5.5 1 5.5 4.4'],
  },
  {
    name: 'more',
    label: 'More',
    paths: ['M4 7h16M4 12h16M4 17h16'],
  },
] as const;

export default defineComponent({
  name: 'MobileTabBar',
  props: {
    tab: {
      type: String as PropType<MobileTab>,
      required: true,
    },
    /*
     * Whether the action panel is a sheet raised over another pane rather than the
     * tab the player is on. Act lights up either way, but only one of the two is a
     * place they navigated to.
     */
    sheetOpen: {
      type: Boolean,
      required: true,
    },
    cardsInHandCount: {
      type: Number,
      required: true,
    },
    actionWaiting: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['select'],
  computed: {
    tabs(): ReadonlyArray<TabSpec> {
      return TABS;
    },
  },
  methods: {
    isSelected(name: MobileTab): boolean {
      /* Act lights up as the tab the player is on, and also when the panel is a sheet
         raised over another pane -- which leaves both lit, because the pane behind a
         half-open sheet is still where they are. */
      return name === 'actions' ? this.tab === 'actions' || this.sheetOpen : this.tab === name;
    },
    badge(name: MobileTab): string {
      if (name === 'cards' && this.cardsInHandCount > 0) {
        return String(this.cardsInHandCount);
      }
      if (name === 'actions' && this.actionWaiting) {
        return '!';
      }
      return '';
    },
  },
});
</script>
