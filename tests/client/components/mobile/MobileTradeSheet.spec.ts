import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel} from '../testHelpers';
import MobileTradeSheet from '@/client/components/mobile/MobileTradeSheet.vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {menu, option, trade} from './menuFixtures';

describe('MobileTradeSheet', () => {
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

  function render(name: ColonyName, fees?: Array<string>, count = 1) {
    const playerView = fakePlayerViewModel({waitingFor: menu(option('Pass for this generation', 'pass'), trade(['Luna', 'Io'], fees))} as never);
    playerView.game.colonies = [{name: 'Luna', colonies: [], isActive: true, trackPosition: 1, visitor: undefined} as never];
    return mount(MobileTradeSheet, {
      ...globalConfig,
      props: {playerView, name, position: 0, count},
      global: {...globalConfig.global, stubs: {Colony: true}},
    });
  }

  it('shows the colony with a choice of fee', () => {
    const wrapper = render(ColonyName.LUNA);
    expect(wrapper.find('[data-test=trade-sheet]').exists()).is.true;
    const fees = wrapper.findAll('[data-test=trade-sheet-fee]');
    expect(fees.map((fee) => fee.text())).deep.eq(['Pay 3 energy', 'Pay 9 M€']);
    expect(fees[0].attributes('aria-checked')).eq('true');
  });

  it('leaves the choice out when there is only one way to pay', () => {
    expect(render(ColonyName.LUNA, ['Pay 9 M€']).find('[data-test=trade-sheet-fees]').exists()).is.false;
  });

  it('answers the fee and the tile together, as the desktop\'s form does', async () => {
    const wrapper = render(ColonyName.LUNA);
    await wrapper.findAll('[data-test=trade-sheet-fee]')[1].trigger('click');
    await wrapper.find('[data-test=trade-sheet-submit]').trigger('click');
    await flushPromises();
    expect(posted[0]).deep.include({
      type: 'or',
      index: 1,
      response: {type: 'and', responses: [{type: 'or', index: 1, response: {type: 'option'}}, {type: 'colony', colonyName: 'Luna'}]},
    });
  });

  it('closes when the turn no longer offers the colony', () => {
    expect(render(ColonyName.EUROPA).emitted('close')).has.length(1);
  });

  it('turns to the next colony on a swipe left', () => {
    const wrapper = render(ColonyName.LUNA, undefined, 2);
    wrapper.vm.onSwipeStart({clientX: 200, clientY: 300} as PointerEvent);
    wrapper.vm.onSwipeEnd({clientX: 120, clientY: 305} as PointerEvent);
    expect(wrapper.emitted('next')).has.length(1);
  });
});
