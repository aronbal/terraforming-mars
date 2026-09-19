<template>
  <section class="mobile-settings" :aria-label="$t('Settings')" data-test="mobile-settings">
    <h3 class="mobile-settings-group" v-i18n>Look</h3>

    <div class="mobile-setting">
      <label class="mobile-setting-label" v-i18n>Phone layout</label>
      <div class="mobile-setting-row">
        <button
          v-for="mode in mobileLayoutModes"
          :key="mode"
          class="mobile-segment-button"
          :aria-selected="prefs.mobile_layout === mode"
          :data-test="'mobile-layout-' + mode"
          @click="setMode('mobile_layout', mode)">{{ $t(modeLabel(mode)) }}</button>
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
          @click="setMode('tag_row', mode)">{{ $t(modeLabel(mode)) }}</button>
      </div>
      <span class="mobile-setting-hint" v-i18n>Auto opens the tag row on the Cards tab.</span>
    </div>

    <h3 class="mobile-settings-group" v-i18n>Cards</h3>

    <div class="mobile-setting">
      <label class="mobile-setting-label" v-i18n>Tapping a card</label>
      <div class="mobile-setting-row">
        <button
          v-for="mode in cardTapModes"
          :key="mode"
          class="mobile-segment-button"
          :aria-selected="prefs.card_tap === mode"
          :data-test="'card-tap-' + mode"
          @click="setMode('card_tap', mode)">{{ $t(modeLabel(mode)) }}</button>
      </div>
      <span class="mobile-setting-hint" v-i18n>Play it goes straight to playing a card you can play, without opening it first.</span>
    </div>

    <template v-for="group in switchGroups" :key="group.title">
      <h3 v-if="group.heading" class="mobile-settings-group">{{ $t(group.title) }}</h3>
      <div v-for="setting in group.settings" :key="setting.name" class="mobile-setting">
        <label class="form-switch mobile-setting-label">
          <input type="checkbox" v-model="prefs[setting.name]" :data-test="setting.name" @change="saveSwitch(setting.name)">
          <i class="form-icon"></i> <span>{{ $t(setting.label) }}</span>
        </label>
        <span v-if="setting.hint !== undefined" class="mobile-setting-hint">{{ $t(setting.hint) }}</span>
      </div>
    </template>

    <h3 class="mobile-settings-group" v-i18n>Language</h3>
    <div class="mobile-setting">
      <div class="mobile-language-grid">
        <button
          v-for="lang in languages"
          :key="lang.id"
          class="mobile-language"
          :aria-selected="prefs.lang === lang.id"
          :data-test="'lang-' + lang.id"
          @click="setLanguage(lang.id)">{{ lang.name }}</button>
      </div>
      <span class="mobile-setting-hint" v-i18n>Changing the language reloads the page.</span>
    </div>

    <div class="mobile-setting">
      <button class="mobile-button" data-test="report-bug" @click="showBugDialog()" v-i18n>Report a bug</button>
    </div>
    <BugReportDialog ref="bugDialog"/>
  </section>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

import BugReportDialog from '@/client/components/BugReportDialog.vue';
import {ALL_LANGUAGES, LANGUAGES} from '@/common/constants';
import {
  BooleanPreference,
  CARD_TAP_MODES,
  CardTapMode,
  MAX_CARD_SCALE,
  MIN_CARD_SCALE,
  MOBILE_LAYOUT_MODES,
  MobileLayoutMode,
  Preference,
  Preferences,
  PreferencesManager,
  TAG_ROW_MODES,
  TagRowMode,
  applyPreferenceClasses,
  getPreferences,
} from '@/client/utils/PreferencesManager';

/*
 * The settings, in the order a player looks for them rather than the order they were
 * added to the game.
 *
 * This replaces `PreferencesDialog` on a phone rather than embedding it. The dialog is
 * one flat column of fourteen switches, several of which are about parts of the
 * desktop layout the shell never draws -- the sidebar, the hover magnifier -- and
 * offering those here would be offering to change nothing.
 */

type SwitchSetting = {
  name: BooleanPreference;
  label: string;
  hint?: string;
};

type SwitchGroup = {
  title: string;
  /** False for the group that continues the heading above it. */
  heading: boolean;
  settings: ReadonlyArray<SwitchSetting>;
};

const SWITCH_GROUPS: ReadonlyArray<SwitchGroup> = [
  {
    title: 'Cards',
    heading: false,
    settings: [
      {name: 'small_cards', label: 'Smaller cards'},
      {name: 'hide_discount_on_cards', label: 'Hide discount on cards'},
    ],
  },
  {
    title: 'Board',
    heading: true,
    settings: [
      {
        name: 'mobile_tap_targets',
        label: 'Show 44px tap targets',
        hint: 'Draws the recommended touch target over every board space.',
      },
      {name: 'hide_tile_confirmation', label: 'Hide tile confirmation'},
      {name: 'hide_awards_and_milestones', label: 'Hide awards and milestones'},
      {name: 'symbol_overlay', label: 'Add symbols on top of player colors'},
      {name: 'remove_background', label: 'Remove background image'},
    ],
  },
  {
    title: 'Game',
    heading: true,
    settings: [
      {name: 'enable_sounds', label: 'Enable sounds'},
      {name: 'show_alerts', label: 'Show in-game alerts'},
      {name: 'animated_title', label: 'Animated title', hint: 'Spins the window title on your turn.'},
      {name: 'learner_mode', label: 'Learner mode', hint: 'Shows extra help for new players. Takes effect on the next load.'},
    ],
  },
  {
    title: 'Developer',
    heading: true,
    settings: [
      {name: 'experimental_ui', label: 'Experimental UI'},
      {name: 'debug_view', label: 'Debug view'},
    ],
  },
];

const MODE_LABELS: Record<string, string> = {
  auto: 'Auto',
  on: 'On',
  off: 'Off',
  always: 'Always',
  never: 'Never',
  magnify: 'Open it',
  play: 'Play it',
};

type Refs = {
  bugDialog: InstanceType<typeof BugReportDialog>;
};

export default defineComponent({
  name: 'MobileSettings',
  emits: ['changed'],
  components: {
    BugReportDialog,
  },
  data(): {prefs: Preferences} {
    return {
      prefs: {...getPreferences()},
    };
  },
  computed: {
    typedRefs(): Refs {
      return this.$refs as unknown as Refs;
    },
    switchGroups(): ReadonlyArray<SwitchGroup> {
      return SWITCH_GROUPS;
    },
    mobileLayoutModes(): ReadonlyArray<MobileLayoutMode> {
      return MOBILE_LAYOUT_MODES;
    },
    tagRowModes(): ReadonlyArray<TagRowMode> {
      return TAG_ROW_MODES;
    },
    cardTapModes(): ReadonlyArray<CardTapMode> {
      return CARD_TAP_MODES;
    },
    languages(): ReadonlyArray<{id: string, name: string}> {
      return ALL_LANGUAGES.map((id) => ({id, name: LANGUAGES[id][0]}));
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
      this.$emit('changed');
    },
    saveSwitch(name: BooleanPreference): void {
      this.save(name);
      // A switch that is only stored changes nothing until the next load: the
      // stylesheets read these off the page, not off the preference.
      applyPreferenceClasses(this.prefs);
    },
    setMode(name: 'mobile_layout' | 'tag_row' | 'card_tap', mode: string): void {
      if (name === 'mobile_layout') {
        this.prefs.mobile_layout = mode as MobileLayoutMode;
      } else if (name === 'tag_row') {
        this.prefs.tag_row = mode as TagRowMode;
      } else {
        this.prefs.card_tap = mode as CardTapMode;
      }
      this.save(name);
    },
    setCardScale(event: Event): void {
      const percent = Number((event.target as HTMLInputElement).value);
      this.prefs.card_scale = percent / 100;
      this.save('card_scale');
    },
    setLanguage(id: string): void {
      this.prefs.lang = id;
      this.save('lang');
      window.location.reload();
    },
    showBugDialog(): void {
      this.typedRefs.bugDialog.show();
    },
  },
});
</script>
