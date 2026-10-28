import {expect} from 'chai';
import {testGame} from '../TestGame';
import {maxOutOceans, setOxygenLevel} from '../TestingUtils';
import {Enablers, raisesOf} from '../../src/server/bot/plan/Enablers';
import {GoalPlanner} from '../../src/server/bot/plan/GoalPlanner';
import {resolveProfile} from '../../src/server/bot/BotProfile';
import {NEUTRAL_PERSONALITY} from '../../src/server/bot/BotPersonality';
import {tempoOf} from '../../src/server/bot/evaluate/Values';
import {IPlayer} from '../../src/server/IPlayer';
import {EarthOffice} from '../../src/server/cards/base/EarthOffice';
import {BusinessContacts} from '../../src/server/cards/base/BusinessContacts';
import {Comet} from '../../src/server/cards/base/Comet';
import {Moss} from '../../src/server/cards/base/Moss';
import {ColonizerTrainingCamp} from '../../src/server/cards/base/ColonizerTrainingCamp';
import {Mangrove} from '../../src/server/cards/base/Mangrove';
import {GlobalParameter} from '../../src/common/GlobalParameter';

function enablers(player: IPlayer, weight: number = 0.5): Enablers {
  const profile = resolveProfile('insane', {planning: {enablerWeight: weight, goalRisk: 0.9}});
  return new Enablers(player, new GoalPlanner(player, profile, tempoOf(player.game), NEUTRAL_PERSONALITY), weight);
}

describe('Enablers', () => {
  it('reads what a card raises', () => {
    expect(raisesOf(new Comet())).to.deep.eq({[GlobalParameter.TEMPERATURE]: 1, [GlobalParameter.OCEANS]: 1});
  });

  it('credits a discount with the cards in hand it applies to', () => {
    const [/* game */, player] = testGame(2);
    const empty = enablers(player).value(new EarthOffice());
    player.cardsInHand.push(new BusinessContacts(), new BusinessContacts());

    expect(empty).to.eq(0);
    expect(enablers(player).value(new EarthOffice())).to.be.greaterThan(0);
  });

  it('credits a move that unlocks a card in hand', () => {
    const [/* game */, player] = testGame(2);
    maxOutOceans(player, 2);
    player.cardsInHand.push(new Moss());

    expect(enablers(player).value(new Comet())).to.be.greaterThan(0);
    expect(enablers(player, 0).value(new Comet())).to.eq(0);
  });

  it('charges a move that shuts a card in hand out', () => {
    const [game, player] = testGame(2);
    setOxygenLevel(game, 5);
    player.megaCredits = 20;
    // Colonizer Training Camp needs oxygen at 5% or less; Mangrove's greenery raises it.
    player.cardsInHand.push(new ColonizerTrainingCamp());

    expect(enablers(player).value(new Mangrove())).to.be.lessThan(0);
  });
});
