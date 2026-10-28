import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {Card} from '../../cards/Card';
import {isIStandardProjectCard} from '../../cards/IStandardProjectCard';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectCardToPlay} from '../../inputs/SelectCardToPlay';
import {CardName} from '../../../common/cards/CardName';
import {ActionAnnotation} from '../../../common/input/Annotation';
import {InputResponse} from '../../../common/inputs/InputResponse';
import {Payment} from '../../../common/inputs/Payment';
import {Units} from '../../../common/Units';
import {BotProfile} from '../BotProfile';
import {BotRandom} from '../BotRandom';
import {PlayableCard, paymentContextFor, planPaymentFor} from '../CardPayment';
import {planPayment} from '../PaymentPlanner';
import {ActionScorer, PASS_SCORE} from '../evaluate/ActionScorer';
import {canCloneSafely, cloneForLookahead} from './GameClone';
import {raisesOf} from './Enablers';
import {requirementsOf} from './RequirementForecast';
import {IProjectCard} from '../../cards/IProjectCard';
import {TagCardRequirement} from '../../cards/requirements/TagCardRequirement';

/** Most inputs a simulated move may raise before it is given up on. */
const MAX_STEPS = 40;

/**
 * What the bot expects to do next after each move on the menu.
 *
 * The scorer adds these to each move's own score, so a move is worth itself
 * plus a discounted share of the best move it leaves possible this turn.
 */
export type TurnPlan = {
  /** Bonuses for playing a card or standard project, by name. */
  readonly cards: ReadonlyMap<CardName, number>;
  /** Bonuses for the other menu entries, by the entry itself. */
  readonly options: ReadonlyMap<PlayerInput, number>;
};

/** Answers inputs for a player in a simulated game. */
export type Responder = {respond(input: PlayerInput): InputResponse};

/** What the planner needs from the bot that is planning. */
export type PlannerContext = {
  readonly player: IPlayer;
  readonly profile: BotProfile;
  readonly random: BotRandom;
  /** The scorer for the real position. */
  readonly scorer: ActionScorer;
  /** A scorer for `player` in a simulated position. */
  scorerFor(player: IPlayer): ActionScorer;
  /** A bot that answers for `player` in a simulated position, without planning ahead itself. */
  responderFor(player: IPlayer, random: BotRandom): Responder;
};

type Candidate = {
  readonly index: number;
  readonly option: PlayerInput;
  readonly card?: PlayableCard;
  readonly staticScore: number;
  /** What the move spends, kept back when pricing what could follow it without simulating. */
  readonly spend: Units;
  readonly simulate: boolean;
};

function annotationOf(option: PlayerInput): ActionAnnotation | undefined {
  return option.annotation as ActionAnnotation | undefined;
}

function unitsOf(payment: Payment): Units {
  return Units.of({
    megacredits: payment.megacredits,
    steel: payment.steel,
    titanium: payment.titanium,
    plants: payment.plants,
    heat: payment.heat,
  });
}

/**
 * True for a card the planner may play out on a copy of the game.
 *
 * A card that draws or reveals cards would show the bot the real deck, so it
 * is never simulated; nor is a card whose effect is bespoke code, which is
 * where surprises live. Standard projects are plain code but deterministic.
 */
function simulatable(card: PlayableCard): boolean {
  if (isIStandardProjectCard(card)) {
    return card.name !== CardName.SELL_PATENTS_STANDARD_PROJECT;
  }
  const behavior = card.behavior;
  if (behavior === undefined || behavior.drawCard !== undefined || behavior.spend?.cards !== undefined) {
    return false;
  }
  return card instanceof Card && card.bespokePlay === Card.prototype.bespokePlay;
}

/**
 * True when playing `card` could make another card in `hand` possible this turn.
 *
 * That is: it gains resources now, makes cards cheaper, raises a global
 * parameter, or carries a tag a card in hand still needs.
 */
function mayEnable(card: PlayableCard, hand: ReadonlyArray<IProjectCard>): boolean {
  const behavior = card.behavior;
  if (behavior?.stock !== undefined || card.cardDiscount !== undefined || Object.keys(raisesOf(card)).length > 0) {
    return true;
  }
  return hand.some((other) => other !== card && requirementsOf(other).some((requirement) =>
    requirement instanceof TagCardRequirement && !requirement.max && card.tags.includes(requirement.tag)));
}

/**
 * Chooses the first action of a turn with the second in view.
 *
 * A static evaluator takes the best single action twice, so it does not see
 * that a cheap card can make an expensive one possible: a discount, a
 * requirement met, a milestone reached. For the few best moves on the menu,
 * this plays the move out on a copy of the game, as far as the next action
 * menu, and asks what the best follow-up is worth there. Moves it does not
 * simulate are credited with the best follow-up they leave affordable.
 *
 * Only the cards the bot already holds count as follow-ups, so a card drawn
 * in the copy cannot leak the real deck into the decision.
 */
export class TurnPlanner {
  constructor(private readonly context: PlannerContext) {}

  /** The plan for `menu`, or `undefined` when the bot should not plan here. */
  public plan(menu: OrOptions): TurnPlan | undefined {
    const {player, profile} = this.context;
    const planning = profile.planning;
    if (planning.lookahead <= 0 || planning.lookaheadBudgetMs <= 0) {
      return undefined;
    }
    if (menu !== player.getWaitingFor() || !canCloneSafely(player.game, player) || !this.hasAnotherAction()) {
      return undefined;
    }

    const candidates = this.candidates(menu);
    const started = performance.now();
    const followUps = new Map<Candidate, number>();
    const toSimulate = this.chooseToSimulate(candidates, planning.lookahead);
    for (const candidate of toSimulate) {
      if (performance.now() - started > planning.lookaheadBudgetMs) {
        break;
      }
      const followUp = this.simulate(menu, candidate);
      if (followUp !== undefined) {
        followUps.set(candidate, followUp);
      }
    }

    const cards = new Map<CardName, number>();
    const options = new Map<PlayerInput, number>();
    for (const candidate of candidates) {
      const followUp = followUps.get(candidate) ?? this.followUpWithout(candidate, candidates);
      const bonus = planning.lookaheadDiscount * followUp;
      if (candidate.card !== undefined) {
        cards.set(candidate.card.name, bonus);
      } else {
        options.set(candidate.option, bonus);
      }
    }
    return {cards, options};
  }

  /**
   * The moves worth simulating, at most `count` of them.
   *
   * Half go to the best moves by their own score. The rest go to cards in hand
   * that could change what is possible next, ranked the same way: the move
   * that opens up the turn is often weak on its own, so the best moves alone
   * would rarely include it.
   */
  private chooseToSimulate(candidates: ReadonlyArray<Candidate>, count: number): Array<Candidate> {
    const ranked = candidates
      .filter((candidate) => candidate.simulate)
      .sort((a, b) => b.staticScore - a.staticScore);
    const chosen = ranked.slice(0, Math.ceil(count / 2));
    const hand = this.context.player.cardsInHand;
    for (const candidate of ranked) {
      if (chosen.length >= count) {
        break;
      }
      const card = candidate.card;
      if (!chosen.includes(candidate) && card !== undefined && !isIStandardProjectCard(card) && mayEnable(card, hand)) {
        chosen.push(candidate);
      }
    }
    for (const candidate of ranked) {
      if (chosen.length >= count) {
        break;
      }
      if (!chosen.includes(candidate)) {
        chosen.push(candidate);
      }
    }
    return chosen;
  }

  /** Whether the move being chosen now is followed by another in the same turn. */
  private hasAnotherAction(): boolean {
    const player = this.context.player;
    const game = player.game;
    const othersPassed = game.players.every((other) => other === player || game.hasPassedThisActionPhase(other));
    return othersPassed || player.actionsTakenThisRound + 1 < player.availableActionsThisRound;
  }

  /** Every move on `menu` but passing, ending the turn and undoing. */
  private candidates(menu: OrOptions): Array<Candidate> {
    const {player, scorer} = this.context;
    const candidates: Array<Candidate> = [];
    menu.options.forEach((option, index) => {
      const annotation = annotationOf(option);
      if (annotation === 'pass' || annotation === 'endTurn' || annotation === 'undo') {
        return;
      }
      if (option instanceof SelectCardToPlay && (annotation === 'projectCard' || annotation === 'standardProject')) {
        const menuOfCards = option as SelectCardToPlay<PlayableCard>;
        for (const {card, value} of scorer.consideredCards(menuOfCards)) {
          const payment = planPaymentFor(player, menuOfCards, card);
          if (payment !== undefined) {
            candidates.push({index, option, card, staticScore: value, spend: unitsOf(payment), simulate: simulatable(card)});
          }
        }
        return;
      }
      const staticScore = scorer.score(option);
      if (!Number.isFinite(staticScore)) {
        return;
      }
      let spend = Units.EMPTY;
      let simulate = false;
      switch (annotation) {
      case 'milestone':
        spend = Units.of({megacredits: player.milestoneCost()});
        simulate = true;
        break;
      case 'award':
        spend = Units.of({megacredits: 8 + player.game.fundedAwards.length * 6});
        simulate = true;
        break;
      case 'convertPlants':
        spend = Units.of({plants: player.plantsNeededForGreenery});
        simulate = true;
        break;
      case 'convertHeat':
        spend = Units.of({heat: 8});
        simulate = true;
        break;
      }
      candidates.push({index, option, staticScore, spend, simulate});
    });
    return candidates;
  }

  /**
   * Plays `candidate` out on a copy of the game and scores what follows.
   *
   * Returns `undefined` when anything about the copy is not as expected, so
   * the move falls back to being priced without simulation.
   */
  private simulate(menu: OrOptions, candidate: Candidate): number | undefined {
    const {player, random} = this.context;
    try {
      const clone = cloneForLookahead(player.game);
      const bot = clone.getPlayerById(player.id);
      const cloneMenu = bot.getWaitingFor();
      if (!(cloneMenu instanceof OrOptions) || cloneMenu.options.length !== menu.options.length ||
          annotationOf(cloneMenu.options[candidate.index]) !== annotationOf(candidate.option)) {
        return undefined;
      }
      const responder = this.context.responderFor(bot, new BotRandom(random.nextInt(2 ** 31)));
      const response = this.responseFor(cloneMenu, candidate, bot, responder);
      if (response === undefined) {
        return undefined;
      }
      bot.process(response);
      for (let step = 0; !bot.isAtActionMenu(); step++) {
        const input = bot.getWaitingFor();
        if (step >= MAX_STEPS || input === undefined || clone.players.some((other) => other !== bot && other.getWaitingFor() !== undefined)) {
          return undefined;
        }
        bot.process(responder.respond(input));
      }
      const after = bot.getWaitingFor();
      return after instanceof OrOptions ? this.bestFollowUp(after, bot) : undefined;
    } catch (err) {
      return undefined;
    }
  }

  private responseFor(cloneMenu: OrOptions, candidate: Candidate, bot: IPlayer, responder: Responder): InputResponse | undefined {
    const option = cloneMenu.options[candidate.index];
    if (candidate.card === undefined) {
      return {type: 'or', index: candidate.index, response: responder.respond(option)};
    }
    if (!(option instanceof SelectCardToPlay)) {
      return undefined;
    }
    const cards = option as SelectCardToPlay<PlayableCard>;
    const name = candidate.card.name;
    const card = cards.cards.find((each) => each.name === name);
    const payment = card === undefined ? undefined : planPaymentFor(bot, cards, card);
    if (payment === undefined) {
      return undefined;
    }
    return {type: 'or', index: candidate.index, response: {type: 'projectCard', card: name, payment}};
  }

  /** The best follow-up on a simulated menu, playing only cards held before the move. */
  private bestFollowUp(menu: OrOptions, bot: IPlayer): number {
    const held = new Set(this.context.player.cardsInHand.map((card) => card.name));
    const scorer = this.context.scorerFor(bot);
    let best = PASS_SCORE;
    for (const option of menu.options) {
      const annotation = annotationOf(option);
      if (annotation === 'pass' || annotation === 'endTurn' || annotation === 'undo') {
        continue;
      }
      if (option instanceof SelectCardToPlay && annotation === 'projectCard') {
        for (const {card, value} of scorer.consideredCards(option as SelectCardToPlay<PlayableCard>)) {
          if (held.has(card.name)) {
            best = Math.max(best, value);
          }
        }
        continue;
      }
      best = Math.max(best, scorer.score(option));
    }
    return best;
  }

  /**
   * The best follow-up to `candidate` without simulating it: the best other
   * move still affordable once `candidate` has been paid for.
   */
  private followUpWithout(candidate: Candidate, candidates: ReadonlyArray<Candidate>): number {
    const player = this.context.player;
    let best = PASS_SCORE;
    for (const other of candidates) {
      if (other === candidate || other.staticScore <= best) {
        continue;
      }
      if (other.card !== undefined && other.option instanceof SelectCardToPlay) {
        if (other.card === candidate.card) {
          continue;
        }
        const context = paymentContextFor(player, other.option as SelectCardToPlay<PlayableCard>, other.card);
        const reserve = Units.of({});
        for (const key of Units.keys) {
          reserve[key] = context.reserveUnits[key] + candidate.spend[key];
        }
        if (planPayment(player, context.cost, context.options, reserve) === undefined) {
          continue;
        }
      } else if (other.spend.megacredits + candidate.spend.megacredits > player.megaCredits) {
        continue;
      }
      best = other.staticScore;
    }
    return best;
  }
}
