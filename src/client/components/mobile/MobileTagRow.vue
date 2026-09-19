<template>
  <div class="mobile-tagbar">
    <button
      class="mobile-tagbar-toggle"
      :aria-expanded="open"
      data-test="tag-row-toggle"
      @click="$emit('toggle')">
      <span v-i18n>Tags</span>
      <span class="mobile-num">{{ ownedTags.length }}</span>
    </button>
    <div v-show="open" class="mobile-tag-list" data-test="tag-row-list">
      <div v-for="tag in ownedTags" :key="tag.name" class="mobile-tag">
        <TagCount :tag="tag.name" :count="tag.count" size="big" type="secondary"/>
      </div>
      <div v-if="ownedTags.length === 0" class="mobile-tag" v-i18n>No tags yet</div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import TagCount from '@/client/components/TagCount.vue';
import {ALL_TAGS, Tag} from '@/common/cards/Tag';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

type TagReadout = {
  name: Tag;
  count: number;
};

export default defineComponent({
  name: 'MobileTagRow',
  props: {
    player: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
    open: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['toggle'],
  components: {
    TagCount,
  },
  computed: {
    /** The player's tag counts, as the server already totalled them from the tableau. */
    ownedTags(): Array<TagReadout> {
      const tags = this.player.tags;
      return ALL_TAGS
        .map((name) => ({name, count: tags[name] ?? 0}))
        .filter((tag) => tag.count > 0);
    },
  },
});
</script>
