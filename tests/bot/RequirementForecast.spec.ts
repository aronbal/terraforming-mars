import {expect} from 'chai';
import {testGame} from '../TestGame';
import {setOxygenLevel, setTemperature} from '../TestingUtils';
import {forecastRequirements, globalRatePerGeneration} from '../../src/server/bot/plan/RequirementForecast';
import {Worms} from '../../src/server/cards/base/Worms';
import {ArcticAlgae} from '../../src/server/cards/base/ArcticAlgae';
import {AdaptationTechnology} from '../../src/server/cards/base/AdaptationTechnology';
import {ThinkTank} from '../../src/server/cards/pathfinders/ThinkTank';
import {GeneRepair} from '../../src/server/cards/base/GeneRepair';
import {GlobalParameter} from '../../src/common/GlobalParameter';

describe('RequirementForecast', () => {
  it('extrapolates a global parameter at the rate it has been moving', () => {
    const [game, player] = testGame(2);
    game.globalsPerGeneration = [{oxygen: 0}, {oxygen: 1}, {oxygen: 2}];
    setOxygenLevel(game, 2);

    expect(globalRatePerGeneration(game, GlobalParameter.OXYGEN)).to.eq(1);
    const forecast = forecastRequirements(player, new Worms());
    expect(forecast.eta).to.eq(2);
    expect(forecast.probability).to.be.within(0.5, 1);
  });

  it('counts a requirement that is met as met', () => {
    const [game, player] = testGame(2);
    setOxygenLevel(game, 4);

    expect(forecastRequirements(player, new Worms())).to.deep.eq({eta: 0, probability: 1});
  });

  it('gives up on a maximum that is already passed', () => {
    const [game, player] = testGame(2);
    setTemperature(game, -10);

    expect(forecastRequirements(player, new ArcticAlgae()).probability).to.eq(0);
  });

  it('reports how soon a maximum closes', () => {
    const [game, player] = testGame(2);
    setTemperature(game, -16);

    const forecast = forecastRequirements(player, new ArcticAlgae());
    expect(forecast.eta).to.eq(0);
    expect(forecast.closesIn).to.be.greaterThan(0);
  });

  it('counts Adaptation Technology', () => {
    const [game, player] = testGame(2);
    setOxygenLevel(game, 2);
    player.playedCards.push(new AdaptationTechnology());

    expect(forecastRequirements(player, new Worms()).eta).to.eq(0);
  });

  it('never writes Think Tank costs onto the card', () => {
    const [game, player] = testGame(2, {pathfindersExpansion: true});
    setOxygenLevel(game, 3);
    const thinkTank = new ThinkTank();
    thinkTank.resourceCount = 3;
    player.playedCards.push(thinkTank);
    const worms = new Worms();

    forecastRequirements(player, worms);
    expect(worms.additionalProjectCosts).is.undefined;
  });

  it('expects a tag requirement sooner with tagged cards in hand', () => {
    const [/* game */, player] = testGame(2);
    // Gene Repair needs three science tags.
    const geneRepair = new GeneRepair();
    const without = forecastRequirements(player, geneRepair);
    player.cardsInHand.push(new AdaptationTechnology(), new AdaptationTechnology(), new AdaptationTechnology());

    const withScience = forecastRequirements(player, geneRepair);
    expect(withScience.probability).to.be.greaterThan(without.probability);
  });
});
