import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileTabBar from '@/client/components/mobile/MobileTabBar.vue';

describe('MobileTabBar', () => {
  function mount(props: Record<string, unknown> = {}) {
    return shallowMount(MobileTabBar, {
      ...globalConfig,
      props: {
        tab: 'board',
        sheetOpen: false,
        cardsInHandCount: 0,
        actionWaiting: false,
        ...props,
      },
    });
  }

  it('mounts without errors', () => {
    expect(mount().exists()).is.true;
  });

  it('Act lights up for a sheet raised over another pane, which stays lit too', () => {
    const wrapper = mount({tab: 'log', sheetOpen: true});
    expect(wrapper.vm.isSelected('actions')).is.true;
    expect(wrapper.vm.isSelected('log')).is.true;
    expect(wrapper.vm.isSelected('board')).is.false;
  });

  it('Act is also a tab of its own, when it holds the turn\'s menu', () => {
    const wrapper = mount({tab: 'actions', sheetOpen: false});
    expect(wrapper.vm.isSelected('actions')).is.true;
    expect(wrapper.vm.isSelected('board')).is.false;
  });

  it('badges the hand count and a waiting action', () => {
    const wrapper = mount({cardsInHandCount: 8, actionWaiting: true});
    expect(wrapper.vm.badge('cards')).eq('8');
    expect(wrapper.vm.badge('actions')).eq('!');
    expect(wrapper.vm.badge('log')).eq('');
  });

  it('reports the tab the player picked', async () => {
    const wrapper = mount();
    await wrapper.find('[data-test="tab-log"]').trigger('click');
    expect(wrapper.emitted('select')?.[0]).deep.eq(['log']);
  });
});
