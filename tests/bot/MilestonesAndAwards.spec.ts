import {expect} from 'chai';
import {testGame} from '../TestGame';
import {addCity, fakeCard} from '../TestingUtils';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {BotBrain} from '../../src/server/bot/BotBrain';
import {BotRandom} from '../../src/server/bot/BotRandom';
import {BotDifficulty} from '../../src/common/bot/BotDifficulty';
import {profileFor} from '../../src/server/bot/BotProfile';
import {ActionScorer, PASS_SCORE} from '../../src/server/bot/evaluate/ActionScorer';
import {CardEvaluator} from '../../src/server/bot/evaluate/CardEvaluator';
import {Tempo} from '../../src/server/bot/evaluate/Values';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {Planner} from '../../src/server/milestones/Planner';
import {Mayor} from '../../src/server/milestones/Mayor';
import {Terraformer} from '../../src/server/milestones/Terraformer';
import {Gardener} from '../../src/server/milestones/Gardener';
import {Banker} from '../../src/server/awards/Banker';
import {Landlord} from '../../src/server/awards/Landlord';
import {Scientist} from '../../src/server/awards/Scientist';
import {Thermalist} from '../../src/server/awards/Thermalist';
import {Resource} from '../../src/common/Resource';

const MID_GAME: Tempo = {progress: 0.5, remainingGenerations: 5, endgame: false};
const LATE_GAME: Tempo = {progress: 0.95, remainingGenerations: 1, endgame: true};

function scorerFor(player: TestPlayer, difficulty: BotDifficulty, tempo: Tempo): ActionScorer {
  const profile = profileFor(difficulty);
  return new ActionScorer(player, profile, tempo, new CardEvaluator(player, profile, tempo));
}

function fillHand(player: TestPlayer, count: number): void {
  player.cardsInHand.length = 0;
  for (let i = 0; i < count; i++) {
    player.cardsInHand.push(fakeCard());
  }
}

function milestoneMenu(...names: Array<string>): OrOptions {
  const menu = new OrOptions(...names.map((name) => new SelectOption(name)));
  menu.annotation = 'milestone';
  return menu;
}

/** A two-player game where both players can pay for a milestone or an award. */
function setUp(): [IGame, TestPlayer, TestPlayer] {
  const [game, player, opponent] = testGame(2);
  game.milestones = [new Planner(), new Mayor(), new Terraformer()];
  game.awards = [new Banker(), new Landlord(), new Scientist()];
  player.megaCredits = 40;
  opponent.megaCredits = 40;
  return [game, player, opponent];
}

describe('MilestonesAndAwards', () => {
  it('hurries to claim a milestone the opponent is one card from', () => {
    const [/* game */, player, opponent] = setUp();
    fillHand(player, 16);
    fillHand(opponent, 3);
    const uncontested = scorerFor(player, 'hard', MID_GAME).score(milestoneMenu('Planner'));

    fillHand(opponent, 15);
    const contested = scorerFor(player, 'hard', MID_GAME).score(milestoneMenu('Planner'));

    // Uncontested, a milestone is five points for eight megacredits. A card
    // netting a few megacredits more wins that comparison, but must not win
    // it when waiting lets the opponent take the five points instead.
    expect(uncontested).to.be.closeTo(17, 0.01);
    expect(contested).to.be.greaterThan(uncontested + 10);
  });

  it('treats a terraform rating one short of Terraformer as a race', () => {
    const [/* game */, player, opponent] = setUp();
    player.setTerraformRating(35);
    opponent.setTerraformRating(20);
    const uncontested = scorerFor(player, 'hard', MID_GAME).score(milestoneMenu('Terraformer'));

    opponent.setTerraformRating(34);
    const contested = scorerFor(player, 'hard', MID_GAME).score(milestoneMenu('Terraformer'));

    expect(contested).to.be.greaterThan(uncontested + 10);
  });

  it('claims the milestone the opponent is about to take, not the safe one', () => {
    const [/* game */, player, opponent] = setUp();
    fillHand(player, 16);
    for (let i = 0; i < 3; i++) {
      addCity(player);
    }
    fillHand(opponent, 15);

    const brain = new BotBrain(player, 'hard', new BotRandom(1));
    const response = brain.respond(milestoneMenu('Mayor', 'Planner'));

    expect(response).to.have.property('index', 1);
  });

  it('sees no race once the opponent has passed', () => {
    const [game, player, opponent] = setUp();
    fillHand(player, 16);
    fillHand(opponent, 15);
    game.playerHasPassed(opponent);

    expect(scorerFor(player, 'hard', MID_GAME).score(milestoneMenu('Planner'))).to.be.closeTo(17, 0.01);
  });

  it('sees no race at medium', () => {
    const [/* game */, player, opponent] = setUp();
    fillHand(player, 16);
    fillHand(opponent, 15);

    expect(scorerFor(player, 'medium', MID_GAME).score(milestoneMenu('Planner'))).to.be.closeTo(17, 0.01);
  });

  it('treats the last milestone slot as contested by any milestone the opponent can claim', () => {
    const [game, player, opponent] = setUp();
    const other = testGame(2, undefined, '-other')[1];
    game.claimedMilestones.push({player: other, milestone: game.milestones[2]});
    game.claimedMilestones.push({player: other, milestone: new Gardener()});
    fillHand(opponent, 2);
    for (let i = 0; i < 3; i++) {
      addCity(player);
    }
    const uncontested = scorerFor(player, 'hard', MID_GAME).score(milestoneMenu('Mayor'));

    // The opponent can claim Planner, which would use the last slot.
    fillHand(opponent, 16);
    const contested = scorerFor(player, 'hard', MID_GAME).score(milestoneMenu('Mayor'));

    expect(contested).to.be.greaterThan(uncontested + 10);
  });

  it('does not bet on a narrow award lead with most of the game left', () => {
    const [game, player, opponent] = setUp();
    game.generation = 3;
    player.production.add(Resource.MEGACREDITS, 4);
    opponent.production.add(Resource.MEGACREDITS, 3);

    const early: Tempo = {progress: 0.25, remainingGenerations: 9, endgame: false};
    expect(scorerFor(player, 'hard', early).score(new SelectOption('Banker'))).to.be.lessThan(PASS_SCORE);
  });

  it('funds an award lead the opponent cannot close', () => {
    const [game, player, opponent] = setUp();
    game.generation = 12;
    player.production.add(Resource.MEGACREDITS, 12);
    opponent.production.add(Resource.MEGACREDITS, 5);

    expect(scorerFor(player, 'hard', LATE_GAME).score(new SelectOption('Banker'))).to.be.greaterThan(PASS_SCORE);
  });

  it('funds the last award before the opponent takes the slot for their own', () => {
    const [game, player, opponent] = setUp();
    game.generation = 8;
    game.awards.push(new Thermalist());
    // Two awards funded by a bystander, so one slot is left.
    const other = testGame(2, undefined, '-other')[1];
    game.fundAward(other, game.awards[2]);
    game.fundAward(other, game.awards[3]);
    player.production.add(Resource.MEGACREDITS, 10);
    opponent.production.add(Resource.MEGACREDITS, 5);
    const quiet = scorerFor(player, 'hard', MID_GAME).score(new SelectOption('Banker'));

    for (let i = 0; i < 5; i++) {
      addCity(opponent);
    }
    const threatened = scorerFor(player, 'hard', MID_GAME).score(new SelectOption('Banker'));

    expect(quiet).to.be.lessThan(PASS_SCORE);
    expect(threatened).to.be.greaterThan(PASS_SCORE);
  });
});
