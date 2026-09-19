import {computed, ComputedRef, ref} from 'vue';

import {MobileTab} from '@/client/components/mobile/MobileTab';

/*
 * A tab the game itself asks the shell to open.
 *
 * The action menu sends the player to the tab that already draws what an entry is
 * about -- a card to the Cards tab, a milestone to the Board tab -- but the menu is
 * rendered several components deep inside `WaitingFor`, with no path back up to the
 * shell for an event to travel. It leaves the request here instead.
 *
 * Each request carries a number so that asking for the tab you are already on still
 * registers as a request, and so the shell can tell one from the next.
 */
type Request = {
  tab: MobileTab;
  serial: number;
};

const request = ref<Request | undefined>(undefined);
let serial = 0;

export const requestedTab: ComputedRef<Request | undefined> = computed(() => request.value);

export function requestTab(tab: MobileTab): void {
  serial += 1;
  request.value = {tab, serial};
}

export function resetNavigationForTest(): void {
  request.value = undefined;
  serial = 0;
}
