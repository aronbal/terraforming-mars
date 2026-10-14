import {GlobalParameter} from '../GlobalParameter';

/** The global parameters a `LogEffect` records. Oceans are recorded as tiles. */
export type LogEffectGlobalParameter = GlobalParameter.TEMPERATURE | GlobalParameter.OXYGEN | GlobalParameter.VENUS;

/** The coarse kinds of Mars tile a `LogEffect` records. Hazards are not recorded. */
export const LOG_TILE_KINDS = ['ocean', 'greenery', 'city', 'special'] as const;
export type LogTileKind = typeof LOG_TILE_KINDS[number];

/**
 * A structured effect of the player action a log message reports.
 *
 * See `docs/log-effects.md` for which actions record effects and how they are attributed.
 */
export type LogEffect = {
  type: 'global',
  parameter: LogEffectGlobalParameter,
  /** Steps on the parameter's track (one temperature step is 2°C, one Venus step is 2%). Negative for a decrease. */
  steps: number,
} | {
  type: 'tile',
  tile: LogTileKind,
  count: number,
} | {
  /** A change to the terraform rating of the player taking the action. */
  type: 'tr',
  steps: number,
};
