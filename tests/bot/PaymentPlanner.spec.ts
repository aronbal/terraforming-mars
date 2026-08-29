import {expect} from 'chai';
import {testGame} from '../TestGame';
import {planPayment} from '../../src/server/bot/PaymentPlanner';
import {Units} from '../../src/common/Units';
import {Payment} from '../../src/common/inputs/Payment';

describe('PaymentPlanner', () => {
  it('pays a plain cost in cash', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 10;

    expect(planPayment(player, 7, {})?.megacredits).to.eq(7);
  });

  it('costs nothing to pay nothing', () => {
    const [/* game */, player] = testGame(2);

    expect(planPayment(player, 0, {})).to.deep.eq(Payment.EMPTY);
  });

  it('spends steel before cash when steel is accepted', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 5;
    player.steel = 5;

    const payment = planPayment(player, 9, {steel: true});

    // Steel is worth 2, so four of them plus a megacredit covers nine.
    expect(payment?.steel).to.eq(4);
    expect(payment?.megacredits).to.eq(1);
  });

  it('leaves steel alone when the purchase does not accept it', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 9;
    player.steel = 5;

    const payment = planPayment(player, 9, {});

    expect(payment?.steel).to.eq(0);
    expect(payment?.megacredits).to.eq(9);
  });

  it('overpays with the least wasteful resource when cash runs out', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 0;
    player.steel = 3;

    const payment = planPayment(player, 5, {steel: true});

    // Two steel is only worth four, so a third goes in and one is wasted.
    expect(payment?.steel).to.eq(3);
  });

  it('returns undefined when the player cannot cover the cost', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 2;
    player.steel = 0;
    player.titanium = 0;

    expect(planPayment(player, 20, {})).is.undefined;
  });

  it('never spends resources held in reserve', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 4;
    player.steel = 4;

    const reserved = {...Units.EMPTY, steel: 3};
    const payment = planPayment(player, 6, {steel: true}, reserved);

    expect(payment?.steel).to.be.at.most(1);
    expect(player.canSpend(payment!, reserved)).is.true;
  });

  it('produces a payment the engine accepts', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 12;
    player.titanium = 4;

    const payment = planPayment(player, 15, {titanium: true});

    expect(payment).is.not.undefined;
    expect(player.canSpend(payment!)).is.true;
    expect(player.payingAmount(payment!, {titanium: true})).to.be.at.least(15);
  });
});
