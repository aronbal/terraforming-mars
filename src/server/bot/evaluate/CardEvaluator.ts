import {ICard, isIActionCard} from '../../cards/ICard';
import {IProjectCard} from '../../cards/IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Behavior} from '../../behavior/Behavior';
import {Counter} from '../../behavior/Counter';
import {Countable} from '../../behavior/Countable';
import {CardType} from '../../../common/cards/CardType';
import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {Units} from '../../../common/Units';
import {BotProfile, weightsOf} from '../BotProfile';
import {Tempo, ValueWeights, VP_VALUE, cardDrawValue, productionValues, stockValues, terraformRatingValue} from './Values';
import {BoardOutlook} from './BoardOutlook';

/** What the bot assumes an unremarkable tile placement is worth in bonuses. */
const TILE_PLACEMENT_VALUE = 2.5;

/**
 * Scores project, corporation and prelude cards in megacredits.
 *
 * Most cards in this codebase declare what they do through the `behavior` DSL,
 * so the bulk of the work here is walking that structure. Cards with bespoke
 * `play()` overrides are invisible to it; those fall back to their tags, VPs
 * and a small allowance so the bot does not treat them as worthless.
 */
export class CardEvaluator {
  constructor(
    private readonly player: IPlayer,
    private readonly profile: BotProfile,
    private readonly tempo: Tempo,
    private readonly outlook: BoardOutlook) {
    this.weights = weightsOf(profile);
  }

  private readonly weights: ValueWeights;

  /**
   * Value of putting `card` into play, ignoring what it costs.
   *
   * Never throws: an unrecognised card is worth its tags and points rather
   * than aborting the bot's turn.
   */
  public valueOfPlaying(card: ICard): number {
    try {
      return this.behaviorValue(card) +
        this.victoryPointValue(card) +
        this.synergyValue(card) +
        this.repeatableActionValue(card);
    } catch (err) {
      return this.victoryPointValue(card);
    }
  }

  /** Value of playing `card` now, net of the megacredits it takes to do so. */
  public valueOfBuying(card: IProjectCard): number {
    return this.valueOfPlaying(card) - this.player.getCardCost(card);
  }

  private counterFor(card: ICard): Counter {
    return new Counter(this.player, card);
  }

  private count(card: ICard, countable: Countable): number {
    try {
      return this.counterFor(card).count(countable);
    } catch (err) {
      return typeof countable === 'number' ? countable : 1;
    }
  }

  private countUnits(card: ICard, units: Partial<Record<keyof Units, unknown>>): Units {
    try {
      return this.counterFor(card).countUnits(units as never);
    } catch (err) {
      return Units.EMPTY;
    }
  }

  private valueOfUnits(units: Units, values: Record<Resource, number>): number {
    return units.megacredits * values.megacredits +
      units.steel * values.steel +
      units.titanium * values.titanium +
      units.plants * values.plants +
      units.energy * values.energy +
      units.heat * values.heat;
  }

  private behaviorValue(card: ICard): number {
    const behavior = card.behavior;
    if (behavior === undefined) {
      // Cards driven by a play() override still tell us something through
      // their type: an automated card that does nothing measurable is rare.
      return card.type === CardType.EVENT ? 3 : 4;
    }
    return this.valueOfBehavior(card, behavior);
  }

  private valueOfBehavior(card: ICard, behavior: Behavior): number {
    const stock = stockValues(this.player, this.tempo, this.weights);
    const production = productionValues(this.player, this.tempo, this.weights);
    const trValue = terraformRatingValue(this.tempo, this.weights);
    let value = 0;

    if (behavior.or !== undefined) {
      // The bot gets to pick, so an "or" is worth its best branch.
      const branches = behavior.or.behaviors ?? [];
      const best = branches
        .map((branch) => this.valueOfBehavior(card, branch))
        .reduce((a, b) => Math.max(a, b), 0);
      value += best;
    }

    if (behavior.production !== undefined) {
      value += this.valueOfUnits(this.countUnits(card, behavior.production), production);
    }
    if (behavior.stock !== undefined) {
      value += this.valueOfUnits(this.countUnits(card, behavior.stock), stock);
    }
    const lostProduction = behavior.lose?.production;
    if (lostProduction !== undefined && lostProduction !== null) {
      value -= this.valueOfUnits(this.countUnits(card, lostProduction), production);
    }
    const lostStock = behavior.lose?.stock;
    if (lostStock !== undefined && lostStock !== null) {
      value -= this.valueOfUnits(this.countUnits(card, lostStock), stock);
    }
    if (behavior.spend !== undefined) {
      value -= this.valueOfSpend(behavior.spend, stock);
    }

    if (behavior.tr !== undefined) {
      value += this.count(card, behavior.tr) * trValue;
    }
    if (behavior.global !== undefined) {
      const steps = Math.abs(behavior.global.temperature ?? 0) +
        Math.abs(behavior.global.oxygen ?? 0) +
        Math.abs(behavior.global.venus ?? 0);
      const sign = (behavior.global.temperature ?? behavior.global.oxygen ?? behavior.global.venus ?? 0) < 0 ? -1 : 1;
      value += sign * steps * trValue;
    }
    if (behavior.ocean !== undefined) {
      const count = behavior.ocean.count ?? 1;
      value += count * (trValue + TILE_PLACEMENT_VALUE);
    }
    if (behavior.greenery !== undefined) {
      // A greenery beside one of the player's own cities scores twice: once
      // for itself, once for the city.
      value += VP_VALUE + trValue + TILE_PLACEMENT_VALUE + this.outlook.greeneryAdjacencyBonus();
    }
    if (behavior.city !== undefined) {
      // A city is worth the points of the greeneries that end up beside it,
      // which depends on the board and on this player's plant engine.
      value += this.outlook.valueOfNextCity() + TILE_PLACEMENT_VALUE;
    }
    if (behavior.tile !== undefined) {
      value += TILE_PLACEMENT_VALUE;
    }

    if (behavior.drawCard !== undefined) {
      const count = typeof behavior.drawCard === 'number' ? behavior.drawCard : (behavior.drawCard.count ?? 1);
      const resolved = typeof count === 'number' ? count : this.count(card, count);
      value += resolved * cardDrawValue(this.tempo);
    }
    if (behavior.standardResource !== undefined) {
      const count = typeof behavior.standardResource === 'number' ?
        behavior.standardResource :
        behavior.standardResource.count;
      value += count * 1.6;
    }

    if (behavior.addResources !== undefined) {
      value += this.count(card, behavior.addResources) * 1.8;
    }
    if (behavior.addResourcesToAnyCard !== undefined) {
      const entries = Array.isArray(behavior.addResourcesToAnyCard) ?
        behavior.addResourcesToAnyCard :
        [behavior.addResourcesToAnyCard];
      for (const entry of entries) {
        value += this.count(card, entry.count ?? 1) * 1.8;
      }
    }
    if (behavior.removeResourcesFromAnyCard !== undefined) {
      const count = behavior.removeResourcesFromAnyCard.count ?? 1;
      value += this.count(card, count) * 1.4;
    }

    if (behavior.decreaseAnyProduction !== undefined) {
      const resource = behavior.decreaseAnyProduction.type;
      const count = behavior.decreaseAnyProduction.count;
      value += count * (production[resource] ?? 2) * 0.7;
    }
    if (behavior.removeAnyPlants !== undefined) {
      value += behavior.removeAnyPlants * stock.plants * 0.7;
    }

    if (behavior.titanumValue !== undefined) {
      value += this.tempo.remainingGenerations * 0.9;
    }
    if (behavior.steelValue !== undefined) {
      value += this.tempo.remainingGenerations * 0.9;
    }
    if (behavior.greeneryDiscount !== undefined) {
      value += stock.plants * behavior.greeneryDiscount * 2;
    }

    if (behavior.colonies !== undefined) {
      if (behavior.colonies.buildColony !== undefined) {
        value += 8;
      }
      value += (behavior.colonies.addTradeFleet ?? 0) * 6;
      value += (behavior.colonies.tradeDiscount ?? 0) * 2;
      value += (behavior.colonies.tradeOffset ?? 0) * 2;
    }
    if (behavior.turmoil !== undefined) {
      if (behavior.turmoil.influenceBonus !== undefined) {
        value += 3;
      }
      if (behavior.turmoil.sendDelegates !== undefined) {
        value += this.count(card, behavior.turmoil.sendDelegates.count) * 3;
      }
    }
    if (behavior.moon !== undefined) {
      const moon = behavior.moon;
      if (moon.habitatTile !== undefined || moon.mineTile !== undefined || moon.roadTile !== undefined) {
        value += trValue + TILE_PLACEMENT_VALUE;
      }
      value += ((moon.habitatRate ?? 0) + (moon.miningRate ?? 0) + (moon.logisticRate ?? 0)) * trValue;
    }
    if (behavior.underworld !== undefined) {
      const underworld = behavior.underworld;
      if (underworld.identify !== undefined) {
        const count = typeof underworld.identify === 'number' ? underworld.identify : underworld.identify.count;
        value += count * 1.2;
      }
      if (underworld.excavate !== undefined) {
        const excavate = underworld.excavate;
        const count = typeof excavate === 'number' ? excavate : this.count(card, excavate.count);
        value += count * 3;
      }
      if (underworld.corruption !== undefined) {
        value += this.count(card, underworld.corruption) * 2.5;
      }
    }

    return value;
  }

  private valueOfSpend(spend: NonNullable<Behavior['spend']>, stock: Record<Resource, number>): number {
    let cost = 0;
    cost += (spend.megacredits ?? 0) * stock.megacredits;
    cost += (spend.steel ?? 0) * stock.steel;
    cost += (spend.titanium ?? 0) * stock.titanium;
    cost += (spend.plants ?? 0) * stock.plants;
    cost += (spend.energy ?? 0) * stock.energy;
    cost += (spend.heat ?? 0) * stock.heat;
    cost += (spend.resourcesHere ?? 0) * 1.8;
    cost += (spend.corruption ?? 0) * 2.5;
    cost += (spend.cards ?? 0) * cardDrawValue(this.tempo);
    if (spend.resourceFromAnyCard !== undefined && spend.resourceFromAnyCard !== null) {
      cost += 1.8;
    }
    return cost;
  }

  private victoryPointValue(card: ICard): number {
    const vp = card.victoryPoints;
    if (vp === undefined) {
      return 0;
    }
    if (typeof vp === 'number') {
      return vp * VP_VALUE;
    }
    if (vp === 'special') {
      // Bespoke scoring, usually worth a couple of points by the end.
      return 2 * VP_VALUE;
    }
    try {
      const scored = this.counterFor(card).count(vp as Countable, 'vps');
      // Countable points grow as the card accumulates whatever it counts.
      return Math.max(scored, 1) * VP_VALUE * 1.25;
    } catch (err) {
      return VP_VALUE;
    }
  }

  /** Extra value for tags the player is already invested in. */
  private synergyValue(card: ICard): number {
    if (this.profile.valuesSynergy === false) {
      return 0;
    }
    let value = 0;
    for (const tag of card.tags) {
      if (tag === Tag.WILD) {
        value += 3;
        continue;
      }
      if (tag === Tag.EVENT) {
        continue;
      }
      const owned = this.player.tags.count(tag, 'raw');
      value += Math.min(owned, 6) * 0.6;
    }
    return value;
  }

  /** A blue card's action pays out once per generation for the rest of the game. */
  private repeatableActionValue(card: ICard): number {
    if (card.type !== CardType.ACTIVE || !isIActionCard(card)) {
      return 0;
    }
    return 3 * this.tempo.remainingGenerations * 0.6;
  }
}
