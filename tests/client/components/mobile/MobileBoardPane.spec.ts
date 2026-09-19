import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileBoardPane from '@/client/components/mobile/MobileBoardPane.vue';
import {fakeGameModel} from '../testHelpers';

describe('MobileBoardPane', () => {
  function mount() {
    return shallowMount(MobileBoardPane, {
      ...globalConfig,
      props: {
        game: fakeGameModel(),
        tileView: 'show',
        tapTargets: false,
        belowOpen: false,
      },
    });
  }

  it('mounts without errors', () => {
    expect(mount().exists()).is.true;
  });

  it('scales the whole artwork as one unit', () => {
    const wrapper = mount();
    wrapper.vm.scale = 0.5;
    wrapper.vm.offsetX = 12;
    wrapper.vm.offsetY = 34;
    expect(wrapper.vm.stageStyle.transform).eq('translate(12px, 34px) scale(0.5)');
  });

  it('reports the tap-target size a hex actually has', () => {
    const wrapper = mount();
    wrapper.vm.scale = 0.62;
    expect(wrapper.vm.hexPixels).eq(29);
    expect(wrapper.vm.zoomPercent).eq(62);
  });

  it('draws the tap-target overlay only when asked', async () => {
    const wrapper = mount();
    expect(wrapper.find('.mobile-board-stage--tap-targets').exists()).is.false;
    await wrapper.setProps({tapTargets: true});
    expect(wrapper.find('.mobile-board-stage--tap-targets').exists()).is.true;
  });
});
