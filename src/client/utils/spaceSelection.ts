import {computed, ComputedRef, ref} from 'vue';

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
}
