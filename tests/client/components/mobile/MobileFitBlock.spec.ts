import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileFitBlock from '@/client/components/mobile/MobileFitBlock.vue';

/**
 * Stands in for the frame and the block, which jsdom gives no size of their own.
 *
 * The block is measured with `offsetWidth`/`offsetHeight`, the layout box, which a
 * transform does not touch -- so unlike a bounding rectangle these do not move with
 * the scale already in force.
 */
function stub(wrapper: ReturnType<typeof mount>, available: number, natural: number, naturalHeight = 200) {
  const vm = wrapper.vm as unknown as {
    scale: number,
    natural: number,
    fit: () => void,
    $refs: {frame: HTMLElement, inner: HTMLElement},
  };
  Object.defineProperty(vm.$refs.frame, 'clientWidth', {value: available, configurable: true});
  Object.defineProperty(vm.$refs.inner, 'offsetWidth', {value: natural, configurable: true});
  Object.defineProperty(vm.$refs.inner, 'offsetHeight', {value: naturalHeight, configurable: true});
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

  /*
   * A transform paints the block smaller while it still reserves its full size, so the
   * block gives that room back itself. Without this the column below a scaled Turmoil
   * board would sit a screen further down than the board it follows.
   */
  it('reserves only the room the block is drawn in', () => {
    const wrapper = mount(MobileFitBlock, {...globalConfig});
    const vm = stub(wrapper, 374, 448, 300);
    vm.fit();

    const style = (wrapper.vm as unknown as {innerStyle: Record<string, string>}).innerStyle;
    expect(style.transform).eq(`scale(${374 / 448})`);
    // 300px tall, drawn at 374/448 of that: the margin takes back the rest.
    expect(parseFloat(style.marginBottom)).closeTo((374 / 448 - 1) * 300, 0.01);
  });

  it('is left alone entirely when it fits', () => {
    const wrapper = mount(MobileFitBlock, {...globalConfig});
    const vm = stub(wrapper, 390, 300);
    vm.fit();

    const style = (wrapper.vm as unknown as {innerStyle: Record<string, string>}).innerStyle;
    expect(style).to.deep.eq({});
  });
});
