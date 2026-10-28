<template>
  <div class="mobile-start" data-test="mobile-start">
    <template v-if="view === 'menu'">
      <header class="mobile-start-head">
        <img class="mobile-start-icon" src="assets/icons/icon.svg" alt="">
        <div class="mobile-start-title">
          <span class="mobile-start-title-top">Terraforming</span>
          <span class="mobile-start-title-bottom">Mars</span>
        </div>
      </header>

      <div class="mobile-list">
        <a
          v-for="entry in playEntries"
          :key="entry.label"
          class="mobile-row mobile-row--button mobile-start-link"
          :href="entry.href">
          <span class="mobile-glyph" :class="entry.glyph">
            <MobileIcon :name="entry.icon" :size="16"/>
          </span>
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-row-title">{{ $t(entry.label) }}</span>
            </span>
            <span class="mobile-row-chevron" aria-hidden="true">&rsaquo;</span>
          </span>
        </a>
      </div>

      <h3 class="mobile-eyebrow" v-i18n>Learn more</h3>
      <!-- The wiki and the README open in the app's reader; only other sites get a tab. -->
      <div class="mobile-list">
        <a
          v-for="entry in referenceEntries"
          :key="entry.label"
          class="mobile-row mobile-row--button mobile-start-link"
          :href="entry.href"
          :target="entry.external === true ? '_blank' : undefined"
          :data-test="'start-' + entry.icon">
          <span class="mobile-glyph" :class="entry.glyph">
            <MobileIcon :name="entry.icon" :size="16"/>
          </span>
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-row-title">{{ $t(entry.label) }}</span>
            </span>
            <MobileIcon v-if="entry.external === true" class="mobile-start-external" name="external-link" :size="15"/>
            <span v-else class="mobile-row-chevron" aria-hidden="true">&rsaquo;</span>
          </span>
        </a>
      </div>

      <div class="mobile-list">
        <!-- The phone's own picker over the row, as in the game's settings. -->
        <label class="mobile-row mobile-row--button mobile-language">
          <span class="mobile-glyph mobile-glyph--accent">
            <MobileIcon name="globe" :size="16"/>
          </span>
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-row-title" v-i18n>Language</span>
            </span>
            <span class="mobile-row-trailing" data-test="start-language-name">{{ languageName }}</span>
            <span class="mobile-row-chevron" aria-hidden="true">&rsaquo;</span>
          </span>
          <select class="mobile-language-select" :value="lang" data-test="start-language" @change="pickLanguage">
            <option v-for="language in languages" :key="language.id" :value="language.id">{{ language.name }}</option>
          </select>
        </label>
        <button type="button" class="mobile-row mobile-row--button" data-test="start-settings" @click="view = 'settings'">
          <span class="mobile-glyph mobile-glyph--neutral">
            <MobileIcon name="settings" :size="16"/>
          </span>
          <span class="mobile-row-body">
            <span class="mobile-row-text">
              <span class="mobile-row-title" v-i18n>Settings</span>
            </span>
            <span class="mobile-row-chevron" aria-hidden="true">&rsaquo;</span>
          </span>
        </button>
      </div>

      <footer class="mobile-start-footer">
        <div><span v-i18n>version</span> {{ settings.head }} · {{ settings.builtAt }}</div>
        <a href="https://github.com/terraforming-mars/terraforming-mars" target="_blank" v-i18n>source code</a>
      </footer>
    </template>

    <!-- The same settings the game's ⋯ menu opens. -->
    <template v-else>
      <div class="mobile-more-head">
        <button type="button" class="mobile-plain-button" data-test="start-back" @click="view = 'menu'" v-i18n>Back</button>
      </div>
      <MobileSettings @changed="refreshMobileLayoutPreference"/>
    </template>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue';

import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import MobileSettings from '@/client/components/mobile/MobileSettings.vue';
import {MobileIconName} from '@/client/components/mobile/MobileIcons';
import {HELP_PAGES} from '@/client/components/reader/reader';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {refreshMobileLayoutPreference} from '@/client/utils/useMobileLayout';
import {ALL_LANGUAGES, LANGUAGES} from '@/common/constants';
import * as constants from '@/common/constants';
import raw_settings from '@/genfiles/settings.json';

type Entry = {
  label: string;
  href: string;
  icon: MobileIconName;
  glyph: string;
  /** Another site, in a new tab. */
  external?: boolean;
};

const playEntries: ReadonlyArray<Entry> = [
  {label: 'New game', href: 'new-game', icon: 'plus', glyph: 'mobile-glyph--accent'},
  {label: 'Continue game', href: 'continue-game', icon: 'history', glyph: 'mobile-glyph--ok'},
];

const referenceEntries: ReadonlyArray<Entry> = [
  {label: 'How to Play', href: HELP_PAGES.howToPlay, icon: 'book-open', glyph: 'mobile-glyph--neutral'},
  {label: 'Cards list', href: 'cards', icon: 'layers', glyph: 'mobile-glyph--neutral'},
  {label: 'Whats new?', href: HELP_PAGES.changelog, icon: 'sparkles', glyph: 'mobile-glyph--neutral'},
  {label: 'About us', href: HELP_PAGES.about, icon: 'info', glyph: 'mobile-glyph--neutral'},
  {label: 'Board game', href: 'https://boardgamegeek.com/boardgame/167791/terraforming-mars', icon: 'dices', glyph: 'mobile-glyph--neutral', external: true},
  {label: 'Join us on Discord', href: constants.DISCORD_INVITE, icon: 'message-circle', glyph: 'mobile-glyph--pr', external: true},
];

const settings = raw_settings;
const view = ref<'menu' | 'settings'>('menu');

const lang = PreferencesManager.INSTANCE.values().lang;
const languages = ALL_LANGUAGES.map((id) => ({id, name: LANGUAGES[id][0]}));
const languageName = computed(() => languages.find((language) => language.id === lang)?.name ?? lang);

function pickLanguage(event: Event): void {
  const id = (event.target as HTMLSelectElement).value;
  if (id !== lang) {
    PreferencesManager.INSTANCE.set('lang', id);
    window.location.reload();
  }
}
</script>
