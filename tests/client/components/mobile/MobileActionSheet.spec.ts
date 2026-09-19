import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileActionSheet from '@/client/components/mobile/MobileActionSheet.vue';
import {fakePlayerViewModel} from '../testHelpers';

describe('MobileActionSheet', () => {
  function mount(props: Record<string, unknown> = {}) {
    return shallowMount(MobileActionSheet, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel(),
        snap: 'peek',
        peekEnabled: true,
        cardScale: 0.62,
        actionWaiting: false,
        ...props,
      },
    });
  }

  it('mounts without errors', () => {
    expect(mount().exists()).is.true;
  });

  it('computes its stops in pixels, leaving a fixed handle at peek', () => {
    const wrapper = mount();
    wrapper.vm.height = 600;

    expect(wrapper.vm.offsetFor('closed')).eq(600);
    expect(wrapper.vm.offsetFor('peek')).eq(554);
    expect(wrapper.vm.offsetFor('half')).eq(300);
    expect(wrapper.vm.offsetFor('full')).eq(24);
  });

  it('peek is the closed stop when the player turned peek off', () => {
    const wrapper = mount({peekEnabled: false});
    wrapper.vm.height = 600;
    expect(wrapper.vm.offsetFor('peek')).eq(600);
  });

  it('a drag settles on the nearest stop', () => {
    const wrapper = mount();
    wrapper.vm.height = 600;
    expect(wrapper.vm.nearestSnap(290)).eq('half');
    expect(wrapper.vm.nearestSnap(590)).eq('closed');
    expect(wrapper.vm.nearestSnap(40)).eq('full');
  });

  it('tapping the head toggles between half and peek', () => {
    const wrapper = mount();
    wrapper.vm.onHeadClick();
    expect(wrapper.emitted('update:snap')?.[0]).deep.eq(['half']);
  });
});
