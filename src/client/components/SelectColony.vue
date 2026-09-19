<template>
  <div class="wf-component wf-component--select-card">
    <div v-if="showtitle === true" class="nofloat wf-component-title">{{ $t(playerinput.title) }}</div>
    <label v-for="colony in (playerinput.coloniesModel || [])" class="cardbox" :key="colony.name">
      <input type="radio" v-model="selectedColony" :value="colony.name" >
      <Colony :colony="colony"/>
    </label>
    <div v-if="showsave === true" class="nofloat">
      <AppButton @click="saveData" :title="playerinput.buttonLabel" :disabled="!canSave()"/>
    </div>
  </div>
</template>
<script lang="ts">
import {defineComponent} from 'vue';
import Colony from '@/client/components/colonies/Colony.vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {SelectColonyModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectColonyResponse} from '@/common/inputs/InputResponse';
import {ColonyName} from '@/common/colonies/ColonyName';
import {BoardPick, pickedBoardThing} from '@/client/utils/boardSelection';

type DataModel = {
  selectedColony: ColonyName | undefined,
};

export default defineComponent({
  name: 'SelectColony',
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectColonyModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectColonyResponse) => void,
      required: true,
    },
    showsave: {
      type: Boolean,
    },
    showtitle: {
      type: Boolean,
    },
  },
  data(): DataModel {
    return {
      selectedColony: undefined,
    };
  },
  components: {
    Colony,
    AppButton,
  },
  computed: {
    pickedBoardThing(): BoardPick | undefined {
      return pickedBoardThing.value;
    },
  },
  watch: {
    // A colony tapped under the board on the mobile shell is this same choice, made
    // one screen earlier, so it arrives here already answered.
    pickedBoardThing: {
      handler(pick: BoardPick | undefined) {
        if (pick?.kind !== 'colony') {
          return;
        }
        if (this.playerinput.coloniesModel.some((colony) => colony.name === pick.name)) {
          this.selectedColony = pick.name as ColonyName;
        }
      },
      immediate: true,
    },
  },
  methods: {
    canSave() {
      return this.selectedColony !== undefined;
    },
    saveData() {
      if (this.selectedColony !== undefined) {
        this.onsave({type: 'colony', colonyName: this.selectedColony});
      }
    },
  },
});
</script>
