<template>
  <nav class="mobile-tabbar" role="tablist" :aria-label="$t('View')" data-test="tab-bar">
    <button
      v-for="tab in tabs"
      :key="tab.view"
      class="mobile-tab"
      :class="{'mobile-tab--on': view === tab.view}"
      role="tab"
      :aria-selected="view === tab.view"
      :data-test="'view-' + tab.view"
      @click="$emit('update:view', tab.view)">
      <MobileIcon :name="tab.icon" :size="22"/>
      <span class="mobile-tab-label">{{ $t(tab.label) }}</span>
    </button>
  </nav>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import {MobileIconName} from '@/client/components/mobile/MobileIcons';
import {MobileView} from '@/client/components/mobile/MobileView';

/*
 * The views, along the bottom edge where the thumb already is.
 *
 * At the top of the header they were the furthest thing from a hand holding the
 * phone, for the control used most often.
 */

type Tab = {
  view: MobileView;
  label: string;
  icon: MobileIconName;
};

const TABS: ReadonlyArray<Tab> = [
  {view: 'turn', label: 'Turn', icon: 'play'},
  {view: 'board', label: 'Board', icon: 'globe'},
  {view: 'cards', label: 'Cards', icon: 'layers'},
  {view: 'log', label: 'Log', icon: 'list'},
];

export default defineComponent({
  name: 'MobileTabBar',
  props: {
    view: {
      type: String as PropType<MobileView>,
      required: true,
    },
  },
  emits: ['update:view'],
  components: {
    MobileIcon,
  },
  computed: {
    tabs(): ReadonlyArray<Tab> {
      return TABS;
    },
  },
});
</script>
