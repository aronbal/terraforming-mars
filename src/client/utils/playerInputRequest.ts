/* global RequestInit */

import {ComponentPublicInstance} from 'vue';
import {vueRoot} from '@/client/components/vueRoot';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {INVALID_RUN_ID, AppErrorResponse} from '@/common/app/AppErrorId';
import {paths} from '@/common/app/paths';
import {statusCode} from '@/common/http/statusCode';

/*
 * Sending the player's answer to the server, and taking the game it sends back.
 *
 * `WaitingFor` has always done this for every input it renders. The mobile shell's
 * play sheet answers the turn's menu from outside it, and goes through this same
 * code so the two can never disagree about how an answer is sent, how a request
 * already in flight is refused, or what an error looks like.
 */

export const CANNOT_CONTACT_SERVER = 'Unable to reach the server. It may be restarting or down for maintenance.';

/** Replaces the game on screen with the one the server sent back. */
function updatePlayerView(component: Pick<ComponentPublicInstance, '$root'>, current: ViewModel, playerView: PlayerViewModel | undefined): void {
  const root = vueRoot(component);
  root.screen = 'empty';
  root.playerView = playerView;
  root.playerkey++;
  root.screen = 'player-home';
  if (current.game.phase === 'end' && window.location.pathname !== paths.THE_END) {
    window.location = window.location as any as (string & Location);
  }
}

/**
 * Sends a request whose answer is the player's new view of the game.
 *
 * Resolves true when the server accepted it and the new view is on screen. Any
 * failure has already been shown to the player when this resolves false.
 */
export async function requestPlayerView(
  component: Pick<ComponentPublicInstance, '$root'>,
  playerView: ViewModel,
  url: string,
  options: RequestInit,
): Promise<boolean> {
  const root = vueRoot(component);
  if (root.isServerSideRequestInProgress) {
    console.warn('Server request in progress');
    return false;
  }

  root.isServerSideRequestInProgress = true;
  try {
    const response = await fetch(url, options);
    if (response.ok) {
      updatePlayerView(component, playerView, await response.json());
      return true;
    }

    const showAlert = vueRoot(component).showAlert;
    if (response.status === statusCode.badRequest) {
      const resp = await response.json() as AppErrorResponse;
      let cb = () => {};
      if (resp.id === INVALID_RUN_ID) {
        cb = () => setTimeout(() => window.location.reload(), 100);
      }
      showAlert('Error with input', resp.message, cb);
    } else {
      showAlert('Error processing response', 'Unexpected response from server. Please try again.');
      console.error(response.statusText);
    }
    return false;
  } catch (e) {
    root.showAlert('Error sending input,', CANNOT_CONTACT_SERVER);
    console.error(e);
    return false;
  } finally {
    root.isServerSideRequestInProgress = false;
  }
}

/** Sends `response` as the player's answer to the input they are waiting on. */
export function postPlayerInput(
  component: Pick<ComponentPublicInstance, '$root'>,
  playerView: ViewModel,
  response: InputResponse,
): Promise<boolean> {
  return requestPlayerView(
    component,
    playerView,
    paths.PLAYER_INPUT + '?id=' + playerView.id,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({runId: playerView.runId, ...response}),
    });
}
