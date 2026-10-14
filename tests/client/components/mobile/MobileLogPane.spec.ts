import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileLogPane from '@/client/components/mobile/MobileLogPane.vue';

describe('MobileLogPane', () => {
  function mount(generations: Array<number>, loading = false) {
    return shallowMount(MobileLogPane, {
      ...globalConfig,
      props: {
        generations: generations.map((generation) => ({generation, events: []})),
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

  it('has nothing earlier to offer at generation 1, or while loading', () => {
    expect(mount([2, 1]).find('[data-test="log-earlier"]').exists()).is.false;
    expect(mount([5], true).find('[data-test="log-earlier"]').exists()).is.false;
  });
});
