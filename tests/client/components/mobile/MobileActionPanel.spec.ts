import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileActionPanel from '@/client/components/mobile/MobileActionPanel.vue';
import {fakePlayerViewModel} from '../testHelpers';

describe('MobileActionPanel', () => {
  function mount(props: Record<string, unknown> = {}) {
    return shallowMount(MobileActionPanel, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel(),
        mode: 'sheet',
        snap: 'closed',
        cardScale: 0.62,
        actionWaiting: false,
        ...props,
      },
    });
  }

  it('mounts without errors', () => {
    expect(mount().exists()).is.true;
  });

  it('computes its stops in pixels', () => {
    const wrapper = mount();
    wrapper.vm.height = 600;

    expect(wrapper.vm.offsetFor('closed')).eq(600);
    expect(wrapper.vm.offsetFor('half')).eq(300);
    expect(wrapper.vm.offsetFor('full')).eq(24);
  });

  it('a drag settles on the nearest stop', () => {
    const wrapper = mount();
    wrapper.vm.height = 600;
    expect(wrapper.vm.nearestSnap(290)).eq('half');
    expect(wrapper.vm.nearestSnap(590)).eq('closed');
    expect(wrapper.vm.nearestSnap(40)).eq('full');
  });

  /* No handle is left behind: a raised sheet goes all the way down. */
  it('tapping the head toggles between half and closed', async () => {
    const wrapper = mount();
    wrapper.vm.onHeadClick();
    expect(wrapper.emitted('update:snap')?.[0]).deep.eq(['half']);

    await wrapper.setProps({snap: 'full'});
    wrapper.vm.onHeadClick();
    expect(wrapper.emitted('update:snap')?.[1]).deep.eq(['closed']);
  });

  it('is a sheet, with a head to drag, for an opened entry or a question', () => {
    expect(mount({mode: 'sheet'}).find('[data-test="sheet-head"]').exists()).is.true;
  });

  it('is a plain pane while it holds the opening hand', () => {
    const wrapper = mount({mode: 'tab'});
    expect(wrapper.find('[data-test="sheet-head"]').exists()).is.false;
    expect(wrapper.find('[data-test="action-panel"]').classes()).includes('mobile-pane');
  });

  /* The head is removed with the sheet, and Vue leaves its ref behind as null, which
     is not the same thing as never having had one. */
  it('survives going back to being a tab', async () => {
    const wrapper = mount({mode: 'sheet'});
    await wrapper.setProps({mode: 'tab'});
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.boundHead).is.undefined;
  });

  it('says what a tap on the head will do', () => {
    expect(mount({snap: 'half'}).vm.hint).eq('Tap to close');
  });
});
