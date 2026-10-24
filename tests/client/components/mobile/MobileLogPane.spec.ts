import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileLogPane from '@/client/components/mobile/MobileLogPane.vue';
import {LogEvent} from '@/client/components/mobile/MobileLog';
import {CardName} from '@/common/cards/CardName';

describe('MobileLogPane', () => {
  function mount(generations: Array<number>, loading = false, events: Array<LogEvent> = []) {
    return shallowMount(MobileLogPane, {
      ...globalConfig,
      props: {
        generations: generations.map((generation) => ({generation, events})),
        players: [],
        now: 0,
        loading,
      },
    });
  }

  it('heads each generation', () => {
    const wrapper = mount([5, 4]);
    const groups = wrapper.findAll('[data-test="log-generation"]');
    expect(groups).has.length(2);
    expect(groups[0].text()).contains('Generation 5');
  });

  it('offers the generation before the earliest one fetched', async () => {
    const wrapper = mount([5, 4]);
    const earlier = wrapper.find('[data-test="log-earlier"]');
    expect(earlier.text()).eq('Show generation 3');
    await earlier.trigger('click');
    expect(wrapper.emitted('loadEarlier')).has.length(1);
  });

  it('passes on a tap on a row that names cards', () => {
    const comet: LogEvent = {
      key: 'k', generation: 5, title: 'Played Comet', color: 'red', icon: 'layers', timestamp: 0, private: false, effects: undefined, cards: [CardName.COMET],
    };
    const wrapper = mount([5], false, [comet]);
    wrapper.findComponent({name: 'MobileLogRow'}).vm.$emit('inspect', comet);
    expect(wrapper.emitted('inspect')).deep.eq([[comet]]);
  });

  it('has nothing earlier to offer at generation 1, or while loading', () => {
    expect(mount([2, 1]).find('[data-test="log-earlier"]').exists()).is.false;
    expect(mount([5], true).find('[data-test="log-earlier"]').exists()).is.false;
  });
});
