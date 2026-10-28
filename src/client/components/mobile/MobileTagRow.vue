<template>
  <!-- Nothing at all until there is a tag to count. -->
  <div v-if="ownedTags.length > 0" class="mobile-tagbar">
    <div class="mobile-tag-list" data-test="tag-row-list">
      <div v-for="tag in ownedTags" :key="tag.name" class="mobile-tag">
        <TagCount :tag="tag.name" :count="tag.count" size="big" type="secondary"/>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

import TagCount from '@/client/components/TagCount.vue';
import {SpecialTags} from '@/client/cards/SpecialTags';
import {ALL_TAGS, Tag} from '@/common/cards/Tag';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

type TagReadout = {
  name: Tag | SpecialTags;
  count: number;
};

export default defineComponent({
  name: 'MobileTagRow',
  props: {
    player: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
  },
  components: {
    TagCount,
  },
  computed: {
    /*
     * The player's tag counts, as the server already totalled them from the tableau,
     * and then their corruption, which Underworld's cards ask for as they ask for tags.
     */
    ownedTags(): Array<TagReadout> {
      const tags = this.player.tags;
      const readouts: Array<TagReadout> = ALL_TAGS.map((name) => ({name, count: tags[name] ?? 0}));
      readouts.push({name: SpecialTags.CORRUPTION, count: this.player.underworldData.corruption});
      return readouts.filter((tag) => tag.count > 0);
    },
  },
});
</script>
