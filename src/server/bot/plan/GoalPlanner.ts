import {IPlayer} from '../../IPlayer';
import {IProjectCard} from '../../cards/IProjectCard';
import {BotProfile} from '../BotProfile';
import {BotPersonality} from '../BotPersonality';
import {BotGoal, BotMemory, BotStats, NO_STATS} from '../BotMemory';
import {CardEvaluator} from '../evaluate/CardEvaluator';
import {Tempo, shiftTempo} from '../evaluate/Values';
import {Purse, PurseChange, etaFor, purseFor} from './Economy';
import {forecastRequirements} from './RequirementForecast';

/**
 * What a held savings goal means for one move.
 *
 * `adjustment` is the megacredit term the move's score gets for what it does
 * to the goal: a penalty when its spending pushes the goal back a generation,
 * a bonus when its income brings the goal forward, and nothing when it only
 * spends slack the goal does not need in time.
 */
export type GoalContext = {
  readonly card: IProjectCard;
  readonly purse: Purse;
  /** Generations until the goal can be played, as things stand. */
  readonly eta0: number;
  adjustment(spendInGoalTerms: number, gainNow: number, incomeDelta: number): number;
};

/**
 * Chooses a card to save for, and says what saving for it is worth.
 *
 * A static evaluator spends whatever it has on the best thing it can afford
 * now, so it never plays the expensive card it is holding: there is always
 * something cheaper to buy first. A goal is the bot's commitment to one such
 * card, kept between decisions in `BotMemory`, so that moves which would
 * push it back are charged for that.
 */
export class GoalPlanner {
  private readonly later = new Map<number, CardEvaluator>();

  constructor(
    private readonly player: IPlayer,
    private readonly profile: BotProfile,
    private readonly tempo: Tempo,
    private readonly personality: BotPersonality) {
  }

  private valueAt(card: IProjectCard, generations: number): number {
    let evaluator = this.later.get(generations);
    if (evaluator === undefined) {
      evaluator = new CardEvaluator(this.player, this.profile, shiftTempo(this.tempo, generations), this.personality);
      this.later.set(generations, evaluator);
    }
    return evaluator.valueOfPlaying(card);
  }

  /**
   * What `card` is worth net of its cost if it is played `eta` generations from now.
   *
   * Each generation of waiting keeps only `goalRisk` of the value, because
   * plans go wrong: the opponent takes the space, the game ends sooner.
   */
  public netAt(card: IProjectCard, eta: number): number {
    const {probability} = forecastRequirements(this.player, card);
    const risk = Math.pow(this.profile.planning.goalRisk, eta);
    return probability * risk * this.valueAt(card, eta) - this.player.getCardCost(card);
  }

  /** Generations until `card` can be played, after `change` to the purse. */
  public etaOf(card: IProjectCard, change?: PurseChange): number {
    const money = etaFor(this.player.getCardCost(card), purseFor(this.player, card, this.profile), change);
    return Math.max(money, forecastRequirements(this.player, card).eta);
  }

  /** The last generation a goal can still be played in, counting this one as 0. */
  private horizon(): number {
    return this.tempo.remainingGenerations - 1;
  }

  /**
   * Updates the goal in `memory` for the position as it stands.
   *
   * Returns the new memory, or `undefined` when nothing changed. A held goal
   * is dropped once played, discarded, too late or out of reach; a new one is
   * set only when a hand card is worth saving for, and replaces a held goal
   * only when clearly better, so the bot does not flip between plans.
   */
  public refresh(memory: BotMemory | undefined): BotMemory | undefined {
    const planning = this.profile.planning;
    const generation = this.player.game.generation;
    let goal = memory?.goal;
    let stats = memory?.stats ?? NO_STATS;
    const count = (key: keyof BotStats) => {
      stats = {...stats, [key]: stats[key] + 1};
    };

    let held: IProjectCard | undefined;
    let abandoned: IProjectCard | undefined;
    if (goal !== undefined) {
      const name = goal.card;
      held = this.player.cardsInHand.find((card) => card.name === name);
      if (held === undefined) {
        count(this.player.playedCards.has(name) ? 'goalsMet' : 'goalsAbandoned');
        goal = undefined;
      } else if (generation > goal.setGeneration + goal.eta + planning.goalMaxAgeSlack ||
          forecastRequirements(this.player, held).probability <= 0 ||
          this.etaOf(held) > this.horizon()) {
        count('goalsAbandoned');
        abandoned = held;
        goal = undefined;
        held = undefined;
      }
    }

    // A goal just given up on is not taken straight back up.
    const candidate = this.bestCandidate(abandoned);
    if (candidate !== undefined && candidate.card !== held) {
      const heldNet = held === undefined ? Number.NEGATIVE_INFINITY : this.netAt(held, this.etaOf(held));
      if (heldNet === Number.NEGATIVE_INFINITY || candidate.net > heldNet * (1 + planning.goalSwitchMargin)) {
        if (goal !== undefined) {
          count('goalsAbandoned');
        }
        goal = {card: candidate.card.name, setGeneration: generation, eta: candidate.eta, net: candidate.net};
        count('goalsSet');
      }
    }

    if (goal === memory?.goal && stats === (memory?.stats ?? NO_STATS)) {
      return undefined;
    }
    const next: BotMemory = {version: 1, stats};
    return goal === undefined ? next : {...next, goal};
  }

  /** The hand card most worth saving for, if any is. */
  private bestCandidate(excluded: IProjectCard | undefined): {card: IProjectCard, eta: number, net: number} | undefined {
    const planning = this.profile.planning;
    if (this.tempo.remainingGenerations <= 1) {
      return undefined;
    }
    let best: {card: IProjectCard, eta: number, net: number} | undefined;
    for (const card of this.player.cardsInHand) {
      if (card === excluded) {
        continue;
      }
      const eta = this.etaOf(card);
      // A card playable now needs no saving; the ordinary scoring handles it.
      if (eta < 1 || eta > planning.goalMaxEta || eta > this.horizon()) {
        continue;
      }
      const net = this.netAt(card, eta);
      if (net >= planning.goalMinNet && (best === undefined || net > best.net)) {
        best = {card, eta, net};
      }
    }
    return best;
  }

  /** What `memory`'s goal means for the moves on offer now, if there is a goal. */
  public context(memory: BotMemory | undefined): GoalContext | undefined {
    const goal: BotGoal | undefined = memory?.goal;
    if (goal === undefined) {
      return undefined;
    }
    const card = this.player.cardsInHand.find((candidate) => candidate.name === goal.card);
    if (card === undefined) {
      return undefined;
    }
    const purse = purseFor(this.player, card, this.profile);
    const eta0 = this.etaOf(card);
    const horizon = this.horizon();
    const planning = this.profile.planning;
    const nets = new Map<number, number>();
    const netAt = (eta: number) => {
      let net = nets.get(eta);
      if (net === undefined) {
        net = this.netAt(card, eta);
        nets.set(eta, net);
      }
      return net;
    };

    return {
      card,
      purse,
      eta0,
      adjustment: (spendNow, gainNow, incomeDelta) => {
        const eta1 = this.etaOf(card, {spendNow, gainNow, incomeDelta});
        if (eta1 > eta0) {
          const before = Math.max(0, netAt(eta0));
          if (eta1 > horizon) {
            return -planning.goalCommitment * before;
          }
          return -planning.goalCommitment * Math.max(0, before - netAt(eta1));
        }
        if (eta1 < eta0) {
          return planning.enablerWeight * Math.max(0, netAt(eta1) - netAt(eta0));
        }
        return 0;
      },
    };
  }

  /**
   * How many cards research may buy without delaying the goal.
   *
   * Only bites when the goal is affordable this generation: then the
   * megacredits it needs beyond the steel and titanium it can use are kept
   * back from research.
   */
  public researchLimit(memory: BotMemory | undefined, spendable: number, cardCost: number): number | undefined {
    const context = this.context(memory);
    if (context === undefined || context.eta0 > 0 || cardCost <= 0) {
      return undefined;
    }
    const cost = this.player.getCardCost(context.card);
    const fromOtherResources = context.purse.now - this.player.megaCredits;
    const needed = Math.max(0, cost - fromOtherResources);
    return Math.max(0, Math.floor((spendable - needed) / cardCost));
  }
}
