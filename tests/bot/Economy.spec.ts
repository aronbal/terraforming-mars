import {expect} from 'chai';
import {testGame} from '../TestGame';
import {etaFor, inPurseTerms, purseFor} from '../../src/server/bot/plan/Economy';
import {profileFor} from '../../src/server/bot/BotProfile';
import {StripMine} from '../../src/server/cards/base/StripMine';
import {Asteroid} from '../../src/server/cards/base/Asteroid';

describe('Economy', () => {
  it('is affordable now when the purse covers the cost', () => {
    expect(etaFor(20, {now: 25, perGeneration: 10})).to.eq(0);
  });

  it('counts the generations of income still needed', () => {
    expect(etaFor(30, {now: 10, perGeneration: 10})).to.eq(2);
  });

  it('lets slack be spent without delay, but not a megacredit more', () => {
    const purse = {now: 20, perGeneration: 10};

    expect(etaFor(30, purse)).to.eq(1);
    expect(etaFor(30, purse, {spendNow: 0})).to.eq(1);
    expect(etaFor(30, purse, {spendNow: 1})).to.eq(2);
    expect(etaFor(30, purse, {spendNow: 1, incomeDelta: 1})).to.eq(1);
  });

  it('never gets there without income', () => {
    expect(etaFor(30, {now: 20, perGeneration: 0})).to.eq(Number.POSITIVE_INFINITY);
  });

  it('counts steel only towards a building card and titanium towards a space card', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 10;
    player.steel = 3;
    player.titanium = 2;
    const profile = profileFor('insane');

    expect(purseFor(player, new StripMine(), profile).now).to.eq(10 + 3 * 2);
    expect(purseFor(player, new Asteroid(), profile).now).to.eq(10 + 2 * 3);
  });

  it('earns production and terraform rating, less research', () => {
    const [/* game */, player] = testGame(2);
    player.production.override({megacredits: 4, steel: 2});
    const profile = profileFor('insane');
    const research = profile.buyRate * 4 * player.cardCost;

    expect(purseFor(player, new StripMine(), profile).perGeneration)
      .to.be.closeTo(4 + player.terraformRating + 2 * 2 - research, 1e-9);
    expect(purseFor(player, new Asteroid(), profile).perGeneration)
      .to.be.closeTo(4 + player.terraformRating - research, 1e-9);
  });

  it('prices a payment in what the goal can use', () => {
    const [/* game */, player] = testGame(2);

    expect(inPurseTerms({megacredits: 5, steel: 2, titanium: 1}, player, new StripMine())).to.eq(5 + 4);
    expect(inPurseTerms({megacredits: 5, steel: 2, titanium: 1}, player, new Asteroid())).to.eq(5 + 3);
  });
});
