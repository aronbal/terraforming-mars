import {expect} from 'chai';
import {Attention} from '../../src/server/bot/Attention';
import {BotRandom} from '../../src/server/bot/BotRandom';
import {CardName} from '../../src/common/cards/CardName';

const SOME_CARDS = Object.values(CardName).slice(0, 200);

describe('Attention', () => {
  it('sees everything at full attention without drawing from the random source', () => {
    const random = new BotRandom(7);
    const attention = new Attention(1, random);

    expect(SOME_CARDS.every((card) => attention.noticesCard(card))).is.true;
    expect(attention.noticesOpponentPlacement()).is.true;
    // Drawing would change every later choice the bot makes in the decision.
    expect(random.next()).to.eq(new BotRandom(7).next());
  });

  it('overlooks some cards below full attention', () => {
    const attention = new Attention(0.6, new BotRandom(3));

    const noticed = SOME_CARDS.filter((card) => attention.noticesCard(card)).length;

    expect(noticed).to.be.greaterThan(SOME_CARDS.length * 0.45);
    expect(noticed).to.be.lessThan(SOME_CARDS.length * 0.75);
  });

  it('keeps its answer for a card for the whole decision', () => {
    const attention = new Attention(0.5, new BotRandom(11));

    const first = SOME_CARDS.map((card) => attention.noticesCard(card));
    const second = SOME_CARDS.map((card) => attention.noticesCard(card));

    expect(second).to.deep.eq(first);
  });

  it('decides once whether to think about the opponent\'s placement', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const attention = new Attention(0.5, new BotRandom(seed));
      const first = attention.noticesOpponentPlacement();
      for (let i = 0; i < 10; i++) {
        expect(attention.noticesOpponentPlacement()).to.eq(first);
      }
    }
  });

  it('notices nothing at zero attention', () => {
    const attention = new Attention(0, new BotRandom(5));

    expect(SOME_CARDS.some((card) => attention.noticesCard(card))).is.false;
    expect(attention.noticesOpponentPlacement()).is.false;
  });
});
