import {expect} from 'chai';
import {
  TRACK_CELLS,
  flipFrame,
  inward,
  medalArt,
  trackCell,
  trackMarkers,
  trackStandings,
  trackStep,
} from '@/client/components/mobile/BoardGame';

describe('BoardGame', () => {
  it('runs the track clockwise from the bottom-left corner, as it is printed', () => {
    expect(trackCell(0)).deep.eq({step: 0, row: 26, column: 1, side: 'bottom'});
    expect(trackCell(1)).deep.eq({step: 1, row: 25, column: 1, side: 'left'});
    expect(trackCell(24)).deep.eq({step: 24, row: 2, column: 1, side: 'left'});
    expect(trackCell(25)).deep.eq({step: 25, row: 1, column: 1, side: 'top'});
    expect(trackCell(50)).deep.eq({step: 50, row: 1, column: 26, side: 'right'});
    expect(trackCell(75)).deep.eq({step: 75, row: 26, column: 26, side: 'bottom'});
    expect(trackCell(99)).deep.eq({step: 99, row: 26, column: 2, side: 'bottom'});
  });

  it('gives every step a cell of its own round the edge', () => {
    const cells = new Set(TRACK_CELLS.map((cell) => `${cell.row},${cell.column}`));
    expect(cells.size).eq(100);
    for (const cell of TRACK_CELLS) {
      expect(cell.row === 1 || cell.row === 26 || cell.column === 1 || cell.column === 26).is.true;
    }
  });

  it('goes round again past 100', () => {
    expect(trackStep(20)).eq(20);
    expect(trackStep(100)).eq(0);
    expect(trackStep(103)).eq(3);
    expect(trackStep(-2)).eq(0);
  });

  it('points a second marker towards the middle of the board', () => {
    expect(inward(trackCell(20))).deep.eq({x: 1, y: 0});
    expect(inward(trackCell(40))).deep.eq({x: 0, y: 1});
    expect(inward(trackCell(60))).deep.eq({x: -1, y: 0});
    expect(inward(trackCell(90))).deep.eq({x: 0, y: -1});
    expect(inward(trackCell(0))).deep.eq({x: 1, y: -1});
  });

  it('puts each player on their rating, side by side where they share a step', () => {
    const markers = trackMarkers([
      {color: 'red', name: 'Red', terraformRating: 20},
      {color: 'green', name: 'Green', terraformRating: 23},
      {color: 'blue', name: 'Blue', terraformRating: 20},
      {color: 'yellow', name: 'Yellow', terraformRating: 120},
    ]);
    expect(markers.map((marker) => [marker.color, marker.cell.step, marker.place])).deep.eq([
      ['red', 20, 0],
      ['green', 23, 0],
      ['blue', 20, 1],
      ['yellow', 20, 2],
    ]);
  });

  it('ranks the players best first, a shared rating sharing its place', () => {
    const standings = trackStandings([
      {color: 'red', name: 'Red', terraformRating: 23},
      {color: 'green', name: 'Green', terraformRating: 27},
      {color: 'blue', name: 'Blue', terraformRating: 23},
    ]);
    expect(standings.map((player) => [player.name, player.place])).deep.eq([['Green', 1], ['Red', 2], ['Blue', 2]]);
  });

  it('prints Terraformer\'s 26 with Turmoil', () => {
    expect(medalArt('Terraformer', false)).eq('url("assets/ma/terraformer.png")');
    expect(medalArt('Terraformer', true)).eq('url("assets/ma/terraformer26.png")');
    expect(medalArt('Cosmic Settler', true)).eq('url("assets/ma/cosmic-settler.png")');
  });

  it('draws an element where it started, scaled by one number', () => {
    const small = {left: 20, top: 400, width: 100, height: 60};
    const large = {left: 0, top: 100, width: 400, height: 400};
    const frame = flipFrame(small, large);
    // A quarter of the width, its centre (200, 300) moved onto the small box's (70, 430).
    expect(frame?.transform).eq('translate(20px, 280px) scale(0.25)');
    // 60px of height at a quarter is 240 of the 400 laid out, so 80 are clipped above and below.
    expect(frame?.clipPath).eq('inset(80px 0px 80px 0px)');
  });

  it('lines up the part that has to match, rather than the whole', () => {
    const window = {left: 16, top: 19, width: 382, height: 341};
    const pane = {left: 0, top: 0, width: 414, height: 634};
    const stageInWindow = {left: 16, top: 19, width: 382, height: 341};
    const stageInPane = {left: 0, top: 132, width: 414, height: 370};
    const frame = flipFrame(window, pane, {first: stageInWindow, last: stageInPane});
    const scale = 382 / 414;
    expect(frame?.transform).match(new RegExp(`scale\\(${Math.round(scale * 10000) / 10000}\\)$`));
    // Nothing of the window is lost at the start: only the pane's letterbox is clipped.
    expect(frame?.clipPath).match(/^inset\([\d.]+px 0px [\d.]+px 0px\)$/);
  });

  it('has nothing to play for a box with no size, as in a pane off screen', () => {
    const none = {left: 0, top: 0, width: 0, height: 0};
    expect(flipFrame(none, {left: 0, top: 0, width: 400, height: 400})).is.undefined;
  });
});
