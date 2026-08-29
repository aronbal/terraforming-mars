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
   * Fraction of a candidate's score replaced by noise, from 0 (always pick the
   * best-scoring option) to 1 (pick uniformly at random).
   */
  noise: number;

  /** Chance per decision that the bot discards its ranking and picks at random. */
  blunderRate: number;

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
   * When false, the bot treats a city as a flat point and plants wherever.
   *
   * A city scores only through the greeneries that end up beside it, so
   * connecting the two is the difference between a player who builds cities
   * and one who builds cities that pay. Weak players famously do not make the
   * connection, so `easy` does not either.
   */
  valuesCityGrowth: boolean;

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
};

const PROFILES: Record<BotDifficulty, BotProfile> = {
  easy: {
    noise: 0.55,
    blunderRate: 0.20,
    productionWeight: 0.4,
    terraformWeight: 0.65,
    valuesSynergy: false,
    racesMilestones: false,
    valuesCityGrowth: false,
    playsAgainstOpponent: false,
    reserveMegacredits: 6,
    buyRate: 0.25,
    playsEndgame: false,
  },
  medium: {
    noise: 0.22,
    blunderRate: 0.05,
    productionWeight: 0.72,
    terraformWeight: 0.85,
    valuesSynergy: false,
    racesMilestones: true,
    valuesCityGrowth: true,
    playsAgainstOpponent: false,
    reserveMegacredits: 3,
    buyRate: 0.45,
    playsEndgame: true,
  },
  hard: {
    noise: 0.08,
    blunderRate: 0.0,
    productionWeight: 1.0,
    terraformWeight: 1.0,
    valuesSynergy: true,
    racesMilestones: true,
    valuesCityGrowth: true,
    playsAgainstOpponent: false,
    reserveMegacredits: 2,
    buyRate: 0.6,
    playsEndgame: true,
  },
  insane: {
    noise: 0.0,
    blunderRate: 0.0,
    productionWeight: 1.05,
    terraformWeight: 1.0,
    valuesSynergy: true,
    racesMilestones: true,
    valuesCityGrowth: true,
    playsAgainstOpponent: true,
    reserveMegacredits: 1,
    buyRate: 0.7,
    playsEndgame: true,
  },
};

/**
 * Knobs moved on top of a difficulty's profile, for the benchmark tools.
 *
 * Measuring an evaluator change means playing the change against its absence,
 * and the two sides have to sit in one process for that. `bot_ab.ts` sets this
 * so one seat plays with a knob moved and the other plays the shipped profile.
 * Nothing in a real game touches it.
 */
const overrides = new Map<BotDifficulty, Partial<BotProfile>>();

export function overrideProfile(difficulty: BotDifficulty, values: Partial<BotProfile>): void {
  overrides.set(difficulty, values);
}

export function clearProfileOverrides(): void {
  overrides.clear();
}

export function profileFor(difficulty: BotDifficulty): BotProfile {
  const override = overrides.get(difficulty);
  return override === undefined ? PROFILES[difficulty] : {...PROFILES[difficulty], ...override};
}

/** The valuation weights implied by a profile. */
export function weightsOf(profile: BotProfile): ValueWeights {
  return {production: profile.productionWeight, terraform: profile.terraformWeight};
}
