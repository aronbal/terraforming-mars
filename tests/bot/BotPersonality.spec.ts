import {expect} from 'chai';
import {testGame} from '../TestGame';
import {NEUTRAL_PERSONALITY, personalityOf} from '../../src/server/bot/BotPersonality';
import {profileFor} from '../../src/server/bot/BotProfile';

describe('BotPersonality', () => {
  it('is the same on every decision of a game', () => {
    const [/* game */, player] = testGame(2);
    const profile = profileFor('medium');

    expect(personalityOf(player, profile)).to.deep.eq(personalityOf(player, profile));
  });

  it('differs from game to game', () => {
    const profile = profileFor('medium');
    const styles = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const [/* game */, player] = testGame(2, {}, `-style${i}`);
      styles.add(JSON.stringify(personalityOf(player, profile)));
    }

    expect(styles.size).to.be.greaterThan(1);
  });

  it('stays within the profile\'s strength', () => {
    const profile = profileFor('hard');
    for (let i = 0; i < 8; i++) {
      const [/* game */, player] = testGame(2, {}, `-range${i}`);
      const personality = personalityOf(player, profile);
      expect(personality.favouriteTags).to.have.length(2);
      expect(personality.cities).to.be.within(1 - profile.personality, 1 + profile.personality);
      expect(personality.greeneries).to.be.within(1 - profile.personality, 1 + profile.personality);
    }
  });

  it('is neutral when the profile allows no personality', () => {
    const [/* game */, player] = testGame(2);

    expect(personalityOf(player, {...profileFor('hard'), personality: 0})).to.eq(NEUTRAL_PERSONALITY);
  });
});
