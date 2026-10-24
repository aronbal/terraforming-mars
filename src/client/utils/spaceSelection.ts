import {computed, ComputedRef, ref, shallowRef} from 'vue';

/*
 * Whether the player is being asked to pick a board space.
 *
 * `SelectSpace` wires its clicks straight onto the board's DOM, so the mobile shell
 * cannot tell from the model alone that a placement is under way — a nested input
 * such as an `OrOptions` hides it. `SelectSpace` reports in here instead, and the
 * shell uses it to clear the board and raise its confirmation.
 */
const openSelections = ref(0);

export const selectingSpace: ComputedRef<boolean> = computed(() => openSelections.value > 0);

export function beginSpaceSelection(): void {
  openSelections.value++;
}

export function endSpaceSelection(): void {
  openSelections.value = Math.max(0, openSelections.value - 1);
}

export function resetSpaceSelectionForTest(): void {
  openSelections.value = 0;
  pendingPlacement.value = undefined;
}

/** A space tapped on the board, waiting for the player to place on it or think again. */
export type PendingPlacement = {
  confirm: () => void;
  cancel: () => void;
};

/*
 * The tap the mobile shell's placement bar is asking about.
 *
 * On a phone a dialog over the board hides the very space it asks about, so
 * `SelectSpace` hands the question to the bar under the map instead.
 */
export const pendingPlacement = shallowRef<PendingPlacement | undefined>(undefined);

export function offerPlacement(placement: PendingPlacement): void {
  pendingPlacement.value = placement;
}

export function clearPlacement(): void {
  pendingPlacement.value = undefined;
}
