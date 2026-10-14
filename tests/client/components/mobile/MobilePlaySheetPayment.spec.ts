import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import MobilePlaySheetPayment from '@/client/components/mobile/MobilePlaySheetPayment.vue';
import {PlaySheetPaymentState} from '@/client/components/mobile/PlaySheet';
import {CardName} from '@/common/cards/CardName';
import {Payment} from '@/common/inputs/Payment';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {RecursivePartial} from '@/common/utils/utils';
import {Units} from '@/common/Units';

function input(card: CardModel, overrides: Partial<SelectProjectCardToPlayModel> = {}): SelectProjectCardToPlayModel {
  return {
    type: 'projectCard',
    title: 'Play project card',
    buttonLabel: 'Play card',
    cards: [card],
    paymentOptions: {},
    microbes: 0,
    floaters: 0,
    lunaArchivesScience: 0,
    seeds: 0,
    graphene: 0,
    kuiperAsteroids: 0,
    auroraiData: 0,
    spireScience: 0,
    ...overrides,
  };
}

describe('MobilePlaySheetPayment', () => {
  function render(playerinput: SelectProjectCardToPlayModel, player: RecursivePartial<PublicPlayerModel>) {
    return mount(MobilePlaySheetPayment, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel({thisPlayer: fakePublicPlayerModel(player)}),
        playerinput,
        cardName: playerinput.cards[0].name,
      },
    });
  }

  function lastState(wrapper: ReturnType<typeof render>): PlaySheetPaymentState {
    const emitted = wrapper.emitted('change') as Array<[PlaySheetPaymentState]>;
    return emitted[emitted.length - 1][0];
  }

  it('lets Helion pay with heat, using only as much as the M€ leave', async () => {
    const wrapper = render(
      input({name: CardName.BIRDS, calculatedCost: 10}, {paymentOptions: {heat: true}}),
      {megacredits: 7, heat: 4, steel: 5});
    await flushPromises();

    // Birds has no building tag, so the steel is not offered.
    expect(wrapper.find('[data-test=pay-steel]').exists()).is.false;
    expect(wrapper.find('[data-test=count-heat]').text()).eq('3');
    expect(lastState(wrapper)).deep.eq({payment: Payment.of({heat: 3, megacredits: 7}), problem: undefined, overpaid: 0});
  });

  it('leaves out what the card holds in reserve, and says so', async () => {
    const wrapper = render(
      input({name: CardName.ASTEROID_DEFLECTION_SYSTEM, calculatedCost: 13, reserveUnits: Units.of({steel: 2})}),
      {megacredits: 20, steel: 3});
    await flushPromises();

    expect(wrapper.find('[data-test=pay-steel]').text()).contains('1 available');
    expect(wrapper.find('[data-test=pay-steel]').text()).contains('Some steel are reserved and unavailable here.');
    expect(wrapper.find('[data-test=count-steel]').text()).eq('1');
    expect(wrapper.find('[data-test=more-steel]').attributes('disabled')).is.not.undefined;
  });

  it('stops + once another unit could only overspend', async () => {
    // 3 steel for a 5 M€ card is 6: allowed, one M€ over. A fourth would be refused.
    const wrapper = render(
      input({name: CardName.ASTEROID_DEFLECTION_SYSTEM, calculatedCost: 5}),
      {megacredits: 0, steel: 4});
    await flushPromises();

    expect(wrapper.find('[data-test=count-steel]').text()).eq('3');
    expect(wrapper.find('[data-test=more-steel]').attributes('disabled')).is.not.undefined;
    expect(lastState(wrapper)).deep.eq({payment: Payment.of({steel: 3}), problem: undefined, overpaid: 1});
  });
});
