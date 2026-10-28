import {CardName} from '../../common/cards/CardName';

/** A card the bot is saving up to play. */
export type BotGoal = {
  readonly card: CardName;
  /** The generation the goal was set in. */
  readonly setGeneration: number;
  /** Generations the bot expected to wait, when it set the goal. */
  readonly eta: number;
  /** What the bot expected the card to be worth net of its cost, when it set the goal. */
  readonly net: number;
};

/** Counts of what the bot's planning did, for measuring it. */
export type BotStats = {
  readonly goalsSet: number;
  readonly goalsMet: number;
  readonly goalsAbandoned: number;
  readonly lookaheadChanged: number;
};

export const NO_STATS: BotStats = {goalsSet: 0, goalsMet: 0, goalsAbandoned: 0, lookaheadChanged: 0};

/**
 * What a computer opponent remembers from one decision to the next.
 *
 * A bot's brain is rebuilt for every decision, so anything it means to carry
 * forward, such as a card it is saving for, lives here, on the player, and is
 * saved with the game. That way a restart or a rollback restores it along
 * with the position it belongs to.
 *
 * It is immutable: the bot replaces it rather than changing it, since the
 * serialized game shares the object.
 */
export type BotMemory = {
  readonly version: 1;
  readonly goal?: BotGoal;
  readonly stats?: BotStats;
};

const CARD_NAMES: ReadonlySet<string> = new Set(Object.values(CardName));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseGoal(raw: unknown): BotGoal | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }
  const {card, setGeneration, eta, net} = raw;
  if (typeof card !== 'string' || !CARD_NAMES.has(card) || !isCount(setGeneration) || !isCount(eta) || !isCount(net)) {
    return undefined;
  }
  return {card: card as CardName, setGeneration, eta, net};
}

function parseStats(raw: unknown): BotStats | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }
  const count = (value: unknown) => isCount(value) ? value : 0;
  return {
    goalsSet: count(raw.goalsSet),
    goalsMet: count(raw.goalsMet),
    goalsAbandoned: count(raw.goalsAbandoned),
    lookaheadChanged: count(raw.lookaheadChanged),
  };
}

/**
 * Reads a bot's memory back from a saved game.
 *
 * Anything unrecognised, from an older version or a card that no longer
 * exists, is dropped rather than trusted: the bot simply starts afresh.
 */
export function parseBotMemory(raw: unknown): BotMemory | undefined {
  if (!isRecord(raw) || raw.version !== 1) {
    return undefined;
  }
  const goal = parseGoal(raw.goal);
  const stats = parseStats(raw.stats);
  return {
    version: 1,
    ...(goal === undefined ? {} : {goal}),
    ...(stats === undefined ? {} : {stats}),
  };
}

/** `memory` with `stats` changed by `change`. */
export function withStats(memory: BotMemory | undefined, change: (stats: BotStats) => BotStats): BotMemory {
  return {...memory, version: 1, stats: change(memory?.stats ?? NO_STATS)};
}
