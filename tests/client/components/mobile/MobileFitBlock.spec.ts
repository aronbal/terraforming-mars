import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileFitBlock from '@/client/components/mobile/MobileFitBlock.vue';

/** Stands in for the frame and the block, which jsdom gives no size of their own. */
function stub(wrapper: ReturnType<typeof mount>, available: number, natural: number) {
  const vm = wrapper.vm as unknown as {
    scale: number,
    fit: () => void,
    $refs: {frame: HTMLElement, inner: HTMLElement},
  };
  Object.defineProperty(vm.$refs.frame, 'clientWidth', {value: available, configurable: true});
  vm.$refs.inner.getBoundingClientRect = () => ({width: natural * vm.scale} as DOMRect);
  return vm;
}

describe('MobileFitBlock', () => {
  it('mounts without errors', () => {
    const wrapper = mount(MobileFitBlock, {...globalConfig});
    expect(wrapper.exists()).is.true;
  });

  it('leaves a block that already fits alone', () => {
    const wrapper = mount(MobileFitBlock, {...globalConfig});
    const vm = stub(wrapper, 390, 300);
    vm.fit();
    expect(vm.scale).eq(1);
  });

  it('scales a block down to the width it has', () => {
    const wrapper = mount(MobileFitBlock, {...globalConfig});
    const vm = stub(wrapper, 374, 448);
    vm.fit();
    expect(vm.scale).closeTo(374 / 448, 0.001);
  });

  it('settles: measuring again at the new scale does not move it', () => {
    const wrapper = mount(MobileFitBlock, {...globalConfig});
    const vm = stub(wrapper, 374, 448);
    vm.fit();
    const first = vm.scale;
    vm.fit();
    expect(vm.scale).eq(first);
  });

  it('stops shrinking once the block would be unreadable', () => {
    const wrapper = mount(MobileFitBlock, {...globalConfig});
    // Turmoil is around 1000px wide whatever the viewport. Scrolling it beats
    // shrinking it to a third of its size.
    const vm = stub(wrapper, 374, 1017);
    vm.fit();
    expect(vm.scale).eq(0.55);
  });

  it('ignores a frame it cannot measure', () => {
    const wrapper = mount(MobileFitBlock, {...globalConfig});
    const vm = stub(wrapper, 0, 448);
    vm.fit();
    expect(vm.scale).eq(1);
  });
});
