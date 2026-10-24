import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

/*
 * The arithmetic behind the mobile results page: who placed where, what each score
 * is made of, and the lines of the points chart.
 */

/** The players best first: most points, then most M€, as the rules break a tie. */
export function standings(players: ReadonlyArray<PublicPlayerModel>): Array<PublicPlayerModel> {
  return players.toSorted((a, b) =>
    (b.victoryPointsBreakdown.total - a.victoryPointsBreakdown.total) || (b.megacredits - a.megacredits));
}

/** Everyone who shares first place. */
export function winners(players: ReadonlyArray<PublicPlayerModel>): Array<PublicPlayerModel> {
  const [first, ...rest] = standings(players);
  if (first === undefined) {
    return [];
  }
  const same = (p: PublicPlayerModel) =>
    p.victoryPointsBreakdown.total === first.victoryPointsBreakdown.total && p.megacredits === first.megacredits;
  return [first, ...rest.filter(same)];
}

/** The sources of points the results compare, in the order the score sheet lists them. */
const CATEGORIES: ReadonlyArray<{key: string, label: string, points: (vp: PublicPlayerModel['victoryPointsBreakdown']) => number}> = [
  {key: 'tr', label: 'TR', points: (vp) => vp.terraformRating},
  {key: 'milestones', label: 'Milestones', points: (vp) => vp.milestones},
  {key: 'awards', label: 'Awards', points: (vp) => vp.awards},
  {key: 'greenery', label: 'Greeneries', points: (vp) => vp.greenery},
  {key: 'city', label: 'Cities', points: (vp) => vp.city},
  {key: 'cards', label: 'Cards', points: (vp) => vp.victoryPoints},
  {key: 'moon', label: 'The Moon', points: (vp) => vp.moonHabitats + vp.moonMines + vp.moonRoads},
  {key: 'tracks', label: 'Planetary tracks', points: (vp) => vp.planetaryTracks},
  {key: 'escape', label: 'Escape Velocity', points: (vp) => vp.escapeVelocity},
];

export type CategoryScore = {
  color: Color;
  points: number;
  /** Whether no one scored more here. */
  leading: boolean;
};

export type Category = {
  key: string;
  label: string;
  /** One per player, in the order given. */
  scores: Array<CategoryScore>;
  /** The sole leader, or undefined on a tie for the most. */
  leader: Color | undefined;
  /** How far the leader is ahead of the next best. */
  margin: number;
};

/**
 * Every source of points side by side, one entry per category anyone scored in, with
 * who led it and by how much.
 */
export function categories(players: ReadonlyArray<PublicPlayerModel>): Array<Category> {
  return CATEGORIES.flatMap((category) => {
    const points = players.map((player) => category.points(player.victoryPointsBreakdown));
    if (points.every((p) => p === 0)) {
      return [];
    }
    const best = Math.max(...points);
    const next = Math.max(...points.toSorted((a, b) => b - a).slice(1), -Infinity);
    const leaders = players.filter((_, index) => points[index] === best);
    return [{
      key: category.key,
      label: category.label,
      scores: players.map((player, index) => ({color: player.color, points: points[index], leading: points[index] === best})),
      leader: leaders.length === 1 ? leaders[0].color : undefined,
      margin: leaders.length === 1 && next !== -Infinity ? best - next : 0,
    }];
  });
}

/** The chart's drawing box, in SVG units. */
export const CHART = {width: 320, height: 160, left: 28, right: 28, top: 10, bottom: 22};

/** A round step for the chart's horizontal lines, about four of them up to `max`. */
export function chartStep(max: number): number {
  for (const step of [5, 10, 20, 25, 50, 100]) {
    if (max / step <= 4) {
      return step;
    }
  }
  return 200;
}

/** The SVG points of one player's score, generation by generation, against the shared `max`. */
export function chartPoints(scores: ReadonlyArray<number>, generations: number, max: number): string {
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const span = Math.max(1, generations - 1);
  return scores.map((score, index) => {
    const x = CHART.left + plotWidth * index / span;
    const y = CHART.top + plotHeight * (1 - score / Math.max(1, max));
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
}
