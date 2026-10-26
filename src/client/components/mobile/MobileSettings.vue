<template>
  <section class="mobile-settings" :aria-label="$t('Settings')" data-test="mobile-settings">
    <h3 class="mobile-eyebrow" v-i18n>Look</h3>
    <div class="mobile-list">
      <div class="mobile-row">
        <span class="mobile-row-body mobile-setting">
          <span class="mobile-row-title" v-i18n>Phone layout</span>
          <span class="mobile-segmented" role="radiogroup">
            <button
              v-for="mode in mobileLayoutModes"
              :key="mode"
              type="button"
              role="radio"
              class="mobile-segmented-option"
              :class="{'mobile-segmented-option--on': prefs.mobile_layout === mode}"
              :aria-checked="prefs.mobile_layout === mode"
              :data-test="'mobile-layout-' + mode"
              @click="setMode('mobile_layout', mode)">{{ $t(modeLabel(mode)) }}</button>
          </span>
          <span class="mobile-row-subtitle mobile-more-wrap" v-i18n>Auto uses the phone layout on narrow screens.</span>
        </span>
      </div>
      <div class="mobile-row">
        <span class="mobile-row-body mobile-setting">
          <span class="mobile-row-title" v-i18n>Board style</span>
          <span class="mobile-segmented" role="radiogroup">
            <button
              v-for="style in boardStyles"
              :key="style"
              type="button"
              role="radio"
              class="mobile-segmented-option"
              :class="{'mobile-segmented-option--on': prefs.mobile_board_style === style}"
              :aria-checked="prefs.mobile_board_style === style"
              :data-test="'board-style-' + style"
              @click="setMode('mobile_board_style', style)">{{ $t(modeLabel(style)) }}</button>
          </span>
          <span class="mobile-row-subtitle mobile-more-wrap" v-i18n>Board game looks like the printed board.</span>
        </span>
      </div>
      <div class="mobile-row">
        <span class="mobile-row-body mobile-setting">
          <label class="mobile-setting-head" for="mobile-card-scale">
            <span class="mobile-row-title" v-i18n>Card size</span>
            <span class="mobile-row-trailing">{{ cardScalePercent }}%</span>
          </label>
          <input
            id="mobile-card-scale"
            class="mobile-setting-range"
            type="range"
            :min="minCardScalePercent"
            :max="maxCardScalePercent"
            step="2"
            data-test="card-scale"
            :value="cardScalePercent"
            @input="setCardScale($event)">
        </span>
      </div>
      <div class="mobile-row">
        <span class="mobile-row-body mobile-setting">
          <span class="mobile-row-title" v-i18n>Tag row</span>
          <span class="mobile-segmented" role="radiogroup">
            <button
              v-for="mode in tagRowModes"
              :key="mode"
              type="button"
              role="radio"
              class="mobile-segmented-option"
              :class="{'mobile-segmented-option--on': tagRowSelected(mode)}"
              :aria-checked="tagRowSelected(mode)"
              :data-test="'tag-row-' + mode"
              @click="setMode('tag_row', mode)">{{ $t(mode === 'auto' ? 'On' : 'Off') }}</button>
          </span>
        </span>
      </div>
    </div>

    <template v-for="group in switchGroups" :key="group.title">
      <h3 class="mobile-eyebrow">{{ $t(group.title) }}</h3>
      <div class="mobile-list">
        <label v-for="setting in group.settings" :key="setting.name" class="mobile-row mobile-more-switch">
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-row-title">{{ $t(setting.label) }}</span>
              <span v-if="setting.hint !== undefined" class="mobile-row-subtitle">{{ $t(setting.hint) }}</span>
            </span>
            <span class="form-switch">
              <input type="checkbox" v-model="prefs[setting.name]" :data-test="setting.name" @change="saveSwitch(setting.name)">
              <i class="form-icon"></i>
            </span>
          </span>
        </label>
      </div>
    </template>

    <h3 class="mobile-eyebrow" v-i18n>Language</h3>
    <!-- One row, and the phone's own picker over it: seventeen names are a list to
         scroll, not a wall of buttons to read. -->
    <div class="mobile-list">
      <label class="mobile-row mobile-row--button mobile-language">
        <span class="mobile-row-body">
          <span class="mobile-row-text">
            <span class="mobile-row-title" v-i18n>Language</span>
          </span>
          <span class="mobile-row-trailing" data-test="language-name">{{ languageName }}</span>
          <span class="mobile-row-chevron" aria-hidden="true">&rsaquo;</span>
        </span>
        <select class="mobile-language-select" :value="prefs.lang" data-test="language" @change="pickLanguage($event)">
          <option v-for="lang in languages" :key="lang.id" :value="lang.id">{{ lang.name }}</option>
        </select>
      </label>
    </div>
    <p class="mobile-section-note" v-i18n>Changing the language reloads the page.</p>

    <div class="mobile-list">
      <button type="button" class="mobile-row mobile-row--button" data-test="report-bug" @click="showBugDialog()">
        <span class="mobile-row-body">
          <span class="mobile-row-text">
            <span class="mobile-row-title" v-i18n>Report a bug</span>
          </span>
          <span class="mobile-row-chevron" aria-hidden="true">&rsaquo;</span>
        </span>
      </button>
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
  MAX_CARD_SCALE,
  MIN_CARD_SCALE,
  MOBILE_BOARD_STYLES,
  MOBILE_LAYOUT_MODES,
  MobileBoardStyle,
  MobileLayoutMode,
  Preference,
  Preferences,
  PreferencesManager,
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
 * desktop layout the shell never draws -- the sidebar, the hover magnifier, the
 * block that hides the milestones and awards -- and offering those here would be
 * offering to change nothing. Milestones and awards are part of the game, and the
 * shell always shows them under the board.
 */

type SwitchSetting = {
  name: BooleanPreference;
  label: string;
  hint?: string;
};

type SwitchGroup = {
  title: string;
  settings: ReadonlyArray<SwitchSetting>;
};

const SWITCH_GROUPS: ReadonlyArray<SwitchGroup> = [
  {
    title: 'Cards',
    settings: [
      {name: 'small_cards', label: 'Smaller cards'},
      {name: 'hide_discount_on_cards', label: 'Hide discount on cards'},
    ],
  },
  {
    title: 'Board',
    settings: [
      {
        name: 'mobile_tap_targets',
        label: 'Show 44px tap targets',
        hint: 'Draws the recommended touch target over every board space.',
      },
      {name: 'hide_tile_confirmation', label: 'Hide tile confirmation'},
      {name: 'symbol_overlay', label: 'Add symbols on top of player colors'},
      {name: 'remove_background', label: 'Remove background image'},
    ],
  },
  {
    title: 'Game',
    settings: [
      {name: 'enable_sounds', label: 'Enable sounds'},
      {name: 'show_alerts', label: 'Show in-game alerts'},
      {name: 'animated_title', label: 'Animated title', hint: 'Spins the window title on your turn.'},
      {name: 'learner_mode', label: 'Learner mode', hint: 'Shows extra help for new players. Takes effect on the next load.'},
    ],
  },
  {
    title: 'Developer',
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
  modern: 'Modern',
  boardgame: 'Board game',
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
    boardStyles(): ReadonlyArray<MobileBoardStyle> {
      return MOBILE_BOARD_STYLES;
    },
    /* The tags have the header's spare line to themselves, so they are simply on or
       off; a stored `always` reads as on. */
    tagRowModes(): ReadonlyArray<TagRowMode> {
      return ['auto', 'never'];
    },
    languages(): ReadonlyArray<{id: string, name: string}> {
      return ALL_LANGUAGES.map((id) => ({id, name: LANGUAGES[id][0]}));
    },
    languageName(): string {
      return this.languages.find((lang) => lang.id === this.prefs.lang)?.name ?? this.prefs.lang;
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
    tagRowSelected(mode: TagRowMode): boolean {
      return mode === 'never' ? this.prefs.tag_row === 'never' : this.prefs.tag_row !== 'never';
    },
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
    /* Each is applied on the `changed` the save emits: the shell re-reads the
       preferences, so the board redraws in its new style without a reload. */
    setMode(name: 'mobile_layout' | 'tag_row' | 'mobile_board_style', mode: string): void {
      if (name === 'mobile_layout') {
        this.prefs.mobile_layout = mode as MobileLayoutMode;
      } else if (name === 'mobile_board_style') {
        this.prefs.mobile_board_style = mode as MobileBoardStyle;
      } else {
        this.prefs.tag_row = mode as TagRowMode;
      }
      this.save(name);
    },
    setCardScale(event: Event): void {
      const percent = Number((event.target as HTMLInputElement).value);
      this.prefs.card_scale = percent / 100;
      this.save('card_scale');
    },
    pickLanguage(event: Event): void {
      const id = (event.target as HTMLSelectElement).value;
      if (id !== this.prefs.lang) {
        this.setLanguage(id);
      }
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
