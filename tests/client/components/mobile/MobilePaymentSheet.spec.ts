import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import MobilePaymentSheet from '@/client/components/mobile/MobilePaymentSheet.vue';
import {SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {PaymentOptions} from '@/common/inputs/Payment';

describe('MobilePaymentSheet', () => {
  let posted: Array<unknown>;
  let realFetch: typeof global.fetch;

  beforeEach(() => {
    posted = [];
    realFetch = global.fetch;
    global.fetch = (async (_url: string, options: {body: string}) => {
      posted.push(JSON.parse(options.body));
      return {ok: true, status: 200, json: async () => fakePlayerViewModel()};
    }) as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  function payment(amount: number, paymentOptions: Partial<PaymentOptions> = {}, optional = false): SelectPaymentModel {
    return {
      type: 'payment',
      title: 'Select how to spend ' + amount + ' M€',
      buttonLabel: 'Pay',
      amount,
      paymentOptions,
      seeds: 0,
      auroraiData: 0,
      kuiperAsteroids: 0,
      spireScience: 0,
      reserveUnits: undefined,
      floaters: 0,
      microbes: 0,
      graphene: 0,
      optional,
    } as SelectPaymentModel;
  }

  function render(input: SelectPaymentModel, player: {megacredits?: number, heat?: number, steel?: number} = {}) {
    const thisPlayer = fakePublicPlayerModel({megacredits: 25, heat: 12, ...player});
    return mount(MobilePaymentSheet, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel({thisPlayer, waitingFor: input} as never),
        playerinput: input,
      },
    });
  }

  const text = (wrapper: ReturnType<typeof render>, test: string) => wrapper.find('[data-test="' + test + '"]').text();

  it('says the price, and pays it in M€ to start with', () => {
    const wrapper = render(payment(3, {heat: true}));
    expect(text(wrapper, 'payment-sheet-title')).eq('Select how to spend 3 M€');
    expect(text(wrapper, 'payment-sheet-cost')).eq('Pay 3 M€');
    expect(text(wrapper, 'count-megacredits')).eq('3');
    expect(text(wrapper, 'payment-sheet-submit')).eq('Pay · 3 M€');
  });

  it('offers only the units the price may be paid with, and the player has', () => {
    const wrapper = render(payment(3, {heat: true}), {steel: 4});
    expect(wrapper.find('[data-test="pay-heat"]').exists()).is.true;
    expect(wrapper.find('[data-test="pay-steel"]').exists()).is.false;
    expect(render(payment(3, {heat: true}), {heat: 0}).find('[data-test="pay-heat"]').exists()).is.false;
  });

  it('takes M€ off as heat goes on, and stops when the price is met', async () => {
    const wrapper = render(payment(3, {heat: true}));
    for (let i = 0; i < 3; i++) {
      await wrapper.find('[data-test="more-heat"]').trigger('click');
    }
    expect(text(wrapper, 'count-heat')).eq('3');
    expect(text(wrapper, 'count-megacredits')).eq('0');
    expect(wrapper.find('[data-test="more-heat"]').attributes('disabled')).is.not.undefined;

    await wrapper.find('[data-test="less-heat"]').trigger('click');
    expect(text(wrapper, 'count-megacredits')).eq('1');
  });

  it('pays what it shows', async () => {
    const wrapper = render(payment(3, {heat: true}));
    await wrapper.find('[data-test="more-heat"]').trigger('click');
    await wrapper.find('[data-test="payment-sheet-submit"]').trigger('click');
    await flushPromises();
    expect(posted).has.length(1);
    expect(posted[0]).deep.include({type: 'payment'});
    expect((posted[0] as {payment: object}).payment).deep.include({heat: 1, megacredits: 2});
    expect(wrapper.emitted('close')).has.length(1);
  });

  it('says why a price cannot be paid, and will not send it', async () => {
    const wrapper = render(payment(30), {megacredits: 25});
    expect(wrapper.find('[data-test="payment-sheet-reason"]').exists()).is.true;
    expect(wrapper.find('[data-test="payment-sheet-reason"]').classes()).contains('mobile-play-sheet-reason--problem');
    expect(wrapper.find('[data-test="payment-sheet-submit"]').attributes('disabled')).is.not.undefined;
  });

  it('pays for an option of a choice as that option', async () => {
    const input = payment(3, {heat: true});
    const choice = {type: 'or', title: 'Select one option', buttonLabel: 'OK', options: [{type: 'option', title: 'Skip', buttonLabel: 'Skip'}, input]};
    const wrapper = mount(MobilePaymentSheet, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel({thisPlayer: fakePublicPlayerModel({megacredits: 25, heat: 12}), waitingFor: choice} as never),
        playerinput: input,
        entry: 1,
      },
    });
    expect(wrapper.find('[data-test="payment-sheet-cancel"]').exists()).is.true;
    await wrapper.find('[data-test="payment-sheet-submit"]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'or', index: 1});
    expect((posted[0] as {response: object}).response).deep.include({type: 'payment'});
  });

  it('can be cancelled only when the question is optional', async () => {
    expect(render(payment(3)).find('[data-test="payment-sheet-cancel"]').exists()).is.false;
    const wrapper = render(payment(3, {}, true));
    await wrapper.find('[data-test="payment-sheet-cancel"]').trigger('click');
    expect(wrapper.emitted('close')).has.length(1);
  });
});
