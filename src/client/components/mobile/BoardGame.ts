import {Color} from '@/common/Color';

/*
 * The arithmetic behind the board-game style of the Board tab: where a terraform
 * rating sits on the track round the edge, which medal art a milestone or award
 * prints, and the FLIP keyframes its zooms are animated with.
 *
 * Kept out of the components so the geometry can be tested without a layout, which
 * the test DOM does not have.
 */

/** What the board-game Board tab is looking at: the whole board, or one of its parts up close. */
export const BOARD_ZOOMS = ['overview', 'milestones', 'awards', 'planet'] as const;
export type BoardZoom = typeof BOARD_ZOOMS[number];

/*
 * How `MobileBoardPane` is set out. `column` is the modern Board tab: the map at the
 * head of a scrolling column. In the board-game style the same map is either a
 * `picture` in the middle of the printed frame, which takes no gesture and opens with
 * a tap, or `zoomed` to fill the tab, where it pans and zooms as it always has.
 *
 * It is one board in every case. `SelectSpace` finds the spaces by id, so a second
 * copy drawn for the picture would take the taps meant for this one.
 */
export type BoardFraming = 'column' | 'picture' | 'zoomed';

/** The steps round the printed track, 0 to 99; 100 is back on the 0 corner. */
export const TRACK_STEPS = 100;

/** The cells along each side of the frame, both corners included. */
export const TRACK_SIDE = 26;

export type TrackSide = 'left' | 'top' | 'right' | 'bottom';

/** A step of the track, as a cell of the frame's 26 x 26 grid, counted from 1. */
export type TrackCell = {
  step: number;
  row: number;
  column: number;
  side: TrackSide;
};

/*
 * Where a step is printed. As on the physical board, 0 is the bottom-left corner and
 * the track runs clockwise: up the left side to 25 in the top-left corner, along the
 * top to 50, down the right side to 75, and back along the bottom to 99.
 */
export function trackCell(step: number): TrackCell {
  const last = TRACK_SIDE;
  if (step === 0) {
    return {step, row: last, column: 1, side: 'bottom'};
  }
  if (step < 25) {
    return {step, row: last - step, column: 1, side: 'left'};
  }
  if (step < 50) {
    return {step, row: 1, column: step - 24, side: 'top'};
  }
  if (step < 75) {
    return {step, row: step - 49, column: last, side: 'right'};
  }
  return {step, row: last, column: 101 - step, side: 'bottom'};
}

export const TRACK_CELLS: ReadonlyArray<TrackCell> = Array.from({length: TRACK_STEPS}, (_, step) => trackCell(step));

/** The step a rating is marked on. A rating past 100 goes round again, as a cube on the board would. */
export function trackStep(rating: number): number {
  return Math.max(0, Math.floor(rating)) % TRACK_STEPS;
}

/** The way from a cell towards the middle of the board, which is where a second marker on it goes. */
export function inward(cell: TrackCell): {x: number, y: number} {
  const x = cell.column === 1 ? 1 : cell.column === TRACK_SIDE ? -1 : 0;
  const y = cell.row === 1 ? 1 : cell.row === TRACK_SIDE ? -1 : 0;
  return {x, y};
}

export type TrackPlayer = {
  color: Color;
  name: string;
  terraformRating: number;
};

export type TrackMarker = TrackPlayer & {
  cell: TrackCell;
  /** How many markers are already on this step before this one: 0 sits on the cell. */
  place: number;
};

/*
 * A marker per player, at their rating.
 *
 * Players who share a step are set side by side towards the middle of the board,
 * in turn order, so every one of them stays in view.
 */
export function trackMarkers(players: ReadonlyArray<TrackPlayer>): ReadonlyArray<TrackMarker> {
  const taken = new Map<number, number>();
  return players.map((player) => {
    const step = trackStep(player.terraformRating);
    const place = taken.get(step) ?? 0;
    taken.set(step, place + 1);
    return {...player, cell: TRACK_CELLS[step], place};
  });
}

/** The players by terraform rating, best first, each with their place. Players on the same rating share it. */
export function trackStandings(players: ReadonlyArray<TrackPlayer>): ReadonlyArray<TrackPlayer & {place: number}> {
  const sorted = [...players].sort((a, b) => b.terraformRating - a.terraformRating);
  return sorted.map((player) => ({
    ...player,
    place: sorted.findIndex((other) => other.terraformRating === player.terraformRating) + 1,
  }));
}

/* The medal a milestone or an award prints, the same file the desktop's `ma-name--*`
   classes draw. With Turmoil, Terraformer asks for 26 TR, and its medal says so. */
export function medalArt(name: string, turmoil: boolean): string {
  let key = name.replaceAll(' ', '-').replaceAll('.', '').toLowerCase();
  if (key === 'terraformer' && turmoil) {
    key = 'terraformer26';
  }
  return `url("assets/ma/${key}.png")`;
}

/*
 * The zooms' timing. The easing is `@m-ease` from mobile_tokens.less; the
 * Web Animations API cannot read a Less variable, so it is repeated here.
 */
export const ZOOM_MS = 300;
export const ZOOM_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

export type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function boxOf(element: Element | null | undefined): Box | undefined {
  if (element === null || element === undefined) {
    return undefined;
  }
  const rect = element.getBoundingClientRect();
  return {left: rect.left, top: rect.top, width: rect.width, height: rect.height};
}

/** The first frame of a FLIP: an element laid out where it ends, drawn where it starts. */
export type FlipFrame = {
  transform: string;
  clipPath: string;
};

function px(value: number): string {
  return `${Math.round(value * 100) / 100}px`;
}

/*
 * The frame that draws an element, already laid out at `last`, where it was at `first`.
 *
 * The scale is one number, so nothing inside is stretched: it is the one that makes
 * `content` -- the part that has to line up, the board inside its viewport, say --
 * as wide as it was, centred where it was. Whatever of the element lies outside
 * `first` is clipped away, so the frame starts exactly the size of the box it grows
 * out of. Undefined when either box has no size, as in a pane that is not on screen,
 * which then simply appears.
 */
export function flipFrame(first: Box, last: Box, content?: {first: Box, last: Box}): FlipFrame | undefined {
  const from = content?.first ?? first;
  const to = content?.last ?? last;
  if (first.width <= 0 || last.width <= 0 || from.width <= 0 || to.width <= 0) {
    return undefined;
  }
  const scale = from.width / to.width;
  // The transform's origin is the element's top-left corner, where it is laid out now.
  const tx = from.left + from.width / 2 - last.left - scale * (to.left + to.width / 2 - last.left);
  const ty = from.top + from.height / 2 - last.top - scale * (to.top + to.height / 2 - last.top);
  const top = Math.max(0, (first.top - last.top - ty) / scale);
  const left = Math.max(0, (first.left - last.left - tx) / scale);
  const right = Math.max(0, last.width - (first.left + first.width - last.left - tx) / scale);
  const bottom = Math.max(0, last.height - (first.top + first.height - last.top - ty) / scale);
  return {
    transform: `translate(${px(tx)}, ${px(ty)}) scale(${Math.round(scale * 10000) / 10000})`,
    clipPath: `inset(${px(top)} ${px(right)} ${px(bottom)} ${px(left)})`,
  };
}

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const AT_REST: FlipFrame = {transform: 'none', clipPath: 'inset(0px 0px 0px 0px)'};

/*
 * Plays the zoom from `frame` to where the element is laid out, or, `reverse`, from
 * there back into `frame`. `fade` brings it in from transparent, or takes it out.
 *
 * Nothing is played when the player has asked for less motion, or where the browser
 * cannot animate, and `done` is then called at once.
 */
export function playZoom(element: HTMLElement, frame: FlipFrame | undefined, options: {reverse?: boolean, fade?: boolean, done?: () => void} = {}): void {
  const done = options.done ?? (() => {});
  if (frame === undefined || prefersReducedMotion() || typeof element.animate !== 'function') {
    done();
    return;
  }
  const start = {...frame, transformOrigin: '0 0', opacity: options.fade ? 0 : 1};
  const end = {...AT_REST, transformOrigin: '0 0', opacity: 1};
  const animation = element.animate(options.reverse ? [end, start] : [start, end], {duration: ZOOM_MS, easing: ZOOM_EASE});
  animation.onfinish = done;
  animation.oncancel = done;
}
