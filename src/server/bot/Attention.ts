import {CardName} from '../../common/cards/CardName';
import {BotRandom} from './BotRandom';

/**
 * What a bot happens to notice during one decision.
 *
 * A weak human player does not weigh every option and then pick badly; they
 * overlook some options altogether. This models that: each card in hand, and
 * each opponent-aware consideration, is seen with probability `level`. The
 * answer is drawn once and remembered, so every part of one decision agrees on
 * what the bot saw. A brain is built per decision, and so is its attention.
 *
 * At level 1 nothing is ever missed and no random numbers are drawn, so a
 * fully attentive bot plays exactly as it would without this.
 */
export class Attention {
  /** Attention that sees everything. */
  public static readonly FULL = new Attention(1);

  private readonly cards = new Map<CardName, boolean>();
  private opponentPlacement: boolean | undefined;

  constructor(
    private readonly level: number,
    private readonly random?: BotRandom) {
  }

  /** True when the bot sees `card` as an option this decision. */
  public noticesCard(card: CardName): boolean {
    if (this.level >= 1) {
      return true;
    }
    let noticed = this.cards.get(card);
    if (noticed === undefined) {
      noticed = this.roll();
      this.cards.set(card, noticed);
    }
    return noticed;
  }

  /**
   * True when the bot thinks about where the opponent might build next.
   *
   * Decided once per decision rather than per space, so the bot either weighs
   * the opponent for the whole placement or not at all.
   */
  public noticesOpponentPlacement(): boolean {
    if (this.level >= 1) {
      return true;
    }
    if (this.opponentPlacement === undefined) {
      this.opponentPlacement = this.roll();
    }
    return this.opponentPlacement;
  }

  /** Without a random source there is nothing to miss things by, so everything is seen. */
  private roll(): boolean {
    if (this.random === undefined) {
      return true;
    }
    return this.random.next() < this.level;
  }
}
