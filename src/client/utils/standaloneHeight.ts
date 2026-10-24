/*
 * The band an iOS home-screen app leaves under the page.
 *
 * In a home-screen app with a translucent status bar the page is drawn under the
 * status bar, but the viewport still stops the status bar's height short of the
 * bottom of the screen. Nothing on the page can be drawn into that band: a shell
 * stretched to the screen's height is cut off at the viewport's edge, tabs and
 * all. Only the page's background shows there.
 *
 * So the shell keeps to the viewport, and is told how tall the band is, to drop
 * the room its tab bar would otherwise keep for the home indicator: the band
 * already sits under it, and the background paints it the tab bar's colour.
 */

export type ViewportReading = {
  /** `navigator.standalone`, which only iOS Safari sets, and only on the home screen. */
  standalone: boolean;
  innerWidth: number;
  innerHeight: number;
  screenWidth: number;
  screenHeight: number;
};

/** How far short of the screen's bottom the viewport stops, in CSS pixels; 0 when it does not. */
export function standaloneGap(reading: ViewportReading): number {
  if (!reading.standalone) {
    return 0;
  }
  // iOS reports the screen in portrait whichever way the phone is held.
  const portrait = reading.innerHeight >= reading.innerWidth;
  const long = Math.max(reading.screenWidth, reading.screenHeight);
  const short = Math.min(reading.screenWidth, reading.screenHeight);
  const full = portrait ? long : short;
  return Math.max(0, full - reading.innerHeight);
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
