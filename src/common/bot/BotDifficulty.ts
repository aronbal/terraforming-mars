/**
 * How hard a computer opponent plays.
 *
 * The levels differ in three ways: how much noise is mixed into the bot's
 * scoring, how many heuristics it applies at all, and how far ahead it looks
 * when the end of the game is in sight. See `BotProfile` for the actual knobs.
 */
export const BOT_DIFFICULTIES = ['easy', 'medium', 'hard', 'insane'] as const;

export type BotDifficulty = typeof BOT_DIFFICULTIES[number];

export function isBotDifficulty(value: unknown): value is BotDifficulty {
  return typeof value === 'string' && (BOT_DIFFICULTIES as ReadonlyArray<string>).includes(value);
}

/** Labels shown in the new-game screen, in play order from gentlest to nastiest. */
export const BOT_DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  insane: 'Insane',
} as const;

export const BOT_DIFFICULTY_DESCRIPTIONS: Record<BotDifficulty, string> = {
  easy: 'Plays legal moves with little planning. Buys few cards, rarely builds an engine, and drops cities wherever they fit.',
  medium: 'Builds production, plays affordable cards, terraforms steadily, and grows greeneries around its cities.',
  hard: 'Values synergies and tags, races milestones and awards, plans its cities around the forests it can grow, and pushes hard at game end.',
  insane: 'Everything Hard does, and additionally blocks your placements, takes the city spaces you wanted, denies awards and times the final generation.',
} as const;

/** The default a new computer opponent starts on. */
export const DEFAULT_BOT_DIFFICULTY: BotDifficulty = 'medium';
