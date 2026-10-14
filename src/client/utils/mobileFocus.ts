import {computed, ComputedRef, ref} from 'vue';

/*
 * Whether the action panel is showing one thing rather than the whole turn.
 *
 * When a player taps a card on the turn page or a milestone under the board, they
 * have already chosen what to do; what is left is the price and the confirmation.
 * Showing them the rest of the menu around it -- standard projects, passing, selling
 * patents -- offers them a decision they have just made, and buries the one thing
 * they came for under headings.
 *
 * So the shell raises the panel focused on that entry alone. The panel is built by
 * the server and nested several components deep, the same reason `cardSelection` and
 * `boardSelection` exist, so the shell says so here and the list reads it.
 */
/**
 * How the panel is showing a pick.
 *
 * `staged` means the thing itself is held up above the panel, so the panel is only
 * the price and the button and takes no more room than that needs. `panel` means
 * there is nothing to hold up -- a colony is chosen inside the trade, alongside its
 * fee, and a tile on the turn page is only a way in -- so the panel keeps the room
 * the entry needs.
 */
export type FocusMode = 'none' | 'staged' | 'panel';

const focused = ref<FocusMode>('none');

export const pickFocus: ComputedRef<FocusMode> = computed(() => focused.value);

export const pickFocused: ComputedRef<boolean> = computed(() => focused.value !== 'none');

export function setPickFocus(value: FocusMode): void {
  focused.value = value;
}

/*
 * The menu entry opened from the turn page, by its index in the server's options.
 *
 * A tile -- convert heat, standard projects -- or a button -- pass, sell patents -- is
 * not a thing the entry offers, the way a card or a milestone is: it is the entry.
 * So it is remembered by position, which is also what the response names.
 */
const entry = ref<number | undefined>(undefined);

export const pickedEntry: ComputedRef<number | undefined> = computed(() => entry.value);

export function pickEntry(index: number): void {
  entry.value = index;
}

export function clearPickedEntry(): void {
  entry.value = undefined;
}

export function resetPickFocusForTest(): void {
  focused.value = 'none';
  entry.value = undefined;
}
