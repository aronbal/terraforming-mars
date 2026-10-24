/*
 * The height an iOS home-screen app should fill, when the browser reports less.
 *
 * In a home-screen app with a translucent status bar the page is drawn under the
 * status bar, but the viewport `position: fixed; inset: 0` is measured against
 * still stops the status bar's height short of the bottom of the screen. The shell
 * then ends above the home indicator, with an empty band under its tab bar.
 *
 * The screen's own size is not affected, so the shell is given that height
 * instead, and only when the viewport really is shorter: a browser tab, or an iOS
 * that has fixed the bug, is left alone.
 */

export type ViewportReading = {
  /** `navigator.standalone`, which only iOS Safari sets, and only on the home screen. */
  standalone: boolean;
  innerWidth: number;
  innerHeight: number;
  screenWidth: number;
  screenHeight: number;
};

/** The screen height to fill, in CSS pixels, or undefined when the viewport already does. */
export function standaloneShellHeight(reading: ViewportReading): number | undefined {
  if (!reading.standalone) {
    return undefined;
  }
  // iOS reports the screen in portrait whichever way the phone is held.
  const portrait = reading.innerHeight >= reading.innerWidth;
  const long = Math.max(reading.screenWidth, reading.screenHeight);
  const short = Math.min(reading.screenWidth, reading.screenHeight);
  const full = portrait ? long : short;
  return full > reading.innerHeight ? full : undefined;
}

/** Reads the current window. */
export function readViewport(): ViewportReading {
  return {
    standalone: (window.navigator as Navigator & {standalone?: boolean}).standalone === true,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
}
