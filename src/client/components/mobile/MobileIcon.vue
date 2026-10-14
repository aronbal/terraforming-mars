<template>
  <svg
    class="mobile-icon"
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true">
    <component :is="shape.tag" v-for="(shape, index) in shapes" :key="index" v-bind="shape.attrs"/>
  </svg>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import {IconShape, MOBILE_ICONS, MobileIconName} from '@/client/components/mobile/MobileIcons';

/** One of the shell's Lucide icons, drawn at the stroke width the design system uses. */
export default defineComponent({
  name: 'MobileIcon',
  props: {
    name: {
      type: String as PropType<MobileIconName>,
      required: true,
    },
    size: {
      type: Number,
      default: 18,
    },
    strokeWidth: {
      type: Number,
      default: 2,
    },
  },
  computed: {
    shapes(): ReadonlyArray<IconShape> {
      return MOBILE_ICONS[this.name] ?? [];
    },
  },
});
</script>
