import {BotDifficulty} from '../../common/bot/BotDifficulty';
import {ValueWeights} from './evaluate/Values';

/**
 * The tuning knobs that separate one difficulty from the next.
 *
 * Every bot runs the same decision code; a profile decides how much of that
 * code's advice it actually takes.
 */
export type BotProfile = {
  /**
   * How loosely the bot picks between options, in megacredits.
   *
   * The bot picks each option with a probability that falls off with how much
   * worse than the best it is (a softmax over the scores). Options within
   * about this many megacredits of the best are picked often; an option many
   * times this far behind almost never is. So a bot errs the way a person
   * does, taking the second-best move when two are close, rather than making a
   * random move. 0 always picks the best.
   */
  temperature: number;

  /**
   * How far the bot's per-game taste may stray from neutral, from 0 (no
   * personality) upward. See `BotPersonality`.
   */
  personality: number;

  /**
   * How accurately the bot prices production, where 1 is accurate.
   *
   * Below 1 the bot undervalues its engine and under-builds, which is the
   * single largest difference between a weak and a strong player.
   */
  productionWeight: number;

  /** How accurately the bot prices terraform rating, where 1 is accurate. */
  terraformWeight: number;

  /** When false, the bot ignores tag synergies and card draw quality. */
  valuesSynergy: boolean;

  /** When false, the bot never claims milestones or funds awards on purpose. */
  racesMilestones: boolean;

  /** When false, the bot ignores what the opponent is doing. */
  playsAgainstOpponent: boolean;

  /**
   * How many megacredits the bot wants to keep in reserve mid-generation.
   *
   * Higher values make it hoard; 0 makes it spend everything it can.
   */
  reserveMegacredits: number;

  /** Fraction of dealt project cards the bot is willing to buy during research. */
  buyRate: number;

  /**
   * When true, the bot recognises that the game is ending and switches to
   * converting resources into points.
   */
  playsEndgame: boolean;

  /** How far ahead the bot thinks. See `PlanningProfile`. */
  planning: PlanningProfile;
};

/**
 * The knobs for thinking beyond the current decision.
 *
 * Everything here adds a megacredit term to the scores the bot already
 * computes, so it composes with the softmax and the personality rather than
 * replacing them.
 */
export type PlanningProfile = {
  /** When true, the bot sets itself a card to save for and protects that saving. */
  goals: boolean;
  /** The most generations ahead a savings goal may be due. */
  goalMaxEta: number;
  /** The least a goal card must be worth, net of its cost, to be saved for. */
  goalMinNet: number;
  /** How much better, as a fraction, a new goal must be to replace the held one. */
  goalSwitchMargin: number;
  /** How much of the value a move delays the bot is charged for, from 0 to 1. */
  goalCommitment: number;
  /** Fraction of a goal's value expected to survive each generation of waiting. */
  goalRisk: number;
  /** Generations a goal may run late before the bot gives up on it. */
  goalMaxAgeSlack: number;
  /** When true, research buys fewer cards when buying them would delay the goal. */
  goalGuardsResearch: boolean;
  /** When true, cards are bought on how soon their requirements will be met. */
  requirementForecast: boolean;
  /** How much of the value a move unlocks in other hand cards the bot credits it with. */
  enablerWeight: number;
  /** How many top moves to try in a simulated copy of the game; 0 never simulates. */
  lookahead: number;
  /** Fraction of a follow-up move's value credited to the move that leads to it. */
  lookaheadDiscount: number;
  /** Time allowed for simulating one decision, in milliseconds. */
  lookaheadBudgetMs: number;
};

/** A profile that never looks past the decision in front of it. */
export const NO_PLANNING: PlanningProfile = {
  goals: false,
  goalMaxEta: 0,
  goalMinNet: Number.POSITIVE_INFINITY,
  goalSwitchMargin: 0,
  goalCommitment: 0,
  goalRisk: 1,
  goalMaxAgeSlack: 0,
  goalGuardsResearch: false,
  requirementForecast: false,
  enablerWeight: 0,
  lookahead: 0,
  lookaheadDiscount: 0,
  lookaheadBudgetMs: 0,
};

/**
 * Changes to a difficulty's profile, for experiments.
 *
 * These come from the tournament tool and tests, never from a saved game.
 */
export type BotProfileOverride = Partial<Omit<BotProfile, 'planning'>> & {
  planning?: Partial<PlanningProfile>;
};

const PROFILES: Record<BotDifficulty, BotProfile> = {
  easy: {
    temperature: 4,
    personality: 0.35,
    productionWeight: 0.4,
    terraformWeight: 0.65,
    valuesSynergy: false,
    racesMilestones: false,
    playsAgainstOpponent: false,
    reserveMegacredits: 6,
    buyRate: 0.25,
    playsEndgame: false,
    planning: NO_PLANNING,
  },
  medium: {
    temperature: 1.8,
    personality: 0.25,
    productionWeight: 0.72,
    terraformWeight: 0.85,
    valuesSynergy: false,
    racesMilestones: true,
    playsAgainstOpponent: false,
    reserveMegacredits: 3,
    buyRate: 0.45,
    playsEndgame: true,
    planning: NO_PLANNING,
  },
  hard: {
    temperature: 0.6,
    personality: 0.15,
    productionWeight: 1.0,
    terraformWeight: 1.0,
    valuesSynergy: true,
    racesMilestones: true,
    playsAgainstOpponent: false,
    reserveMegacredits: 2,
    buyRate: 0.6,
    playsEndgame: true,
    planning: NO_PLANNING,
  },
  insane: {
    temperature: 0,
    personality: 0.1,
    productionWeight: 1.05,
    terraformWeight: 1.0,
    valuesSynergy: true,
    racesMilestones: true,
    playsAgainstOpponent: true,
    reserveMegacredits: 1,
    buyRate: 0.7,
    playsEndgame: true,
    planning: NO_PLANNING,
  },
};

export function profileFor(difficulty: BotDifficulty): BotProfile {
  return PROFILES[difficulty];
}

/** The profile for `difficulty` with `override` applied on top. */
export function resolveProfile(difficulty: BotDifficulty, override?: BotProfileOverride): BotProfile {
  const base = PROFILES[difficulty];
  if (override === undefined) {
    return base;
  }
  return {...base, ...override, planning: {...base.planning, ...override.planning}};
}

/** The valuation weights implied by a profile. */
export function weightsOf(profile: BotProfile): ValueWeights {
  return {production: profile.productionWeight, terraform: profile.terraformWeight};
}
