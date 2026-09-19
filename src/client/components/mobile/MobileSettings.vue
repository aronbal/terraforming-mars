<template>
  <section class="mobile-settings" :aria-label="$t('Settings')" data-test="mobile-settings">
    <div class="mobile-settings-head">
      <span class="mobile-settings-title" v-i18n>Settings</span>
      <button class="mobile-button" data-test="close-settings" @click="$emit('close')" v-i18n>Done</button>
    </div>

    <div class="mobile-setting">
      <label class="mobile-setting-label" v-i18n>Mobile layout</label>
      <div class="mobile-setting-row">
        <button
          v-for="mode in mobileLayoutModes"
          :key="mode"
          class="mobile-segment-button"
          :aria-selected="prefs.mobile_layout === mode"
          :data-test="'mobile-layout-' + mode"
          @click="setMobileLayout(mode)">{{ $t(modeLabel(mode)) }}</button>
      </div>
      <span class="mobile-setting-hint" v-i18n>Auto uses the phone layout on narrow screens.</span>
    </div>

    <div class="mobile-setting">
      <label class="mobile-setting-label" for="mobile-card-scale">
        <span v-i18n>Card size</span> <span class="mobile-num">{{ cardScalePercent }}%</span>
      </label>
      <input
        id="mobile-card-scale"
        type="range"
        :min="minCardScalePercent"
        :max="maxCardScalePercent"
        step="2"
        data-test="card-scale"
        :value="cardScalePercent"
        @input="setCardScale($event)">
    </div>

    <div class="mobile-setting">
      <label class="mobile-setting-label" v-i18n>Tag row</label>
      <div class="mobile-setting-row">
        <button
          v-for="mode in tagRowModes"
          :key="mode"
          class="mobile-segment-button"
          :aria-selected="prefs.tag_row === mode"
          :data-test="'tag-row-' + mode"
          @click="setTagRow(mode)">{{ $t(modeLabel(mode)) }}</button>
      </div>
      <span class="mobile-setting-hint" v-i18n>Auto opens the tag row on the Cards tab.</span>
    </div>

    <div class="mobile-setting">
      <label class="form-switch mobile-setting-label">
        <input type="checkbox" v-model="prefs.action_sheet_peek" data-test="action_sheet_peek" @change="save('action_sheet_peek')">
        <i class="form-icon"></i> <span v-i18n>Keep a sliver of the action sheet visible</span>
      </label>
    </div>

    <div class="mobile-setting">
      <label class="form-switch mobile-setting-label">
        <input type="checkbox" v-model="prefs.hide_tile_confirmation" data-test="hide_tile_confirmation" @change="save('hide_tile_confirmation')">
        <i class="form-icon"></i> <span v-i18n>Hide tile confirmation</span>
      </label>
    </div>

    <div class="mobile-setting">
      <label class="form-switch mobile-setting-label">
        <input type="checkbox" v-model="prefs.mobile_tap_targets" data-test="mobile_tap_targets" @change="save('mobile_tap_targets')">
        <i class="form-icon"></i> <span v-i18n>Show 44px tap targets</span>
      </label>
      <span class="mobile-setting-hint" v-i18n>Draws the recommended touch target over every board space.</span>
    </div>

    <PreferencesDialog :preferencesManager="preferencesManager" @okButtonClicked="$emit('close')"/>
  </section>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

import PreferencesDialog from '@/client/components/PreferencesDialog.vue';
import {
  MAX_CARD_SCALE,
  MIN_CARD_SCALE,
  MOBILE_LAYOUT_MODES,
  MobileLayoutMode,
  Preference,
  Preferences,
  PreferencesManager,
  TAG_ROW_MODES,
  TagRowMode,
  getPreferences,
} from '@/client/utils/PreferencesManager';

const MODE_LABELS: Record<string, string> = {
  auto: 'Auto',
  on: 'On',
  off: 'Off',
  always: 'Always',
  never: 'Never',
};

export default defineComponent({
  name: 'MobileSettings',
  emits: ['close'],
  components: {
    PreferencesDialog,
  },
  data(): {prefs: Preferences} {
    return {
      prefs: {...getPreferences()},
    };
  },
  computed: {
    preferencesManager(): PreferencesManager {
      return PreferencesManager.INSTANCE;
    },
    mobileLayoutModes(): ReadonlyArray<MobileLayoutMode> {
      return MOBILE_LAYOUT_MODES;
    },
    tagRowModes(): ReadonlyArray<TagRowMode> {
      return TAG_ROW_MODES;
    },
    cardScalePercent(): number {
      return Math.round(this.prefs.card_scale * 100);
    },
    minCardScalePercent(): number {
      return Math.round(MIN_CARD_SCALE * 100);
    },
    maxCardScalePercent(): number {
      return Math.round(MAX_CARD_SCALE * 100);
    },
  },
  methods: {
    modeLabel(mode: string): string {
      return MODE_LABELS[mode] ?? mode;
    },
    save(name: Preference): void {
      PreferencesManager.INSTANCE.set(name, this.prefs[name]);
    },
    setMobileLayout(mode: MobileLayoutMode): void {
      this.prefs.mobile_layout = mode;
      this.save('mobile_layout');
    },
    setTagRow(mode: TagRowMode): void {
      this.prefs.tag_row = mode;
      this.save('tag_row');
    },
    setCardScale(event: Event): void {
      const percent = Number((event.target as HTMLInputElement).value);
      this.prefs.card_scale = percent / 100;
      this.save('card_scale');
    },
  },
});
</script>
