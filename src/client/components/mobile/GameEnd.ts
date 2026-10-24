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

export type ScorePart = {
  key: string;
  label: string;
  points: number;
};

/** What a player's score is made of, largest source first, leaving out what gave nothing. */
export function scoreParts(player: PublicPlayerModel): Array<ScorePart> {
  const vp = player.victoryPointsBreakdown;
  const parts: Array<ScorePart> = [
    {key: 'tr', label: 'TR', points: vp.terraformRating},
    {key: 'milestones', label: 'Milestones', points: vp.milestones},
    {key: 'awards', label: 'Awards', points: vp.awards},
    {key: 'greenery', label: 'Greeneries', points: vp.greenery},
    {key: 'city', label: 'Cities', points: vp.city},
    {key: 'cards', label: 'Cards', points: vp.victoryPoints},
    {key: 'moon', label: 'The Moon', points: vp.moonHabitats + vp.moonMines + vp.moonRoads},
    {key: 'tracks', label: 'Planetary tracks', points: vp.planetaryTracks},
    {key: 'escape', label: 'Escape Velocity', points: vp.escapeVelocity},
  ];
  return parts.filter((part) => part.points !== 0).sort((a, b) => b.points - a.points);
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
