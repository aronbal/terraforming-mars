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
   * Chance that the bot notices any one option, where 1 sees everything.
   *
   * Below 1 the bot overlooks some cards in hand and sometimes forgets where the
   * opponent could build, the way a human misses things rather than playing
   * at random. See `Attention`.
   */
  attention: number;

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

  /**
   * When true, the bot prices milestones and awards against the opponents' positions.
   *
   * It hurries to claim a milestone an opponent is about to claim, funds an
   * award only on a lead the opponent cannot plausibly close, and takes the
   * last award slot before an opponent spends it on an award they lead.
   */
  watchesMilestonesAndAwards: boolean;

  /**
   * When true, the bot hurries the end of the game when ahead on points and drags it out when behind.
   */
  timesTheEnd: boolean;

  /** When true, the bot takes board spaces partly to keep them from the opponent. */
  deniesPlacement: boolean;

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
};

const PROFILES: Record<BotDifficulty, BotProfile> = {
  easy: {
    temperature: 4,
    personality: 0.35,
    attention: 0.6,
    productionWeight: 0.4,
    terraformWeight: 0.65,
    valuesSynergy: false,
    racesMilestones: false,
    watchesMilestonesAndAwards: false,
    timesTheEnd: false,
    deniesPlacement: false,
    reserveMegacredits: 6,
    buyRate: 0.25,
    playsEndgame: false,
  },
  medium: {
    temperature: 1.8,
    personality: 0.25,
    attention: 0.8,
    productionWeight: 0.72,
    terraformWeight: 0.85,
    valuesSynergy: false,
    racesMilestones: true,
    watchesMilestonesAndAwards: false,
    timesTheEnd: false,
    deniesPlacement: false,
    reserveMegacredits: 3,
    buyRate: 0.45,
    playsEndgame: true,
  },
  hard: {
    temperature: 0.6,
    personality: 0.15,
    attention: 0.95,
    productionWeight: 1.0,
    terraformWeight: 1.0,
    valuesSynergy: true,
    racesMilestones: true,
    watchesMilestonesAndAwards: true,
    timesTheEnd: true,
    deniesPlacement: false,
    reserveMegacredits: 2,
    buyRate: 0.6,
    playsEndgame: true,
  },
  insane: {
    temperature: 0,
    personality: 0.1,
    attention: 1,
    productionWeight: 1.05,
    terraformWeight: 1.0,
    valuesSynergy: true,
    racesMilestones: true,
    watchesMilestonesAndAwards: true,
    timesTheEnd: true,
    deniesPlacement: true,
    reserveMegacredits: 1,
    buyRate: 0.7,
    playsEndgame: true,
  },
};

export function profileFor(difficulty: BotDifficulty): BotProfile {
  return PROFILES[difficulty];
}

/** The valuation weights implied by a profile. */
export function weightsOf(profile: BotProfile): ValueWeights {
  return {production: profile.productionWeight, terraform: profile.terraformWeight};
}
