import {expect} from 'chai';
import {testGame} from '../TestGame';
import {playStyleOf} from '../../src/server/bot/BotStrategy';
import {personalityOf} from '../../src/server/bot/BotPersonality';
import {profileFor} from '../../src/server/bot/BotProfile';
import {Tempo} from '../../src/server/bot/evaluate/Values';
import {EcoLine} from '../../src/server/cards/corporation/EcoLine';
import {PhoboLog} from '../../src/server/cards/corporation/PhoboLog';
import {Research} from '../../src/server/cards/base/Research';
import {PhysicsComplex} from '../../src/server/cards/base/PhysicsComplex';
import {SearchForLife} from '../../src/server/cards/base/SearchForLife';
import {OlympusConference} from '../../src/server/cards/base/OlympusConference';
import {MarsUniversity} from '../../src/server/cards/base/MarsUniversity';
import {Tag} from '../../src/common/cards/Tag';

const opening: Tempo = {progress: 0.05, remainingGenerations: 10, endgame: false};
const lateGame: Tempo = {progress: 0.8, remainingGenerations: 2, endgame: true};

describe('BotStrategy', () => {
  it('starts from the corporation\'s plan', () => {
    const [/* game */, player] = testGame(2);
    player.playCorporationCard(new EcoLine());
    const profile = profileFor('hard');

    const style = playStyleOf(player, profile, opening);

    expect(style.favouriteTags).to.include(Tag.PLANT);
    expect(style.greeneries).to.be.greaterThan(personalityOf(player, profile).greeneries);
  });

  it('follows the cards when they do not fit the corporation', () => {
    const [/* game */, player] = testGame(2);
    player.playCorporationCard(new PhoboLog());
    const profile = profileFor('hard');
    expect(playStyleOf(player, profile, opening).favouriteTags).to.include(Tag.SPACE);

    // Generation after generation the bot has only drawn and played science.
    player.playedCards.push(new Research(), new PhysicsComplex(), new SearchForLife(), new OlympusConference(), new MarsUniversity());

    expect(playStyleOf(player, profile, lateGame).favouriteTags[0]).to.eq(Tag.SCIENCE);
  });

  it('has a focus even with no personality', () => {
    const [/* game */, player] = testGame(2);
    player.playCorporationCard(new PhoboLog());

    const style = playStyleOf(player, {...profileFor('insane'), personality: 0}, opening);

    expect(style.favouriteTags).to.include(Tag.SPACE);
    expect(style.favouriteTagBonus).to.be.greaterThan(1);
  });
});
