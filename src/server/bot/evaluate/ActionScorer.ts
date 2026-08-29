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
import {CardEvaluator} from './CardEvaluator';
import {PlayableCard, planPaymentFor} from '../CardPayment';
import {BoardOutlook} from './BoardOutlook';
import {Tempo, ValueWeights, VP_VALUE, cardDrawValue, productionValues, stockValues, terraformRatingValue} from './Values';

/** Points awarded for claiming a milestone or winning an award. */
const MILESTONE_POINTS = 5;
const AWARD_FIRST_PLACE_POINTS = 5;
const AWARD_SECOND_PLACE_POINTS = 2;

/** What the bot assumes an unremarkable tile placement is worth in bonuses. */
const TILE_PLACEMENT_VALUE = 2.5;

/** Roughly what a player can turn into board position in one generation. */
const SPENDING_PER_GENERATION = 25;

/** Floor on the value of a megacredit, so cash never becomes literally free. */
const MIN_MONEY_VALUE = 0.3;

/** Most the endgame race can shift the value of terraforming, either way. */
const MAX_CLOSING_SWING = 7;

/** What an award lead is worth at the very start of the game, as a fraction. */
const MINIMUM_AWARD_CERTAINTY = 0.25;

/**
 * Scores an entry in the action menu, in megacredits.
 *
 * Anything scoring at or below `PASS_SCORE` is not worth doing, so the bot
 * passes rather than take it.
 */
export const PASS_SCORE = 0.25;
const END_TURN_SCORE = 0.15;

export class ActionScorer {
  constructor(
    private readonly player: IPlayer,
    private readonly profile: BotProfile,
    private readonly tempo: Tempo,
    private readonly cards: CardEvaluator,
    private readonly outlook: BoardOutlook) {
    this.weights = weightsOf(profile);
  }

  private readonly weights: ValueWeights;
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
   * Raising the last global parameters ends the game. That is worth doing when
   * ahead and worth avoiding when behind, so this shifts the value of any
   * action that terraforms once the end is in sight.
   */
  private closingAdjustment(): number {
    if (this.profile.playsAgainstOpponent === false || this.tempo.endgame === false) {
      return 0;
    }
    const margin = this.scoreMargin();
    return Math.max(-MAX_CLOSING_SWING, Math.min(MAX_CLOSING_SWING, margin * 0.6));
  }

  public score(option: PlayerInput): number {
    // Undoing is a user-interface affordance, never a move.
    if (option instanceof UndoActionOption) {
      return Number.NEGATIVE_INFINITY;
    }

    try {
      return this.scoreByAnnotation(option);
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
    return MILESTONE_POINTS * VP_VALUE - this.player.milestoneCost();
  }

  private awardScore(): number {
    if (this.profile.racesMilestones === false) {
      return PASS_SCORE / 2;
    }
    const game = this.player.game;
    const cost = 8 + game.fundedAwards.length * 6;
    let best = Number.NEGATIVE_INFINITY;
    for (const award of game.awards) {
      if (game.hasBeenFunded(award)) {
        continue;
      }
      best = Math.max(best, this.awardValue(award.getScore(this.player), award, cost));
    }
    return best === Number.NEGATIVE_INFINITY ? PASS_SCORE / 2 : best;
  }

  private awardValue(ownScore: number, award: {getScore(player: IPlayer): number}, cost: number): number {
    const best = Math.max(...this.player.opponents.map((opponent) => award.getScore(opponent)), 0);
    if (ownScore < best) {
      // Funding an award the opponent leads hands them points.
      return -AWARD_FIRST_PLACE_POINTS * VP_VALUE;
    }
    const points = ownScore > best ? AWARD_FIRST_PLACE_POINTS : AWARD_SECOND_PLACE_POINTS;
    return points * VP_VALUE * this.awardCertainty() - cost;
  }

  /**
   * How much a current award lead is worth betting on.
   *
   * Leading an award in the first generation means almost nothing — one tag is
   * enough to lead when nobody has played anything — while a lead late in the
   * game is close to banked. Without this the bot funds awards on its opening
   * turn, which is close to the worst use of eight megacredits in the game.
   */
  private awardCertainty(): number {
    return MINIMUM_AWARD_CERTAINTY + (1 - MINIMUM_AWARD_CERTAINTY) * this.tempo.progress;
  }

  /**
   * Scores one entry inside the milestone or award submenu.
   *
   * The submenu's own score decides whether to spend at all; this decides
   * which one to spend on, which matters because funding an award the
   * opponent leads hands them the points. The titles are `AwardName` and
   * `MilestoneName` identifiers rather than translated prose, so matching on
   * them is safe.
   */
  private namedChoiceValue(title: string | Message): number | undefined {
    const name = typeof title === 'string' ? title : title.message;
    const game = this.player.game;

    const award = game.awards.find((candidate) => candidate.name === name);
    if (award !== undefined) {
      const cost = 8 + game.fundedAwards.length * 6;
      return this.awardValue(award.getScore(this.player), award, cost);
    }

    // Every claimable milestone is worth the same five points.
    if (game.milestones.some((candidate) => candidate.name === name)) {
      return this.milestoneScore();
    }
    return undefined;
  }

  private convertPlantsScore(): number {
    const stock = stockValues(this.player, this.tempo, this.weights);
    const cost = this.player.plantsNeededForGreenery * stock.plants;
    const oxygenGain = this.player.game.getOxygenLevel() < MAX_OXYGEN_LEVEL ?
      terraformRatingValue(this.tempo, this.weights) :
      0;
    // Planting beside one of the bot's own cities scores that city a point too.
    const adjacency = this.outlook.greeneryAdjacencyBonus();
    return VP_VALUE + oxygenGain + TILE_PLACEMENT_VALUE + adjacency - cost + 1 + this.closingAdjustment();
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

  /** The value of the best card the player can actually pay for. */
  public bestPlayableCardScore(option: PlayerInput): number {
    if (!(option instanceof SelectCardToPlay)) {
      return 0;
    }
    let best = Number.NEGATIVE_INFINITY;
    option.cards.forEach((card, index) => {
      if (option.enabled?.[index] === false) {
        return;
      }
      best = Math.max(best, this.valueOfPlayingFromMenu(option, card));
    });
    return best;
  }

  /**
   * Net value of one entry in a play-a-card menu, cost included.
   *
   * A card the player cannot construct a legal payment for scores as
   * impossible, so the bot never picks a menu it then cannot answer.
   */
  public valueOfPlayingFromMenu(option: SelectCardToPlay<PlayableCard>, card: PlayableCard): number {
    if (planPaymentFor(this.player, option, card) === undefined) {
      return Number.NEGATIVE_INFINITY;
    }
    const cost = this.costOf(option, card) * this.moneyValue();
    const gross = isIStandardProjectCard(card) ?
      this.standardProjectValue(card) :
      this.cards.valueOfPlaying(card);
    const reserve = this.profile.reserveMegacredits;
    const shortfall = Math.max(0, cost - (this.player.megaCredits - reserve));
    // Spending down to nothing has a real cost: it forecloses next turn.
    return gross - cost - shortfall * 0.05;
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
      return tr + this.closingAdjustment();
    case CardName.AQUIFER_STANDARD_PROJECT:
      return oceans < MAX_OCEAN_TILES ? tr + TILE_PLACEMENT_VALUE + this.closingAdjustment() : 0;
    case CardName.GREENERY_STANDARD_PROJECT:
      return VP_VALUE +
        (game.getOxygenLevel() < MAX_OXYGEN_LEVEL ? tr + this.closingAdjustment() : 0) +
        TILE_PLACEMENT_VALUE +
        this.outlook.greeneryAdjacencyBonus();
    case CardName.CITY_STANDARD_PROJECT:
      // The megacredit production is the small half of this. The large half is
      // the greeneries the city will collect, which is why it is priced off
      // the board rather than off a constant.
      return production.megacredits + this.outlook.valueOfNextCity() + TILE_PLACEMENT_VALUE;
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
