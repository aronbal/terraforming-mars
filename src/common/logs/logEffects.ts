import {GlobalParameter} from '../GlobalParameter';
import {HAZARD_TILES, TileType} from '../TileType';
import {LOG_TILE_KINDS, LogEffect, LogEffectGlobalParameter, LogTileKind} from './LogEffect';

type GlobalEffect = Extract<LogEffect, {type: 'global'}>;
type TileEffect = Extract<LogEffect, {type: 'tile'}>;
type TrEffect = Extract<LogEffect, {type: 'tr'}>;

const GLOBAL_PARAMETER_ORDER: ReadonlyArray<LogEffectGlobalParameter> = [
  GlobalParameter.TEMPERATURE,
  GlobalParameter.OXYGEN,
  GlobalParameter.VENUS,
];

const GLOBAL_PARAMETER_LABELS: Readonly<Record<LogEffectGlobalParameter, string>> = {
  [GlobalParameter.TEMPERATURE]: 'temp',
  [GlobalParameter.OXYGEN]: 'oxygen',
  [GlobalParameter.VENUS]: 'Venus',
};

/** Singular and plural labels for each tile kind. */
const TILE_LABELS: Readonly<Record<LogTileKind, readonly [string, string]>> = {
  ocean: ['ocean', 'oceans'],
  greenery: ['greenery', 'greeneries'],
  city: ['city', 'cities'],
  special: ['special tile', 'special tiles'],
};

/** Returns the coarse kind `tileType` is recorded as, or `undefined` for tiles that are not recorded (hazards). */
export function toLogTileKind(tileType: TileType): LogTileKind | undefined {
  if (HAZARD_TILES.has(tileType)) {
    return undefined;
  }
  switch (tileType) {
  case TileType.OCEAN:
    return 'ocean';
  case TileType.GREENERY:
    return 'greenery';
  case TileType.CITY:
  case TileType.CAPITAL:
  case TileType.OCEAN_CITY:
  case TileType.RED_CITY:
  case TileType.NEW_HOLLAND:
    return 'city';
  default:
    return 'special';
  }
}

function sameKind(a: LogEffect, b: LogEffect): boolean {
  switch (a.type) {
  case 'global':
    return b.type === 'global' && a.parameter === b.parameter;
  case 'tile':
    return b.type === 'tile' && a.tile === b.tile;
  case 'tr':
    return b.type === 'tr';
  }
}

function amount(effect: LogEffect): number {
  return effect.type === 'tile' ? effect.count : effect.steps;
}

function withAmount(effect: LogEffect, value: number): LogEffect {
  return effect.type === 'tile' ? {...effect, count: value} : {...effect, steps: value};
}

/**
 * Adds `effect` to `effects` in place, merging it into the entry of the same kind.
 *
 * Entries whose amounts cancel out are removed, and effects with no amount are ignored.
 */
export function addLogEffect(effects: Array<LogEffect>, effect: LogEffect): void {
  const index = effects.findIndex((existing) => sameKind(existing, effect));
  if (index === -1) {
    if (amount(effect) !== 0) {
      effects.push({...effect});
    }
    return;
  }
  const total = amount(effects[index]) + amount(effect);
  if (total === 0) {
    effects.splice(index, 1);
  } else {
    effects[index] = withAmount(effects[index], total);
  }
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/**
 * Renders `effects` as a compact English summary, e.g. `+1 temp · ocean`.
 *
 * Parts are merged by kind and ordered global parameters (temperature, oxygen, Venus), then tiles
 * (ocean, greenery, city, special), then TR. TR is left out when it equals what the listed raises
 * normally give (1 per raised step and per ocean), since it adds nothing then. Returns `undefined`
 * when there is nothing to show.
 */
export function summarizeLogEffects(effects: ReadonlyArray<LogEffect> | undefined): string | undefined {
  if (effects === undefined || effects.length === 0) {
    return undefined;
  }
  const merged: Array<LogEffect> = [];
  for (const effect of effects) {
    addLogEffect(merged, effect);
  }

  const parts: Array<string> = [];
  let impliedTr = 0;
  for (const parameter of GLOBAL_PARAMETER_ORDER) {
    const steps = merged.find((e): e is GlobalEffect => e.type === 'global' && e.parameter === parameter)?.steps;
    if (steps !== undefined) {
      parts.push(`${signed(steps)} ${GLOBAL_PARAMETER_LABELS[parameter]}`);
      impliedTr += Math.max(steps, 0);
    }
  }
  for (const tile of LOG_TILE_KINDS) {
    const count = merged.find((e): e is TileEffect => e.type === 'tile' && e.tile === tile)?.count ?? 0;
    if (count > 0) {
      const [singular, plural] = TILE_LABELS[tile];
      parts.push(count === 1 ? singular : `${count} ${plural}`);
      if (tile === 'ocean') {
        impliedTr += count;
      }
    }
  }
  const tr = merged.find((e): e is TrEffect => e.type === 'tr')?.steps;
  if (tr !== undefined && tr !== impliedTr) {
    parts.push(`${signed(tr)} TR`);
  }

  return parts.length > 0 ? parts.join(' · ') : undefined;
}
