<template>
  <div id="continue-game" class="continue-game-container">
    <h1><span v-i18n>{{ APP_NAME }}</span> — <span v-i18n>Continue game</span></h1>

    <div v-if="games.length === 0" class="continue-game-empty" v-i18n>
      This browser hasn't opened any games yet. Games opened here are listed on this page so you can return to them later.
    </div>

    <ul v-else class="continue-game-list">
      <li v-for="game in games" :key="game.id" class="continue-game-entry">
        <span :class="'color-square ' + colorClass(game)">{{ symbol(game) }}</span>
        <a class="continue-game-link" :href="href(game)">
          <span v-if="game.name !== undefined">{{ game.name }}</span>
          <span v-else-if="game.kind === 'spectator'" v-i18n>Spectator</span>
          <span v-else v-i18n>Player links</span>
        </a>
        <span class="continue-game-detail">
          {{ game.gameName }}
          <template v-if="game.generation !== undefined"> · <span v-i18n>generation</span> {{ game.generation }}</template>
          <template v-if="game.phase === Phase.END"> · <span v-i18n>finished</span></template>
        </span>
        <span class="continue-game-detail">{{ lastSeen(game) }}</span>
        <AppButton title="remove" size="tiny" :disableOnServerBusy="false" @click="forget(game)"/>
      </li>
    </ul>

    <div v-if="games.length > 0" class="continue-game-clear">
      <AppButton title="Clear list" size="small" :disableOnServerBusy="false" @click="forgetAll"/>
    </div>

    <div class="continue-game-manual">
      <h2 v-i18n>Have a link's id?</h2>
      <p v-i18n>Paste the player, spectator, or game id from the link you were given.</p>
      <input class="form-input form-inline continue-game-id" placeholder="Id" v-model="id">
      <AppButton title="Continue" type="success" :disableOnServerBusy="false" @click="continueById"/>
      <div v-if="error !== undefined" class="continue-game-error" v-i18n>{{ error }}</div>
    </div>

    <div class="continue-game-back">
      <a href="/" v-i18n>Back to main page</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {APP_NAME} from '@/common/constants';
import {Phase} from '@/common/Phase';
import {isGameId, isPlayerId, isSpectatorId} from '@/common/Types';
import {playerColorClass} from '@/common/utils/utils';
import {playerSymbol} from '@/client/utils/playerSymbol';
import {forgetAllGames, forgetGame, getRecentGames, RecentGame} from '@/client/utils/RecentGamesStorage';
import {setDocumentTitle} from '@/client/utils/documentTitle';

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
