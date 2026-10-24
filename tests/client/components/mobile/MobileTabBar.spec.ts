import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileTabBar from '@/client/components/mobile/MobileTabBar.vue';

describe('MobileTabBar', () => {
  function mount() {
    return shallowMount(MobileTabBar, {
      ...globalConfig,
      props: {view: 'turn'},
    });
  }

  it('mounts without errors', () => {
    expect(mount().exists()).is.true;
  });

  it('marks the view that is open', () => {
    const wrapper = mount();
    expect(wrapper.find('[data-test="view-turn"]').attributes('aria-selected')).eq('true');
    expect(wrapper.find('[data-test="view-log"]').attributes('aria-selected')).eq('false');
  });

  it('switches the view', async () => {
    const wrapper = mount();
    await wrapper.find('[data-test="view-log"]').trigger('click');
    expect(wrapper.emitted('update:view')).deep.eq([['log']]);
  });

  it('shows a count over a tab with something waiting', () => {
    const wrapper = shallowMount(MobileTabBar, {
      ...globalConfig,
      props: {view: 'turn', badges: {cards: '2'}},
    });
    expect(wrapper.find('[data-test="badge-cards"]').text()).eq('2');
    expect(wrapper.find('[data-test="badge-log"]').exists()).is.false;
  });
});
