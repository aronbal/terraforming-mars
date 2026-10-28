import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {SelectCardToPlay} from '../../inputs/SelectCardToPlay';
import {UndoActionOption} from '../../inputs/UndoActionOption';
import {IStandardProjectCard, isIStandardProjectCard} from '../../cards/IStandardProjectCard';
import {CardName} from '../../../common/cards/CardName';
import {ActionAnnotation} from '../../../common/input/Annotation';
import {Message} from '../../../common/logs/Message';
import {MAX_OCEAN_TILES, MAX_OXYGEN_LEVEL, MAX_TEMPERATURE, MAX_VENUS_SCALE} from '../../../common/constants';
import {TileType} from '../../../common/TileType';
import {BotProfile, weightsOf} from '../BotProfile';
import {BotPersonality, NEUTRAL_PERSONALITY} from '../BotPersonality';
import {Attention} from '../Attention';
import {CardEvaluator} from './CardEvaluator';
import {MilestonesAndAwards} from './MilestonesAndAwards';
import {bestCitySpaceValue} from './SpaceEvaluator';
import {PlayableCard, planPaymentFor} from '../CardPayment';
import {Tempo, ValueWeights, VP_VALUE, cardDrawValue, productionValues, stockValues, terraformRatingValue} from './Values';
import {GoalContext} from '../plan/GoalPlanner';
import {Enablers} from '../plan/Enablers';
import {TurnPlan} from '../plan/TurnPlanner';
import {inPurseTerms} from '../plan/Economy';
import {Payment} from '../../../common/inputs/Payment';

/** What the bot assumes an unremarkable tile placement is worth in bonuses. */
const TILE_PLACEMENT_VALUE = 2.5;

/** Roughly what a player can turn into board position in one generation. */
const SPENDING_PER_GENERATION = 25;

/** Floor on the value of a megacredit, so cash never becomes literally free. */
const MIN_MONEY_VALUE = 0.3;

/** Most the endgame race can shift the value of terraforming, either way. */
const MAX_CLOSING_SWING = 7;

/**
 * Scores an entry in the action menu, in megacredits.
 *
 * Anything scoring at or below `PASS_SCORE` is not worth doing, so the bot
 * passes rather than take it.
 */
export const PASS_SCORE = 0.25;
const END_TURN_SCORE = 0.15;

/** What the bot's planning adds to the scores. Every part is optional. */
export type ScorerPlanning = {
  /** The savings goal, which charges moves that delay it. */
  readonly goal?: GoalContext;
  /** What a card does for the other cards in hand. */
  readonly enablers?: Enablers;
  /** What each move on the action menu leaves possible for the rest of the turn. */
  readonly plan?: TurnPlan;
};

export class ActionScorer {
  constructor(
    private readonly player: IPlayer,
    private readonly profile: BotProfile,
    private readonly tempo: Tempo,
    private readonly cards: CardEvaluator,
    private readonly personality: BotPersonality = NEUTRAL_PERSONALITY,
    private readonly attention: Attention = Attention.FULL,
    private readonly planning: ScorerPlanning = {}) {
    this.weights = weightsOf(profile);
    this.contests = new MilestonesAndAwards(player, profile, tempo);
  }

  private readonly weights: ValueWeights;
  private readonly contests: MilestonesAndAwards;
  private cachedMargin: number | undefined;

  /**
   * How much this bot is ahead on points, or behind if negative.
   *
   * Computing a victory point breakdown is not cheap, so it is done at most
   * once per decision.
   */
  private scoreMargin(): number {
    if (this.cachedMargin === undefined) {
      const own = this.player.getVictoryPoints().total;
      const best = this.player.opponents
        .map((opponent) => opponent.getVictoryPoints().total)
        .reduce((a, b) => Math.max(a, b), 0);
      this.cachedMargin = own - best;
    }
    return this.cachedMargin;
  }

  /**
   * How keen the bot is to bring the game to a close.
   *
   * Raising the last global parameters ends the game. When ahead, every step
   * toward that is worth a little more. When behind, only the step that
   * finishes Mars is held back: refusing ordinary terraforming just gives up
   * points while the leader closes the game anyway.
   */
  private closingAdjustment(): number {
    if (this.profile.timesTheEnd === false || this.tempo.endgame === false) {
      return 0;
    }
    const margin = this.scoreMargin();
    if (margin >= 0) {
      return Math.min(MAX_CLOSING_SWING, margin * 0.6);
    }
    return this.stepsToFinishMars() <= 1 ? Math.max(-MAX_CLOSING_SWING, margin * 0.6) : 0;
  }

  /** How many steps of temperature, oxygen and oceans are left before the game ends. */
  private stepsToFinishMars(): number {
    const game = this.player.game;
    const oceans = game.board.spaces.filter((space) => space.tile?.tileType === TileType.OCEAN).length;
    return Math.max(0, (MAX_TEMPERATURE - game.getTemperature()) / 2) +
      Math.max(0, MAX_OXYGEN_LEVEL - game.getOxygenLevel()) +
      Math.max(0, MAX_OCEAN_TILES - oceans);
  }

  public score(option: PlayerInput): number {
    // Undoing is a user-interface affordance, never a move.
    if (option instanceof UndoActionOption) {
      return Number.NEGATIVE_INFINITY;
    }

    try {
      return this.scoreByAnnotation(option) + (this.planning.plan?.options.get(option) ?? 0);
    } catch (err) {
      return 0;
    }
  }

  private scoreByAnnotation(option: PlayerInput): number {
    switch (option.annotation as ActionAnnotation | undefined) {
    case 'pass':
      return PASS_SCORE;
    case 'endTurn':
      return END_TURN_SCORE;
    case 'undo':
      return Number.NEGATIVE_INFINITY;
    case 'milestone':
      return this.milestoneScore();
    case 'award':
      return this.awardScore();
    case 'convertPlants':
      return this.convertPlantsScore();
    case 'convertHeat':
      return this.convertHeatScore(option);
    case 'sellPatents':
      return this.sellPatentsScore();
    case 'projectCard':
      return this.bestPlayableCardScore(option);
    case 'standardProject':
      return this.bestStandardProjectScore(option);
    case 'actionCard':
    case 'ceoAction':
      return this.actionCardScore();
    case 'tradeWithColony':
      return 6;
    case 'turmoilParty':
    case 'sendDelegate':
      return 3;
    default:
      return this.scoreByStructure(option);
    }
  }

  /** Fallback for menu entries that cards contribute, which carry no annotation. */
  private scoreByStructure(option: PlayerInput): number {
    if (option instanceof SelectCardToPlay) {
      return this.bestPlayableCardScore(option);
    }
    if (option instanceof SelectOption) {
      const named = this.namedChoiceValue(option.title);
      if (named !== undefined) {
        return named;
      }
    }
    if (option instanceof OrOptions) {
      return option.options
        .map((child) => this.score(child))
        .reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY);
    }
    // An unrecognised option from a card is usually the card doing its job.
    return 2;
  }

  private milestoneScore(): number {
    if (this.profile.racesMilestones === false) {
      return PASS_SCORE / 2;
    }
    return this.contests.bestMilestoneValue() + this.goalPenalty(this.player.milestoneCost());
  }

  private awardScore(): number {
    if (this.profile.racesMilestones === false) {
      return PASS_SCORE / 2;
    }
    const value = this.contests.bestAwardValue();
    return value === undefined ? PASS_SCORE / 2 : value + this.goalPenalty(this.player.game.getAwardFundingCost());
  }

  /**
   * Scores one entry inside the milestone or award submenu.
   *
   * The submenu's own score decides whether to spend at all; this decides
   * which one to spend on, which matters because funding an award the
   * opponent leads hands them the points, and because an opponent may be
   * about to claim one milestone but not another. The titles are `AwardName`
   * and `MilestoneName` identifiers rather than translated prose, so matching
   * on them is safe.
   */
  private namedChoiceValue(title: string | Message): number | undefined {
    const name = typeof title === 'string' ? title : title.message;
    const game = this.player.game;

    const award = game.awards.find((candidate) => candidate.name === name);
    if (award !== undefined) {
      return this.contests.awardValue(award);
    }

    const milestone = game.milestones.find((candidate) => candidate.name === name);
    if (milestone !== undefined) {
      return this.profile.racesMilestones ? this.contests.milestoneValue(milestone) : PASS_SCORE / 2;
    }
    return undefined;
  }

  private convertPlantsScore(): number {
    const stock = stockValues(this.player, this.tempo, this.weights);
    const cost = this.player.plantsNeededForGreenery * stock.plants;
    // Once oxygen is maxed a greenery no longer brings the end closer.
    const oxygenGain = this.player.game.getOxygenLevel() < MAX_OXYGEN_LEVEL ?
      terraformRatingValue(this.tempo, this.weights) + this.closingAdjustment() :
      0;
    return (VP_VALUE + TILE_PLACEMENT_VALUE) * this.personality.greeneries + oxygenGain - cost + 1;
  }

  private convertHeatScore(option: PlayerInput): number {
    if (this.player.game.getTemperature() >= MAX_TEMPERATURE) {
      return Number.NEGATIVE_INFINITY;
    }
    if (option instanceof SelectOption && option.warnings?.includes('maxtemp')) {
      return Number.NEGATIVE_INFINITY;
    }
    const stock = stockValues(this.player, this.tempo, this.weights);
    return terraformRatingValue(this.tempo, this.weights) - 8 * stock.heat + 1 + this.closingAdjustment();
  }

  private sellPatentsScore(): number {
    // Only worth it when the cards are dead weight and cash is short.
    if (this.player.megaCredits >= 8 || this.player.cardsInHand.length === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const worst = Math.min(...this.player.cardsInHand.map((card) => this.cards.valueOfPlaying(card)));
    return worst < cardDrawValue(this.tempo) ? 1 : Number.NEGATIVE_INFINITY;
  }

  private actionCardScore(): number {
    // Blue-card actions are free, so taking one is nearly always right.
    return 4;
  }

  /** The value of the best card the player notices and can actually pay for. */
  public bestPlayableCardScore(option: PlayerInput): number {
    if (!(option instanceof SelectCardToPlay)) {
      return 0;
    }
    return this.consideredCards(option)
      .reduce((best, entry) => Math.max(best, entry.value), Number.NEGATIVE_INFINITY);
  }

  /**
   * The entries of a play-a-card menu the bot weighs this decision, with their values.
   *
   * Only entries the player can pay for are candidates. A card in hand is
   * weighed only when the bot notices it, while standard projects are printed
   * on the board and always seen. A bot that would notice nothing still sees
   * its best candidate: forgetting every card in hand is not a mistake people
   * make. Choosing whether to play a card and choosing which card both read
   * this, so the bot never opens the menu for a card it then overlooks.
   */
  public consideredCards(option: SelectCardToPlay<PlayableCard>): Array<{card: PlayableCard, value: number}> {
    const candidates = option.cards
      .filter((_card, index) => option.enabled?.[index] !== false)
      .map((card) => ({card, value: this.valueOfPlayingFromMenu(option, card)}))
      .filter((entry) => entry.value > Number.NEGATIVE_INFINITY);
    const noticed = candidates.filter((entry) =>
      isIStandardProjectCard(entry.card) || this.attention.noticesCard(entry.card.name));
    if (noticed.length > 0 || candidates.length === 0) {
      return noticed;
    }
    return [candidates.reduce((best, entry) => entry.value > best.value ? entry : best)];
  }

  /**
   * Net value of one entry in a play-a-card menu, cost included.
   *
   * A card the player cannot construct a legal payment for scores as
   * impossible, so the bot never picks a menu it then cannot answer.
   */
  public valueOfPlayingFromMenu(option: SelectCardToPlay<PlayableCard>, card: PlayableCard): number {
    const payment = planPaymentFor(this.player, option, card);
    if (payment === undefined) {
      return Number.NEGATIVE_INFINITY;
    }
    const cost = this.costOf(option, card) * this.moneyValue();
    const gross = isIStandardProjectCard(card) ?
      this.standardProjectValue(card) :
      this.cards.valueOfPlaying(card);
    const reserve = Math.max(0, this.profile.reserveMegacredits + this.personality.thrift);
    const shortfall = Math.max(0, cost - (this.player.megaCredits - reserve));
    // Spending down to nothing has a real cost: it forecloses next turn.
    const enabled = this.planning.enablers?.value(card) ?? 0;
    const followUp = this.planning.plan?.cards.get(card.name) ?? 0;
    return gross - cost - shortfall * 0.05 + this.goalAdjustment(card, payment) + enabled + followUp;
  }

  /**
   * What playing `card` does to the savings goal, if the bot has one.
   *
   * The goal card itself is exempt: playing it is what the saving was for.
   */
  private goalAdjustment(card: PlayableCard, payment: Payment): number {
    const goal = this.planning.goal;
    if (goal === undefined || card.name === goal.card.name) {
      return 0;
    }
    const spend = inPurseTerms(payment, this.player, goal.card);
    if (isIStandardProjectCard(card)) {
      return goal.adjustment(spend, 0, this.standardProjectIncome(card));
    }
    const delta = this.cards.economicDelta(card);
    const gain = inPurseTerms(delta.stock, this.player, goal.card);
    const income = inPurseTerms(delta.production, this.player, goal.card) + delta.tr;
    return goal.adjustment(spend, gain, income);
  }

  /** What spending `cost` megacredits does to the savings goal: a penalty or nothing. */
  private goalPenalty(cost: number): number {
    const goal = this.planning.goal;
    return goal === undefined ? 0 : Math.min(0, goal.adjustment(cost, 0, 0));
  }

  /** The income a standard project adds: its terraform rating, or a city's megacredit. */
  private standardProjectIncome(card: IStandardProjectCard): number {
    const game = this.player.game;
    switch (card.name) {
    case CardName.ASTEROID_STANDARD_PROJECT:
      return game.getTemperature() < MAX_TEMPERATURE ? 1 : 0;
    case CardName.AQUIFER_STANDARD_PROJECT:
      return game.board.getOceanSpaces().length < MAX_OCEAN_TILES ? 1 : 0;
    case CardName.GREENERY_STANDARD_PROJECT:
      return game.getOxygenLevel() < MAX_OXYGEN_LEVEL ? 1 : 0;
    case CardName.AIR_SCRAPPING_STANDARD_PROJECT:
    case CardName.AIR_SCRAPPING_STANDARD_PROJECT_VARIANT:
      return game.getVenusScaleLevel() < MAX_VENUS_SCALE ? 1 : 0;
    case CardName.BUFFER_GAS_STANDARD_PROJECT:
    case CardName.CITY_STANDARD_PROJECT:
      return 1;
    default:
      return 0;
    }
  }

  /**
   * What a megacredit is worth to this player right now.
   *
   * Money left over when the game ends scores nothing, so once a player holds
   * more than they can plausibly deploy in the generations remaining, each
   * further megacredit is worth less than face value. This is what stops the
   * bot sitting on a treasury instead of converting it into tiles and points.
   */
  private moneyValue(): number {
    if (this.profile.playsEndgame === false) {
      return 1;
    }
    const capacity = SPENDING_PER_GENERATION * this.tempo.remainingGenerations;
    const held = this.player.megaCredits;
    if (held <= capacity || held <= 0) {
      return 1;
    }
    return Math.max(MIN_MONEY_VALUE, capacity / held);
  }

  public costOf(option: SelectCardToPlay<PlayableCard>, card: PlayableCard): number {
    const overridden = option.extras.get(card.name)?.overriddenCost;
    if (overridden !== undefined) {
      return overridden;
    }
    return isIStandardProjectCard(card) ?
      card.getAdjustedCost(this.player) :
      this.player.getCardCost(card);
  }

  private bestStandardProjectScore(option: PlayerInput): number {
    return this.bestPlayableCardScore(option);
  }

  /**
   * Values a standard project.
   *
   * Standard projects carry out their effects in code rather than through the
   * behavior DSL, so each one is priced explicitly here.
   */
  public standardProjectValue(card: IStandardProjectCard): number {
    const game = this.player.game;
    const production = productionValues(this.player, this.tempo, this.weights);
    const tr = terraformRatingValue(this.tempo, this.weights);
    const oceans = game.board.spaces.filter((space) => space.tile?.tileType === TileType.OCEAN).length;

    switch (card.name) {
    case CardName.SELL_PATENTS_STANDARD_PROJECT:
      return 0;
    case CardName.POWER_PLANT_STANDARD_PROJECT:
      return production.energy;
    case CardName.ASTEROID_STANDARD_PROJECT:
      return game.getTemperature() < MAX_TEMPERATURE ? tr + this.closingAdjustment() : 0;
    case CardName.BUFFER_GAS_STANDARD_PROJECT:
      // Raises no global parameter, so it does not bring the end closer.
      return tr;
    case CardName.AQUIFER_STANDARD_PROJECT:
      return oceans < MAX_OCEAN_TILES ? tr + TILE_PLACEMENT_VALUE + this.closingAdjustment() : 0;
    case CardName.GREENERY_STANDARD_PROJECT:
      return (VP_VALUE + TILE_PLACEMENT_VALUE) * this.personality.greeneries +
        (game.getOxygenLevel() < MAX_OXYGEN_LEVEL ? tr + this.closingAdjustment() : 0);
    case CardName.CITY_STANDARD_PROJECT:
      return production.megacredits + bestCitySpaceValue(this.player, this.tempo, this.profile) * this.personality.cities;
    case CardName.AIR_SCRAPPING_STANDARD_PROJECT:
    case CardName.AIR_SCRAPPING_STANDARD_PROJECT_VARIANT:
      return game.getVenusScaleLevel() < MAX_VENUS_SCALE ? tr : 0;
    case CardName.BUILD_COLONY_STANDARD_PROJECT:
      return 8;
    case CardName.MOON_HABITAT_STANDARD_PROJECT:
    case CardName.MOON_MINE_STANDARD_PROJECT:
    case CardName.MOON_ROAD_STANDARD_PROJECT:
      return tr + TILE_PLACEMENT_VALUE;
    case CardName.EXCAVATE_STANDARD_PROJECT:
      return 3;
    default:
      return 4;
    }
  }
}
