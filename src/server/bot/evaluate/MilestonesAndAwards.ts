import {IPlayer} from '../../IPlayer';
import {IMilestone, BaseMilestone} from '../../milestones/IMilestone';
import {Terraformer} from '../../milestones/Terraformer';
import {IAward} from '../../awards/IAward';
import {AwardScorer} from '../../awards/AwardScorer';
import {MAX_AWARDS, MAX_MILESTONES} from '../../../common/constants';
import {BotProfile} from '../BotProfile';
import {Tempo, VP_VALUE} from './Values';

/** Points awarded for claiming a milestone or placing in an award. */
const MILESTONE_POINTS = 5;
const AWARD_FIRST_PLACE_POINTS = 5;
const AWARD_SECOND_PLACE_POINTS = 2;

/** The extra claim cost printed on the Briber milestone. */
const BRIBER_SURCHARGE = 12;

/** What an award lead is worth at the very start of the game, as a fraction. */
const MINIMUM_AWARD_CERTAINTY = 0.25;

/**
 * Chance an opponent claims a milestone on their next turn, by how many steps short they are.
 *
 * A player who can claim now nearly always does. One step short — one tag,
 * one city, one point of terraform rating — is a single card away, which an
 * opponent reaches about as often as not. Beyond two steps is not a race yet.
 */
const CLAIM_CHANCE_BY_DISTANCE: ReadonlyArray<number> = [0.9, 0.4, 0.1];

/** How much a threat shrinks when the opponent cannot pay to act on it this generation. */
const UNAFFORDABLE_THREAT = 0.3;

/**
 * Values claiming milestones and funding awards, in megacredits.
 *
 * Weaker profiles price these on the bot's own position alone. A profile that
 * `watchesMilestonesAndAwards` also reads the opponents' positions the way a
 * competent human does: it hurries to claim a milestone an opponent is about
 * to claim, it bets on an award lead only when the opponent cannot plausibly
 * close it, and it takes the last award slot before an opponent spends it on
 * an award they lead.
 */
export class MilestonesAndAwards {
  constructor(
    private readonly player: IPlayer,
    private readonly profile: BotProfile,
    private readonly tempo: Tempo) {
  }

  /* ---------------------------------------------------------- milestones */

  /** Net value of the best milestone the player can claim now. */
  public bestMilestoneValue(): number {
    const game = this.player.game;
    const claimable = game.milestones
      .filter((milestone) => !game.milestoneClaimed(milestone) && milestone.canClaim(this.player));
    if (claimable.length === 0) {
      return this.ownMilestoneValue(undefined);
    }
    return Math.max(...claimable.map((milestone) => this.milestoneValue(milestone)));
  }

  /**
   * Net value of claiming `milestone` now.
   *
   * Every milestone is the same five points; what differs is whether waiting
   * is safe. When an opponent is about to claim it — or about to fill the last
   * milestone slot with a different one — waiting loses the five points and
   * hands them five, so claiming now is worth that much more.
   */
  public milestoneValue(milestone: IMilestone): number {
    const own = this.ownMilestoneValue(milestone);
    if (this.profile.watchesMilestonesAndAwards === false) {
      return own;
    }
    const denial = MILESTONE_POINTS * VP_VALUE * this.denialWeight();
    return own + this.milestoneThreat(milestone) * (Math.max(0, own) + denial);
  }

  private ownMilestoneValue(milestone: IMilestone | undefined): number {
    const surcharge = milestone?.name === 'Briber' ? BRIBER_SURCHARGE : 0;
    return MILESTONE_POINTS * VP_VALUE - this.player.milestoneCost() - surcharge;
  }

  /**
   * Chance an opponent takes `milestone` away before the bot acts again.
   *
   * An opponent who has passed cannot act again this generation, so they
   * threaten nothing.
   */
  private milestoneThreat(milestone: IMilestone): number {
    const game = this.player.game;
    const unclaimed = game.milestones.filter((candidate) => !game.milestoneClaimed(candidate));
    const lastSlot = MAX_MILESTONES - game.claimedMilestones.length <= 1;
    // On the last slot, an opponent claiming anything shuts this one out too.
    const contested = lastSlot ? unclaimed : [milestone];

    let threat = 0;
    for (const opponent of this.activeOpponents()) {
      for (const candidate of contested) {
        threat = Math.max(threat, this.claimChance(opponent, candidate));
      }
    }
    return threat;
  }

  private claimChance(opponent: IPlayer, milestone: IMilestone): number {
    const distance = this.stepsToClaim(opponent, milestone);
    if (distance === undefined) {
      return 0;
    }
    const chance = CLAIM_CHANCE_BY_DISTANCE[distance] ?? 0;
    return opponent.canAfford(opponent.milestoneCost()) ? chance : chance * UNAFFORDABLE_THREAT;
  }

  /**
   * How many steps `player` is short of claiming `milestone`.
   *
   * Undefined for milestones with no countable threshold, such as Briber.
   */
  private stepsToClaim(player: IPlayer, milestone: IMilestone): number | undefined {
    if (milestone.canClaim(player)) {
      return 0;
    }
    let threshold: number;
    if (milestone instanceof BaseMilestone) {
      threshold = milestone.threshold;
    } else if (milestone instanceof Terraformer) {
      threshold = milestone.targetRating(player.game);
    } else {
      return undefined;
    }
    return Math.max(1, threshold - milestone.getScore(player));
  }

  /* -------------------------------------------------------------- awards */

  /** Net value of funding the best award still open, or undefined when none is. */
  public bestAwardValue(): number | undefined {
    const game = this.player.game;
    const open = game.awards.filter((award) => !game.hasBeenFunded(award));
    if (open.length === 0) {
      return undefined;
    }
    return Math.max(...open.map((award) => this.awardValue(award)));
  }

  /** Net value of funding `award` now. */
  public awardValue(award: IAward): number {
    const scorer = new AwardScorer(this.player.game, award);
    const own = scorer.get(this.player);
    const best = this.bestOpponentScore(scorer);
    if (own < best) {
      // Funding an award the opponent leads hands them points.
      return -AWARD_FIRST_PLACE_POINTS * VP_VALUE;
    }
    const cost = this.player.game.getAwardFundingCost();
    if (this.profile.watchesMilestonesAndAwards === false) {
      const points = own > best ? AWARD_FIRST_PLACE_POINTS : AWARD_SECOND_PLACE_POINTS;
      return points * VP_VALUE * this.awardCertainty() - cost;
    }

    // Holding first place scores five; losing it scores second place at best
    // and gives the opponent the five instead.
    const hold = this.leadSecurity(own, best);
    const secondPlace = this.player.game.players.length > 2 ? AWARD_SECOND_PLACE_POINTS : 0;
    const ownPoints = hold * AWARD_FIRST_PLACE_POINTS + (1 - hold) * secondPlace;
    const conceded = (1 - hold) * AWARD_FIRST_PLACE_POINTS * this.denialWeight();
    const value = (ownPoints - conceded) * VP_VALUE - cost;
    return value + this.lastAwardSlotPremium(award, value);
  }

  /**
   * What funding first is worth when the last award slot is up for grabs.
   *
   * With one slot left, an opponent who leads a different award and can pay
   * for it will take the slot next turn, scoring that award for themselves and
   * shutting this one out. Funding now prevents both.
   */
  private lastAwardSlotPremium(award: IAward, value: number): number {
    const game = this.player.game;
    if (MAX_AWARDS - game.fundedAwards.length > 1) {
      return 0;
    }
    const cost = game.getAwardFundingCost();
    let premium = 0;
    for (const opponent of this.activeOpponents()) {
      if (!opponent.canAfford(cost)) {
        continue;
      }
      for (const other of game.awards) {
        if (other.name === award.name || game.hasBeenFunded(other)) {
          continue;
        }
        const scorer = new AwardScorer(game, other);
        const theirs = scorer.get(opponent);
        const rival = Math.max(...game.players
          .filter((candidate) => candidate.id !== opponent.id)
          .map((candidate) => scorer.get(candidate)));
        if (theirs <= rival) {
          continue;
        }
        // A clear lead on the last slot gets funded sooner or later; the
        // question is only whether it happens before this player acts again.
        const edge = 2 * this.leadSecurity(theirs, rival) - 1;
        const fundChance = Math.min(1, 2 * edge) * (0.5 + 0.5 * this.tempo.progress);
        const gain = edge * AWARD_FIRST_PLACE_POINTS * VP_VALUE * this.denialWeight();
        premium = Math.max(premium, fundChance * (Math.max(0, value) + gain));
      }
    }
    return premium;
  }

  /**
   * Chance a leader at `leader` stays at or above a trailer at `trailer` until the end.
   *
   * A lead is safe when it is large next to how much the scores can still
   * move, which this estimates from how fast the leading score grew so far
   * and how many generations are left. A tie is a coin flip; a one-tag lead
   * in the first generation barely better.
   */
  private leadSecurity(leader: number, trailer: number): number {
    const margin = Math.max(0, leader - trailer);
    const growthPerGeneration = Math.max(leader, trailer, 0) / Math.max(1, this.player.game.generation);
    const swing = 1 + 0.5 * growthPerGeneration * this.tempo.remainingGenerations;
    return 0.5 + 0.5 * margin / (margin + swing);
  }

  /**
   * How much a current award lead is worth betting on, for profiles that do not read the opponent.
   *
   * Leading an award in the first generation means almost nothing — one tag is
   * enough to lead when nobody has played anything — while a lead late in the
   * game is close to banked. Without this the bot funds awards on its opening
   * turn, which is close to the worst use of eight megacredits in the game.
   */
  private awardCertainty(): number {
    return MINIMUM_AWARD_CERTAINTY + (1 - MINIMUM_AWARD_CERTAINTY) * this.tempo.progress;
  }

  private bestOpponentScore(scorer: AwardScorer): number {
    return Math.max(0, ...this.player.opponents.map((opponent) => scorer.get(opponent)));
  }

  /* ------------------------------------------------------------- helpers */

  /** Opponents who can still act this generation. */
  private activeOpponents(): ReadonlyArray<IPlayer> {
    const game = this.player.game;
    return this.player.opponents.filter((opponent) => !game.hasPassedThisActionPhase(opponent));
  }

  /**
   * How much five points to one opponent costs this player, as a fraction of five points to itself.
   *
   * Against a single opponent their gain is exactly this player's loss; with
   * more opponents it matters only against one of them.
   */
  private denialWeight(): number {
    return 1 / Math.max(1, this.player.opponents.length);
  }
}
