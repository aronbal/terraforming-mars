import {expect} from 'chai';
import {GlobalParameter} from '@/common/GlobalParameter';
import {TileType} from '@/common/TileType';
import {LogEffect} from '@/common/logs/LogEffect';
import {addLogEffect, summarizeLogEffects, toLogTileKind} from '@/common/logs/logEffects';

const temperature = (steps: number): LogEffect => ({type: 'global', parameter: GlobalParameter.TEMPERATURE, steps});
const oxygen = (steps: number): LogEffect => ({type: 'global', parameter: GlobalParameter.OXYGEN, steps});
const venus = (steps: number): LogEffect => ({type: 'global', parameter: GlobalParameter.VENUS, steps});
const tile = (kind: 'ocean' | 'greenery' | 'city' | 'special', count = 1): LogEffect => ({type: 'tile', tile: kind, count});
const tr = (steps: number): LogEffect => ({type: 'tr', steps});

describe('logEffects', () => {
  it('summarizes nothing as undefined', () => {
    expect(summarizeLogEffects(undefined)).is.undefined;
    expect(summarizeLogEffects([])).is.undefined;
  });

  it('summarizes the effects of common actions', () => {
    expect(summarizeLogEffects([tr(1), temperature(1), tile('ocean'), tr(1)])).eq('+1 temp · ocean');
    expect(summarizeLogEffects([tr(1), oxygen(1), tile('greenery')])).eq('+1 oxygen · greenery');
    expect(summarizeLogEffects([tr(1)])).eq('+1 TR');
    expect(summarizeLogEffects([tile('ocean'), tr(1), tile('ocean'), tr(1)])).eq('2 oceans');
    expect(summarizeLogEffects([tile('city')])).eq('city');
  });

  it('merges duplicates', () => {
    expect(summarizeLogEffects([temperature(1), temperature(1), tr(2)])).eq('+2 temp');
    expect(summarizeLogEffects([oxygen(1), tile('greenery'), oxygen(1), tile('greenery'), tr(2)])).eq('+2 oxygen · 2 greeneries');
    expect(summarizeLogEffects([tile('city'), tile('city', 2)])).eq('3 cities');
    expect(summarizeLogEffects([tile('special'), tile('special')])).eq('2 special tiles');
  });

  it('orders globals, then tiles, then TR', () => {
    expect(summarizeLogEffects([tr(5), tile('special'), tile('city'), venus(1), tile('greenery'), tile('ocean'), oxygen(1), temperature(1)]))
      .eq('+1 temp · +1 oxygen · +1 Venus · ocean · greenery · city · special tile · +5 TR');
  });

  it('shows TR only when it differs from what the raises imply', () => {
    // Raising Venus to 14% grants a bonus TR.
    expect(summarizeLogEffects([venus(1), tr(2)])).eq('+1 Venus · +2 TR');
    // No TR from a raise, e.g. during the solar phase.
    expect(summarizeLogEffects([temperature(1)])).eq('+1 temp');
    expect(summarizeLogEffects([tr(-1)])).eq('-1 TR');
    expect(summarizeLogEffects([tile('city'), tr(1)])).eq('city · +1 TR');
  });

  it('shows decreases', () => {
    expect(summarizeLogEffects([temperature(-1)])).eq('-1 temp');
    expect(summarizeLogEffects([venus(-1), tr(1)])).eq('-1 Venus · +1 TR');
  });

  it('drops effects that cancel out', () => {
    expect(summarizeLogEffects([tr(1), tr(-1)])).is.undefined;
  });

  it('addLogEffect merges in place', () => {
    const effects: Array<LogEffect> = [];
    addLogEffect(effects, tr(1));
    addLogEffect(effects, temperature(1));
    addLogEffect(effects, tr(1));
    addLogEffect(effects, tile('ocean'));
    addLogEffect(effects, tr(0));
    expect(effects).deep.eq([tr(2), temperature(1), tile('ocean')]);

    addLogEffect(effects, tr(-2));
    expect(effects).deep.eq([temperature(1), tile('ocean')]);
  });

  it('addLogEffect does not share objects with its input', () => {
    const effects: Array<LogEffect> = [];
    const effect = tr(1);
    addLogEffect(effects, effect);
    addLogEffect(effects, tr(1));
    expect(effect).deep.eq(tr(1));
  });

  it('toLogTileKind', () => {
    expect(toLogTileKind(TileType.OCEAN)).eq('ocean');
    expect(toLogTileKind(TileType.GREENERY)).eq('greenery');
    expect(toLogTileKind(TileType.CITY)).eq('city');
    expect(toLogTileKind(TileType.CAPITAL)).eq('city');
    expect(toLogTileKind(TileType.OCEAN_CITY)).eq('city');
    expect(toLogTileKind(TileType.WETLANDS)).eq('special');
    expect(toLogTileKind(TileType.NATURAL_PRESERVE)).eq('special');
    expect(toLogTileKind(TileType.EROSION_MILD)).is.undefined;
    expect(toLogTileKind(TileType.DUST_STORM_SEVERE)).is.undefined;
  });
});
