/**
 * A small seeded generator so a bot's choices can be replayed in tests.
 *
 * This deliberately does not use the game's own random source: drawing from
 * that would change the cards players are dealt depending on how much the bot
 * happened to think.
 */
export class BotRandom {
  private state: number;

  constructor(seed: number = Date.now()) {
    // Any non-zero state works; mixing keeps small seeds from starting cold.
    this.state = (Math.floor(Math.abs(seed)) % 2147483646) + 1;
  }

  /** Returns a number in [0, 1). */
  public next(): number {
    // Lehmer / Park-Miller minimal standard generator.
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }

  /** Returns an integer in [0, max). */
  public nextInt(max: number): number {
    if (max <= 0) {
      return 0;
    }
    return Math.floor(this.next() * max);
  }

  public pick<T>(items: ReadonlyArray<T>): T | undefined {
    if (items.length === 0) {
      return undefined;
    }
    return items[this.nextInt(items.length)];
  }
}
