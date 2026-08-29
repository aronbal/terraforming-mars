<template>
<div class="start-screen">
  <div v-i18n class="start-screen-links">
    <div class="start-screen-header start-screen-link--title">
      <div class="start-screen-title-top">TERRAFORMING</div>
      <div class="start-screen-title-bottom">MARS</div>
    </div>
    <nav class="start-screen-menu">
      <a
        v-for="(entry, index) in entries"
        :key="entry.label"
        class="start-screen-link"
        :class="{'start-screen-link--primary': entry.primary === true}"
        :href="entry.href"
        :target="entry.external === true ? '_blank' : undefined"
      >
        <span class="start-screen-link-index">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="start-screen-link-label">{{ entry.label }}</span>
        <span class="start-screen-link-arrow" aria-hidden="true">{{ entry.external === true ? '↗' : '→' }}</span>
      </a>
    </nav>
    <div class="start-screen-header start-screen-link--languages">
      <LanguageSwitcher />
    </div>
    <div class="start-screen-footer">
      <div class="start-screen-version-cont">
        <div class="nowrap start-screen-date"><span v-i18n>deployed</span>: {{raw_settings.builtAt}}</div>
        <div class="nowrap start-screen-version"><span v-i18n>version</span>: {{raw_settings.head}}</div>
      </div>
      <div class="source-code">
        <a href="https://github.com/terraforming-mars/terraforming-mars" target="_blank" class="source-code-text">
        <img src="assets/misc/github.png" class="source-code-img">
          source code
        </a>
      </div>
    </div>
  </div>
  <div class="free-floating-preferences-icon">
    <LanguageIcon class="corner-language-icon"/>
    <PreferencesIcon/>
  </div>
</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import LanguageSwitcher from '@/client/components/LanguageSwitcher.vue';
import LanguageIcon from '@/client/components/LanguageIcon.vue';
import PreferencesIcon from '@/client/components/PreferencesIcon.vue';

import raw_settings from '@/genfiles/settings.json';
import * as constants from '@/common/constants';

type MenuEntry = {
  label: string;
  href: string;
  /** Opens in a new tab, and is marked with an outward arrow. */
  external?: boolean;
  /** Gets the accent treatment. Reserved for the two ways into a game. */
  primary?: boolean;
};

const previousViewport = ref('');

// Set the viewport width to width=device-width on the start screen so mobile browsers use their actual CSS viewport width.
// The current global viewport is width=1260, which prevents the home page from using the device width on phones.
// This is a temporary solution in order to make this edit scoped to the start screen.
// TODO: Once responsiveness covers the whole project, this code should be removed and the tag in index.html should be updated directly.
onMounted(() => {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport !== null) {
    previousViewport.value = viewport.getAttribute('content') ?? '';
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1, viewport-fit=cover',
    );
  }
});

onBeforeUnmount(() => {
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute('content', previousViewport.value);
});

const entries: ReadonlyArray<MenuEntry> = [
  {label: 'New game', href: 'new-game', primary: true},
  {label: 'Continue game', href: 'continue-game', primary: true},
  {label: 'How to Play', href: 'https://github.com/terraforming-mars/terraforming-mars/wiki/Rulebooks', external: true},
  {label: 'Cards list', href: 'cards', external: true},
  {label: 'Board game', href: 'https://boardgamegeek.com/boardgame/167791/terraforming-mars', external: true},
  {label: 'About us', href: 'https://github.com/terraforming-mars/terraforming-mars#README', external: true},
  {label: 'Whats new?', href: 'https://github.com/terraforming-mars/terraforming-mars/wiki/Changelog', external: true},
  {label: 'Join us on Discord', href: constants.DISCORD_INVITE, external: true},
];
</script>
