import {expect} from 'chai';
import {NO_PLANNING, profileFor, resolveProfile} from '../../src/server/bot/BotProfile';
import {parseOverride} from '../../src/server/tools/bot_tournament';

describe('BotProfile', () => {
  it('resolves to the difficulty profile without an override', () => {
    expect(resolveProfile('hard')).to.eq(profileFor('hard'));
  });

  it('merges planning settings into the difficulty profile', () => {
    const resolved = resolveProfile('insane', {temperature: 2, planning: {goals: true}});

    expect(resolved.temperature).to.eq(2);
    expect(resolved.planning.goals).is.true;
    expect(resolved.planning.lookahead).to.eq(profileFor('insane').planning.lookahead);
    expect(resolved.buyRate).to.eq(profileFor('insane').buyRate);
    expect(profileFor('insane').temperature, 'the shared profile is left alone').to.eq(0);
  });

  it('parses tournament settings', () => {
    expect(parseOverride(['planning.goals=false', 'buyRate=0.5', 'planning.lookahead=4'])).to.deep.eq({
      buyRate: 0.5,
      planning: {goals: false, lookahead: 4},
    });
  });

  it('plans more the stronger the level', () => {
    expect(profileFor('easy').planning).to.deep.eq(NO_PLANNING);
    expect(profileFor('medium').planning.goals).is.true;
    expect(profileFor('medium').planning.lookahead).to.eq(0);
    expect(profileFor('hard').planning.enablerWeight).to.be.greaterThan(0);
    expect(profileFor('hard').planning.lookahead).to.eq(0);
    expect(profileFor('insane').planning.lookahead).to.be.greaterThan(0);
  });
});
