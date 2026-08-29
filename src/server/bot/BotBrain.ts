import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {Message} from '../../common/logs/Message';
import {InputResponse} from '../../common/inputs/InputResponse';
import {Payment} from '../../common/inputs/Payment';
import {Units} from '../../common/Units';
import {Resource} from '../../common/Resource';
import {TileType} from '../../common/TileType';
import {BotDifficulty} from '../../common/bot/BotDifficulty';
import {ICard} from '../cards/ICard';
import {ICorporationCard} from '../cards/corporation/ICorporationCard';

import {OrOptions} from '../inputs/OrOptions';
import {AndOptions} from '../inputs/AndOptions';
import {SelectCard} from '../inputs/SelectCard';
import {SelectCardToPlay} from '../inputs/SelectCardToPlay';
import {SelectSpace} from '../inputs/SelectSpace';
import {SelectPayment} from '../inputs/SelectPayment';
import {SelectAmount} from '../inputs/SelectAmount';
import {SelectPlayer} from '../inputs/SelectPlayer';
import {SelectInitialCards} from '../inputs/SelectInitialCards';
import {SelectProductionToLose} from '../inputs/SelectProductionToLose';
import {SelectResource} from '../inputs/SelectResource';
import {SelectResources} from '../inputs/SelectResources';
import {SelectColony} from '../inputs/SelectColony';
import {SelectParty} from '../inputs/SelectParty';
import {SelectDelegate} from '../inputs/SelectDelegate';
import {SelectGlobalEvent} from '../inputs/SelectGlobalEvent';
import {SelectClaimedUndergroundToken} from '../inputs/SelectClaimedUndergroundToken';
import {DeltaProjectInput} from '../delta/DeltaProjectInput';

import {BotProfile, profileFor, weightsOf} from './BotProfile';
import {BotRandom} from './BotRandom';
import {PlayableCard, planPaymentFor} from './CardPayment';
import {planPayment} from './PaymentPlanner';
import {ActionScorer} from './evaluate/ActionScorer';
import {CardEvaluator} from './evaluate/CardEvaluator';
import {scoreSpace} from './evaluate/SpaceEvaluator';
import {BoardOutlook} from './evaluate/BoardOutlook';
import {Tempo, ValueWeights, productionValues, stockValues, tempoOf} from './evaluate/Values';

/** Hand size beyond which the bot starts buying fewer cards. */
const COMFORTABLE_HAND_SIZE = 8;

/** Words that mark a card selection as something the player gives up. */
const LOSS_WORDS = ['discard', 'remove', 'lose', 'sacrifice', 'destroy', 'spend', 'trash'];

export class UnansweredInputError extends Error {
  constructor(public readonly inputType: string) {
    super(`The bot has no answer for a ${inputType} input`);
  }
}

/**
 * Chooses a computer opponent's answer to whatever the game is asking it.
 *
 * A brain is built fresh for each decision, so it always reads current game
 * state. `respond` returns the same `InputResponse` shape the browser would
 * post, which means bot moves travel the same validation path as a human's.
 */
export class BotBrain {
  private readonly profile: BotProfile;
  private readonly tempo: Tempo;
  private readonly cards: CardEvaluator;
  private readonly actions: ActionScorer;
  private readonly outlook: BoardOutlook;
  private readonly weights: ValueWeights;

  constructor(
    private readonly player: IPlayer,
    difficulty: BotDifficulty,
    private readonly random: BotRandom = new BotRandom()) {
    this.profile = profileFor(difficulty);
    this.weights = weightsOf(this.profile);
    this.tempo = tempoOf(player.game);
    this.outlook = new BoardOutlook(player, this.tempo, this.profile);
    this.cards = new CardEvaluator(player, this.profile, this.tempo, this.outlook);
    this.actions = new ActionScorer(player, this.profile, this.tempo, this.cards, this.outlook);
  }

  public respond(input: PlayerInput): InputResponse {
    // Order matters: several inputs subclass others, and SelectGlobalEvent
    // reports its type as 'card' while expecting a global event response.
    if (input instanceof SelectGlobalEvent) {
      return this.respondToGlobalEvent(input);
    }
    if (input instanceof SelectInitialCards) {
      return this.respondToInitialCards(input);
    }
    if (input instanceof SelectCardToPlay) {
      return this.respondToCardToPlay(input as SelectCardToPlay<PlayableCard>);
    }
    if (input instanceof OrOptions) {
      return this.respondToOr(input);
    }
    if (input instanceof AndOptions) {
      return this.respondToAnd(input);
    }
    if (input instanceof SelectCard) {
      return this.respondToSelectCard(input);
    }
    if (input instanceof SelectSpace) {
      return this.respondToSpace(input);
    }
    if (input instanceof SelectPayment) {
      return this.respondToPayment(input);
    }
    if (input instanceof SelectAmount) {
      return this.respondToAmount(input);
    }
    if (input instanceof SelectPlayer) {
      return this.respondToPlayer(input);
    }
    if (input instanceof SelectProductionToLose) {
      return this.respondToProductionToLose(input);
    }
    if (input instanceof SelectResource) {
      return this.respondToResource(input);
    }
    if (input instanceof SelectResources) {
      return this.respondToResources(input);
    }
    if (input instanceof SelectColony) {
      return this.respondToColony(input);
    }
    if (input instanceof SelectParty) {
      return this.respondToParty(input);
    }
    if (input instanceof SelectDelegate) {
      return this.respondToDelegate(input);
    }
    if (input instanceof SelectClaimedUndergroundToken) {
      return this.respondToUndergroundToken(input);
    }
    if (input instanceof DeltaProjectInput) {
      return {type: 'deltaProject', amount: input.validSteps[0] ?? 1};
    }

    switch (input.type) {
    case 'option':
      return {type: 'option'};
    case 'aresGlobalParameters':
      return {
        type: 'aresGlobalParameters',
        response: {lowOceanDelta: 0, highOceanDelta: 0, temperatureDelta: 0, oxygenDelta: 0},
      };
    default:
      throw new UnansweredInputError(input.type);
    }
  }

  /* ---------------------------------------------------------------- menus */

  private respondToOr(input: OrOptions): InputResponse {
    const index = this.chooseIndex(input.options.map((option) => this.actions.score(option)));
    const chosen = input.options[index];
    return {type: 'or', index, response: this.respond(chosen)};
  }

  private respondToAnd(input: AndOptions): InputResponse {
    return {
      type: 'and',
      responses: input.options.map((option) => this.respond(option)),
    };
  }

  /* -------------------------------------------------------- opening hand */

  private respondToInitialCards(input: SelectInitialCards): InputResponse {
    const corporation = this.chooseCorporation(input);
    const budget = corporation === undefined ?
      0 :
      corporation.startingMegaCredits - this.preludeSpend(input);
    const cardCost = corporation?.cardCost ?? this.player.cardCost;

    const responses = input.options.map((option) => {
      if (option === input.inputs.corp) {
        return this.selectNamedCards(option, corporation === undefined ? [] : [corporation]);
      }
      if (option === input.inputs.project) {
        return this.selectNamedCards(option, this.chooseOpeningHand(option, budget, cardCost));
      }
      return this.respond(option);
    });

    return {type: 'initialCards', responses};
  }

  private chooseCorporation(input: SelectInitialCards): ICorporationCard | undefined {
    const corpInput = input.inputs.corp;
    if (!(corpInput instanceof SelectCard)) {
      return undefined;
    }
    const corporations = corpInput.cards as ReadonlyArray<ICorporationCard>;
    const scores = corporations.map((corp) =>
      this.cards.valueOfPlaying(corp) + corp.startingMegaCredits * 0.8);
    return corporations[this.chooseIndex(scores)];
  }

  /** Preludes are free, but two of them are chosen before the cards are paid for. */
  private preludeSpend(_input: SelectInitialCards): number {
    return 0;
  }

  /**
   * Picks the starting hand.
   *
   * The engine rejects a hand the corporation cannot pay for, so the count is
   * capped by the starting megacredits before anything else.
   */
  private chooseOpeningHand(option: PlayerInput, budget: number, cardCost: number): ReadonlyArray<ICard> {
    if (!(option instanceof SelectCard)) {
      return [];
    }
    const affordable = cardCost > 0 ? Math.floor(budget / cardCost) : option.cards.length;
    const limit = Math.min(option.config.max, affordable, option.cards.length);
    if (limit <= 0) {
      return [];
    }

    const ranked = this.rankCards(option.cards, cardCost);
    const wanted = Math.max(
      option.config.min,
      Math.min(limit, Math.round(limit * Math.max(this.profile.buyRate, 0.3))));

    return ranked.filter((entry) => entry.net > 0).slice(0, wanted).map((entry) => entry.card);
  }

  /* --------------------------------------------------------------- cards */

  private respondToSelectCard(input: SelectCard<ICard>): InputResponse {
    const {min, max} = input.config;
    const eligible = input.cards.filter((_card, index) => input.config.enabled?.[index] !== false);
    if (eligible.length === 0) {
      return {type: 'card', cards: []};
    }

    // `played: false` is how this codebase marks a menu where cards are bought.
    const buying = input.config.played === false;
    const losing = this.looksLikeLoss(input.title);
    const cardCost = buying ? this.player.cardCost : 0;
    const ranked = this.rankCards(eligible, cardCost);

    let chosen: ReadonlyArray<ICard>;
    if (losing) {
      // Give up the cards worth the least.
      chosen = ranked.slice().reverse().slice(0, Math.max(min, 0)).map((entry) => entry.card);
    } else if (buying) {
      const affordable = cardCost > 0 ?
        Math.floor(this.player.spendableMegacredits() / cardCost) :
        eligible.length;
      const limit = Math.min(max, affordable);
      // A hand the bot is not getting through is a reason to stop buying.
      const handPressure = Math.max(0, this.player.cardsInHand.length - COMFORTABLE_HAND_SIZE) * 0.08;
      const appetite = Math.ceil(eligible.length * Math.max(0.1, this.profile.buyRate - handPressure));
      chosen = ranked
        .filter((entry) => entry.net > 0)
        .slice(0, Math.max(min, Math.min(limit, appetite)))
        .map((entry) => entry.card);
    } else {
      chosen = ranked.slice(0, Math.max(min, Math.min(max, ranked.length))).map((entry) => entry.card);
    }

    if (chosen.length < min) {
      chosen = ranked.slice(0, min).map((entry) => entry.card);
    }
    return {type: 'card', cards: chosen.map((card) => card.name)};
  }

  private rankCards(cards: ReadonlyArray<ICard>, cardCost: number): Array<{card: ICard, net: number}> {
    return cards
      .map((card) => ({card, net: this.noisy(this.cards.valueOfPlaying(card) - cardCost)}))
      .sort((a, b) => b.net - a.net);
  }

  private selectNamedCards(option: PlayerInput, cards: ReadonlyArray<ICard>): InputResponse {
    if (!(option instanceof SelectCard)) {
      return this.respond(option);
    }
    return {type: 'card', cards: cards.map((card) => card.name)};
  }

  private respondToCardToPlay(input: SelectCardToPlay<PlayableCard>): InputResponse {
    const playable = input.cards
      .map((card, index) => ({card, index}))
      .filter((entry) => input.enabled?.[entry.index] !== false)
      .map((entry) => ({
        card: entry.card,
        score: this.noisy(this.actions.valueOfPlayingFromMenu(input, entry.card)),
        payment: planPaymentFor(this.player, input, entry.card),
      }))
      .filter((entry) => entry.payment !== undefined)
      .sort((a, b) => b.score - a.score);

    const best = playable[0];
    if (best === undefined) {
      throw new UnansweredInputError('projectCard');
    }
    return {type: 'projectCard', card: best.card.name, payment: best.payment as Payment};
  }

  /* --------------------------------------------------------------- board */

  private respondToSpace(input: SelectSpace): InputResponse {
    const tileType = this.tileTypeOf(input);
    const scores = input.spaces.map((space) =>
      scoreSpace(this.player, space, tileType, this.tempo, this.profile, this.outlook));
    const index = this.chooseIndex(scores);
    return {type: 'space', spaceId: input.spaces[index].id};
  }

  /**
   * Guesses which kind of tile is being placed.
   *
   * `SelectSpace` does not carry the tile type, so this reads it off the title,
   * which is the only signal available. The titles are English source strings
   * — translation happens in the browser — and the ones the game builds for a
   * city or a greenery both name the tile. Getting it wrong only costs
   * placement quality, never legality.
   */
  private tileTypeOf(input: SelectSpace): TileType | undefined {
    const title = this.titleText(input.title).toLowerCase();
    if (title.includes('greenery')) {
      return TileType.GREENERY;
    }
    if (title.includes('ocean')) {
      return TileType.OCEAN;
    }
    if (title.includes('city')) {
      return TileType.CITY;
    }
    return undefined;
  }

  /* ------------------------------------------------------------ payments */

  private respondToPayment(input: SelectPayment): InputResponse {
    const payment = planPayment(
      this.player,
      input.amount,
      input.paymentOptions,
      input.reserveUnits ?? Units.EMPTY);
    if (payment === undefined) {
      throw new UnansweredInputError('payment');
    }
    return {type: 'payment', payment};
  }

  /* ------------------------------------------------------------- numbers */

  private respondToAmount(input: SelectAmount): InputResponse {
    // Nearly every amount prompt is "how much do you want", so take the most.
    const amount = input.maxByDefault === false ? input.min : input.max;
    return {type: 'amount', amount: Math.max(input.min, Math.min(input.max, amount))};
  }

  /* ------------------------------------------------------------- players */

  private respondToPlayer(input: SelectPlayer): InputResponse {
    const opponents = input.players.filter((candidate) => candidate.id !== this.player.id);
    // These prompts are overwhelmingly attacks, so aim away from ourselves.
    const target = opponents.length > 0 ? this.strongestOf(opponents) : input.players[0];
    return {type: 'player', player: target.color};
  }

  private strongestOf(players: ReadonlyArray<IPlayer>): IPlayer {
    return players.reduce((best, candidate) =>
      candidate.terraformRating > best.terraformRating ? candidate : best);
  }

  /* ----------------------------------------------------------- resources */

  private respondToProductionToLose(input: SelectProductionToLose): InputResponse {
    const values = productionValues(this.player, this.tempo, this.weights);
    const units: Units = {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0};
    const production = this.player.production;

    // Megacredit production may go negative, the rest may not.
    const floors: Record<keyof Units, number> = {
      megacredits: -5, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0,
    };

    for (let taken = 0; taken < input.unitsToLose; taken++) {
      const affordable = (Object.keys(units) as Array<keyof Units>)
        .filter((resource) => production[resource as Resource] - units[resource] > floors[resource]);
      if (affordable.length === 0) {
        break;
      }
      const cheapest = affordable.reduce((best, candidate) =>
        values[candidate as Resource] < values[best as Resource] ? candidate : best);
      units[cheapest]++;
    }
    return {type: 'productionToLose', units};
  }

  private respondToResource(input: SelectResource): InputResponse {
    const values = stockValues(this.player, this.tempo, this.weights);
    const best = input.include.reduce((chosen, candidate) =>
      values[candidate as Resource] > values[chosen as Resource] ? candidate : chosen);
    return {type: 'resource', resource: best};
  }

  private respondToResources(input: SelectResources): InputResponse {
    const values = stockValues(this.player, this.tempo, this.weights);
    const order = (Object.keys(values) as Array<Resource>)
      .sort((a, b) => values[b] - values[a]);
    const units: Units = {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0};
    const best = order[0] ?? 'megacredits';
    units[best as keyof Units] = input.count;
    return {type: 'resources', units};
  }

  /* ------------------------------------------------------- expansion bits */

  private respondToColony(input: SelectColony): InputResponse {
    const colony = this.random.pick(input.colonies) ?? input.colonies[0];
    return {type: 'colony', colonyName: colony.name};
  }

  private respondToParty(input: SelectParty): InputResponse {
    return {type: 'party', partyName: input.parties[0]};
  }

  private respondToDelegate(input: SelectDelegate): InputResponse {
    const candidate = input.players[0];
    return {type: 'delegate', player: candidate === 'NEUTRAL' ? 'NEUTRAL' : candidate.color};
  }

  private respondToGlobalEvent(input: SelectGlobalEvent): InputResponse {
    return {type: 'globalEvent', globalEventName: input.globalEvents[0].name};
  }

  private respondToUndergroundToken(input: SelectClaimedUndergroundToken): InputResponse {
    const count = Math.max(input.min, Math.min(input.max, input.tokens.length));
    const selected: Array<number> = [];
    for (let i = 0; i < count; i++) {
      selected.push(i);
    }
    return {type: 'claimedUndergroundToken', selected};
  }

  /* ------------------------------------------------------------- helpers */

  /**
   * Picks the index of the highest score, with difficulty-dependent slop.
   *
   * Easier bots mix noise into every score and occasionally throw the ranking
   * away entirely, which is what makes them beatable without making them
   * pick illegal or self-destructive moves.
   */
  private chooseIndex(scores: ReadonlyArray<number>): number {
    if (scores.length === 0) {
      return 0;
    }
    const legal = scores
      .map((score, index) => ({score, index}))
      .filter((entry) => entry.score > Number.NEGATIVE_INFINITY);
    if (legal.length === 0) {
      return 0;
    }
    if (this.profile.blunderRate > 0 && this.random.next() < this.profile.blunderRate) {
      return (this.random.pick(legal) ?? legal[0]).index;
    }
    const best = legal
      .map((entry) => ({index: entry.index, score: this.noisy(entry.score)}))
      .reduce((a, b) => b.score > a.score ? b : a);
    return best.index;
  }

  /** Blends a score toward random noise according to the difficulty. */
  private noisy(score: number): number {
    const noise = this.profile.noise;
    if (noise <= 0 || !Number.isFinite(score)) {
      return score;
    }
    // Scale the noise to the score so it stays meaningful at any magnitude.
    const spread = Math.max(4, Math.abs(score));
    return score * (1 - noise) + (this.random.next() * 2 - 1) * spread * noise;
  }

  private looksLikeLoss(title: string | Message): boolean {
    const text = this.titleText(title).toLowerCase();
    return LOSS_WORDS.some((word) => text.includes(word));
  }

  /**
   * The words in a prompt's title, including the ones it interpolates.
   *
   * A title assembled as `Select space for ${0}` keeps the tile or card name in
   * its data rather than in the sentence, so reading only `message` throws away
   * the one word worth reading.
   */
  private titleText(title: string | Message): string {
    if (typeof title === 'string') {
      return title;
    }
    return [title.message, ...title.data.map((entry) => String(entry.value))].join(' ');
  }
}
