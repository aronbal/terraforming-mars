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
  easy: 'Beginner',
  medium: 'Engineer',
  hard: 'Veteran',
  insane: 'Director',
} as const;

export const BOT_DIFFICULTY_DESCRIPTIONS: Record<BotDifficulty, string> = {
  easy: 'Plays legal moves with little planning. Buys few cards and rarely builds an engine.',
  medium: 'Builds production, plays affordable cards and terraforms steadily.',
  hard: 'Values synergies and tags, races milestones and awards, and pushes hard at game end.',
  insane: 'Plays like Veteran, and additionally blocks your placements, denies awards and times the final generation.',
} as const;

/** The default a new computer opponent starts on. */
export const DEFAULT_BOT_DIFFICULTY: BotDifficulty = 'medium';
