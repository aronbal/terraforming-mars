import {computed, ComputedRef, ref} from 'vue';
import {getPreferences, MobileLayoutMode} from '@/client/utils/PreferencesManager';

/**
 * Viewports this wide or narrower get the mobile shell when `mobile_layout` is `auto`.
 *
 * Wide enough to cover phones in landscape, narrow enough that a tablet keeps the
 * desktop layout the game was drawn for.
 */
export const MOBILE_BREAKPOINT = 820;

const viewportWidth = ref(0);
const layoutPreference = ref<MobileLayoutMode>('auto');
let tracking = false;

function readViewport(): void {
  viewportWidth.value = window.innerWidth;
}

/**
 * Whether the mobile shell replaces the desktop layout.
 *
 * Reads as `false` until `startMobileLayoutTracking` has run, so a server-side or
 * test render without a window falls back to the desktop layout.
 */
export const mobileLayout: ComputedRef<boolean> = computed(() => {
  switch (layoutPreference.value) {
  case 'on':
    return true;
  case 'off':
    return false;
  default:
    return viewportWidth.value > 0 && viewportWidth.value <= MOBILE_BREAKPOINT;
  }
});

/** Re-reads `mobile_layout`, which the preferences dialog can change mid-game. */
export function refreshMobileLayoutPreference(): void {
  layoutPreference.value = getPreferences().mobile_layout;
}

/** Starts watching the viewport. Safe to call more than once. */
export function startMobileLayoutTracking(): void {
  if (tracking || typeof window === 'undefined') {
    return;
  }
  tracking = true;
  readViewport();
  refreshMobileLayoutPreference();
  window.addEventListener('resize', readViewport);
  window.addEventListener('orientationchange', readViewport);
}

export function resetMobileLayoutForTest(): void {
  tracking = false;
  viewportWidth.value = 0;
  layoutPreference.value = 'auto';
}
