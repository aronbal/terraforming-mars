<template>
  <!-- On a phone, drawn like the game it returns to. -->
  <div v-if="mobileLayout" id="continue-game" class="mobile-continue">
    <div class="mobile-more-head">
      <a class="mobile-plain-button mobile-continue-back" href="/" data-test="continue-back">&lsaquo; {{ $t('Back') }}</a>
    </div>
    <header class="mobile-continue-head">
      <div class="mobile-continue-eyebrow">{{ APP_NAME }}</div>
      <h1 v-i18n>Continue game</h1>
      <p class="mobile-section-note" v-i18n>Games opened in this browser, most recent first.</p>
    </header>

    <div class="mobile-list">
      <div v-if="games.length === 0" class="mobile-row mobile-row--empty mobile-continue-empty" v-i18n>
        This browser hasn't opened any games yet. Games opened here are listed on this page so you can return to them later.
      </div>
      <div v-for="game in games" :key="game.id" class="mobile-row mobile-row--button mobile-continue-row" data-test="continue-row">
        <a class="mobile-continue-link" :href="href(game)" :aria-label="title(game)"></a>
        <span v-if="game.color !== undefined" class="mobile-glyph mobile-continue-swatch" :class="colorClass(game)">{{ symbol(game) }}</span>
        <span v-else class="mobile-glyph mobile-glyph--neutral">
          <MobileIcon :name="game.kind === 'spectator' ? 'eye' : 'users'" :size="16"/>
        </span>
        <span class="mobile-row-body">
          <span class="mobile-row-text">
            <span class="mobile-row-title">{{ title(game) }}</span>
            <span class="mobile-row-subtitle">
              {{ game.gameName }}<template v-if="game.generation !== undefined"> · {{ $t('generation') }} {{ game.generation }}</template><template v-if="game.phase === Phase.END"> · {{ $t('finished') }}</template>
            </span>
          </span>
          <span class="mobile-row-trailing">{{ ago(game) }}</span>
          <button class="mobile-continue-remove" type="button" @click="forget(game)" :aria-label="$t('remove')">&times;</button>
        </span>
      </div>
    </div>
    <div v-if="games.length > 0" class="mobile-continue-clear">
      <button class="mobile-plain-button mobile-continue-clear-button" type="button" @click="forgetAll" v-i18n>Clear list</button>
    </div>

    <h3 class="mobile-eyebrow" v-i18n>Have a link's id?</h3>
    <div class="mobile-list">
      <div class="mobile-row">
        <span class="mobile-row-body">
          <input class="mobile-continue-id" placeholder="p1a2b3c…" v-model="id" @keyup.enter="continueById" autocapitalize="off" autocorrect="off" spellcheck="false">
          <button class="mobile-plain-button" type="button" @click="continueById" v-i18n>Continue</button>
        </span>
      </div>
    </div>
    <p v-if="error !== undefined" class="mobile-section-note mobile-continue-error" v-i18n>{{ error }}</p>
    <p v-else class="mobile-section-note" v-i18n>Paste the player, spectator, or game id from the link you were given.</p>
  </div>

  <div v-else id="continue-game" class="continue-game-container">
    <header class="continue-game-head">
      <div class="continue-game-eyebrow" v-i18n>{{ APP_NAME }}</div>
      <h1 v-i18n>Continue game</h1>
      <p class="continue-game-lede" v-i18n>Games opened in this browser, most recent first.</p>
    </header>

    <div v-if="games.length === 0" class="continue-game-empty" v-i18n>
      This browser hasn't opened any games yet. Games opened here are listed on this page so you can return to them later.
    </div>

    <ul v-else class="continue-game-list">
      <li v-for="game in games" :key="game.id" class="continue-game-entry">
        <span class="continue-game-swatch" :class="colorClass(game)">{{ symbol(game) }}</span>
        <a class="continue-game-link" :href="href(game)">
          <span v-if="game.name !== undefined">{{ game.name }}</span>
          <span v-else-if="game.kind === 'spectator'" v-i18n>Spectator</span>
          <span v-else v-i18n>Player links</span>
        </a>
        <span class="continue-game-meta">
          <span class="continue-game-gamename">{{ game.gameName }}</span>
          <template v-if="game.generation !== undefined"><span class="continue-game-dot">·</span><span v-i18n>generation</span>&nbsp;{{ game.generation }}</template>
          <template v-if="game.phase === Phase.END"><span class="continue-game-dot">·</span><span v-i18n>finished</span></template>
        </span>
        <span class="continue-game-seen">{{ lastSeen(game) }}</span>
        <button class="continue-game-remove" type="button" @click="forget(game)" :title="$t('remove')" :aria-label="$t('remove')">&times;</button>
      </li>
    </ul>

    <div v-if="games.length > 0" class="continue-game-clear">
      <button class="continue-game-clear-button" type="button" @click="forgetAll" v-i18n>Clear list</button>
    </div>

    <section class="continue-game-manual">
      <div class="continue-game-eyebrow" v-i18n>Have a link's id?</div>
      <p v-i18n>Paste the player, spectator, or game id from the link you were given.</p>
      <div class="continue-game-manual-row">
        <input class="continue-game-id" placeholder="p1a2b3c…" v-model="id" @keyup.enter="continueById">
        <button class="continue-game-go" type="button" @click="continueById" v-i18n>Continue</button>
      </div>
      <div v-if="error !== undefined" class="continue-game-error" v-i18n>{{ error }}</div>
    </section>

    <div class="continue-game-back">
      <a href="/" v-i18n>← Back to main menu</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue';
import {APP_NAME} from '@/common/constants';
import {Phase} from '@/common/Phase';
import {isGameId, isPlayerId, isSpectatorId} from '@/common/Types';
import {playerColorClass} from '@/common/utils/utils';
import {playerSymbol} from '@/client/utils/playerSymbol';
import {forgetAllGames, forgetGame, getRecentGames, RecentGame} from '@/client/utils/RecentGamesStorage';
import {setDocumentTitle} from '@/client/utils/documentTitle';
import {mobileLayout} from '@/client/utils/useMobileLayout';
import MobileIcon from '@/client/components/mobile/MobileIcon.vue';
import {formatAgo} from '@/client/components/mobile/MobileLog';
import {translateText} from '@/client/directives/i18n';

const games = ref(getRecentGames());
const id = ref('');
const error = ref<string | undefined>(undefined);

onMounted(() => setDocumentTitle('Continue game'));

function href(game: RecentGame): string {
  switch (game.kind) {
  case 'player': return `player?id=${game.id}`;
  case 'spectator': return `spectator?id=${game.id}`;
  case 'game': return `game?id=${game.id}`;
  }
}

function title(game: RecentGame): string {
  if (game.name !== undefined) {
    return game.name;
  }
  return translateText(game.kind === 'spectator' ? 'Spectator' : 'Player links');
}

function ago(game: RecentGame): string {
  return formatAgo(game.lastSeenMs, Date.now());
}

function colorClass(game: RecentGame): string {
  return playerColorClass(game.color ?? 'neutral', 'bg');
}

function symbol(game: RecentGame): string {
  return playerSymbol(game.color ?? 'neutral');
}

function lastSeen(game: RecentGame): string {
  return new Date(game.lastSeenMs).toLocaleString();
}

function forget(game: RecentGame): void {
  forgetGame(game.id);
  games.value = getRecentGames();
}

function forgetAll(): void {
  forgetAllGames();
  games.value = getRecentGames();
}

function continueById(): void {
  const trimmed = id.value.trim();
  if (isPlayerId(trimmed)) {
    window.location.href = `player?id=${trimmed}`;
  } else if (isSpectatorId(trimmed)) {
    window.location.href = `spectator?id=${trimmed}`;
  } else if (isGameId(trimmed)) {
    window.location.href = `game?id=${trimmed}`;
  } else {
    error.value = 'That is not a player, spectator, or game id.';
  }
}
</script>
