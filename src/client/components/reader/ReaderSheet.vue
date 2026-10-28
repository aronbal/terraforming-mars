<template>
  <Teleport to="body">
    <div v-if="page !== undefined" class="mobile-overlay reader" :class="{'reader--section': page.anchor !== undefined}" data-test="reader">
      <div class="mobile-overlay-scrim" @click="closeReader"></div>
      <section class="mobile-overlay-sheet reader-sheet" role="dialog" :aria-label="heading">
        <div class="mobile-overlay-head reader-head">
          <button v-if="canGoBack" type="button" class="mobile-plain-button" data-test="reader-back" @click="readerBack" v-i18n>Back</button>
          <h2 class="mobile-overlay-title reader-title">{{ heading }}</h2>
          <button type="button" class="mobile-plain-button" data-test="reader-close" @click="closeReader" v-i18n>Done</button>
        </div>
        <div ref="body" class="mobile-overlay-body reader-body" @click="follow">
          <p v-if="state === 'loading'" class="mobile-section-note" data-test="reader-loading" v-i18n>Loading</p>
          <p v-else-if="state === 'failed'" class="mobile-section-note" data-test="reader-failed" v-i18n>The page could not be loaded. Try again in a moment.</p>
          <div v-else class="reader-text" data-test="reader-text" v-html="html"></div>
          <a class="reader-source" :href="page.pageUrl" target="_blank" rel="noopener" data-reader-external v-i18n>Open in browser</a>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue';

import {closeReader, openReaderAt, readerBack, ReaderPage, readerStack, sectionOf} from '@/client/components/reader/reader';
import {renderPage} from '@/client/components/reader/renderPage';
import {translateText} from '@/client/directives/i18n';

/*
 * The sheet the in-app reader draws in, over everything, the game's shell included.
 *
 * While it is mounted it also takes over every link to a wiki page or the README:
 * on a phone a new tab is a different app, and the way back from it is not obvious.
 */

const page = computed<ReaderPage | undefined>(() => readerStack.value[readerStack.value.length - 1]);
const canGoBack = computed(() => readerStack.value.length > 1);

const state = ref<'loading' | 'failed' | 'ready'>('loading');
const html = ref('');
const sectionTitle = ref<string | undefined>(undefined);
const body = ref<HTMLElement>();

const heading = computed(() => sectionTitle.value ?? translateText(page.value?.title ?? ''));

const cache = new Map<string, string>();

async function fetchMarkdown(source: string): Promise<string> {
  const cached = cache.get(source);
  if (cached !== undefined) {
    return cached;
  }
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`${source}: ${response.status}`);
  }
  const text = await response.text();
  cache.set(source, text);
  return text;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function load(current: ReaderPage | undefined): Promise<void> {
  sectionTitle.value = undefined;
  if (current === undefined) {
    return;
  }
  state.value = 'loading';
  try {
    const markdown = await fetchMarkdown(current.source);
    if (page.value !== current) {
      return;
    }
    const section = current.anchor === undefined ? undefined : sectionOf(markdown, current.anchor);
    sectionTitle.value = section?.title;
    // The sheet's title already names the page; its own first heading would repeat it.
    const text = section?.markdown ?? markdown.replace(new RegExp(`^#\\s+${escapeRegExp(current.title)}\\s*\\n`, 'i'), '');
    html.value = renderPage(text, current);
    state.value = 'ready';
    body.value?.scrollTo?.(0, 0);
  } catch (e) {
    if (page.value === current) {
      console.error('Cannot load the page', e);
      state.value = 'failed';
    }
  }
}

watch(page, (current) => load(current), {immediate: true});

/* The link a click landed in, unless it is one the reader must leave alone. */
function linkOf(event: MouseEvent): HTMLAnchorElement | undefined {
  const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null | undefined;
  if (link === null || link === undefined || link.hasAttribute('data-reader-external')) {
    return undefined;
  }
  return link;
}

/* A link in the page: another wiki page opens over this one; anything else, a tab. */
function follow(event: MouseEvent): void {
  const link = linkOf(event);
  if (link === undefined) {
    return;
  }
  event.preventDefault();
  if (!openReaderAt(link.href)) {
    window.open(link.href, '_blank', 'noopener');
  }
}

/* Any other link to the wiki or the README, anywhere in the app, opens here. */
function intercept(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  const link = linkOf(event);
  if (link === undefined || body.value?.contains(link) === true) {
    return;
  }
  if (openReaderAt(link.href)) {
    event.preventDefault();
    // A link inside a label would otherwise also flip the option it explains.
    event.stopPropagation();
  }
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && page.value !== undefined) {
    closeReader();
  }
}

onMounted(() => {
  document.addEventListener('click', intercept, true);
  document.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', intercept, true);
  document.removeEventListener('keydown', onKey);
});
</script>
