import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel} from '../testHelpers';
import MobileAmountSheet from '@/client/components/mobile/MobileAmountSheet.vue';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {menu, option} from './menuFixtures';

describe('MobileAmountSheet', () => {
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

  function amount(fields: Partial<{min: number, max: number, maxByDefault: boolean, optional: boolean}> = {}): PlayerInputModel {
    return {
      type: 'amount',
      title: 'Select amount of heat production to decrease',
      buttonLabel: 'Decrease',
      min: 1,
      max: 10,
      maxByDefault: false,
      ...fields,
    } as PlayerInputModel;
  }

  function render(waitingFor: PlayerInputModel) {
    return mount(MobileAmountSheet, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel({waitingFor} as never)},
    });
  }

  const value = (wrapper: ReturnType<typeof render>) => wrapper.find('[data-test=amount-sheet-value]').text();

  it('starts at the end of the range the server asks for', () => {
    expect(value(render(amount()))).eq('1');
    expect(value(render(amount({maxByDefault: true})))).eq('10');
  });

  it('steps within the range and jumps to its ends', async () => {
    const wrapper = render(amount({min: 1, max: 3}));
    expect(wrapper.find('[data-test=amount-sheet-less]').attributes('disabled')).is.not.undefined;
    await wrapper.find('[data-test=amount-sheet-more]').trigger('click');
    expect(value(wrapper)).eq('2');
    await wrapper.find('[data-test=amount-sheet-max]').trigger('click');
    expect(value(wrapper)).eq('3');
    expect(wrapper.find('[data-test=amount-sheet-more]').attributes('disabled')).is.not.undefined;
    await wrapper.find('[data-test=amount-sheet-min]').trigger('click');
    expect(value(wrapper)).eq('1');
  });

  it('sends the number on its button', async () => {
    const wrapper = render(amount({maxByDefault: true}));
    const submit = wrapper.find('[data-test=amount-sheet-submit]');
    expect(submit.text()).eq('Decrease · 10');
    await submit.trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'amount', amount: 10});
    expect(wrapper.emitted('close')).has.length(1);
  });

  it('offers Cancel for a question that need not be answered now, and Close for one that must', () => {
    expect(render(amount()).find('[data-test=amount-sheet-cancel]').text()).eq('Close');
    expect(render(amount({optional: true})).find('[data-test=amount-sheet-cancel]').text()).eq('Cancel');
  });

  it('answers an option of a choice as that option', async () => {
    const choice = {type: 'or', title: 'Select one option', buttonLabel: 'OK', options: [option('Skip'), amount()]} as PlayerInputModel;
    const wrapper = mount(MobileAmountSheet, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel({waitingFor: choice} as never), entry: 1},
    });
    expect(wrapper.find('[data-test=amount-sheet-cancel]').exists()).is.true;
    await wrapper.find('[data-test=amount-sheet-submit]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({type: 'or', index: 1, response: {type: 'amount', amount: 1}});
  });

  it('closes when the question is not a number', () => {
    expect(render(menu(option('Pass for this generation', 'pass'))).emitted('close')).has.length(1);
  });
});
