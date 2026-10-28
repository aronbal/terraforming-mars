import {IPlayer} from '../../IPlayer';
import {ICard} from '../../cards/ICard';
import {IProjectCard} from '../../cards/IProjectCard';
import {GlobalParameterRequirement} from '../../cards/requirements/GlobalParameterRequirement';
import {TagCardRequirement} from '../../cards/requirements/TagCardRequirement';
import {CardName} from '../../../common/cards/CardName';
import {GlobalParameter} from '../../../common/GlobalParameter';
import {asArray} from '../../../common/utils/utils';
import {GoalPlanner} from './GoalPlanner';
import {PARAMETERS, forecastRequirements, requirementsOf} from './RequirementForecast';

/** Steps a move raises each global parameter by. */
export type Raises = Partial<Record<GlobalParameter, number>>;

/** How many of the best other hand cards a move is checked against. */
const CARDS_CONSIDERED = 3;

/** Chance a discounted card in hand is actually played. */
const PLAY_PROBABILITY = 0.6;

/** The global parameters `card` raises when played, card or standard project. */
export function raisesOf(card: ICard): Raises {
  switch (card.name) {
  case CardName.ASTEROID_STANDARD_PROJECT:
    return {[GlobalParameter.TEMPERATURE]: 1};
  case CardName.AQUIFER_STANDARD_PROJECT:
    return {[GlobalParameter.OCEANS]: 1};
  case CardName.GREENERY_STANDARD_PROJECT:
    return {[GlobalParameter.OXYGEN]: 1};
  case CardName.AIR_SCRAPPING_STANDARD_PROJECT:
  case CardName.AIR_SCRAPPING_STANDARD_PROJECT_VARIANT:
    return {[GlobalParameter.VENUS]: 1};
  }
  const behavior = card.behavior;
  if (behavior === undefined) {
    return {};
  }
  const raises: Raises = {};
  const add = (parameter: GlobalParameter, steps: number) => {
    if (steps > 0) {
      raises[parameter] = (raises[parameter] ?? 0) + steps;
    }
  };
  add(GlobalParameter.TEMPERATURE, behavior.global?.temperature ?? 0);
  add(GlobalParameter.OXYGEN, behavior.global?.oxygen ?? 0);
  add(GlobalParameter.VENUS, behavior.global?.venus ?? 0);
  add(GlobalParameter.OCEANS, behavior.ocean === undefined ? 0 : behavior.ocean.count ?? 1);
  add(GlobalParameter.OXYGEN, behavior.greenery === undefined ? 0 : 1);
  return raises;
}

/**
 * Credits a move with what it does for the other cards in hand.
 *
 * The evaluator prices each card alone, so it cannot see that a cheap card
 * with an Earth discount makes the expensive Earth cards in hand cheaper, or
 * that raising the oxygen unlocks a held card that needs it, or that it shuts
 * one out for good. This adds those effects, without simulating anything,
 * for the few hand cards that matter most and the savings goal.
 */
export class Enablers {
  private cachedConsidered: ReadonlyArray<IProjectCard> | undefined;

  constructor(
    private readonly player: IPlayer,
    private readonly planner: GoalPlanner,
    private readonly weight: number,
    private readonly goal?: IProjectCard) {
  }

  /** The goal and the best few other hand cards, worked out once, when first needed. */
  private considered(): ReadonlyArray<IProjectCard> {
    if (this.cachedConsidered === undefined) {
      const ranked = this.player.cardsInHand
        .filter((card) => card !== this.goal)
        .map((card) => ({card, net: this.planner.netAt(card, this.planner.etaOf(card))}))
        .filter((entry) => entry.net > 0)
        .sort((a, b) => b.net - a.net)
        .slice(0, CARDS_CONSIDERED)
        .map((entry) => entry.card);
      this.cachedConsidered = this.goal === undefined ? ranked : [this.goal, ...ranked];
    }
    return this.cachedConsidered;
  }

  /** What playing `card` does for the other cards in hand, in megacredits. */
  public value(card: ICard): number {
    if (this.weight <= 0) {
      return 0;
    }
    return this.weight * (this.discountValue(card) + this.requirementValue(card));
  }

  private discountValue(card: ICard): number {
    let value = 0;
    for (const discount of asArray(card.cardDiscount ?? [])) {
      for (const other of this.player.cardsInHand) {
        if (other === card) {
          continue;
        }
        if (discount.tag === undefined) {
          value += discount.amount;
        } else {
          const tags = other.tags.filter((tag) => tag === discount.tag).length;
          value += discount.amount * (discount.per === 'tag' ? tags : Math.min(tags, 1));
        }
      }
    }
    return value * PLAY_PROBABILITY;
  }

  private requirementValue(card: ICard): number {
    const raises = raisesOf(card);
    let value = 0;
    for (const other of this.considered()) {
      if (other === card) {
        continue;
      }
      for (const requirement of requirementsOf(other)) {
        if (requirement instanceof GlobalParameterRequirement) {
          const parameter = PARAMETERS[requirement.type];
          const steps = parameter === undefined ? 0 : raises[parameter] ?? 0;
          if (steps <= 0) {
            continue;
          }
          const distance = requirement.distance(this.player);
          if (requirement.max) {
            const met = requirement.getScore(this.player) <= requirement.count;
            if (met && steps > distance) {
              value -= Math.max(0, this.planner.netAt(other, this.planner.etaOf(other)));
            }
          } else if (distance > 0 && steps >= distance) {
            value += this.unlockValue(other, requirement);
          }
        } else if (requirement instanceof TagCardRequirement && !requirement.max && !requirement.all) {
          const missing = requirement.count - requirement.getScore(this.player);
          const added = card.tags.filter((tag) => tag === requirement.tag).length;
          if (missing > 0 && added >= missing) {
            value += this.unlockValue(other, requirement);
          }
        }
      }
    }
    return value;
  }

  /** What meeting `requirement` now is worth for `card`. */
  private unlockValue(card: IProjectCard, requirement: GlobalParameterRequirement | TagCardRequirement): number {
    const before = this.planner.netAt(card, this.planner.etaOf(card));
    const after = forecastRequirements(this.player, card, requirement);
    const eta = Math.max(this.planner.moneyEta(card), after.eta);
    return Math.max(0, this.planner.netAt(card, eta, after.probability) - Math.max(0, before));
  }
}
