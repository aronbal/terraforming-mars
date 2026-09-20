import {computed, ComputedRef, ref} from 'vue';

/*
 * Whether the action panel is showing one thing rather than the whole turn.
 *
 * When a player taps a card in their hand or a milestone under the board, they have
 * already chosen what to do; what is left is the price and the confirmation. Showing
 * them the rest of the menu around it -- standard projects, passing, selling patents
 * -- offers them a decision they have just made, and buries the one thing they came
 * for under headings.
 *
 * So the shell raises the panel focused on that entry alone. The panel is built by
 * the server and nested several components deep, the same reason `cardSelection` and
 * `boardSelection` exist, so the shell says so here and the list reads it.
 *
 * This is never set when the player asked to finish their actions on the Act tab:
 * there the point is that the rest of the menu is in reach beside the entry.
 */
/**
 * How the panel is showing a pick.
 *
 * `staged` means the thing itself is held up above the panel, so the panel is only
 * the price and the button and takes no more room than that needs. `panel` means
 * there is nothing to hold up -- a colony is chosen inside the trade, alongside its
 * fee -- so the panel keeps the whole screen.
 */
export type FocusMode = 'none' | 'staged' | 'panel';

const focused = ref<FocusMode>('none');

export const pickFocus: ComputedRef<FocusMode> = computed(() => focused.value);

export const pickFocused: ComputedRef<boolean> = computed(() => focused.value !== 'none');

export function setPickFocus(value: FocusMode): void {
  focused.value = value;
}

export function resetPickFocusForTest(): void {
  focused.value = 'none';
  routing.value = true;
}

/*
 * Whether an entry whose subject is drawn on another tab sends the player there.
 *
 * It does when they play on the tabs, which is the whole arrangement: the card is
 * tapped in the hand, the milestone under the board. When they have asked to take
 * their turn on the Act tab instead, nothing there may send them away -- every entry
 * unfolds in place, the way the desktop menu does, or the setting would be a promise
 * the shell keeps breaking.
 */
const routing = ref(true);

export const tabRouting: ComputedRef<boolean> = computed(() => routing.value);

export function setTabRouting(value: boolean): void {
  routing.value = value;
}
