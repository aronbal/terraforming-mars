import {expect} from 'chai';
import {testGame} from '../TestGame';
import {GoalPlanner} from '../../src/server/bot/plan/GoalPlanner';
import {BotProfile, PlanningProfile, resolveProfile} from '../../src/server/bot/BotProfile';
import {NEUTRAL_PERSONALITY} from '../../src/server/bot/BotPersonality';
import {BotMemory} from '../../src/server/bot/BotMemory';
import {Tempo, tempoOf} from '../../src/server/bot/evaluate/Values';
import {SpaceElevator} from '../../src/server/cards/base/SpaceElevator';
import {StripMine} from '../../src/server/cards/base/StripMine';
import {Sabotage} from '../../src/server/cards/base/Sabotage';
import {IPlayer} from '../../src/server/IPlayer';
import {TestPlayer} from '../TestPlayer';

const GOALS: Partial<PlanningProfile> = {
  goals: true,
  goalMaxEta: 2,
  goalMinNet: 8,
  goalSwitchMargin: 0.25,
  goalCommitment: 1,
  goalRisk: 0.9,
  goalMaxAgeSlack: 1,
};

function profile(planning: Partial<PlanningProfile> = {}): BotProfile {
  return resolveProfile('insane', {planning: {...GOALS, ...planning}});
}

function planner(player: IPlayer, planning: Partial<PlanningProfile> = {}, tempo?: Tempo): GoalPlanner {
  return new GoalPlanner(player, profile(planning), tempo ?? tempoOf(player.game), NEUTRAL_PERSONALITY);
}

/** A player a generation of income short of Space Elevator. */
function saving(): TestPlayer {
  const [/* game */, player] = testGame(2);
  player.megaCredits = 20;
  player.cardsInHand.push(new SpaceElevator(), new Sabotage());
  return player;
}

describe('GoalPlanner', () => {
  it('saves for a valuable card a generation away', () => {
    const player = saving();

    const memory = planner(player).refresh(undefined);

    expect(memory?.goal?.card).to.eq(new SpaceElevator().name);
    expect(memory?.goal?.eta).to.eq(1);
    expect(memory?.stats?.goalsSet).to.eq(1);
  });

  it('does not save for a card it can already afford', () => {
    const player = saving();
    player.megaCredits = 40;

    expect(planner(player).refresh(undefined)?.goal).is.undefined;
  });

  it('reports no change when the goal still stands', () => {
    const player = saving();
    const memory = planner(player).refresh(undefined);

    expect(planner(player).refresh(memory)).is.undefined;
  });

  it('keeps a held goal unless a new one is clearly better', () => {
    const player = saving();
    player.cardsInHand.push(new StripMine());
    expect(planner(player).netAt(new StripMine(), 1), 'test needs Strip Mine the better goal')
      .to.be.greaterThan(planner(player).netAt(new SpaceElevator(), 1));
    const elevator: BotMemory = {
      version: 1,
      goal: {card: new SpaceElevator().name, setGeneration: 1, eta: 1, net: 10},
    };

    expect(planner(player, {goalSwitchMargin: 100}).refresh(elevator)).is.undefined;
    const switched = planner(player, {goalSwitchMargin: 0}).refresh(elevator);
    expect(switched?.goal?.card).to.eq(new StripMine().name);
    expect(switched?.stats?.goalsAbandoned).to.eq(1);
  });

  it('counts a goal met once the card is played', () => {
    const player = saving();
    const memory = planner(player).refresh(undefined);
    const elevator = player.cardsInHand[0];
    player.cardsInHand.splice(0, 1);
    player.playedCards.push(elevator);

    const after = planner(player).refresh(memory);
    expect(after?.goal).is.undefined;
    expect(after?.stats?.goalsMet).to.eq(1);
  });

  it('counts a goal abandoned when the card leaves the hand', () => {
    const player = saving();
    const memory = planner(player).refresh(undefined);
    player.cardsInHand.splice(0, 1);

    const after = planner(player).refresh(memory);
    expect(after?.goal).is.undefined;
    expect(after?.stats?.goalsAbandoned).to.eq(1);
  });

  it('gives up on a goal that runs too late', () => {
    const player = saving();
    const memory = planner(player).refresh(undefined);
    player.game.generation = 4;

    const after = planner(player).refresh(memory);
    expect(after?.goal).is.undefined;
    expect(after?.stats?.goalsAbandoned).to.eq(1);
  });

  it('sets no goal in the last generation', () => {
    const player = saving();
    const lastGeneration: Tempo = {progress: 0.95, remainingGenerations: 1, endgame: true};

    expect(planner(player, {}, lastGeneration).refresh(undefined)).is.undefined;
  });

  it('charges a move that delays the goal, and not one that spends slack', () => {
    const player = saving();
    const goals = planner(player);
    const context = goals.context(goals.refresh(undefined));
    expect(context?.eta0).to.eq(1);
    const slack = 20 - (context!.card.cost - context!.purse.perGeneration);

    expect(context!.adjustment(Math.floor(slack), 0, 0)).to.eq(0);
    expect(context!.adjustment(15, 0, 0)).to.be.lessThan(0);
  });

  it('credits income that brings the goal forward, by the enabler weight', () => {
    const player = saving();
    player.megaCredits = 8;
    const goals = planner(player, {enablerWeight: 0.5});
    const context = goals.context(goals.refresh(undefined));
    expect(context?.eta0).to.eq(2);

    expect(context!.adjustment(0, 0, 20)).to.be.greaterThan(0);
    const unweighted = planner(player, {enablerWeight: 0});
    expect(unweighted.context(unweighted.refresh(undefined))!.adjustment(0, 0, 20)).to.eq(0);
  });
});
